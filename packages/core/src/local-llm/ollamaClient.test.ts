/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaClient } from './ollamaClient.js';
import { ServiceConfig, GenerateContentRequest } from './types.js';

// Mock the HttpClient
vi.mock('./httpClient.js', () => ({
  HttpClient: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    post: vi.fn(),
    postStream: vi.fn(),
  })),
}));

describe('OllamaClient', () => {
  let client: OllamaClient;
  let config: ServiceConfig;
  let mockHttpClient: any;

  beforeEach(() => {
    config = {
      host: 'localhost',
      port: 11434,
      enabled: true,
      timeout: 30000,
      maxRetries: 3,
    };

    client = new OllamaClient(config);
    mockHttpClient = (client as any).httpClient;
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct service and config', () => {
      expect(client.service).toBe('ollama');
      expect(client.config).toEqual(config);
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status when service is available', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: { models: [] },
        status: 200,
      });

      const status = await client.checkHealth();

      expect(status.available).toBe(true);
      expect(status.endpoint).toBe('http://localhost:11434');
      expect(status.responseTime).toBeGreaterThan(0);
      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/tags');
    });

    it('should return unhealthy status when service is unavailable', async () => {
      const error = new Error('Connection refused');
      mockHttpClient.get.mockRejectedValue(error);

      const status = await client.checkHealth();

      expect(status.available).toBe(false);
      expect(status.endpoint).toBe('http://localhost:11434');
      expect(status.error).toBe('Connection refused');
    });
  });

  describe('listModels', () => {
    it('should return formatted model list', async () => {
      const mockResponse = {
        data: {
          models: [
            {
              name: 'llama2:7b',
              modified_at: '2024-01-01T00:00:00Z',
              size: 3825819519,
              digest: 'sha256:abc123',
              details: {
                format: 'gguf',
                family: 'llama',
                parameter_size: '7B',
                quantization_level: 'Q4_0',
              },
            },
            {
              name: 'codellama:13b',
              modified_at: '2024-01-01T00:00:00Z',
              size: 7365960935,
              digest: 'sha256:def456',
              details: {
                format: 'gguf',
                family: 'llama',
                parameter_size: '13B',
                quantization_level: 'Q4_0',
              },
            },
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const models = await client.listModels();

      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        id: 'llama2:7b',
        name: 'Llama2',
        size: '3.6 GB',
        description: 'Ollama model: llama2:7b (7B)',
        capabilities: {
          supportsStreaming: true,
          supportsChat: true,
          supportsCompletion: true,
          supportsSystemMessages: true,
          maxContextLength: 4096,
        },
      });
      expect(models[1].name).toBe('Codellama');
      expect(models[1].capabilities?.maxContextLength).toBe(16384); // Code Llama has longer context
    });

    it('should throw ServiceUnavailableError when service is down', async () => {
      const fetchError = new TypeError('Failed to fetch');
      mockHttpClient.get.mockRejectedValue(fetchError);

      await expect(client.listModels()).rejects.toThrow('ServiceUnavailableError');
    });
  });

  describe('generateContent', () => {
    describe('with single message (uses generate API)', () => {
      it('should generate content successfully', async () => {
        const request: GenerateContentRequest = {
          model: 'llama2:7b',
          messages: [
            { role: 'user', content: 'Hello, how are you?' },
          ],
          temperature: 0.7,
          maxTokens: 100,
        };

        const mockResponse = {
          data: {
            model: 'llama2:7b',
            created_at: '2024-01-01T00:00:00Z',
            response: 'Hello! I am doing well, thank you for asking.',
            done: true,
            prompt_eval_count: 10,
            eval_count: 12,
          },
        };

        mockHttpClient.post.mockResolvedValue(mockResponse);

        const response = await client.generateContent(request);

        expect(response).toEqual({
          content: 'Hello! I am doing well, thank you for asking.',
          model: 'llama2:7b',
          finishReason: 'stop',
          usage: {
            promptTokens: 10,
            completionTokens: 12,
            totalTokens: 22,
          },
        });

        expect(mockHttpClient.post).toHaveBeenCalledWith('/api/generate', {
          model: 'llama2:7b',
          prompt: 'Human: Hello, how are you?\nAssistant: ',
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 100,
          },
        });
      });
    });

    describe('with multiple messages (uses chat API)', () => {
      it('should generate content successfully', async () => {
        const request: GenerateContentRequest = {
          model: 'llama2:7b',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
            { role: 'user', content: 'How are you?' },
          ],
          temperature: 0.7,
        };

        const mockResponse = {
          data: {
            model: 'llama2:7b',
            created_at: '2024-01-01T00:00:00Z',
            message: {
              role: 'assistant',
              content: 'I am doing well, thank you!',
            },
            done: true,
            prompt_eval_count: 15,
            eval_count: 8,
          },
        };

        mockHttpClient.post.mockResolvedValue(mockResponse);

        const response = await client.generateContent(request);

        expect(response).toEqual({
          content: 'I am doing well, thank you!',
          model: 'llama2:7b',
          finishReason: 'stop',
          usage: {
            promptTokens: 15,
            completionTokens: 8,
            totalTokens: 23,
          },
        });

        expect(mockHttpClient.post).toHaveBeenCalledWith('/api/chat', {
          model: 'llama2:7b',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
            { role: 'user', content: 'How are you?' },
          ],
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: undefined,
          },
        });
      });

      it('should include system message when provided', async () => {
        const request: GenerateContentRequest = {
          model: 'llama2:7b',
          messages: [
            { role: 'user', content: 'Hello' },
          ],
          systemMessage: 'You are a helpful assistant.',
        };

        const mockResponse = {
          data: {
            model: 'llama2:7b',
            created_at: '2024-01-01T00:00:00Z',
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?',
            },
            done: true,
          },
        };

        mockHttpClient.post.mockResolvedValue(mockResponse);

        await client.generateContent(request);

        expect(mockHttpClient.post).toHaveBeenCalledWith('/api/chat', {
          model: 'llama2:7b',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello' },
          ],
          stream: false,
          options: {
            temperature: undefined,
            num_predict: undefined,
          },
        });
      });
    });

    it('should throw ModelNotFoundError for 404 responses', async () => {
      const request: GenerateContentRequest = {
        model: 'nonexistent-model',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const apiError = new (await import('./types.js')).APIError(
        'ollama',
        'Model not found',
        404
      );
      mockHttpClient.post.mockRejectedValue(apiError);

      await expect(client.generateContent(request)).rejects.toThrow('ModelNotFoundError');
    });
  });

  describe('generateContentStream', () => {
    describe('with single message (uses generate API)', () => {
      it('should handle streaming responses', async () => {
        const request: GenerateContentRequest = {
          model: 'llama2:7b',
          messages: [{ role: 'user', content: 'Tell me a story' }],
          stream: true,
        };

        const mockStreamData = [
          {
            model: 'llama2:7b',
            created_at: '2024-01-01T00:00:00Z',
            response: 'Once',
            done: false,
          },
          {
            model: 'llama2:7b',
            created_at: '2024-01-01T00:00:00Z',
            response: ' upon',
            done: false,
          },
          {
            model: 'llama2:7b',
            created_at: '2024-01-01T00:00:00Z',
            response: ' a time',
            done: true,
            prompt_eval_count: 5,
            eval_count: 10,
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
        expect(chunks[3].usage).toEqual({
          promptTokens: 5,
          completionTokens: 10,
          totalTokens: 15,
        });

        expect(mockHttpClient.postStream).toHaveBeenCalledWith('/api/generate', {
          model: 'llama2:7b',
          prompt: 'Human: Tell me a story\nAssistant: ',
          stream: true,
          options: {
            temperature: undefined,
            num_predict: undefined,
          },
        });
      });
    });

    describe('with multiple messages (uses chat API)', () => {
      it('should handle streaming chat responses', async () => {
        const request: GenerateContentRequest = {
          model: 'llama2:7b',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi!' },
            { role: 'user', content: 'Tell me a joke' },
          ],
          stream: true,
        };

        const mockStreamData = [
          {
            model: 'llama2:7b',
            created_at: '2024-01-01T00:00:00Z',
            message: { role: 'assistant', content: 'Why' },
            done: false,
          },
          {
            model: 'llama2:7b',
            created_at: '2024-01-01T00:00:00Z',
            message: { role: 'assistant', content: ' did the' },
            done: false,
          },
          {
            model: 'llama2:7b',
            created_at: '2024-01-01T00:00:00Z',
            message: { role: 'assistant', content: ' chicken cross the road?' },
            done: true,
            prompt_eval_count: 20,
            eval_count: 15,
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
        expect(chunks[0].content).toBe('Why');
        expect(chunks[1].content).toBe(' did the');
        expect(chunks[2].content).toBe(' chicken cross the road?');
        expect(chunks[3].finishReason).toBe('stop');

        expect(mockHttpClient.postStream).toHaveBeenCalledWith('/api/chat', {
          model: 'llama2:7b',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi!' },
            { role: 'user', content: 'Tell me a joke' },
          ],
          stream: true,
          options: {
            temperature: undefined,
            num_predict: undefined,
          },
        });
      });
    });

    it('should throw ModelNotFoundError for streaming 404 responses', async () => {
      const request: GenerateContentRequest = {
        model: 'nonexistent-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      };

      const apiError = new (await import('./types.js')).APIError(
        'ollama',
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
          models: [
            {
              name: 'llama2:7b',
              modified_at: '2024-01-01T00:00:00Z',
              size: 1000000,
              digest: 'sha256:abc',
              details: { format: 'gguf', family: 'llama', parameter_size: '7B', quantization_level: 'Q4_0' },
            },
            {
              name: 'code-llama:13b-instruct',
              modified_at: '2024-01-01T00:00:00Z',
              size: 2000000,
              digest: 'sha256:def',
              details: { format: 'gguf', family: 'llama', parameter_size: '13B', quantization_level: 'Q4_0' },
            },
            {
              name: 'mistral:latest',
              modified_at: '2024-01-01T00:00:00Z',
              size: 3000000,
              digest: 'sha256:ghi',
              details: { format: 'gguf', family: 'mistral', parameter_size: '7B', quantization_level: 'Q4_0' },
            },
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const models = await client.listModels();

      expect(models[0].name).toBe('Llama2');
      expect(models[1].name).toBe('Code Llama');
      expect(models[2].name).toBe('Mistral');
    });
  });

  describe('size formatting', () => {
    it('should format model sizes correctly', async () => {
      const mockResponse = {
        data: {
          models: [
            {
              name: 'small:latest',
              size: 1024,
              modified_at: '2024-01-01T00:00:00Z',
              digest: 'sha256:abc',
              details: { format: 'gguf', family: 'test', parameter_size: '1B', quantization_level: 'Q4_0' },
            },
            {
              name: 'medium:latest',
              size: 1024 * 1024,
              modified_at: '2024-01-01T00:00:00Z',
              digest: 'sha256:def',
              details: { format: 'gguf', family: 'test', parameter_size: '7B', quantization_level: 'Q4_0' },
            },
            {
              name: 'large:latest',
              size: 1024 * 1024 * 1024,
              modified_at: '2024-01-01T00:00:00Z',
              digest: 'sha256:ghi',
              details: { format: 'gguf', family: 'test', parameter_size: '13B', quantization_level: 'Q4_0' },
            },
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const models = await client.listModels();

      expect(models[0].size).toBe('1.0 KB');
      expect(models[1].size).toBe('1.0 MB');
      expect(models[2].size).toBe('1.0 GB');
    });
  });

  describe('context length estimation', () => {
    it('should estimate context length based on model family', async () => {
      const mockResponse = {
        data: {
          models: [
            {
              name: 'llama2:7b',
              size: 1000000,
              modified_at: '2024-01-01T00:00:00Z',
              digest: 'sha256:abc',
              details: { format: 'gguf', family: 'llama', parameter_size: '7B', quantization_level: 'Q4_0' },
            },
            {
              name: 'codellama:13b',
              size: 2000000,
              modified_at: '2024-01-01T00:00:00Z',
              digest: 'sha256:def',
              details: { format: 'gguf', family: 'llama', parameter_size: '13B', quantization_level: 'Q4_0' },
            },
            {
              name: 'mistral:7b',
              size: 3000000,
              modified_at: '2024-01-01T00:00:00Z',
              digest: 'sha256:ghi',
              details: { format: 'gguf', family: 'mistral', parameter_size: '7B', quantization_level: 'Q4_0' },
            },
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const models = await client.listModels();

      expect(models[0].capabilities?.maxContextLength).toBe(4096); // Llama2
      expect(models[1].capabilities?.maxContextLength).toBe(16384); // CodeLlama
      expect(models[2].capabilities?.maxContextLength).toBe(8192); // Mistral
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