/**
 * WASM Module Loader - Lite Variant
 * Handles initialization and caching of the SyncKit WASM module (Lite variant)
 * @module wasm-loader-lite
 */

import { WASMError } from './types'

// WASM module types (from generated bindings)
export interface WASMModule {
  WasmDocument: {
    new (id: string): WasmDocument
  }
  WasmVectorClock: {
    new (): WasmVectorClock
  }
  init_panic_hook(): void
}

export interface WasmDocument {
  getId(): string
  setField(path: string, valueJson: string, clock: bigint, clientId: string): void
  getField(path: string): string | undefined
  deleteField(path: string): void
  fieldCount(): number
  toJSON(): string
  merge(other: WasmDocument): void
  free(): void
}

export interface WasmVectorClock {
  tick(clientId: string): void
  update(clientId: string, clock: bigint): void
  get(clientId: string): bigint
  merge(other: WasmVectorClock): void
  toJSON(): string
  free(): void
}

// Singleton WASM instance
let wasmModule: WASMModule | null = null
let initPromise: Promise<WASMModule> | null = null

/**
 * Initialize the WASM module (Lite variant)
 * Uses singleton pattern - subsequent calls return cached instance
 */
export async function initWASM(): Promise<WASMModule> {
  // Return cached instance if already loaded
  if (wasmModule) {
    return wasmModule
  }

  // Return in-flight promise if initialization in progress
  if (initPromise) {
    return initPromise
  }

  // Start initialization
  initPromise = (async () => {
    try {
      // Dynamic import of WASM module from the lite variant directory
      const wasm = await import('../wasm/lite/synckit_core.js')

      // Initialize WASM module
      await wasm.default()

      // Install panic hook for better error messages
      wasm.init_panic_hook()

      return wasm as WASMModule
    } catch (error) {
      initPromise = null // Reset so retry is possible
      if (error instanceof WASMError) throw error
      throw new WASMError(`Failed to initialize WASM: ${error}`)
    }
  })()

  wasmModule = await initPromise
  return wasmModule
}

/**
 * Check if WASM module is initialized
 */
export function isWASMInitialized(): boolean {
  return wasmModule !== null
}

/**
 * Reset WASM instance (mainly for testing)
 */
export function resetWASM(): void {
  wasmModule = null
  initPromise = null
}
