/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LocalLLMService,
  LocalLLMError,
  ServiceUnavailableError,
  ModelNotFoundError,
  APIError,
  AvailableModel,
} from './types.js';

/**
 * Error handling framework for local LLM service communication
 */

export interface ErrorHandlerOptions {
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  fallbackModels: AvailableModel[];
}

export interface ErrorContext {
  service: LocalLLMService;
  operation: string;
  modelId?: string;
  endpoint?: string;
  attempt?: number;
}

export interface ErrorHandlingResult {
  shouldRetry: boolean;
  fallbackModel?: AvailableModel;
  userMessage: string;
  technicalMessage: string;
}

export class LocalLLMErrorHandler {
  private options: ErrorHandlerOptions;

  constructor(options: Partial<ErrorHandlerOptions> = {}) {
    this.options = {
      enableRetry: options.enableRetry ?? true,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      fallbackModels: options.fallbackModels ?? [],
    };
  }

  /**
   * Handle service unavailable errors
   */
  async handleServiceUnavailable(
    error: ServiceUnavailableError,
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    const userMessage = this.createServiceUnavailableMessage(error.service);
    const technicalMessage = `${error.service} service unavailable at ${context.endpoint}: ${error.message}`;

    // Check if we have fallback models from other services
    const fallbackModel = this.findFallbackModel(error.service);

    return {
      shouldRetry: this.shouldRetryError(error, context),
      fallbackModel,
      userMessage,
      technicalMessage,
    };
  }

  /**
   * Handle model not found errors
   */
  async handleModelNotFound(
    error: ModelNotFoundError,
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    const userMessage = `The model "${context.modelId}" is no longer available. Please select a different model.`;
    const technicalMessage = `Model ${context.modelId} not found in ${error.service}`;

    // Try to find a similar model as fallback
    const fallbackModel = this.findSimilarModel(context.modelId || '');

    return {
      shouldRetry: false, // Don't retry model not found errors
      fallbackModel,
      userMessage,
      technicalMessage,
    };
  }

  /**
   * Handle API errors
   */
  async handleAPIError(
    error: APIError,
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    const userMessage = this.createAPIErrorMessage(error, context);
    const technicalMessage = `API error in ${error.service}: ${error.message} (Status: ${error.statusCode})`;

    return {
      shouldRetry: this.shouldRetryAPIError(error, context),
      fallbackModel: undefined,
      userMessage,
      technicalMessage,
    };
  }

  /**
   * Handle network errors
   */
  async handleNetworkError(
    error: Error,
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    const userMessage = `Network error connecting to ${context.service}. Please check your connection and try again.`;
    const technicalMessage = `Network error for ${context.service}: ${error.message}`;

    return {
      shouldRetry: this.shouldRetryError(error, context),
      fallbackModel: undefined,
      userMessage,
      technicalMessage,
    };
  }

  /**
   * Handle generic local LLM errors
   */
  async handleLocalLLMError(
    error: LocalLLMError,
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    if (error instanceof ServiceUnavailableError) {
      return this.handleServiceUnavailable(error, context);
    }

    if (error instanceof ModelNotFoundError) {
      return this.handleModelNotFound(error, context);
    }

    if (error instanceof APIError) {
      return this.handleAPIError(error, context);
    }

    // Generic local LLM error
    const userMessage = `An error occurred with ${error.service}: ${error.message}`;
    const technicalMessage = `LocalLLMError in ${error.service}: ${error.message} (Code: ${error.code})`;

    return {
      shouldRetry: this.shouldRetryError(error, context),
      fallbackModel: undefined,
      userMessage,
      technicalMessage,
    };
  }

  /**
   * Determine if an error should be retried
   */
  private shouldRetryError(error: Error, context: ErrorContext): boolean {
    if (!this.options.enableRetry) {
      return false;
    }

    if ((context.attempt || 0) >= this.options.maxRetries) {
      return false;
    }

    // Don't retry client errors (4xx)
    if (error instanceof APIError && error.statusCode && error.statusCode < 500) {
      return false;
    }

    // Don't retry model not found errors
    if (error instanceof ModelNotFoundError) {
      return false;
    }

    // Retry service unavailable and server errors
    return error instanceof ServiceUnavailableError || 
           (error instanceof APIError && (!error.statusCode || error.statusCode >= 500));
  }

  /**
   * Determine if an API error should be retried
   */
  private shouldRetryAPIError(error: APIError, context: ErrorContext): boolean {
    // Don't retry client errors (4xx)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return false;
    }

    return this.shouldRetryError(error, context);
  }

  /**
   * Find a fallback model from a different service
   */
  private findFallbackModel(unavailableService: LocalLLMService): AvailableModel | undefined {
    return this.options.fallbackModels.find(model => model.service !== unavailableService);
  }

  /**
   * Find a similar model as fallback
   */
  private findSimilarModel(modelId: string): AvailableModel | undefined {
    // Simple similarity matching - could be enhanced with more sophisticated logic
    const lowerModelId = modelId.toLowerCase();
    
    return this.options.fallbackModels.find(model => {
      const lowerModelName = model.name.toLowerCase();
      return lowerModelName.includes(lowerModelId) || 
             lowerModelId.includes(lowerModelName) ||
             this.calculateSimilarity(lowerModelId, lowerModelName) > 0.5;
    });
  }

  /**
   * Calculate similarity between two strings (simple implementation)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Create user-friendly message for service unavailable errors
   */
  private createServiceUnavailableMessage(service: LocalLLMService): string {
    const serviceInfo = {
      lmstudio: {
        name: 'LM Studio',
        defaultPort: 1234,
        setupInstructions: 'Please ensure LM Studio is running and the local server is started.',
      },
      ollama: {
        name: 'Ollama',
        defaultPort: 11434,
        setupInstructions: 'Please ensure Ollama is installed and running.',
      },
    };

    const info = serviceInfo[service];
    return `${info.name} is not available. ${info.setupInstructions} The service should be accessible at localhost:${info.defaultPort}.`;
  }

  /**
   * Create user-friendly message for API errors
   */
  private createAPIErrorMessage(error: APIError, context: ErrorContext): string {
    if (error.statusCode === 400) {
      return `Invalid request to ${context.service}. Please check your input and try again.`;
    }
    
    if (error.statusCode === 401) {
      return `Authentication failed with ${context.service}. Please check your configuration.`;
    }
    
    if (error.statusCode === 404) {
      return `The requested resource was not found in ${context.service}.`;
    }
    
    if (error.statusCode === 429) {
      return `Rate limit exceeded for ${context.service}. Please wait a moment and try again.`;
    }
    
    if (error.statusCode && error.statusCode >= 500) {
      return `${context.service} server error. Please try again later.`;
    }
    
    return `An error occurred with ${context.service}: ${error.message}`;
  }

  /**
   * Update fallback models list
   */
  updateFallbackModels(models: AvailableModel[]): void {
    this.options.fallbackModels = models;
  }

  /**
   * Get retry delay for the given attempt
   */
  getRetryDelay(attempt: number): number {
    return this.options.retryDelay * Math.pow(2, attempt); // Exponential backoff
  }
}