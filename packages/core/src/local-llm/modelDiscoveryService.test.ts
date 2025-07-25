/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalModelDiscoveryService, ModelDiscoveryConfig } from './modelDiscoveryService.js';
import { AvailableModel, ServiceConfig, ServiceUnavailableError } from './types.js';

// Mock the clients
vi.mock('./lmStudioClient.js', () => ({
  LMStudioClient: vi.fn().mockImplementation(() => ({
    checkHealth: vi.fn(),
    listModels: vi.fn(),
    updateConfig: vi.fn(),
  })),
}));

vi.mock('./ollamaClient.js', () => ({
  OllamaClient: vi.fn().mockImplementation(() => ({
    checkHealth: vi.fn(),
    listModels: vi.fn(),
    updateConfig: vi.fn(),
  })),
}));

vi.mock('./errorHandler.js', () => ({
  LocalLLMErrorHandler: vi.fn().mockImplementation(() => ({
    updateFallbackModels: vi.fn(),
  })),
}));

describe('LocalModelDiscoveryService', () => {
  let service: LocalModelDiscoveryService;
  let mockLMStudioClient: any;
  let mockOllamaClient: any;
  let mockErrorHandler: any;

  const mockLMStudioModels: AvailableModel[] = [
    {
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
    },
  ];

  const mockOllamaModels: AvailableModel[] = [
    {
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
    },
  ];

  beforeEach(() => {
    service = new LocalModelDiscoveryService();
    mockLMStudioClient = (service as any).lmStudioClient;
    mockOllamaClient = (service as any).ollamaClient;
    mockErrorHandler = (service as any).errorHandler;
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const config = service.getConfig();
      
      expect(config.services.lmstudio.host).toBe('localhost');
      expect(config.services.lmstudio.port).toBe(1234);
      expect(config.services.ollama.host).toBe('localhost');
      expect(config.services.ollama.port).toBe(11434);
      expect(config.discovery.enableCaching).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<ModelDiscoveryConfig> = {
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
            enabled: false,
            timeout: 20000,
            maxRetries: 3,
          },
        },
        discovery: {
          enableCaching: false,
          cacheTimeout: 60000,
          concurrentScans: false,
          healthCheckTimeout: 8000,
        },
      };

      const customService = new LocalModelDiscoveryService(customConfig);
      const config = customService.getConfig();

      expect(config.services.lmstudio.host).toBe('192.168.1.100');
      expect(config.services.lmstudio.port).toBe(8080);
      expect(config.services.ollama.enabled).toBe(false);
      expect(config.discovery.enableCaching).toBe(false);
    });
  });

  describe('scanAvailableModels', () => {
    it('should scan both services successfully', async () => {
      // Mock successful health checks
      mockLMStudioClient.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:1234',
        responseTime: 100,
      });
      mockOllamaClient.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:11434',
        responseTime: 150,
      });

      // Mock model lists
      mockLMStudioClient.listModels.mockResolvedValue([
        {
          id: 'llama2-7b.gguf',
          name: 'Llama 2 7B',
          capabilities: mockLMStudioModels[0].capabilities,
        },
      ]);
      mockOllamaClient.listModels.mockResolvedValue([
        {
          id: 'codellama:13b',
          name: 'Code Llama 13B',
          size: '7.3 GB',
          capabilities: mockOllamaModels[0].capabilities,
        },
      ]);

      const models = await service.scanAvailableModels();

      expect(models).toHaveLength(2);
      expect(models[0].service).toBe('lmstudio');
      expect(models[1].service).toBe('ollama');
      expect(mockErrorHandler.updateFallbackModels).toHaveBeenCalledWith(models);
    });

    it('should handle service unavailable errors', async () => {
      // Mock LM Studio as unavailable
      mockLMStudioClient.checkHealth.mockResolvedValue({
        available: false,
        endpoint: 'http://localhost:1234',
        error: 'Connection refused',
      });

      // Mock Ollama as available
      mockOllamaClient.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:11434',
        responseTime: 150,
      });
      mockOllamaClient.listModels.mockResolvedValue([
        {
          id: 'codellama:13b',
          name: 'Code Llama 13B',
          size: '7.3 GB',
          capabilities: mockOllamaModels[0].capabilities,
        },
      ]);

      const models = await service.scanAvailableModels();

      expect(models).toHaveLength(1);
      expect(models[0].service).toBe('ollama');

      const lastResults = service.getLastScanResults();
      expect(lastResults.services.lmstudio.available).toBe(false);
      expect(lastResults.services.ollama.available).toBe(true);
      expect(lastResults.errors).toHaveLength(1);
      expect(lastResults.errors[0].service).toBe('lmstudio');
    });

    it('should handle service exceptions', async () => {
      // Mock LM Studio throwing an exception
      mockLMStudioClient.checkHealth.mockRejectedValue(
        new ServiceUnavailableError('lmstudio', 'http://localhost:1234')
      );

      // Mock Ollama as available
      mockOllamaClient.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:11434',
        responseTime: 150,
      });
      mockOllamaClient.listModels.mockResolvedValue([]);

      const models = await service.scanAvailableModels();

      expect(models).toHaveLength(0);

      const lastResults = service.getLastScanResults();
      expect(lastResults.services.lmstudio.available).toBe(false);
      expect(lastResults.errors).toHaveLength(1);
    });

    it('should use cached results when caching is enabled', async () => {
      // First scan
      mockLMStudioClient.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:1234',
        responseTime: 100,
      });
      mockLMStudioClient.listModels.mockResolvedValue([]);
      mockOllamaClient.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:11434',
        responseTime: 150,
      });
      mockOllamaClient.listModels.mockResolvedValue([]);

      await service.scanAvailableModels();

      // Reset mocks
      vi.resetAllMocks();

      // Second scan should use cache
      const models = await service.scanAvailableModels();

      expect(mockLMStudioClient.checkHealth).not.toHaveBeenCalled();
      expect(mockOllamaClient.checkHealth).not.toHaveBeenCalled();
      expect(models).toEqual([]);
    });

    it('should skip disabled services', async () => {
      // Create service with Ollama disabled
      const config: Partial<ModelDiscoveryConfig> = {
        services: {
          lmstudio: {
            host: 'localhost',
            port: 1234,
            enabled: true,
            timeout: 10000,
            maxRetries: 2,
          },
          ollama: {
            host: 'localhost',
            port: 11434,
            enabled: false,
            timeout: 10000,
            maxRetries: 2,
          },
        },
      };

      const customService = new LocalModelDiscoveryService(config);
      const mockCustomLMStudio = (customService as any).lmStudioClient;
      const mockCustomOllama = (customService as any).ollamaClient;

      mockCustomLMStudio.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:1234',
        responseTime: 100,
      });
      mockCustomLMStudio.listModels.mockResolvedValue([]);

      await customService.scanAvailableModels();

      expect(mockCustomLMStudio.checkHealth).toHaveBeenCalled();
      expect(mockCustomOllama.checkHealth).not.toHaveBeenCalled();
    });
  });

  describe('checkServiceHealth', () => {
    it('should check LM Studio health', async () => {
      const expectedStatus = {
        available: true,
        endpoint: 'http://localhost:1234',
        responseTime: 100,
      };

      mockLMStudioClient.checkHealth.mockResolvedValue(expectedStatus);

      const status = await service.checkServiceHealth('lmstudio');

      expect(status).toEqual(expectedStatus);
      expect(mockLMStudioClient.checkHealth).toHaveBeenCalled();
    });

    it('should check Ollama health', async () => {
      const expectedStatus = {
        available: true,
        endpoint: 'http://localhost:11434',
        responseTime: 150,
      };

      mockOllamaClient.checkHealth.mockResolvedValue(expectedStatus);

      const status = await service.checkServiceHealth('ollama');

      expect(status).toEqual(expectedStatus);
      expect(mockOllamaClient.checkHealth).toHaveBeenCalled();
    });

    it('should handle health check errors', async () => {
      mockLMStudioClient.checkHealth.mockRejectedValue(new Error('Connection failed'));

      const status = await service.checkServiceHealth('lmstudio');

      expect(status.available).toBe(false);
      expect(status.error).toBe('Connection failed');
    });
  });

  describe('refreshModelList', () => {
    it('should clear cache and rescan', async () => {
      // First scan to populate cache
      mockLMStudioClient.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:1234',
        responseTime: 100,
      });
      mockLMStudioClient.listModels.mockResolvedValue([]);
      mockOllamaClient.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:11434',
        responseTime: 150,
      });
      mockOllamaClient.listModels.mockResolvedValue([]);

      await service.scanAvailableModels();

      // Reset mocks
      vi.resetAllMocks();

      // Refresh should trigger new scan
      await service.refreshModelList();

      expect(mockLMStudioClient.checkHealth).toHaveBeenCalled();
      expect(mockOllamaClient.checkHealth).toHaveBeenCalled();
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

      service.updateServiceConfig('lmstudio', newConfig);

      expect(mockLMStudioClient.updateConfig).toHaveBeenCalledWith(newConfig);
      expect(service.getConfig().services.lmstudio).toEqual(newConfig);
    });

    it('should update Ollama configuration', () => {
      const newConfig: ServiceConfig = {
        host: '192.168.1.101',
        port: 9090,
        enabled: false,
        timeout: 20000,
        maxRetries: 3,
      };

      service.updateServiceConfig('ollama', newConfig);

      expect(mockOllamaClient.updateConfig).toHaveBeenCalledWith(newConfig);
      expect(service.getConfig().services.ollama).toEqual(newConfig);
    });
  });

  describe('updateConfig', () => {
    it('should update entire configuration', () => {
      const newConfig: Partial<ModelDiscoveryConfig> = {
        discovery: {
          enableCaching: false,
          cacheTimeout: 60000,
          concurrentScans: false,
          healthCheckTimeout: 8000,
        },
      };

      service.updateConfig(newConfig);

      const config = service.getConfig();
      expect(config.discovery.enableCaching).toBe(false);
      expect(config.discovery.cacheTimeout).toBe(60000);
    });
  });

  describe('getLastScanResults', () => {
    it('should return last scan results', () => {
      const results = service.getLastScanResults();

      expect(results).toHaveProperty('models');
      expect(results).toHaveProperty('services');
      expect(results).toHaveProperty('lastScanTime');
      expect(results).toHaveProperty('errors');
    });
  });

  describe('fromNextMavensConfig', () => {
    it('should create service from Next Mavens config', () => {
      const nextMavensConfig = {
        selectedModel: {
          id: 'llama2:7b',
          service: 'ollama' as const,
        },
        services: {
          lmstudio: {
            host: 'localhost',
            port: 1234,
            enabled: true,
            timeout: 30000,
            maxRetries: 3,
          },
          ollama: {
            host: 'localhost',
            port: 11434,
            enabled: true,
            timeout: 30000,
            maxRetries: 3,
          },
        },
        ui: {
          theme: 'dark',
          autoRefreshModels: true,
          showModelDetails: true,
        },
        performance: {
          requestTimeout: 15000,
          maxConcurrentRequests: 5,
          enableCaching: true,
        },
      };

      const discoveryService = LocalModelDiscoveryService.fromNextMavensConfig(nextMavensConfig);
      const config = discoveryService.getConfig();

      expect(config.services.lmstudio.timeout).toBe(30000);
      expect(config.services.ollama.timeout).toBe(30000);
      expect(config.discovery.enableCaching).toBe(true);
      expect(config.discovery.healthCheckTimeout).toBe(15000);
    });
  });

  describe('concurrent vs sequential scanning', () => {
    it('should handle concurrent scanning', async () => {
      const concurrentConfig: Partial<ModelDiscoveryConfig> = {
        discovery: {
          enableCaching: false,
          cacheTimeout: 30000,
          concurrentScans: true,
          healthCheckTimeout: 5000,
        },
      };

      const concurrentService = new LocalModelDiscoveryService(concurrentConfig);
      const mockConcurrentLMStudio = (concurrentService as any).lmStudioClient;
      const mockConcurrentOllama = (concurrentService as any).ollamaClient;

      mockConcurrentLMStudio.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:1234',
        responseTime: 100,
      });
      mockConcurrentLMStudio.listModels.mockResolvedValue([]);

      mockConcurrentOllama.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:11434',
        responseTime: 150,
      });
      mockConcurrentOllama.listModels.mockResolvedValue([]);

      const models = await concurrentService.scanAvailableModels();

      expect(models).toEqual([]);
      expect(mockConcurrentLMStudio.checkHealth).toHaveBeenCalled();
      expect(mockConcurrentOllama.checkHealth).toHaveBeenCalled();
    });

    it('should handle sequential scanning', async () => {
      const sequentialConfig: Partial<ModelDiscoveryConfig> = {
        discovery: {
          enableCaching: false,
          cacheTimeout: 30000,
          concurrentScans: false,
          healthCheckTimeout: 5000,
        },
      };

      const sequentialService = new LocalModelDiscoveryService(sequentialConfig);
      const mockSequentialLMStudio = (sequentialService as any).lmStudioClient;
      const mockSequentialOllama = (sequentialService as any).ollamaClient;

      mockSequentialLMStudio.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:1234',
        responseTime: 100,
      });
      mockSequentialLMStudio.listModels.mockResolvedValue([]);

      mockSequentialOllama.checkHealth.mockResolvedValue({
        available: true,
        endpoint: 'http://localhost:11434',
        responseTime: 150,
      });
      mockSequentialOllama.listModels.mockResolvedValue([]);

      const models = await sequentialService.scanAvailableModels();

      expect(models).toEqual([]);
      expect(mockSequentialLMStudio.checkHealth).toHaveBeenCalled();
      expect(mockSequentialOllama.checkHealth).toHaveBeenCalled();
    });
  });
});