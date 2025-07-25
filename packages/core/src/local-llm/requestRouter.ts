/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LMStudioClient } from './lmStudioClient.js';
import { OllamaClient } from './ollamaClient.js';
import { LocalLLMErrorHandler } from './errorHandler.js';
import { LocalModelDiscoveryService } from './modelDiscoveryService.js';
import {
  AvailableModel,
  GenerateContentRequest,
  GenerateContentResponse,
  LocalLLMClient,
  LocalLLMService,
  ServiceConfig,
  ModelNotFoundError,
  ServiceUnavailableError,
  LocalLLMError,
} from './types.js';

/**
 * Interface for the request router
 */
export interface RequestRouter {
  routeRequest(request: GenerateContentRequest, model: AvailableModel): Promise<GenerateContentResponse>;
  routeStreamRequest(request: GenerateContentRequest, model: AvailableModel): AsyncGenerator<GenerateContentResponse>;
  updateServiceConfig(service: LocalLLMService, config: ServiceConfig): void;
  updateAvailableModels(models: AvailableModel[]): void;
  getServiceStatus(service: LocalLLMService): Promise<boolean>;
}

/**
 * Configuration for the request router
 */
export interface RequestRouterConfig {
  services: {
    lmstudio: ServiceConfig;
    ollama: ServiceConfig;
  };
  routing: {
    enableFailover: boolean;
    maxRetries: number;
    retryDelay: number;
    healthCheckInterval: number;
  };
}

/**
 * Default configuration for the request router
 */
const DEFAULT_ROUTER_CONFIG: RequestRouterConfig = {
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
  routing: {
    enableFailover: true,
    maxRetries: 3,
    retryDelay: 1000,
    healthCheckInterval: 30000,
  },
};

/**
 * Request router that routes requests to appropriate local LLM services
 */
export class LocalLLMRequestRouter implements RequestRouter {
  private config: RequestRouterConfig;
  private lmStudioClient: LMStudioClient;
  private ollamaClient: OllamaClient;
  private errorHandler: LocalLLMErrorHandler;
  private availableModels: Map<string, AvailableModel> = new Map();
  private serviceHealthCache: Map<LocalLLMService, { healthy: boolean; lastCheck: Date }> = new Map();

  constructor(
    config?: Partial<RequestRouterConfig>,
    discoveryService?: LocalModelDiscoveryService
  ) {
    this.config = this.mergeConfig(config);
    this.lmStudioClient = new LMStudioClient(this.config.services.lmstudio);
    this.ollamaClient = new OllamaClient(this.config.services.ollama);
    this.errorHandler = new LocalLLMErrorHandler({
      enableRetry: true,
      maxRetries: this.config.routing.maxRetries,
      retryDelay: this.config.routing.retryDelay,
      fallbackModels: [],
    });

    // Initialize service health cache
    this.serviceHealthCache.set('lmstudio', { healthy: false, lastCheck: new Date(0) });
    this.serviceHealthCache.set('ollama', { healthy: false, lastCheck: new Date(0) });

    // If discovery service is provided, initialize with available models
    if (discoveryService) {
      this.initializeFromDiscoveryService(discoveryService);
    }
  }

  /**
   * Route a request to the appropriate service based on the model
   */
  async routeRequest(
    request: GenerateContentRequest,
    model: AvailableModel
  ): Promise<GenerateContentResponse> {
    const client = this.getClientForService(model.service);

    // Validate that the model is available
    if (!this.availableModels.has(model.id)) {
      throw new ModelNotFoundError(model.service, model.id);
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.config.routing.maxRetries) {
      try {
        // Check service health before making request
        const isHealthy = await this.checkServiceHealth(model.service);
        if (!isHealthy) {
          throw new ServiceUnavailableError(
            model.service,
            `http://${this.config.services[model.service].host}:${this.config.services[model.service].port}`
          );
        }

        // Make the request
        const response = await client.generateContent(request);
        return response;

      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Handle the error and determine if we should retry or failover
        const errorResult = await this.handleRequestError(error as Error, model, attempt);

        if (!errorResult.shouldRetry) {
          // Try failover if enabled and available
          if (this.config.routing.enableFailover && errorResult.fallbackModel) {
            try {
              return await this.routeRequest(request, errorResult.fallbackModel);
            } catch (failoverError) {
              // If failover also fails, throw the original error
              throw lastError;
            }
          }
          throw lastError;
        }

        // Wait before retrying
        if (attempt <= this.config.routing.maxRetries) {
          await this.delay(this.errorHandler.getRetryDelay(attempt - 1));
        }
      }
    }

    throw lastError || new Error('Maximum retries exceeded');
  }

  /**
   * Route a streaming request to the appropriate service
   */
  async *routeStreamRequest(
    request: GenerateContentRequest,
    model: AvailableModel
  ): AsyncGenerator<GenerateContentResponse> {
    const client = this.getClientForService(model.service);

    // Validate that the model is available
    if (!this.availableModels.has(model.id)) {
      throw new ModelNotFoundError(model.service, model.id);
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.config.routing.maxRetries) {
      try {
        // Check service health before making request
        const isHealthy = await this.checkServiceHealth(model.service);
        if (!isHealthy) {
          throw new ServiceUnavailableError(
            model.service,
            `http://${this.config.services[model.service].host}:${this.config.services[model.service].port}`
          );
        }

        // Make the streaming request
        yield* client.generateContentStream(request);
        return; // Success, exit the retry loop

      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Handle the error and determine if we should retry or failover
        const errorResult = await this.handleRequestError(error as Error, model, attempt);

        if (!errorResult.shouldRetry) {
          // Try failover if enabled and available
          if (this.config.routing.enableFailover && errorResult.fallbackModel) {
            try {
              yield* this.routeStreamRequest(request, errorResult.fallbackModel);
              return;
            } catch (failoverError) {
              // If failover also fails, throw the original error
              throw lastError;
            }
          }
          throw lastError;
        }

        // Wait before retrying
        if (attempt <= this.config.routing.maxRetries) {
          await this.delay(this.errorHandler.getRetryDelay(attempt - 1));
        }
      }
    }

    throw lastError || new Error('Maximum retries exceeded');
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

    // Clear health cache for the updated service
    this.serviceHealthCache.set(service, { healthy: false, lastCheck: new Date(0) });
  }

