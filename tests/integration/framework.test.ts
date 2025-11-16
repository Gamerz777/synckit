/**
 * Integration Test Framework Sanity Check
 * 
 * Verifies that the test framework itself is working correctly
 */

import { describe, it, expect } from 'bun:test';
import {
  setupTestSuite,
  createClient,
  createClients,
  getServer,
  assertServerHealth,
  assertDocumentState,
  assertFieldValue,
  TEST_CONFIG,
} from './setup';

describe('Integration Test Framework', () => {
  setupTestSuite();

  it('should start test server successfully', async () => {
    const server = getServer();
    expect(server).toBeDefined();
    expect(server.running).toBe(true);
  });

  it('should respond to health check', async () => {
    await assertServerHealth('healthy');
  });

  it('should create and initialize test client', async () => {
    const client = await createClient();
    
    expect(client).toBeDefined();
    expect(client.id).toBeDefined();
    expect(client.userId).toBeDefined();
  });

  it('should create multiple test clients', async () => {
    const clients = await createClients(3);
    
    expect(clients).toHaveLength(3);
    expect(clients[0].id).not.toBe(clients[1].id);
    expect(clients[1].id).not.toBe(clients[2].id);
  });

  it('should allow client to get document', async () => {
    const client = await createClient();
    const doc = await client.getDocument(TEST_CONFIG.testData.defaultDocumentId);
    
    expect(doc).toBeDefined();
  });

  it('should allow client to set and get field', async () => {
    const client = await createClient();
    const docId = TEST_CONFIG.testData.defaultDocumentId;
    
    await client.setField(docId, 'testField', 'testValue');
    const value = await client.getField(docId, 'testField');
    
    expect(value).toBe('testValue');
  });

  it('should allow client to set multiple fields', async () => {
    const client = await createClient();
    const docId = TEST_CONFIG.testData.defaultDocumentId;
    
    await client.setField(docId, 'field1', 'value1');
    await client.setField(docId, 'field2', 'value2');
    await client.setField(docId, 'field3', 'value3');
    
    const state = await client.getDocumentState(docId);
    
    expect(state).toEqual({
      field1: 'value1',
      field2: 'value2',
      field3: 'value3',
    });
  });

  it('should allow client to delete field', async () => {
    const client = await createClient();
    const docId = TEST_CONFIG.testData.defaultDocumentId;
    
    await client.setField(docId, 'tempField', 'tempValue');
    await client.deleteField(docId, 'tempField');
    
    const state = await client.getDocumentState(docId);
    expect(state).not.toHaveProperty('tempField');
  });

  it('should support document state assertions', async () => {
    const client = await createClient();
    const docId = TEST_CONFIG.testData.defaultDocumentId;
    
    await client.setField(docId, 'name', 'Alice');
    await client.setField(docId, 'age', 30);
    
    await assertDocumentState(client, docId, {
      name: 'Alice',
      age: 30,
    });
  });

  it('should support field value assertions', async () => {
    const client = await createClient();
    const docId = TEST_CONFIG.testData.defaultDocumentId;
    
    await client.setField(docId, 'status', 'active');
    
    await assertFieldValue(client, docId, 'status', 'active');
  });

  it('should cleanup clients automatically after test', async () => {
    // This test verifies that afterEach cleanup works
    // If cleanup doesn't work, this test would affect subsequent tests
    const client = await createClient();
    await client.setField('cleanup-test-doc', 'test', 'value');
    
    // Client will be cleaned up automatically by afterEach
    expect(client).toBeDefined();
  });
});

describe('Integration Test Framework - Isolation', () => {
  setupTestSuite();

  it('should have clean state from previous test suite', async () => {
    const client = await createClient();
    
    // Verify that 'cleanup-test-doc' from previous suite is not accessible
    // This proves test isolation is working
    const state = await client.getDocumentState('cleanup-test-doc');
    
    // Should be empty or not have the 'test' field from previous suite
    expect(state).toEqual({});
  });
});
