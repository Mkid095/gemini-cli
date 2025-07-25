/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from './httpClient.js';
import { ServiceConfig } from './types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HttpClient', () => {
  let client: HttpClient;
  let config: ServiceConfig;

  beforeEach(() => {
    config = {
      host: 'localhost',
      port: 1234,
      enabled: true,
      timeout: 5000,
      maxRetries: 2,
    };
    client = new HttpClient('lmstudio', config);
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct service and config', () => {
      expect(client).toBeDefined();
    });

    it('should use default options when not provided', () => {
      const defaultClient = new HttpClient('ollama', config);
      expect(defaultClient).toBeDefined();
    });
  });

  describe('request method', () => {
    it('should make successful GET request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:1234/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': expect.stringContaining('NextMavens'),
          }),
        })
      );
      expect(result.data).toEqual({ data: 'test' });
      expect(result.status).toBe(200);
    });

    it('should make successful POST request with data', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Map([['content-type', 'application/json']]),
        json: vi.fn().mockResolvedValue({ id: 1 }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const postData = { name: 'test' };
      const result = await client.post('/create', postData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:1234/create',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(postData),
        })
      );
      expect(result.data).toEqual({ id: 1 });
    });

    it('should handle non-JSON responses', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/plain']]),
        text: vi.fn().mockResolvedValue('plain text response'),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.get('/text');

      expect(result.data).toBe('plain text response');
    });

    it('should throw APIError for HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map(),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.get('/notfound')).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should retry on server errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map(),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.get('/error')).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry on client errors', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Map(),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.get('/bad')).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries for 4xx errors
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(client.get('/network-error')).rejects.toThrow('ServiceUnavailableError');
    });

    it('should handle timeout errors', async () => {
      // Mock a slow response that will timeout
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      const fastClient = new HttpClient('lmstudio', { ...config, timeout: 100 });
      
      await expect(fastClient.get('/slow')).rejects.toThrow('ServiceUnavailableError');
    });
  });

  describe('checkHealth method', () => {
    it('should return true for healthy service', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const isHealthy = await client.checkHealth();
      expect(isHealthy).toBe(true);
    });

    it('should return false for unhealthy service', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const isHealthy = await client.checkHealth();
      expect(isHealthy).toBe(false);
    });
  });

  describe('postStream method', () => {
    it('should handle streaming responses', async () => {
      const streamData = [
        'data: {"chunk": "Hello"}\n\n',
        'data: {"chunk": " world"}\n\n',
        'data: [DONE]\n\n',
      ];

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(streamData[0]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(streamData[1]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(streamData[2]) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      };

      const mockResponse = {
        ok: true,
        status: 200,
        body: {
          getReader: vi.fn().mockReturnValue(mockReader),
        },
        headers: new Map(),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const chunks = [];
      for await (const chunk of client.postStream('/stream', { prompt: 'test' })) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ chunk: 'Hello' });
      expect(chunks[1]).toEqual({ chunk: ' world' });
    });

    it('should handle streaming errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map(),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const streamGenerator = client.postStream('/stream-error', { prompt: 'test' });
      
      await expect(streamGenerator.next()).rejects.toThrow('HTTP 500: Internal Server Error');
    });
  });
});