  /**
   * Update the list of available models
   */
  updateAvailableModels(models: AvailableModel[]): void {
    this.availableModels.clear();

    for (const model of models) {
      this.availableModels.set(model.id, model);
    }

    // Update error handler with new models for fallback
    this.errorHandler.updateFallbackModels(models);
  }

  /**
   * Get the status of a specific service
   */
  async getServiceStatus(service: LocalLLMService): Promise<boolean> {
    return await this.checkServiceHealth(service);
  }

  /**
   * Update the entire router configuration
   */
  updateConfig(config: Partial<RequestRouterConfig>): void {
    this.config = this.mergeConfig(config);

    // Update clients with new service configs
    this.lmStudioClient.updateConfig(this.config.services.lmstudio);
    this.ollamaClient.updateConfig(this.config.services.ollama);

    // Update error handler configuration
    this.errorHandler = new LocalLLMErrorHandler({
      enableRetry: true,
      maxRetries: this.config.routing.maxRetries,
      retryDelay: this.config.routing.retryDelay,
      fallbackModels: Array.from(this.availableModels.values()),
    });

    // Clear health cache
    this.serviceHealthCache.clear();
    this.serviceHealthCache.set('lmstudio', { healthy: false, lastCheck: new Date(0) });
    this.serviceHealthCache.set('ollama', { healthy: false, lastCheck: new Date(0) });
  }

  /**
   * Get current configuration
   */
  getConfig(): RequestRouterConfig {
    return { ...this.config };
  }

  /**
   * Get the client for a specific service
   */
  private getClientForService(service: LocalLLMService): LocalLLMClient {
    switch (service) {
      case 'lmstudio':
        return this.lmStudioClient;
      case 'ollama':
        return this.ollamaClient;
      default:
        throw new Error(`Unknown service: ${service}`);
    }
  }

  /**
   * Check service health with caching
   */
  private async checkServiceHealth(service: LocalLLMService): Promise<boolean> {
    const cached = this.serviceHealthCache.get(service);
    const now = new Date();

    // Use cached result if it's recent
    if (cached && (now.getTime() - cached.lastCheck.getTime()) < this.config.routing.healthCheckInterval) {
      return cached.healthy;
    }

    try {
      const client = this.getClientForService(service);
      const status = await client.checkHealth();

      this.serviceHealthCache.set(service, {
        healthy: status.available,
        lastCheck: now,
      });

      return status.available;
    } catch (error) {
      this.serviceHealthCache.set(service, {
        healthy: false,
        lastCheck: now,
      });

      return false;
    }
  }

  /**
   * Handle request errors and determine retry/failover strategy
   */
  private async handleRequestError(
    error: Error,
    model: AvailableModel,
    attempt: number
  ) {
    const context = {
      service: model.service,
      operation: 'generateContent',
      modelId: model.id,
      attempt,
    };

    if (error instanceof LocalLLMError) {
      return await this.errorHandler.handleLocalLLMError(error, context);
    } else {
      return await this.errorHandler.handleNetworkError(error, context);
    }
  }

  /**
   * Initialize router from discovery service
   */
  private async initializeFromDiscoveryService(discoveryService: LocalModelDiscoveryService): Promise<void> {
    try {
      const models = await discoveryService.scanAvailableModels();
      this.updateAvailableModels(models);
    } catch (error) {
      // Log error but don't fail initialization
      console.warn('Failed to initialize router from discovery service:', error);
    }
  }

  /**
   * Utility method to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Merge user config with defaults
   */
  private mergeConfig(userConfig?: Partial<RequestRouterConfig>): RequestRouterConfig {
    if (!userConfig) {
      return { ...DEFAULT_ROUTER_CONFIG };
    }

    return {
      services: {
        lmstudio: { ...DEFAULT_ROUTER_CONFIG.services.lmstudio, ...userConfig.services?.lmstudio },
        ollama: { ...DEFAULT_ROUTER_CONFIG.services.ollama, ...userConfig.services?.ollama },
      },
      routing: { ...DEFAULT_ROUTER_CONFIG.routing, ...userConfig.routing },
    };
  }

  /**
   * Find a fallback model from a different service
   */
  private findFallbackModel(unavailableService: LocalLLMService): AvailableModel | undefined {
    for (const model of this.availableModels.values()) {
      if (model.service !== unavailableService) {
        return model;
      }
    }
    return undefined;
  }

  /**
   * Get statistics about the router
   */
  getStats(): {
    availableModels: number;
    serviceHealth: Record<LocalLLMService, boolean>;
    lastHealthCheck: Record<LocalLLMService, Date>;
  } {
    const stats = {
      availableModels: this.availableModels.size,
      serviceHealth: {} as Record<LocalLLMService, boolean>,
      lastHealthCheck: {} as Record<LocalLLMService, Date>,
    };

    for (const [service, health] of this.serviceHealthCache.entries()) {
      stats.serviceHealth[service] = health.healthy;
      stats.lastHealthCheck[service] = health.lastCheck;
    }

    return stats;
  }
}