# Testing Guide for SyncKit Applications

Learn how to comprehensively test offline-first applications with distributed sync.

---

## Table of Contents

1. [Introduction to Testing Sync Applications](#introduction-to-testing-sync-applications)
2. [Unit Testing CRDT Operations](#unit-testing-crdt-operations)
3. [Property-Based Testing for CRDTs](#property-based-testing-for-crdts)
4. [Network Condition Testing](#network-condition-testing)
5. [Chaos Engineering](#chaos-engineering)
6. [Multi-Client E2E Testing](#multi-client-e2e-testing)
7. [Performance and Load Testing](#performance-and-load-testing)
8. [Testing State Management Integration](#testing-state-management-integration)
9. [CI/CD Integration](#cicd-integration)
10. [Debugging and Troubleshooting](#debugging-and-troubleshooting)

---

## Introduction to Testing Sync Applications

### Why Testing Sync is Harder

Distributed sync applications have unique challenges:

| Challenge | Example | Impact |
|-----------|---------|--------|
| **Non-determinism** | Network timing varies | Flaky tests |
| **Concurrency** | Multiple clients editing | Race conditions |
| **State explosion** | Many possible sync states | Hard to cover all cases |
| **Time dependencies** | Conflict resolution based on timestamps | Hard to reproduce |
| **Network failures** | Offline, slow, packet loss | Edge cases missed |

**Traditional testing isn't enough.**

### Testing Philosophy

SyncKit testing follows these principles:

1. **Convergence is non-negotiable** - All clients must reach same state
2. **Network conditions define UX** - Test offline, slow, packet loss
3. **Chaos reveals edge cases** - Deliberately inject failures
4. **Multi-client E2E is critical** - Single-client tests miss sync bugs
5. **Property-based testing catches edge cases** - Generate thousands of scenarios

---

## Unit Testing CRDT Operations

### Testing Document Updates

```typescript
import { describe, test, expect, beforeEach } from 'bun:test'
import { SyncKit } from '@synckit/sdk'

describe('Document operations', () => {
  let sync: SyncKit

  beforeEach(async () => {
    // Use in-memory storage for fast tests
    sync = new SyncKit({ storage: 'memory', name: 'test' })
    await sync.init()
  })

  test('should create and read document', async () => {
    const todo = sync.document<Todo>('todo-1')
    await todo.init()

    await todo.update({
      id: 'todo-1',
      text: 'Buy milk',
      completed: false
    })

    const data = todo.get()

    expect(data.text).toBe('Buy milk')
    expect(data.completed).toBe(false)
  })

  test('should update document fields', async () => {
    const todo = sync.document<Todo>('todo-1')
    await todo.init()

    await todo.update({
      id: 'todo-1',
      text: 'Buy milk',
      completed: false
    })

    await todo.update({ completed: true })

    const data = todo.get()
    expect(data.completed).toBe(true)
    expect(data.text).toBe('Buy milk')  // Other fields unchanged
  })

  test('should handle partial updates', async () => {
    const todo = sync.document<Todo>('todo-1')
    await todo.init()

    await todo.update({
      id: 'todo-1',
      text: 'Buy milk',
      completed: false,
      priority: 'low'
    })

    // Update only one field
    await todo.update({ priority: 'high' })

    const data = todo.get()
    expect(data.priority).toBe('high')
    expect(data.text).toBe('Buy milk')
    expect(data.completed).toBe(false)
  })

  test('should delete document', async () => {
    const todo = sync.document<Todo>('todo-1')
    await todo.init()

    await todo.update({
      id: 'todo-1',
      text: 'Buy milk',
      completed: false
    })

    // Delete the entire document using sync.deleteDocument()
    await sync.deleteDocument('todo-1')

    // Verify document is deleted by checking if it's in the list
    const docs = await sync.listDocuments()
    expect(docs.includes('todo-1')).toBe(false)
  })
})
```

### Testing Subscriptions

```typescript
describe('Document subscriptions', () => {
  test('should receive updates via subscription', async () => {
    const todo = sync.document<Todo>('todo-1')
    await todo.init()

    // Track received updates
    const updates: Todo[] = []
    const unsubscribe = todo.subscribe(data => {
      updates.push(data)
    })

    // Initial set
    await todo.update({
      id: 'todo-1',
      text: 'Buy milk',
      completed: false
    })

    // Update
    await todo.update({ completed: true })

    // Wait for subscription to fire
    await new Promise(resolve => setTimeout(resolve, 10))

    // 3 updates: initial empty state, first update, second update
    expect(updates.length).toBeGreaterThanOrEqual(2)
    expect(updates[updates.length - 2].completed).toBe(false)
    expect(updates[updates.length - 1].completed).toBe(true)

    unsubscribe()
  })

  test('should unsubscribe correctly', async () => {
    const todo = sync.document<Todo>('todo-1')
    await todo.init()

    let callCount = 0
    const unsubscribe = todo.subscribe(() => {
      callCount++
    })

    await todo.update({ id: 'todo-1', text: 'Test', completed: false })

    // Unsubscribe
    unsubscribe()

    // This update should NOT trigger callback
    await todo.update({ completed: true })

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(callCount).toBe(2)  // Initial subscribe callback + one update
  })
})
```

### Testing Conflict Resolution

```typescript
describe('LWW conflict resolution', () => {
  test('should resolve conflicts with last-write-wins', async () => {
    const syncA = new SyncKit({ storage: 'memory', name: 'client-a' })
    const syncB = new SyncKit({ storage: 'memory', name: 'client-b' })
    await syncA.init()
    await syncB.init()

    const todoA = syncA.document<Todo>('todo-1')
    const todoB = syncB.document<Todo>('todo-1')
    await todoA.init()
    await todoB.init()

    // Initial state
    await todoA.update({
      id: 'todo-1',
      text: 'Original',
      completed: false
    })

    // Simulate offline conflict
    await todoA.update({ text: 'Version A' })  // Earlier timestamp
    await new Promise(resolve => setTimeout(resolve, 100))  // Wait 100ms
    await todoB.update({ text: 'Version B' })  // Later timestamp

    // Manually sync (merge documents)
    await todoA.merge(todoB)
    await todoB.merge(todoA)

    // Both should converge to Version B (later timestamp)
    const dataA = todoA.get()
    const dataB = todoB.get()

    expect(dataA.text).toBe('Version B')
    expect(dataB.text).toBe('Version B')
  })

  test('should resolve field-level conflicts independently', async () => {
    const syncA = new SyncKit({ storage: 'memory', name: 'client-a' })
    const syncB = new SyncKit({ storage: 'memory', name: 'client-b' })
    await syncA.init()
    await syncB.init()

    const todoA = syncA.document<Todo>('todo-1')
    const todoB = syncB.document<Todo>('todo-1')
    await todoA.init()
    await todoB.init()

    // Initial state
    await todoA.update({
      id: 'todo-1',
      text: 'Original',
      completed: false,
      priority: 'low'
    })

    // Client A updates text (earlier)
    await todoA.update({ text: 'A text' })

    await new Promise(resolve => setTimeout(resolve, 50))

    // Client B updates both text and priority (later)
    await todoB.update({ text: 'B text', priority: 'high' })

    // Sync (merge documents)
    await todoA.merge(todoB)
    await todoB.merge(todoA)

    const dataA = todoA.get()
    const dataB = todoB.get()

    // text: B wins (later timestamp)
    expect(dataA.text).toBe('B text')
    expect(dataB.text).toBe('B text')

    // priority: B wins (only B set it)
    expect(dataA.priority).toBe('high')
    expect(dataB.priority).toBe('high')
  })
})
```

---

## Property-Based Testing for CRDTs

### What is Property-Based Testing?

Instead of writing specific test cases, define **properties** that should always hold, then generate thousands of random test cases.

**Example property:** "After syncing, all clients must have identical state"

### Using fast-check

```typescript
import { test } from 'bun:test'
import * as fc from 'fast-check'

test('convergence property: all clients converge to same state', async () => {
  await fc.assert(
    fc.asyncProperty(
      // Generate random operations
      fc.array(
        fc.record({
          client: fc.integer({ min: 0, max: 2 }),  // 3 clients
          operation: fc.oneof(
            fc.record({
              type: fc.constant('update'),
              field: fc.constantFrom('text', 'completed', 'priority'),
              value: fc.oneof(
                fc.string(),
                fc.boolean(),
                fc.constantFrom('low', 'medium', 'high')
              )
            }),
            fc.record({
              type: fc.constant('delete')
            })
          ),
          delay: fc.integer({ min: 0, max: 100 })  // Random delay
        }),
        { minLength: 1, maxLength: 50 }
      ),
      async (operations) => {
        // Create 3 clients
        const clients = [
          new SyncKit({ storage: 'memory', name: 'client-0' }),
          new SyncKit({ storage: 'memory', name: 'client-1' }),
          new SyncKit({ storage: 'memory', name: 'client-2' })
        ]

        // Initialize all clients
        await Promise.all(clients.map(c => c.init()))

        const docs = clients.map(c => c.document<Todo>('todo-1'))
        await Promise.all(docs.map(d => d.init()))

        // Apply operations
        for (const op of operations) {
          const doc = docs[op.client]

          if (op.operation.type === 'update') {
            await doc.update({
              [op.operation.field]: op.operation.value
            })
          } else {
            // Delete entire document
            await clients[op.client].deleteDocument('todo-1')
          }

          // Random delay to simulate network jitter
          await new Promise(r => setTimeout(r, op.delay))
        }

        // Sync all clients (manually merge all documents)
        for (let i = 0; i < docs.length; i++) {
          for (let j = i + 1; j < docs.length; j++) {
            await docs[i].merge(docs[j])
            await docs[j].merge(docs[i])
          }
        }

        // PROPERTY: All clients must have identical state
        const states = docs.map(d => d.get())

        for (let i = 1; i < states.length; i++) {
          expect(states[i]).toEqual(states[0])
        }
      }
    ),
    { numRuns: 100 }  // Run 100 random scenarios
  )
})
```

### Commutativity Property

Test that operation order doesn't matter:

```typescript
test('commutativity property: operations can be applied in any order', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({
          field: fc.string(),
          value: fc.anything()
        }),
        { minLength: 2, maxLength: 10 }
      ),
      async (operations) => {
        const sync1 = new SyncKit({ storage: 'memory', name: 'sync1' })
        const sync2 = new SyncKit({ storage: 'memory', name: 'sync2' })
        await sync1.init()
        await sync2.init()

        // Apply operations in original order
        const doc1 = sync1.document<any>('test-1')
        await doc1.init()
        for (const op of operations) {
          await doc1.update({ [op.field]: op.value })
        }

        // Apply operations in reverse order
        const doc2 = sync2.document<any>('test-2')
        await doc2.init()
        for (const op of [...operations].reverse()) {
          await doc2.update({ [op.field]: op.value })
        }

        // PROPERTY: Final state should be identical (commutativity)
        const state1 = doc1.get()
        const state2 = doc2.get()

        expect(state1).toEqual(state2)
      }
    )
  )
})
```

### Idempotence Property

Test that applying same operation twice has no additional effect:

```typescript
test('idempotence property: applying operation twice = applying once', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        field: fc.string(),
        value: fc.anything()
      }),
      async (operation) => {
        const sync = new SyncKit({ storage: 'memory', name: 'test' })
        await sync.init()
        const doc = sync.document<any>('test-1')
        await doc.init()

        // Apply once
        await doc.update({ [operation.field]: operation.value })
        const stateAfterOne = doc.get()

        // Apply again
        await doc.update({ [operation.field]: operation.value })
        const stateAfterTwo = doc.get()

        // PROPERTY: State should be identical
        expect(stateAfterTwo).toEqual(stateAfterOne)
      }
    )
  )
})
```

---

## Network Condition Testing

**⚠️ IMPORTANT - v0.1.0 STATUS:**

The network testing examples in this section reference features **NOT YET IMPLEMENTED in v0.1.0**:
- ❌ Network sync (serverUrl, connect/disconnect)
- ❌ Offline queue (offlineQueue, queueSize)
- ❌ Network reconnection

**Current v0.1.0:** SyncKit works offline-only with local IndexedDB storage. Network sync features are planned for future versions.

### Simulating Offline/Online Transitions (Planned Feature)

```typescript
describe('Offline/online transitions', () => {
  test('should queue operations when offline', async () => {
    const sync = new SyncKit({
      serverUrl: 'ws://localhost:8080',
      offlineQueue: true
    })

    const todo = sync.document<Todo>('todo-1')

    // Go offline
    await sync.disconnect()

    // Make changes while offline
    await todo.update({ completed: true })
    await todo.update({ text: 'Updated offline' })

    // Check queue size
    expect(sync.queueSize).toBe(2)

    // Reconnect
    await sync.reconnect()

    // Wait for queue to flush
    await waitForQueueEmpty(sync)

    expect(sync.queueSize).toBe(0)
  })

  test('should handle rapid offline/online cycles', async () => {
    const sync = new SyncKit({ serverUrl: 'ws://localhost:8080' })
    const todo = sync.document<Todo>('todo-1')

    // Rapidly toggle connection
    for (let i = 0; i < 10; i++) {
      await sync.disconnect()
      await todo.update({ counter: i })
      await sync.reconnect()
      await new Promise(r => setTimeout(r, 50))
    }

    // All updates should eventually sync
    await waitForQueueEmpty(sync)

    const data = todo.get()
    expect(data.counter).toBe(9)
  })
})
```

### Network Throttling

```typescript
import { chromium } from 'playwright'

test('should handle slow 3G network', async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext()

  // Emulate slow 3G
  await context.route('**/*', route => {
    setTimeout(() => route.continue(), 500)  // 500ms delay
  })

  const page = await context.newPage()
  await page.goto('http://localhost:3000')

  // Perform operations
  await page.click('[data-testid="add-todo"]')
  await page.fill('[data-testid="todo-input"]', 'Test todo')
  await page.click('[data-testid="save"]')

  // Should still work, just slower
  await page.waitForSelector('[data-testid="todo-item"]', { timeout: 10000 })

  await browser.close()
})
```

### Packet Loss Simulation

```typescript
test('should handle 10% packet loss', async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext()

  // Drop 10% of requests randomly
  await context.route('**/*', route => {
    if (Math.random() < 0.1) {
      route.abort()  // Drop packet
    } else {
      route.continue()
    }
  })

  const page = await context.newPage()
  await page.goto('http://localhost:3000')

  // Make 100 updates
  for (let i = 0; i < 100; i++) {
    await page.click(`[data-testid="todo-${i}"]`)
  }

  // All updates should eventually succeed (with retries)
  await page.waitForFunction(() => {
    return document.querySelectorAll('[data-testid*="todo"]').length === 100
  }, { timeout: 30000 })

  await browser.close()
})
```

---

## Chaos Engineering

**⚠️ IMPORTANT - v0.1.0 STATUS:**

Chaos engineering examples below use network sync features **NOT YET IMPLEMENTED in v0.1.0**. These patterns will be applicable when network sync is released.

**Current v0.1.0:** Focus on testing local IndexedDB operations, conflict resolution with manual merges, and CRDT properties.

### Random Failure Injection (Planned Feature)

```typescript
describe('Chaos engineering', () => {
  test('should survive random disconnections', async () => {
    const sync = new SyncKit({ serverUrl: 'ws://localhost:8080' })
    const todo = sync.document<Todo>('todo-1')

    // Randomly disconnect/reconnect during operations
    const chaosMonkey = setInterval(() => {
      if (Math.random() < 0.3) {
        sync.disconnect()
        setTimeout(() => sync.reconnect(), Math.random() * 1000)
      }
    }, 500)

    // Perform 100 operations
    for (let i = 0; i < 100; i++) {
      await todo.update({ counter: i })
      await new Promise(r => setTimeout(r, 50))
    }

    clearInterval(chaosMonkey)

    // Reconnect and wait for stabilization
    await sync.reconnect()
    await waitForQueueEmpty(sync)

    // PROPERTY: Final state should be consistent
    const data = todo.get()
    expect(data.counter).toBe(99)
  })

  test('should handle network partition', async () => {
    // Simulate network partition: two groups can't communicate
    const groupA = [
      new SyncKit({ serverUrl: 'ws://server-a:8080' }),
      new SyncKit({ serverUrl: 'ws://server-a:8080' })
    ]

    const groupB = [
      new SyncKit({ serverUrl: 'ws://server-b:8080' }),
      new SyncKit({ serverUrl: 'ws://server-b:8080' })
    ]

    const docsA = groupA.map(s => s.document<Todo>('todo-1'))
    const docsB = groupB.map(s => s.document<Todo>('todo-1'))

    // Both groups make conflicting changes
    await docsA[0].update({ text: 'Group A' })
    await docsB[0].update({ text: 'Group B' })

    // Groups internally consistent
    await syncAllClients(docsA)
    await syncAllClients(docsB)

    // Heal partition
    await healPartition()

    // Sync everyone
    await syncAllClients([...docsA, ...docsB])

    // PROPERTY: All clients converge to same state
    const states = await Promise.all([
      ...docsA.map(d => d.get()),
      ...docsB.map(d => d.get())
    ])

    for (let i = 1; i < states.length; i++) {
      expect(states[i]).toEqual(states[0])
    }
  })
})
```

---

## Multi-Client E2E Testing

**⚠️ IMPORTANT - v0.1.0 STATUS:**

Multi-client E2E tests shown below demonstrate **future network sync functionality**. In v0.1.0, you can test multi-client scenarios by manually syncing documents using the `merge()` API.

### Using Playwright for Multi-Client Tests (Future Feature)

```typescript
import { test, chromium } from '@playwright/test'

test('should sync between multiple clients', async () => {
  const browser = await chromium.launch()

  // Create 3 clients
  const clients = await Promise.all([
    browser.newPage(),
    browser.newPage(),
    browser.newPage()
  ])

  // Open app in all clients
  await Promise.all(
    clients.map(page => page.goto('http://localhost:3000'))
  )

  // Client 1: Add a todo
  await clients[0].click('[data-testid="add-todo"]')
  await clients[0].fill('[data-testid="todo-input"]', 'Buy milk')
  await clients[0].click('[data-testid="save"]')

  // Client 2 & 3: Should see the todo appear
  await clients[1].waitForSelector('text=Buy milk')
  await clients[2].waitForSelector('text=Buy milk')

  // Client 2: Mark as completed
  await clients[1].click('[data-testid="todo-checkbox"]')

  // Client 1 & 3: Should see completion
  await clients[0].waitForSelector('[data-testid="todo-completed"]')
  await clients[2].waitForSelector('[data-testid="todo-completed"]')

  // Client 3: Delete todo
  await clients[2].click('[data-testid="delete-todo"]')

  // Client 1 & 2: Todo should disappear
  await clients[0].waitForSelector('text=Buy milk', { state: 'detached' })
  await clients[1].waitForSelector('text=Buy milk', { state: 'detached' })

  await browser.close()
})
```

### Concurrent Edit Testing

```typescript
test('should handle concurrent edits gracefully', async () => {
  const browser = await chromium.launch()

  const [client1, client2] = await Promise.all([
    browser.newPage(),
    browser.newPage()
  ])

  await Promise.all([
    client1.goto('http://localhost:3000'),
    client2.goto('http://localhost:3000')
  ])

  // Both clients edit the same field concurrently
  await Promise.all([
    client1.fill('[data-testid="todo-title"]', 'Version 1'),
    client2.fill('[data-testid="todo-title"]', 'Version 2')
  ])

  // Wait for sync
  await new Promise(r => setTimeout(r, 1000))

  // Both should converge to same value (LWW)
  const title1 = await client1.textContent('[data-testid="todo-title"]')
  const title2 = await client2.textContent('[data-testid="todo-title"]')

  expect(title1).toBe(title2)

  await browser.close()
})
```

---

## Performance and Load Testing

### Load Testing with Multiple Clients

```typescript
import { chromium } from 'playwright'

test('should handle 100 concurrent clients', async () => {
  const browser = await chromium.launch()
  const clients: Page[] = []

  // Spawn 100 clients
  for (let i = 0; i < 100; i++) {
    const page = await browser.newPage()
    await page.goto('http://localhost:3000')
    clients.push(page)
  }

  // Each client adds a todo
  await Promise.all(
    clients.map((page, i) =>
      page.evaluate(async (index) => {
        await sync.document(`todo-${index}`).update({
          id: `todo-${index}`,
          text: `Todo ${index}`,
          completed: false
        })
      }, i)
    )
  )

  // Verify all clients see all 100 todos
  for (const client of clients) {
    await client.waitForFunction(() => {
      return document.querySelectorAll('[data-testid^="todo-"]').length === 100
    }, { timeout: 30000 })
  }

  await browser.close()
}, { timeout: 120000 })
```

### Stress Testing

```typescript
test('should handle rapid updates', async () => {
  const sync = new SyncKit({ storage: 'memory', name: 'stress-test' })
  await sync.init()
  const todo = sync.document<Todo>('todo-1')
  await todo.init()

  await todo.update({
    id: 'todo-1',
    text: 'Test',
    completed: false,
    counter: 0
  })

  // 10,000 updates as fast as possible
  const start = performance.now()

  for (let i = 0; i < 10000; i++) {
    await todo.update({ counter: i })
  }

  const duration = performance.now() - start

  console.log(`10,000 updates in ${duration.toFixed(2)}ms`)
  console.log(`${(10000 / duration * 1000).toFixed(0)} ops/sec`)

  // Should complete in <10 seconds
  expect(duration).toBeLessThan(10000)
})
```

---

## Testing State Management Integration

### Testing with React

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { useSyncDocument } from '@synckit/sdk/react'

test('should sync state to React component', async () => {
  function TodoComponent() {
    const [todo, { update }] = useSyncDocument<Todo>('todo-1')

    if (!todo) return <div>Loading...</div>

    return (
      <div>
        <span data-testid="todo-text">{todo.text}</span>
        <button onClick={() => update({ completed: !todo.completed })}>
          Toggle
        </button>
      </div>
    )
  }

  // Initial setup
  const doc = sync.document<Todo>('todo-1')
  await doc.init()
  await doc.update({
    id: 'todo-1',
    text: 'Buy milk',
    completed: false
  })

  render(<TodoComponent />)

  // Should display initial state
  await waitFor(() => {
    expect(screen.getByTestId('todo-text')).toHaveTextContent('Buy milk')
  })

  // Click toggle button
  await userEvent.click(screen.getByText('Toggle'))

  // Update should propagate (no need to manually check)
  // React hook handles re-rendering automatically
})
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - name: Start server
        run: bun run server &
      - name: Wait for server
        run: npx wait-on http://localhost:8080
      - run: bun test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - name: Install Playwright
        run: bunx playwright install --with-deps
      - name: Start app
        run: bun run dev &
      - name: Wait for app
        run: npx wait-on http://localhost:3000
      - run: bun test:e2e

  property-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - name: Run property-based tests
        run: bun test:property
        env:
          FAST_CHECK_NUM_RUNS: 1000
```

---

## Debugging and Troubleshooting

### Debug Logging - Planned Feature

**⚠️ NOT YET IMPLEMENTED IN v0.1.0**

```typescript
// ⚠️ logLevel option doesn't exist in v0.1.0
const sync = new SyncKit({
  serverUrl: 'ws://localhost:8080',
  logLevel: 'debug'  // Not functional
})

// Logs all operations:
// [DEBUG] document.update: todo-1 { completed: true }
// [DEBUG] sync.send: delta { ... }
// [DEBUG] sync.receive: ack { ... }
```

**Current v0.1.0:** Use console.log for manual debugging:
```typescript
const todo = sync.document<Todo>('todo-1')
await todo.init()
console.log('Before update:', todo.get())
await todo.update({ completed: true })
console.log('After update:', todo.get())
```

### Inspecting State

```typescript
// Get current document state
const state = todo.get()
console.log('Current state:', state)

// List all documents
const docIds = await sync.listDocuments()
console.log('All documents:', docIds)

// Get client ID
const clientId = sync.getClientId()
console.log('Client ID:', clientId)
```

**Note:** Methods like `getMetadata()` and `exists()` are not available in v0.1.0. Use `listDocuments()` to check if a document exists.

### Common Test Failures

**"Test is flaky"**
- **Cause:** Not waiting for async operations
- **Fix:** Use `await` consistently, add proper waits

**"Convergence test fails"**
- **Cause:** Clients not fully synced
- **Fix:** Wait for queue to empty before asserting

**"Timeout in E2E test"**
- **Cause:** Network delays, server not ready
- **Fix:** Increase timeout, use `waitFor` patterns

---

## Summary

**Key Testing Strategies:**

1. **Unit tests** - Test CRDT operations in isolation
2. **Property-based tests** - Verify CRDT properties (convergence, commutativity, idempotence)
3. **Network tests** - Simulate offline, slow networks, packet loss
4. **Chaos tests** - Inject random failures, network partitions
5. **Multi-client E2E** - Test real-world collaboration scenarios
6. **Performance tests** - Verify scalability and load handling

**Essential Test Checklist:**

- ✅ Convergence: All clients reach same state
- ✅ Offline: Operations work without network
- ✅ Conflicts: LWW resolves correctly
- ✅ Multi-client: Real-time sync works
- ✅ Performance: Meets latency/throughput targets
- ✅ Edge cases: Network failures, rapid edits, partitions

**Next Steps:**

- Set up [CI/CD](#cicd-integration) for continuous testing
- Implement [property-based tests](#property-based-testing-for-crdts) for critical paths
- Add [chaos testing](#chaos-engineering) to catch edge cases

---

**Testing is your safety net! 🎯**
