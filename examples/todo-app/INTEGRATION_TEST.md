# SyncKit Integration Test Checklist

## ✅ Completed Pre-Tests

### 1. Build & Compilation
- [x] WASM files present in `sdk/wasm/`
  - [x] synckit_core.js
  - [x] synckit_core_bg.wasm
  - [x] synckit_core.d.ts
- [x] WASM loader updated (no placeholder code)
- [x] React hooks exported from SDK
- [x] Dev server starts without errors
- [x] No TypeScript compilation errors

## 🧪 Manual Browser Tests

### 2. WASM Loading (Critical)
Open browser console at http://localhost:3001 and verify:

```javascript
// Should see: "SyncKit initialized successfully" or similar
// Should NOT see: "WASM module not yet linked" error
```

**Expected:** WASM loads, no errors
**Actual:** _[TODO: Fill after manual test]_

---

### 3. Basic Document Operations

#### Create Todo
1. Type "Test todo" in the input field
2. Click "Add Todo"

**Expected:** Todo appears in the list instantly
**Actual:** _[TODO: Fill after manual test]_

#### Read Todo
1. Check if the todo text is displayed correctly
2. Open browser DevTools → Application → IndexedDB → synckit
3. Verify document is stored

**Expected:** Todo visible in UI and IndexedDB
**Actual:** _[TODO: Fill after manual test]_

#### Update Todo
1. Click checkbox to mark todo as complete
2. Verify strikethrough styling appears

**Expected:** Visual feedback, state updated
**Actual:** _[TODO: Fill after manual test]_

#### Delete Todo
1. Click "Delete" button on a todo
2. Verify it disappears

**Expected:** Todo removed from UI and storage
**Actual:** _[TODO: Fill after manual test]_

---

### 4. Data Persistence
1. Create several todos
2. Refresh the page (Ctrl+R)
3. Verify todos are still there

**Expected:** All todos persist after refresh
**Actual:** _[TODO: Fill after manual test]_

---

### 5. Multi-Tab Sync (Local)
1. Open app in two browser tabs side-by-side
2. Add a todo in Tab 1
3. Check if it appears in Tab 2

**Expected:** Changes appear in other tab (storage event)
**Actual:** _[TODO: Fill after manual test]_

---

### 6. Filter Views
1. Create mix of completed and incomplete todos
2. Click "Active" filter
3. Verify only incomplete todos show
4. Click "Completed" filter
5. Verify only completed todos show
6. Click "All" filter
7. Verify all todos show

**Expected:** Filters work correctly
**Actual:** _[TODO: Fill after manual test]_

---

### 7. Bulk Operations
1. Create 3+ todos
2. Mark some as complete
3. Click "Clear Completed"
4. Verify only completed todos removed

**Expected:** Only completed todos deleted
**Actual:** _[TODO: Fill after manual test]_

---

## 🔍 Advanced Tests

### 8. Performance Check

Open browser console and run:

```javascript
// Test document operations performance
console.time('100 operations')
for (let i = 0; i < 100; i++) {
  // Add todos via UI rapidly
}
console.timeEnd('100 operations')
```

**Expected:** <100ms for 100 operations
**Actual:** _[TODO: Fill after manual test]_

---

### 9. Memory Check

```javascript
// Check memory usage
console.log(performance.memory)
// Create 100 todos, then check again
```

**Expected:** Reasonable memory usage (<10MB increase)
**Actual:** _[TODO: Fill after manual test]_

---

### 10. WASM Bundle Size

Check Network tab in DevTools:
- Find `synckit_core_bg.wasm`
- Check transfer size

**Expected:** ~51KB gzipped (as documented)
**Actual:** _[TODO: Fill after manual test]_

---

## 🐛 Known Issues to Watch For

### Potential Issues:
1. **WASM loading errors** - Check console for "Failed to initialize WASM"
2. **Type mismatches** - BigInt handling between Rust and JS
3. **Storage errors** - IndexedDB quota or permission issues
4. **Memory leaks** - Subscriptions not cleaned up properly
5. **React warnings** - Key props, hook dependencies

### If You See Errors:

#### "WASM module not yet linked"
- WASM loader still has placeholder code
- Check `sdk/src/wasm-loader.ts` line 70-80

#### "Cannot read property of undefined"
- WASM bindings might not match TypeScript interfaces
- Check type definitions in `sdk/wasm/synckit_core.d.ts`

#### "QuotaExceededError"
- IndexedDB storage limit reached
- Clear browser data or use smaller dataset

#### "Module not found: '@synckit/sdk'"
- React hooks not exported from main index
- Check `sdk/src/index.ts` exports

---

## ✅ Success Criteria

All tests pass if:
- [x] WASM loads without errors
- [x] All CRUD operations work
- [x] Data persists after refresh
- [x] Multi-tab sync works (local storage events)
- [x] No console errors
- [x] Performance targets met (<100ms operations)
- [x] Bundle size reasonable (~51KB WASM)

---

## 🚀 Next Steps After Passing Tests

If all tests pass:
1. **Document findings** - Note any issues or improvements
2. **Optimize if needed** - Bundle size, performance tweaks
3. **Add more examples** - Different use cases
4. **Proceed to Phase 7** - Build WebSocket server for real-time sync

If tests fail:
1. **Document errors** - Exact error messages and steps to reproduce
2. **Fix issues** - Debug and resolve
3. **Re-test** - Verify fixes work
4. **Update ROADMAP.md** - Document any changes

---

## 📝 Test Results

**Tester:** _________________  
**Date:** _________________  
**Browser:** _________________  
**OS:** _________________

**Overall Status:** 🟡 Not Yet Tested

**Notes:**
_[Add any observations, issues, or suggestions here]_
