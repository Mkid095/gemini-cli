/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalLLMRequestRouter, RequestRouterConfig } from './requestRouter.js';
import { AvailableModel, GenerateContentRequest, ServiceConfig } from './types.js';

// Mock the clients and services
vi.mock('./lmStudioClient.js', () => ({
  LMStudioClient: vi.fn().mockImplementation(() => ({
    checkHealth: vi.fn(),
    generateContent: vi.fn(),
    generateContentStream: vi.fn(),
    updateConfig: vi.fn(),
  })),
}));

vi.mock('./ollamaClient.js', () => ({
  OllamaClient: vi.fn().mockImplementation(() => ({
    checkHealth: vi.fn(),
    generateContent: vi.fn(),
    generateContentStream: vi.fn(),
    updateConfig: vi.fn(),
  })),
}));

vi.mock('./errorHandler.js', () => ({
  LocalLLMErrorHandler: vi.fn().mockImplementation(() => ({
    handleLocalLLMError: vi.fn(),
    handleNetworkError: vi.fn(),
    updateFallbackModels: vi.fn(),
    getRetryDelay: vi.fn().mockReturnValue(1000),
  })),
}));

vi.mock('./modelDiscoveryService.js', () => ({
  LocalModelDiscoveryService: vi.fn().mockImplementation(() => ({
    scanAvailableModels: vi.fn(),
  })),
}));

