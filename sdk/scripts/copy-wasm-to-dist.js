#!/usr/bin/env node
/**
 * Copy WASM files from wasm/ directory to dist/ for bundler compatibility
 * This ensures the .wasm files are alongside the bundled JS files
 */

const fs = require('fs');
const path = require('path');

const wasmDir = path.join(__dirname, '../wasm/default');
const distDir = path.join(__dirname, '../dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('❌ dist directory not found. Run build first.');
  process.exit(1);
}

console.log('Copying WASM files to dist...\n');

// Files to copy (default variant for main bundle)
const files = ['synckit_core_bg.wasm'];

let copied = 0;
files.forEach(file => {
  const src = path.join(wasmDir, file);
  const dest = path.join(distDir, file);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    const stats = fs.statSync(dest);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`✅ ${file} copied to dist/ (${sizeKB} KB)`);
    copied++;
  } else {
    console.warn(`⚠️  ${file} not found in ${wasmDir}`);
  }
});

if (copied === files.length) {
  console.log('\n✅ WASM files copied to dist/');
} else {
  console.log(`\n⚠️  ${copied}/${files.length} files copied`);
}
