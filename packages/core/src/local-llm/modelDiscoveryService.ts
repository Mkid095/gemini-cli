/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LMStudioClient } from './lmStudioClient.js';
import { OllamaClient } from './ollamaClient.js';
import { LocalLLMErrorHandler } from './errorHandler.js';
import {
  AvailableModel,
  ServiceStatus,
  ServiceConfig,
  LocalLLMService,
  NextMavensConfig,
  ServiceUnavailableError,
  LocalLLMError,
} from './types.js';

/**
 * Interface for the model discovery service
 */
export interface ModelDiscoveryService {
  scanAvailableModels(): Promise<AvailableModel[]>;
  checkServiceHealth(service: LocalLLMService): Promise<ServiceStatus>;
  refreshModelList(): Promise<void>;
  getLastScanResults(): ModelDiscoveryResult;
  updateServiceConfig(service: LocalLLMService, config: ServiceConfig): void;
}

/**
 * Result of a model discovery scan
 */
export interface ModelDiscoveryResult {
  models: AvailableModel[];
  services: Record<LocalLLMService, ServiceStatus>;
  lastScanTime: Date;
  errors: Array<{
    service: LocalLLMService;
    error: string;
  }>;
}

/**
 * Configuration for model discovery
 */
export interface ModelDiscoveryConfig {
  services: {
    lmstudio: ServiceConfig;
    ollama: ServiceConfig;
  };
  discovery: {
    enableCaching: boolean;
    cacheTimeout: number; // in milliseconds
    concurrentScans: boolean;
    healthCheckTimeout: number;
  };
}

/**
 * Default configuration for model discovery
 */
const DEFAULT_DISCOVERY_CONFIG: ModelDiscoveryConfig = {
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
      enabled: true,
      timeout: 10000,
      maxRetries: 2,
    },
  },
  discovery: {
    enableCaching: true,
    cacheTimeout: 30000, // 30 seconds
    concurrentScans: true,
    healthCheckTimeout: 5000,
  },
};

/**
 * Service for discovering available models from local LLM services
 */
export class LocalModelDiscoveryService implements ModelDiscoveryService {
  private config: ModelDiscoveryConfig;
  private lmStudioClient: LMStudioClient;
  private ollamaClient: OllamaClient;
  private errorHandler: LocalLLMErrorHandler;
  private lastScanResult: ModelDiscoveryResult;
  private lastScanTime: Date | null = null;

  constructor(config?: Partial<ModelDiscoveryConfig>) {
    this.config = this.mergeConfig(config);
    this.lmStudioClient = new LMStudioClient(this.config.services.lmstudio);
    this.ollamaClient = new OllamaClient(this.config.services.ollama);
    this.errorHandler = new LocalLLMErrorHandler({
      enableRetry: true,
      maxRetries: 2,
      retryDelay: 1000,
      fallbackModels: [],
    });

    this.lastScanResult = {
      models: [],
      services: {
        lmstudio: { available: false, endpoint: '' },
        ollama: { available: false, endpoint: '' },
      },
      lastScanTime: new Date(),
      errors: [],
    };
  }

