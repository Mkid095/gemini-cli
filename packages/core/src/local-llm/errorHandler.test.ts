/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalLLMErrorHandler } from './errorHandler.js';
import {
  ServiceUnavailableError,
  ModelNotFoundError,
  APIError,
  AvailableModel,
} from './types.js';

describe('LocalLLMErrorHandler', () => {
  let errorHandler: LocalLLMErrorHandler;
  let fallbackModels: AvailableModel[];

  beforeEach(() => {
    fallbackModels = [
      {
        id: 'llama2:7b',
        name: 'Llama 2 7B',
        service: 'ollama',
        capabilities: {
          supportsStreaming: true,
          supportsChat: true,
          supportsCompletion: true,
          supportsSystemMessages: true,
        },
      },
      {
        id: 'codellama:13b',
        name: 'Code Llama 13B',
        service: 'lmstudio',
        capabilities: {
          supportsStreaming: true,
          supportsChat: true,
          supportsCompletion: true,
          supportsSystemMessages: true,
        },
      },
    ];

    errorHandler = new LocalLLMErrorHandler({
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      fallbackModels,
    });
  });

  describe('handleServiceUnavailable', () => {
    it('should handle LM Studio service unavailable error', async () => {
      const error = new ServiceUnavailableError('lmstudio', 'http://localhost:1234');
      const context = {
        service: 'lmstudio' as const,
        operation: 'generateContent',
        endpoint: 'http://localhost:1234',
        attempt: 1,
      };

      const result = await errorHandler.handleServiceUnavailable(error, context);

      expect(result.shouldRetry).toBe(true);
      expect(result.fallbackModel).toBeDefined();
      expect(result.fallbackModel?.service).toBe('ollama');
      expect(result.userMessage).toContain('LM Studio is not available');
      expect(result.technicalMessage).toContain('lmstudio service unavailable');
    });

    it('should handle Ollama service unavailable error', async () => {
      const error = new ServiceUnavailableError('ollama', 'http://localhost:11434');
      const context = {
        service: 'ollama' as const,
        operation: 'listModels',
        endpoint: 'http://localhost:11434',
        attempt: 1,
      };

      const result = await errorHandler.handleServiceUnavailable(error, context);

      expect(result.shouldRetry).toBe(true);
      expect(result.fallbackModel).toBeDefined();
      expect(result.fallbackModel?.service).toBe('lmstudio');
      expect(result.userMessage).toContain('Ollama is not available');
    });

    it('should not retry after max attempts', async () => {
      const error = new ServiceUnavailableError('lmstudio', 'http://localhost:1234');
      const context = {
        service: 'lmstudio' as const,
        operation: 'generateContent',
        endpoint: 'http://localhost:1234',
        attempt: 3,
      };

      const result = await errorHandler.handleServiceUnavailable(error, context);

      expect(result.shouldRetry).toBe(false);
    });
  });

  describe('handleModelNotFound', () => {
    it('should handle model not found error with fallback', async () => {
      const error = new ModelNotFoundError('lmstudio', 'llama2:7b');
      const context = {
        service: 'lmstudio' as const,
        operation: 'generateContent',
        modelId: 'llama2:7b',
        attempt: 1,
      };

      const result = await errorHandler.handleModelNotFound(error, context);

      expect(result.shouldRetry).toBe(false);
      expect(result.fallbackModel).toBeDefined();
      expect(result.fallbackModel?.id).toBe('llama2:7b');
      expect(result.fallbackModel?.service).toBe('ollama');
      expect(result.userMessage).toContain('no longer available');
    });

    it('should find similar model when exact match not available', async () => {
      const error = new ModelNotFoundError('lmstudio', 'llama:7b');
      const context = {
        service: 'lmstudio' as const,
        operation: 'generateContent',
        modelId: 'llama:7b',
        attempt: 1,
      };

      const result = await errorHandler.handleModelNotFound(error, context);

      expect(result.fallbackModel).toBeDefined();
      expect(result.fallbackModel?.name).toContain('Llama');
    });
  });

  describe('handleAPIError', () => {
    it('should handle 400 Bad Request error', async () => {
      const error = new APIError('ollama', 'Invalid request format', 400);
      const context = {
        service: 'ollama' as const,
        operation: 'generateContent',
        attempt: 1,
      };

      const result = await errorHandler.handleAPIError(error, context);

      expect(result.shouldRetry).toBe(false);
      expect(result.userMessage).toContain('Invalid request');
      expect(result.technicalMessage).toContain('Status: 400');
    });

    it('should handle 500 Server Error with retry', async () => {
      const error = new APIError('lmstudio', 'Internal server error', 500);
      const context = {
        service: 'lmstudio' as const,
        operation: 'generateContent',
        attempt: 1,
      };

      const result = await errorHandler.handleAPIError(error, context);

      expect(result.shouldRetry).toBe(true);
      expect(result.userMessage).toContain('server error');
    });

    it('should handle 429 Rate Limit error', async () => {
      const error = new APIError('ollama', 'Too many requests', 429);
      const context = {
        service: 'ollama' as const,
        operation: 'generateContent',
        attempt: 1,
      };

      const result = await errorHandler.handleAPIError(error, context);

      expect(result.shouldRetry).toBe(false);
      expect(result.userMessage).toContain('Rate limit exceeded');
    });
  });

  describe('handleNetworkError', () => {
    it('should handle network connection error', async () => {
      const error = new Error('ECONNREFUSED');
      const context = {
        service: 'lmstudio' as const,
        operation: 'checkHealth',
        attempt: 1,
      };

      const result = await errorHandler.handleNetworkError(error, context);

      expect(result.shouldRetry).toBe(true);
      expect(result.userMessage).toContain('Network error');
      expect(result.technicalMessage).toContain('ECONNREFUSED');
    });
  });

  describe('utility methods', () => {
    it('should calculate retry delay with exponential backoff', () => {
      expect(errorHandler.getRetryDelay(0)).toBe(1000);
      expect(errorHandler.getRetryDelay(1)).toBe(2000);
      expect(errorHandler.getRetryDelay(2)).toBe(4000);
    });

    it('should update fallback models', () => {
      const newModels: AvailableModel[] = [
        {
          id: 'mistral:7b',
          name: 'Mistral 7B',
          service: 'ollama',
          capabilities: {
            supportsStreaming: true,
            supportsChat: true,
            supportsCompletion: true,
            supportsSystemMessages: true,
          },
        },
      ];

      errorHandler.updateFallbackModels(newModels);

      // Test that the new models are used
      const error = new ServiceUnavailableError('lmstudio', 'http://localhost:1234');
      const context = {
        service: 'lmstudio' as const,
        operation: 'generateContent',
        endpoint: 'http://localhost:1234',
        attempt: 1,
      };

      errorHandler.handleServiceUnavailable(error, context).then(result => {
        expect(result.fallbackModel?.id).toBe('mistral:7b');
      });
    });
  });

  describe('error handler with retry disabled', () => {
    it('should not retry when retry is disabled', async () => {
      const noRetryHandler = new LocalLLMErrorHandler({
        enableRetry: false,
        fallbackModels,
      });

      const error = new ServiceUnavailableError('lmstudio', 'http://localhost:1234');
      const context = {
        service: 'lmstudio' as const,
        operation: 'generateContent',
        endpoint: 'http://localhost:1234',
        attempt: 1,
      };

      const result = await noRetryHandler.handleServiceUnavailable(error, context);

      expect(result.shouldRetry).toBe(false);
    });
  });
});