/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LMStudioClient } from './lmStudioClient.js';
import { ServiceConfig, GenerateContentRequest } from './types.js';

// Mock the HttpClient
vi.mock('./httpClient.js', () => ({
  HttpClient: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    post: vi.fn(),
    postStream: vi.fn(),
  })),
}));

describe('LMStudioClient', () => {
  let client: LMStudioClient;
  let config: ServiceConfig;
  let mockHttpClient: any;

  beforeEach(() => {
    config = {
      host: 'localhost',
      port: 1234,
      enabled: true,
      timeout: 30000,
      maxRetries: 3,
    };

    client = new LMStudioClient(config);
    mockHttpClient = (client as any).httpClient;
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct service and config', () => {
      expect(client.service).toBe('lmstudio');
      expect(client.config).toEqual(config);
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status when service is available', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: { object: 'list', data: [] },
        status: 200,
      });

      const status = await client.checkHealth();

      expect(status.available).toBe(true);
      expect(status.endpoint).toBe('http://localhost:1234');
      expect(status.responseTime).toBeGreaterThan(0);
      expect(mockHttpClient.get).toHaveBeenCalledWith('/v1/models');
    });

    it('should return unhealthy status when service is unavailable', async () => {
      const error = new Error('Connection refused');
      mockHttpClient.get.mockRejectedValue(error);

      const status = await client.checkHealth();

      expect(status.available).toBe(false);
      expect(status.endpoint).toBe('http://localhost:1234');
      expect(status.error).toBe('Connection refused');
    });
  });

  describe('listModels', () => {
    it('should return formatted model list', async () => {
      const mockResponse = {
        data: {
          object: 'list',
          data: [
            {
              id: 'llama-2-7b-chat.gguf',
              object: 'model',
              created: 1234567890,
              owned_by: 'user',
            },
            {
              id: 'codellama-13b-instruct.gguf',
              object: 'model',
              created: 1234567890,
              owned_by: 'user',
            },
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const models = await client.listModels();

      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        id: 'llama-2-7b-chat.gguf',
        name: 'Llama 2 7b Chat',
        description: 'LM Studio model: llama-2-7b-chat.gguf',
        capabilities: {
          supportsStreaming: true,
          supportsChat: true,
          supportsCompletion: true,
          supportsSystemMessages: true,
          maxContextLength: 4096,
        },
      });
      expect(models[1].name).toBe('Codellama 13b Instruct');
    });

    it('should throw ServiceUnavailableError when service is down', async () => {
      const fetchError = new TypeError('Failed to fetch');
      mockHttpClient.get.mockRejectedValue(fetchError);

      await expect(client.listModels()).rejects.toThrow('ServiceUnavailableError');
    });
  });

  describe('generateContent', () => {
    it('should generate content successfully', async () => {
      const request: GenerateContentRequest = {
        model: 'llama-2-7b-chat',
        messages: [
          { role: 'user', content: 'Hello, how are you?' },
        ],
        temperature: 0.7,
        maxTokens: 100,
      };

      const mockResponse = {
        data: {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'llama-2-7b-chat',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello! I am doing well, thank you for asking.',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 12,
            total_tokens: 22,
          },
        },
      };

      mockHttpClient.post.mockResolvedValue(mockResponse);

      const response = await client.generateContent(request);

      expect(response).toEqual({
        content: 'Hello! I am doing well, thank you for asking.',
        model: 'llama-2-7b-chat',
        finishReason: 'stop',
        usage: {
          promptTokens: 10,
          completionTokens: 12,
          totalTokens: 22,
        },
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith('/v1/chat/completions', {
        model: 'llama-2-7b-chat',
        messages: [
          { role: 'user', content: 'Hello, how are you?' },
        ],
        temperature: 0.7,
        max_tokens: 100,
        stream: false,
      });
    });

    it('should include system message when provided', async () => {
      const request: GenerateContentRequest = {
        model: 'llama-2-7b-chat',
        messages: [
          { role: 'user', content: 'Hello' },
        ],
        systemMessage: 'You are a helpful assistant.',
      };

      const mockResponse = {
        data: {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'llama-2-7b-chat',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello! How can I help you?',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 15,
            completion_tokens: 8,
            total_tokens: 23,
          },
        },
      };

      mockHttpClient.post.mockResolvedValue(mockResponse);

      await client.generateContent(request);

      expect(mockHttpClient.post).toHaveBeenCalledWith('/v1/chat/completions', {
        model: 'llama-2-7b-chat',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' },
        ],
        temperature: undefined,
        max_tokens: undefined,
        stream: false,
      });
    });

    it('should throw ModelNotFoundError for 404 responses', async () => {
      const request: GenerateContentRequest = {
        model: 'nonexistent-model',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const apiError = new (await import('./types.js')).APIError(
        'lmstudio',
        'Model not found',
        404
      );
      mockHttpClient.post.mockRejectedValue(apiError);

      await expect(client.generateContent(request)).rejects.toThrow('ModelNotFoundError');
    });
  });

  describe('generateContentStream', () => {
    it('should handle streaming responses', async () => {
      const request: GenerateContentRequest = {
        model: 'llama-2-7b-chat',
        messages: [{ role: 'user', content: 'Tell me a story' }],
        stream: true,
      };

      const mockStreamData = [
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1234567890,
          model: 'llama-2-7b-chat',
          choices: [
            {
              index: 0,
              delta: { role: 'assistant', content: 'Once' },
              finish_reason: null,
            },
          ],
        },
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1234567890,
          model: 'llama-2-7b-chat',
          choices: [
            {
              index: 0,
              delta: { content: ' upon' },
              finish_reason: null,
            },
          ],
        },
        {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1234567890,
          model: 'llama-2-7b-chat',
          choices: [
            {
              index: 0,
              delta: { content: ' a time' },
              finish_reason: 'stop',
            },
          ],
        },
      ];

      // Mock async generator
      mockHttpClient.postStream.mockImplementation(async function* () {
        for (const chunk of mockStreamData) {
          yield chunk;
        }
      });

      const chunks = [];
      for await (const chunk of client.generateContentStream(request)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(4); // 3 content chunks + 1 final chunk
      expect(chunks[0].content).toBe('Once');
      expect(chunks[1].content).toBe(' upon');
      expect(chunks[2].content).toBe(' a time');
      expect(chunks[3].finishReason).toBe('stop');

      expect(mockHttpClient.postStream).toHaveBeenCalledWith('/v1/chat/completions', {
        model: 'llama-2-7b-chat',
        messages: [{ role: 'user', content: 'Tell me a story' }],
        temperature: undefined,
        max_tokens: undefined,
        stream: true,
      });
    });

    it('should throw ModelNotFoundError for streaming 404 responses', async () => {
      const request: GenerateContentRequest = {
        model: 'nonexistent-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      };

      const apiError = new (await import('./types.js')).APIError(
        'lmstudio',
        'Model not found',
        404
      );
      mockHttpClient.postStream.mockImplementation(async function* () {
        throw apiError;
      });

      const streamGenerator = client.generateContentStream(request);
      
      await expect(streamGenerator.next()).rejects.toThrow('ModelNotFoundError');
    });
  });

  describe('model name formatting', () => {
    it('should format model names correctly', async () => {
      const mockResponse = {
        data: {
          object: 'list',
          data: [
            { id: 'llama-2-7b-chat.gguf', object: 'model', created: 1234567890, owned_by: 'user' },
            { id: 'code_llama_13b_instruct.bin', object: 'model', created: 1234567890, owned_by: 'user' },
            { id: 'mistral-7b-v0.1.safetensors', object: 'model', created: 1234567890, owned_by: 'user' },
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const models = await client.listModels();

      expect(models[0].name).toBe('Llama 2 7b Chat');
      expect(models[1].name).toBe('Code Llama 13b Instruct');
      expect(models[2].name).toBe('Mistral 7b V0.1');
    });
  });

  describe('context length estimation', () => {
    it('should estimate context length based on model name', async () => {
      const mockResponse = {
        data: {
          object: 'list',
          data: [
            { id: 'model-4k.gguf', object: 'model', created: 1234567890, owned_by: 'user' },
            { id: 'model-8k.gguf', object: 'model', created: 1234567890, owned_by: 'user' },
            { id: 'model-16k.gguf', object: 'model', created: 1234567890, owned_by: 'user' },
            { id: 'model-32k.gguf', object: 'model', created: 1234567890, owned_by: 'user' },
            { id: 'regular-model.gguf', object: 'model', created: 1234567890, owned_by: 'user' },
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const models = await client.listModels();

      expect(models[0].capabilities?.maxContextLength).toBe(4096);
      expect(models[1].capabilities?.maxContextLength).toBe(8192);
      expect(models[2].capabilities?.maxContextLength).toBe(16384);
      expect(models[3].capabilities?.maxContextLength).toBe(32768);
      expect(models[4].capabilities?.maxContextLength).toBe(4096); // default
    });
  });

  describe('updateConfig', () => {
    it('should update configuration and recreate http client', () => {
      const newConfig: ServiceConfig = {
        host: '192.168.1.100',
        port: 8080,
        enabled: true,
        timeout: 60000,
        maxRetries: 5,
      };

      client.updateConfig(newConfig);

      expect(client.config).toEqual(newConfig);
      // HttpClient should be recreated with new config
      expect((client as any).httpClient).toBeDefined();
    });
  });
});