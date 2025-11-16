/**
 * Test Client Utilities
 * 
 * Wrapper around SyncKit SDK for integration testing
 */

import { SyncKit } from '../../../sdk/src/synckit';
import { SyncDocument } from '../../../sdk/src/document';
import { TEST_CONFIG, getWebSocketUrl, generateTestId, sleep } from '../config';

/**
 * Test client configuration
 */
export interface TestClientConfig {
  clientId?: string;
  userId?: string;
  autoConnect?: boolean;
  token?: string;
}

/**
 * Test client wrapper
 */
export class TestClient {
  private sdk: SyncKit | null = null;
  public readonly clientId: string;
  public readonly userId: string;
  private connected: boolean = false;
  private ws: WebSocket | null = null;

  constructor(config: TestClientConfig = {}) {
    this.clientId = config.clientId || generateTestId('client');
    this.userId = config.userId || generateTestId('user');
  }

  /**
   * Initialize SDK
   */
  async init(): Promise<void> {
    if (this.sdk) {
      throw new Error('Client already initialized');
    }

    this.sdk = new SyncKit({
      clientId: this.clientId,
    });

    await this.sdk.init();

    if (TEST_CONFIG.features.verbose) {
      console.log(`[TestClient:${this.clientId}] Initialized`);
    }
  }

  /**
   * Connect to test server via WebSocket
   */
  async connect(token?: string): Promise<void> {
    if (!this.sdk) {
      throw new Error('Client not initialized');
    }

    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      const wsUrl = getWebSocketUrl();
      this.ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, TEST_CONFIG.timeouts.connection);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.connected = true;

        // Send auth message if token provided
        if (token) {
          this.ws!.send(JSON.stringify({
            type: 'AUTH',
            id: generateTestId('msg'),
            timestamp: Date.now(),
            token,
          }));
        }

        if (TEST_CONFIG.features.verbose) {
          console.log(`[TestClient:${this.clientId}] Connected`);
        }

        resolve();
      };

      this.ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };

      this.ws.onclose = () => {
        this.connected = false;
        if (TEST_CONFIG.features.verbose) {
          console.log(`[TestClient:${this.clientId}] Disconnected`);
        }
      };
    });
  }

  /**
   * Disconnect from server
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  /**
   * Get or create document
   */
  async getDocument<T = any>(documentId: string): Promise<SyncDocument<T>> {
    if (!this.sdk) {
      throw new Error('Client not initialized');
    }

    return this.sdk.document<T>(documentId);
  }

  /**
   * Set field in document
   */
  async setField<T = any>(
    documentId: string,
    field: string,
    value: any
  ): Promise<void> {
    const doc = await this.getDocument<T>(documentId);
    await doc.set(field as any, value);
  }

  /**
   * Get field from document
   */
  async getField<T = any>(
    documentId: string,
    field: string
  ): Promise<any> {
    const doc = await this.getDocument<T>(documentId);
    return doc.getField(field as any);
  }

  /**
   * Get entire document state
   */
  async getDocumentState<T = any>(documentId: string): Promise<T> {
    const doc = await this.getDocument<T>(documentId);
    return doc.get();
  }

  /**
   * Delete field from document
   */
  async deleteField<T = any>(
    documentId: string,
    field: string
  ): Promise<void> {
    const doc = await this.getDocument<T>(documentId);
    await doc.delete(field as any);
  }

  /**
   * Subscribe to document changes
   */
  async subscribeToDocument<T = any>(
    documentId: string,
    callback: (state: T) => void
  ): Promise<() => void> {
    const doc = await this.getDocument<T>(documentId);
    return doc.subscribe(callback);
  }

  /**
   * Wait for document to reach expected state
   */
  async waitForState<T = any>(
    documentId: string,
    expectedState: Partial<T>,
    timeout: number = TEST_CONFIG.timeouts.sync
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const currentState = await this.getDocumentState<T>(documentId);
      
      // Check if all expected fields match
      let matches = true;
      for (const [key, value] of Object.entries(expectedState)) {
        if ((currentState as any)[key] !== value) {
          matches = false;
          break;
        }
      }

      if (matches) {
        return;
      }

      await sleep(100);
    }

    throw new Error(`Timeout waiting for document state after ${timeout}ms`);
  }

  /**
   * Wait for field to have expected value
   */
  async waitForField(
    documentId: string,
    field: string,
    expectedValue: any,
    timeout: number = TEST_CONFIG.timeouts.sync
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const value = await this.getField(documentId, field);
      
      if (value === expectedValue) {
        return;
      }

      await sleep(100);
    }

    throw new Error(`Timeout waiting for field '${field}' to equal ${expectedValue} after ${timeout}ms`);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.disconnect();

    if (this.sdk) {
      await this.sdk.clearAll();
      this.sdk = null;
    }

    if (TEST_CONFIG.features.verbose) {
      console.log(`[TestClient:${this.clientId}] Cleaned up`);
    }
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get client ID
   */
  get id(): string {
    return this.clientId;
  }
}

/**
 * Create multiple test clients
 */
export async function createTestClients(count: number): Promise<TestClient[]> {
  const clients: TestClient[] = [];
  
  for (let i = 0; i < count; i++) {
    const client = new TestClient({
      userId: TEST_CONFIG.testData.userIds[i % TEST_CONFIG.testData.userIds.length],
    });
    await client.init();
    clients.push(client);
  }

  return clients;
}

/**
 * Cleanup multiple test clients
 */
export async function cleanupTestClients(clients: TestClient[]): Promise<void> {
  await Promise.all(clients.map(client => client.cleanup()));
}