  /**
   * Scan for available models from all enabled services
   */
  async scanAvailableModels(): Promise<AvailableModel[]> {
    // Check if we can use cached results
    if (this.shouldUseCachedResults()) {
      return this.lastScanResult.models;
    }

    const scanPromises: Promise<{
      service: LocalLLMService;
      models: AvailableModel[];
      status: ServiceStatus;
      error?: string;
    }>[] = [];

    // Scan LM Studio if enabled
    if (this.config.services.lmstudio.enabled) {
      scanPromises.push(this.scanService('lmstudio'));
    }

    // Scan Ollama if enabled
    if (this.config.services.ollama.enabled) {
      scanPromises.push(this.scanService('ollama'));
    }

    let results: Awaited<typeof scanPromises[0]>[];

    if (this.config.discovery.concurrentScans) {
      // Run scans concurrently
      results = await Promise.allSettled(scanPromises).then(settled =>
        settled.map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            const service = index === 0 ? 'lmstudio' : 'ollama';
            return {
              service: service as LocalLLMService,
              models: [],
              status: {
                available: false,
                endpoint: `http://${this.config.services[service].host}:${this.config.services[service].port}`,
                error: result.reason?.message || 'Unknown error',
              },
              error: result.reason?.message || 'Unknown error',
            };
          }
        })
      );
    } else {
      // Run scans sequentially
      results = [];
      for (const promise of scanPromises) {
        try {
          results.push(await promise);
        } catch (error) {
          const service = results.length === 0 ? 'lmstudio' : 'ollama';
          results.push({
            service: service as LocalLLMService,
            models: [],
            status: {
              available: false,
              endpoint: `http://${this.config.services[service].host}:${this.config.services[service].port}`,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // Combine results
    const allModels: AvailableModel[] = [];
    const serviceStatuses: Record<LocalLLMService, ServiceStatus> = {
      lmstudio: { available: false, endpoint: '' },
      ollama: { available: false, endpoint: '' },
    };
    const errors: Array<{ service: LocalLLMService; error: string }> = [];

    for (const result of results) {
      allModels.push(...result.models);
      serviceStatuses[result.service] = result.status;
      
      if (result.error) {
        errors.push({
          service: result.service,
          error: result.error,
        });
      }
    }

    // Update cache
    this.lastScanResult = {
      models: allModels,
      services: serviceStatuses,
      lastScanTime: new Date(),
      errors,
    };
    this.lastScanTime = new Date();

    // Update error handler with available models for fallback
    this.errorHandler.updateFallbackModels(allModels);

    return allModels;
  }

  /**
   * Check health of a specific service
   */
  async checkServiceHealth(service: LocalLLMService): Promise<ServiceStatus> {
    const client = service === 'lmstudio' ? this.lmStudioClient : this.ollamaClient;
    
    try {
      return await client.checkHealth();
    } catch (error) {
      return {
        available: false,
        endpoint: `http://${this.config.services[service].host}:${this.config.services[service].port}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Refresh the model list by clearing cache and scanning again
   */
  async refreshModelList(): Promise<void> {
    this.lastScanTime = null;
    await this.scanAvailableModels();
  }

  /**
   * Get the last scan results without triggering a new scan
   */
  getLastScanResults(): ModelDiscoveryResult {
    return { ...this.lastScanResult };
  }

  /**
   * Update configuration for a specific service
   */
  updateServiceConfig(service: LocalLLMService, config: ServiceConfig): void {
    this.config.services[service] = { ...config };
    
    if (service === 'lmstudio') {
      this.lmStudioClient.updateConfig(config);
    } else {
      this.ollamaClient.updateConfig(config);
    }

    // Clear cache to force rescan with new config
    this.lastScanTime = null;
  }

  /**
   * Update the entire discovery configuration
   */
  updateConfig(config: Partial<ModelDiscoveryConfig>): void {
    this.config = this.mergeConfig(config);
    
    // Update clients with new service configs
    this.lmStudioClient.updateConfig(this.config.services.lmstudio);
    this.ollamaClient.updateConfig(this.config.services.ollama);

    // Clear cache
    this.lastScanTime = null;
  }

  /**
   * Get current configuration
   */
  getConfig(): ModelDiscoveryConfig {
    return { ...this.config };
  }

  /**
   * Scan a specific service for models
   */
  private async scanService(service: LocalLLMService): Promise<{
    service: LocalLLMService;
    models: AvailableModel[];
    status: ServiceStatus;
    error?: string;
  }> {
    const client = service === 'lmstudio' ? this.lmStudioClient : this.ollamaClient;
    
    try {
      // First check if service is healthy
      const status = await client.checkHealth();
      
      if (!status.available) {
        return {
          service,
          models: [],
          status,
          error: status.error,
        };
      }

      // Get models from the service
      const modelInfos = await client.listModels();
      
      // Convert to AvailableModel format
      const models: AvailableModel[] = modelInfos.map(modelInfo => ({
        id: modelInfo.id,
        name: modelInfo.name,
        service,
        size: modelInfo.size,
        description: modelInfo.description,
        capabilities: modelInfo.capabilities,
      }));

      return {
        service,
        models,
        status,
      };

    } catch (error) {
      let errorMessage = 'Unknown error';
      let status: ServiceStatus;

      if (error instanceof ServiceUnavailableError) {
        errorMessage = `Service unavailable: ${error.message}`;
        status = {
          available: false,
          endpoint: `http://${this.config.services[service].host}:${this.config.services[service].port}`,
          error: errorMessage,
        };
      } else if (error instanceof LocalLLMError) {
        errorMessage = `Service error: ${error.message}`;
        status = {
          available: false,
          endpoint: `http://${this.config.services[service].host}:${this.config.services[service].port}`,
          error: errorMessage,
        };
      } else {
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
        status = {
          available: false,
          endpoint: `http://${this.config.services[service].host}:${this.config.services[service].port}`,
          error: errorMessage,
        };
      }

      return {
        service,
        models: [],
        status,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if cached results should be used
   */
  private shouldUseCachedResults(): boolean {
    if (!this.config.discovery.enableCaching || !this.lastScanTime) {
      return false;
    }

    const now = new Date();
    const timeSinceLastScan = now.getTime() - this.lastScanTime.getTime();
    
    return timeSinceLastScan < this.config.discovery.cacheTimeout;
  }

  /**
   * Merge user config with defaults
   */
  private mergeConfig(userConfig?: Partial<ModelDiscoveryConfig>): ModelDiscoveryConfig {
    if (!userConfig) {
      return { ...DEFAULT_DISCOVERY_CONFIG };
    }

    return {
      services: {
        lmstudio: { ...DEFAULT_DISCOVERY_CONFIG.services.lmstudio, ...userConfig.services?.lmstudio },
        ollama: { ...DEFAULT_DISCOVERY_CONFIG.services.ollama, ...userConfig.services?.ollama },
      },
      discovery: { ...DEFAULT_DISCOVERY_CONFIG.discovery, ...userConfig.discovery },
    };
  }

  /**
   * Create a discovery service from Next Mavens config
   */
  static fromNextMavensConfig(config: NextMavensConfig): LocalModelDiscoveryService {
    const discoveryConfig: Partial<ModelDiscoveryConfig> = {
      services: config.services,
      discovery: {
        enableCaching: config.performance?.enableCaching ?? true,
        cacheTimeout: 30000,
        concurrentScans: true,
        healthCheckTimeout: config.performance?.requestTimeout ?? 10000,
      },
    };

    return new LocalModelDiscoveryService(discoveryConfig);
  }
}