/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Core types and interfaces for local LLM services (LM Studio and Ollama)
 */

export type LocalLLMService = 'lmstudio' | 'ollama';

export interface AvailableModel {
  id: string;
  name: string;
  service: LocalLLMService;
  size?: string;
  capabilities?: ModelCapabilities;
  description?: string;
}

export interface ModelCapabilities {
  supportsStreaming: boolean;
  supportsChat: boolean;
  supportsCompletion: boolean;
  maxContextLength?: number;
  supportsSystemMessages: boolean;
}

export interface ServiceStatus {
  available: boolean;
  endpoint: string;
  error?: string;
  responseTime?: number;
}

export interface ServiceConfig {
  host: string;
  port: number;
  enabled: boolean;
  timeout: number;
  maxRetries: number;
}

export interface GenerateContentRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemMessage?: string;
}

export interface GenerateContentResponse {
  content: string;
  usage?: TokenUsage;
  model: string;
  finishReason?: 'stop' | 'length' | 'error';
  error?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  size?: string;
  description?: string;
  capabilities?: ModelCapabilities;
}

/**
 * Base interface for local LLM clients
 */
export interface LocalLLMClient {
  service: LocalLLMService;
  config: ServiceConfig;
  
  /**
   * Check if the service is available and healthy
   */
  checkHealth(): Promise<ServiceStatus>;
  
  /**
   * List available models from this service
   */
  listModels(): Promise<ModelInfo[]>;
  
  /**
   * Generate content using the specified model
   */
  generateContent(request: GenerateContentRequest): Promise<GenerateContentResponse>;
  
  /**
   * Generate content with streaming response
   */
  generateContentStream(request: GenerateContentRequest): AsyncGenerator<GenerateContentResponse>;
}

/**
 * Configuration for Next Mavens local LLM system
 */
export interface NextMavensConfig {
  selectedModel?: {
    id: string;
    service: LocalLLMService;
  };
  services: {
    lmstudio: ServiceConfig;
    ollama: ServiceConfig;
  };
  ui: {
    theme: string;
    autoRefreshModels: boolean;
    showModelDetails: boolean;
  };
  performance: {
    requestTimeout: number;
    maxConcurrentRequests: number;
    enableCaching: boolean;
  };
}

/**
 * Error types for local LLM operations
 */
export class LocalLLMError extends Error {
  constructor(
    message: string,
    public service: LocalLLMService,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'LocalLLMError';
  }
}

export class ServiceUnavailableError extends LocalLLMError {
  constructor(service: LocalLLMService, endpoint: string, originalError?: Error) {
    super(
      `${service} service is not available at ${endpoint}`,
      service,
      'SERVICE_UNAVAILABLE',
      originalError
    );
    this.name = 'ServiceUnavailableError';
  }
}

export class ModelNotFoundError extends LocalLLMError {
  constructor(service: LocalLLMService, modelId: string) {
    super(
      `Model '${modelId}' not found in ${service}`,
      service,
      'MODEL_NOT_FOUND'
    );
    this.name = 'ModelNotFoundError';
  }
}

export class APIError extends LocalLLMError {
  constructor(
    service: LocalLLMService,
    message: string,
    public statusCode?: number,
    originalError?: Error
  ) {
    super(message, service, 'API_ERROR', originalError);
    this.name = 'APIError';
    this.statusCode = statusCode;
  }
}