describe('LocalLLMRequestRouter', () => {
  let router: LocalLLMRequestRouter;
  let mockLMStudioClient: any;
  let mockOllamaClient: any;
  let mockErrorHandler: any;

  const mockLMStudioModel: AvailableModel = {
    id: 'llama2-7b.gguf',
    name: 'Llama 2 7B',
    service: 'lmstudio',
    capabilities: {
      supportsStreaming: true,
      supportsChat: true,
      supportsCompletion: true,
      supportsSystemMessages: true,
      maxContextLength: 4096,
    },
  };

  const mockOllamaModel: AvailableModel = {
    id: 'codellama:13b',
    name: 'Code Llama 13B',
    service: 'ollama',
    size: '7.3 GB',
    capabilities: {
      supportsStreaming: true,
      supportsChat: true,
      supportsCompletion: true,
      supportsSystemMessages: true,
      maxContextLength: 16384,
    },
  };

  const mockRequest: GenerateContentRequest = {
    model: 'llama2-7b.gguf',
    messages: [{ role: 'user', content: 'Hello, world!' }],
    temperature: 0.7,
    maxTokens: 100,
  };

  beforeEach(() => {
    router = new LocalLLMRequestRouter();
    mockLMStudioClient = (router as any).lmStudioClient;
    mockOllamaClient = (router as any).ollamaClient;
    mockErrorHandler = (router as any).errorHandler;

    // Set up available models
    router.updateAvailableModels([mockLMStudioModel, mockOllamaModel]);

    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const config = router.getConfig();
      
      expect(config.services.lmstudio.host).toBe('localhost');
      expect(config.services.lmstudio.port).toBe(1234);
      expect(config.services.ollama.host).toBe('localhost');
      expect(config.services.ollama.port).toBe(11434);
      expect(config.routing.enableFailover).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<RequestRouterConfig> = {
        services: {
          lmstudio: {
            host: '192.168.1.100',
            port: 8080,
            enabled: true,
            timeout: 15000,
            maxRetries: 5,
          },
          ollama: {
            host: '192.168.1.101',
            port: 9090,
            enabled: true,
            timeout: 20000,
            maxRetries: 3,
          },
        },
        routing: {
          enableFailover: false,
          maxRetries: 5,
          retryDelay: 2000,
          healthCheckInterval: 60000,
        },
      };

      const customRouter = new LocalLLMRequestRouter(customConfig);
      const config = customRouter.getConfig();

      expect(config.services.lmstudio.host).toBe('192.168.1.100');
      expect(config.services.lmstudio.port).toBe(8080);
      expect(config.routing.enableFailover).toBe(false);
      expect(config.routing.maxRetries).toBe(5);
    });
  });

  describe('routeRequest', () => {
    it('should route request to LM Studio successfully', async () => {
      const expectedResponse = {
        content: 'Hello! How can I help you?',
        model: 'llama2-7b.gguf',
        finishReason: 'stop' as const,
        usage: { promptTokens: 10, completionTokens: 8, totalTokens: 18 },
      };

      mockLMStudioClient.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:1234',
        responseTime: 100,
      });
      mockLMStudioClient.generateContent.mockResolvedValue(expectedResponse);

      const response = await router.routeRequest(mockRequest, mockLMStudioModel);

      expect(response).toEqual(expectedResponse);
      expect(mockLMStudioClient.checkHealth).toHaveBeenCalled();
      expect(mockLMStudioClient.generateContent).toHaveBeenCalledWith(mockRequest);
    });

    it('should route request to Ollama successfully', async () => {
      const ollamaRequest = { ...mockRequest, model: 'codellama:13b' };
      const expectedResponse = {
        content: 'Here is some code for you.',
        model: 'codellama:13b',
        finishReason: 'stop' as const,
        usage: { promptTokens: 12, completionTokens: 15, totalTokens: 27 },
      };

      mockOllamaClient.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:11434',
        responseTime: 150,
      });
      mockOllamaClient.generateContent.mockResolvedValue(expectedResponse);

      const response = await router.routeRequest(ollamaRequest, mockOllamaModel);

      expect(response).toEqual(expectedResponse);
      expect(mockOllamaClient.checkHealth).toHaveBeenCalled();
      expect(mockOllamaClient.generateContent).toHaveBeenCalledWith(ollamaRequest);
    });

    it('should throw ModelNotFoundError for unknown model', async () => {
      const unknownModel: AvailableModel = {
        id: 'unknown-model',
        name: 'Unknown Model',
        service: 'lmstudio',
        capabilities: mockLMStudioModel.capabilities!,
      };

      await expect(router.routeRequest(mockRequest, unknownModel))
        .rejects.toThrow('ModelNotFoundError');
    });

    it('should handle service unavailable and retry', async () => {
      // First call fails with service unavailable
      mockLMStudioClient.checkHealth
        .mockResolvedValueOnce({ available: false, endpoint: 'http://localhost:1234', error: 'Connection refused' })
        .mockResolvedValueOnce({ available: true, endpoint: 'http://localhost:1234', responseTime: 100 });

      const expectedResponse = {
        content: 'Hello after retry!',
        model: 'llama2-7b.gguf',
        finishReason: 'stop' as const,
      };

      mockLMStudioClient.generateContent.mockResolvedValue(expectedResponse);

      // Mock error handler to allow retry
      mockErrorHandler.handleNetworkError.mockResolvedValue({
        shouldRetry: true,
        userMessage: 'Service unavailable, retrying...',
        technicalMessage: 'LM Studio unavailable',
      });

      const response = await router.routeRequest(mockRequest, mockLMStudioModel);

      expect(response).toEqual(expectedResponse);
      expect(mockLMStudioClient.checkHealth).toHaveBeenCalledTimes(2);
    });

    it('should failover to different service when enabled', async () => {
      // Configure router with failover enabled
      const configWithFailover: Partial<RequestRouterConfig> = {
        routing: { enableFailover: true, maxRetries: 1, retryDelay: 100, healthCheckInterval: 30000 },
      };
      const failoverRouter = new LocalLLMRequestRouter(configWithFailover);
      failoverRouter.updateAvailableModels([mockLMStudioModel, mockOllamaModel]);

      const mockFailoverLMStudio = (failoverRouter as any).lmStudioClient;
      const mockFailoverOllama = (failoverRouter as any).ollamaClient;
      const mockFailoverErrorHandler = (failoverRouter as any).errorHandler;

      // LM Studio fails
      mockFailoverLMStudio.checkHealth.mockResolvedValue({
        available: false,
        endpoint: 'http://localhost:1234',
        error: 'Connection refused',
      });

      // Ollama succeeds
      mockFailoverOllama.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:11434',
        responseTime: 150,
      });

      const expectedResponse = {
        content: 'Failover response from Ollama',
        model: 'codellama:13b',
        finishReason: 'stop' as const,
      };

      mockFailoverOllama.generateContent.mockResolvedValue(expectedResponse);

      // Mock error handler to suggest failover
      mockFailoverErrorHandler.handleNetworkError.mockResolvedValue({
        shouldRetry: false,
        fallbackModel: mockOllamaModel,
        userMessage: 'Service unavailable, trying fallback',
        technicalMessage: 'LM Studio unavailable',
      });

      const response = await failoverRouter.routeRequest(mockRequest, mockLMStudioModel);

      expect(response).toEqual(expectedResponse);
      expect(mockFailoverOllama.generateContent).toHaveBeenCalled();
    });

    it('should respect max retries limit', async () => {
      const limitedRetryConfig: Partial<RequestRouterConfig> = {
        routing: { enableFailover: false, maxRetries: 2, retryDelay: 10, healthCheckInterval: 30000 },
      };
      const limitedRouter = new LocalLLMRequestRouter(limitedRetryConfig);
      limitedRouter.updateAvailableModels([mockLMStudioModel]);

      const mockLimitedLMStudio = (limitedRouter as any).lmStudioClient;
      const mockLimitedErrorHandler = (limitedRouter as any).errorHandler;

      // Always fail health check
      mockLimitedLMStudio.checkHealth.mockResolvedValue({
        available: false,
        endpoint: 'http://localhost:1234',
        error: 'Connection refused',
      });

      // Mock error handler to always retry
      mockLimitedErrorHandler.handleNetworkError.mockResolvedValue({
        shouldRetry: true,
        userMessage: 'Service unavailable, retrying...',
        technicalMessage: 'LM Studio unavailable',
      });

      await expect(limitedRouter.routeRequest(mockRequest, mockLMStudioModel))
        .rejects.toThrow();

      // Should be called 3 times (initial + 2 retries)
      expect(mockLimitedLMStudio.checkHealth).toHaveBeenCalledTimes(3);
    });
  });

  describe('routeStreamRequest', () => {
    it('should route streaming request successfully', async () => {
      const mockStreamData = [
        { content: 'Hello', model: 'llama2-7b.gguf', finishReason: undefined },
        { content: ' world', model: 'llama2-7b.gguf', finishReason: undefined },
        { content: '!', model: 'llama2-7b.gguf', finishReason: 'stop' as const },
      ];

      mockLMStudioClient.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:1234',
        responseTime: 100,
      });

      // Mock async generator
      mockLMStudioClient.generateContentStream.mockImplementation(async function* () {
        for (const chunk of mockStreamData) {
          yield chunk;
        }
      });

      const chunks = [];
      for await (const chunk of router.routeStreamRequest(mockRequest, mockLMStudioModel)) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(mockStreamData);
      expect(mockLMStudioClient.checkHealth).toHaveBeenCalled();
      expect(mockLMStudioClient.generateContentStream).toHaveBeenCalledWith(mockRequest);
    });

    it('should handle streaming errors with failover', async () => {
      const failoverRouter = new LocalLLMRequestRouter({
        routing: { enableFailover: true, maxRetries: 1, retryDelay: 10, healthCheckInterval: 30000 },
      });
      failoverRouter.updateAvailableModels([mockLMStudioModel, mockOllamaModel]);

      const mockFailoverLMStudio = (failoverRouter as any).lmStudioClient;
      const mockFailoverOllama = (failoverRouter as any).ollamaClient;
      const mockFailoverErrorHandler = (failoverRouter as any).errorHandler;

      // LM Studio fails
      mockFailoverLMStudio.checkHealth.mockResolvedValue({
        available: false,
        endpoint: 'http://localhost:1234',
        error: 'Connection refused',
      });

      // Ollama succeeds
      mockFailoverOllama.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:11434',
        responseTime: 150,
      });

      const mockOllamaStreamData = [
        { content: 'Failover', model: 'codellama:13b', finishReason: undefined },
        { content: ' stream', model: 'codellama:13b', finishReason: 'stop' as const },
      ];

      mockFailoverOllama.generateContentStream.mockImplementation(async function* () {
        for (const chunk of mockOllamaStreamData) {
          yield chunk;
        }
      });

      // Mock error handler to suggest failover
      mockFailoverErrorHandler.handleNetworkError.mockResolvedValue({
        shouldRetry: false,
        fallbackModel: mockOllamaModel,
        userMessage: 'Service unavailable, trying fallback',
        technicalMessage: 'LM Studio unavailable',
      });

      const chunks = [];
      for await (const chunk of failoverRouter.routeStreamRequest(mockRequest, mockLMStudioModel)) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(mockOllamaStreamData);
    });
  });

  describe('updateServiceConfig', () => {
    it('should update LM Studio configuration', () => {
      const newConfig: ServiceConfig = {
        host: '192.168.1.100',
        port: 8080,
        enabled: true,
        timeout: 15000,
        maxRetries: 5,
      };

      router.updateServiceConfig('lmstudio', newConfig);

      expect(mockLMStudioClient.updateConfig).toHaveBeenCalledWith(newConfig);
      expect(router.getConfig().services.lmstudio).toEqual(newConfig);
    });

    it('should update Ollama configuration', () => {
      const newConfig: ServiceConfig = {
        host: '192.168.1.101',
        port: 9090,
        enabled: false,
        timeout: 20000,
        maxRetries: 3,
      };

      router.updateServiceConfig('ollama', newConfig);

      expect(mockOllamaClient.updateConfig).toHaveBeenCalledWith(newConfig);
      expect(router.getConfig().services.ollama).toEqual(newConfig);
    });
  });

  describe('updateAvailableModels', () => {
    it('should update available models and error handler', () => {
      const newModels = [mockLMStudioModel];

      router.updateAvailableModels(newModels);

      expect(mockErrorHandler.updateFallbackModels).toHaveBeenCalledWith(newModels);
    });
  });

  describe('getServiceStatus', () => {
    it('should return service status', async () => {
      mockLMStudioClient.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:1234',
        responseTime: 100,
      });

      const status = await router.getServiceStatus('lmstudio');

      expect(status).toBe(true);
      expect(mockLMStudioClient.checkHealth).toHaveBeenCalled();
    });

    it('should cache service health checks', async () => {
      mockLMStudioClient.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:1234',
        responseTime: 100,
      });

      // First call
      await router.getServiceStatus('lmstudio');
      // Second call should use cache
      await router.getServiceStatus('lmstudio');

      expect(mockLMStudioClient.checkHealth).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStats', () => {
    it('should return router statistics', () => {
      const stats = router.getStats();

      expect(stats).toHaveProperty('availableModels');
      expect(stats).toHaveProperty('serviceHealth');
      expect(stats).toHaveProperty('lastHealthCheck');
      expect(stats.availableModels).toBe(2); // mockLMStudioModel and mockOllamaModel
    });
  });

  describe('updateConfig', () => {
    it('should update entire configuration', () => {
      const newConfig: Partial<RequestRouterConfig> = {
        routing: {
          enableFailover: false,
          maxRetries: 5,
          retryDelay: 2000,
          healthCheckInterval: 60000,
        },
      };

      router.updateConfig(newConfig);

      const config = router.getConfig();
      expect(config.routing.enableFailover).toBe(false);
      expect(config.routing.maxRetries).toBe(5);
    });
  });
});