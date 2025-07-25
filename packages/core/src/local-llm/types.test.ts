/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  LocalLLMError,
  ServiceUnavailableError,
  ModelNotFoundError,
  APIError,
} from './types.js';

describe('LocalLLM Error Types', () => {
  describe('LocalLLMError', () => {
    it('should create error with correct properties', () => {
      const error = new LocalLLMError('Test error', 'lmstudio', 'TEST_CODE');
      
      expect(error.message).toBe('Test error');
      expect(error.service).toBe('lmstudio');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('LocalLLMError');
    });

    it('should include original error when provided', () => {
      const originalError = new Error('Original error');
      const error = new LocalLLMError('Test error', 'ollama', 'TEST_CODE', originalError);
      
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create service unavailable error with correct message', () => {
      const error = new ServiceUnavailableError('lmstudio', 'http://localhost:1234');
      
      expect(error.message).toBe('lmstudio service is not available at http://localhost:1234');
      expect(error.service).toBe('lmstudio');
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.name).toBe('ServiceUnavailableError');
    });

    it('should include original error when provided', () => {
      const originalError = new Error('Connection refused');
      const error = new ServiceUnavailableError('ollama', 'http://localhost:11434', originalError);
      
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('ModelNotFoundError', () => {
    it('should create model not found error with correct message', () => {
      const error = new ModelNotFoundError('lmstudio', 'llama2:7b');
      
      expect(error.message).toBe("Model 'llama2:7b' not found in lmstudio");
      expect(error.service).toBe('lmstudio');
      expect(error.code).toBe('MODEL_NOT_FOUND');
      expect(error.name).toBe('ModelNotFoundError');
    });
  });

  describe('APIError', () => {
    it('should create API error with status code', () => {
      const error = new APIError('ollama', 'Bad request', 400);
      
      expect(error.message).toBe('Bad request');
      expect(error.service).toBe('ollama');
      expect(error.code).toBe('API_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('APIError');
    });

    it('should create API error without status code', () => {
      const error = new APIError('lmstudio', 'Unknown error');
      
      expect(error.message).toBe('Unknown error');
      expect(error.statusCode).toBeUndefined();
    });

    it('should include original error when provided', () => {
      const originalError = new Error('Network error');
      const error = new APIError('ollama', 'Request failed', 500, originalError);
      
      expect(error.originalError).toBe(originalError);
    });
  });
});