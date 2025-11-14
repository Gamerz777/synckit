#!/usr/bin/env node
/**
 * Direct Integration Test for Phase 6 WASM ↔ SDK
 * Tests WASM loading and SDK functionality without browser/dev server
 * 
 * Run with: node sdk/tests/integration-test.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Phase 6 Integration Test - Direct WASM Loading\n');

// Test counter
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    failed++;
  }
}

// Test 1: WASM files exist
console.log('📦 Testing WASM Files...\n');

test('WASM binary exists', () => {
  const wasmPath = join(__dirname, '../wasm/synckit_core_bg.wasm');
  const stats = readFileSync(wasmPath);
  if (stats.length === 0) throw new Error('WASM file is empty');
  console.log(`   Size: ${(stats.length / 1024).toFixed(2)} KB`);
});

test('WASM JS bindings exist', () => {
  const jsPath = join(__dirname, '../wasm/synckit_core.js');
  const content = readFileSync(jsPath, 'utf-8');
  if (!content.includes('WebAssembly')) throw new Error('Missing WASM initialization code');
});

test('WASM TypeScript definitions exist', () => {
  const dtsPath = join(__dirname, '../wasm/synckit_core.d.ts');
  const content = readFileSync(dtsPath, 'utf-8');
  if (!content.includes('WasmDocument')) throw new Error('Missing type definitions');
});

// Test 2: SDK Build Output
console.log('\n🔨 Testing SDK Build...\n');

test('SDK dist folder exists with index.js', () => {
  const distPath = join(__dirname, '../dist/index.js');
  const content = readFileSync(distPath, 'utf-8');
  if (content.length === 0) throw new Error('index.js is empty');
  console.log(`   Size: ${(content.length / 1024).toFixed(2)} KB`);
});

test('SDK dist folder has ESM build', () => {
  const distPath = join(__dirname, '../dist/index.mjs');
  const content = readFileSync(distPath, 'utf-8');
  if (content.length === 0) throw new Error('index.mjs is empty');
});

test('SDK has React adapters', () => {
  const distPath = join(__dirname, '../dist/adapters/react.js');
  const content = readFileSync(distPath, 'utf-8');
  if (!content.includes('useSyncDocument')) throw new Error('Missing React hooks');
});

// Test 3: Direct WASM Import
console.log('\n⚡ Testing Direct WASM Import...\n');

await asyncTest('Import WASM module directly', async () => {
  const wasmPath = join(__dirname, '../wasm/synckit_core.js');
  const wasm = await import(wasmPath);
  
  if (!wasm.default) throw new Error('Missing default export');
  if (!wasm.init_panic_hook) throw new Error('Missing panic hook');
  
  // Initialize WASM
  await wasm.default();
  wasm.init_panic_hook();
  
  console.log('   WASM initialized successfully');
});

await asyncTest('Create WasmDocument', async () => {
  const wasmPath = join(__dirname, '../wasm/synckit_core.js');
  const wasm = await import(wasmPath);
  await wasm.default();
  
  const doc = new wasm.WasmDocument('test-doc');
  const id = doc.getId();
  
  if (id !== 'test-doc') throw new Error(`Expected 'test-doc', got '${id}'`);
  
  doc.free(); // Clean up
});

await asyncTest('Document operations', async () => {
  const wasmPath = join(__dirname, '../wasm/synckit_core.js');
  const wasm = await import(wasmPath);
  await wasm.default();
  
  const doc = new wasm.WasmDocument('test-doc');
  
  // Set field
  doc.setField('name', JSON.stringify('Alice'), BigInt(1), 'client1');
  
  // Get field
  const value = doc.getField('name');
  if (!value) throw new Error('Failed to get field');
  
  const parsed = JSON.parse(value);
  if (parsed !== 'Alice') throw new Error(`Expected 'Alice', got '${parsed}'`);
  
  // Delete field
  doc.deleteField('name');
  const deleted = doc.getField('name');
  if (deleted !== undefined) throw new Error('Field should be deleted');
  
  doc.free();
});

// Test 4: SDK Integration (if built)
console.log('\n🎯 Testing SDK Integration...\n');

await asyncTest('Import SDK package', async () => {
  try {
    // Try to import from built package
    const { SyncKit } = await import('../dist/index.mjs');
    if (!SyncKit) throw new Error('SyncKit not exported');
    console.log('   SDK exports found');
  } catch (error) {
    if (error.message.includes('Cannot find module')) {
      throw new Error('SDK not built yet - run: cd sdk && npm run build');
    }
    throw error;
  }
});

await asyncTest('Initialize SDK with memory storage', async () => {
  const { SyncKit } = await import('../dist/index.mjs');
  
  const sync = new SyncKit({ 
    storage: 'memory',
    name: 'test-db'
  });
  
  await sync.init();
  
  if (!sync.isInitialized()) throw new Error('SDK not initialized');
  
  const clientId = sync.getClientId();
  if (!clientId) throw new Error('Missing client ID');
  
  console.log(`   Client ID: ${clientId}`);
});

await asyncTest('Create and manipulate document', async () => {
  const { SyncKit } = await import('../dist/index.mjs');
  
  const sync = new SyncKit({ storage: 'memory', name: 'test-db' });
  await sync.init();
  
  const doc = sync.document('test-doc');
  await doc.init();
  
  // Set field
  await doc.set('name', 'Bob');
  
  // Get field
  const name = doc.getField('name');
  if (name !== 'Bob') throw new Error(`Expected 'Bob', got '${name}'`);
  
  // Update
  await doc.update({ age: 25, city: 'NYC' });
  
  const state = doc.get();
  if (state.age !== 25) throw new Error('Update failed');
  if (state.city !== 'NYC') throw new Error('Update failed');
  
  // Delete field
  await doc.delete('city');
  const afterDelete = doc.get();
  if ('city' in afterDelete) throw new Error('Delete failed');
  
  doc.dispose();
});

await asyncTest('Document persistence and retrieval', async () => {
  const { SyncKit } = await import('../dist/index.mjs');
  
  const sync = new SyncKit({ storage: 'memory', name: 'test-db' });
  await sync.init();
  
  // Create document
  const doc1 = sync.document('persist-test');
  await doc1.init();
  await doc1.set('value', 'persistent');
  
  // List documents
  const docs = await sync.listDocuments();
  if (!docs.includes('persist-test')) throw new Error('Document not in list');
  
  // Get same document again
  const doc2 = sync.document('persist-test');
  const value = doc2.getField('value');
  if (value !== 'persistent') throw new Error('Data not persisted');
  
  doc1.dispose();
  doc2.dispose();
});

await asyncTest('Document subscribe/unsubscribe', async () => {
  const { SyncKit } = await import('../dist/index.mjs');
  
  const sync = new SyncKit({ storage: 'memory', name: 'test-db' });
  await sync.init();
  
  const doc = sync.document('subscribe-test');
  await doc.init();
  
  let callCount = 0;
  const callback = () => { callCount++; };
  
  // Subscribe
  const unsubscribe = doc.subscribe(callback);
  
  // Trigger change
  await doc.set('test', 'value');
  
  if (callCount === 0) throw new Error('Callback not called');
  
  // Unsubscribe
  unsubscribe();
  
  const beforeCount = callCount;
  await doc.set('test', 'value2');
  
  if (callCount !== beforeCount) throw new Error('Callback called after unsubscribe');
  
  doc.dispose();
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Test Summary\n');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 ALL TESTS PASSED! Phase 6 integration is working!\n');
  console.log('Next steps:');
  console.log('1. Commit these changes');
  console.log('2. Update ROADMAP.md to mark Phase 6 as verified');
  console.log('3. Proceed to Phase 7 (TypeScript Reference Server)\n');
  process.exit(0);
} else {
  console.log('\n❌ SOME TESTS FAILED. Fix issues before proceeding.\n');
  process.exit(1);
}
