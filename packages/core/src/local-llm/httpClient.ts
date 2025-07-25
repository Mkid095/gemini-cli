/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServiceConfig, LocalLLMService, APIError, ServiceUnavailableError } from './types.js';

/**
 * HTTP client utilities for local LLM service communication
 */

export interface HttpClientOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export class HttpClient {
  private service: LocalLLMService;
  private config: ServiceConfig;
  private options: HttpClientOptions;

  constructor(service: LocalLLMService, config: ServiceConfig, options: HttpClientOptions = {}) {
    this.service = service;
    this.config = config;
    this.options = {
      timeout: options.timeout || config.timeout || 30000,
      maxRetries: options.maxRetries || config.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
    };
  }

  /**
   * Get the base URL for the service
   */
  private getBaseUrl(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }

  /**
   * Make an HTTP request with retry logic
   */
  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: unknown,
    headers: Record<string, string> = {}
  ): Promise<HttpResponse<T>> {
    const url = `${this.getBaseUrl()}${path}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': `NextMavens/1.0.0 (${process.platform}; ${process.arch})`,
      ...headers,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxRetries!; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: data ? JSON.stringify(data) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        let responseData: T;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = (await response.text()) as T;
        }

        if (!response.ok) {
          throw new APIError(
            this.service,
            `HTTP ${response.status}: ${response.statusText}`,
            response.status
          );
        }

        return {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        };

      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof APIError && error.statusCode && error.statusCode < 500) {
          throw error;
        }

        // If this is the last attempt, throw the error
        if (attempt === this.options.maxRetries) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw new ServiceUnavailableError(
              this.service,
              url,
              new Error(`Request timeout after ${this.options.timeout}ms`)
            );
          }
          
          if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new ServiceUnavailableError(this.service, url, error);
          }

          throw error;
        }

        // Wait before retrying
        await this.delay(this.options.retryDelay! * (attempt + 1));
      }
    }

    throw lastError || new Error('Unknown error occurred');
  }

  /**
   * Make a GET request
   */
  async get<T = unknown>(path: string, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>('GET', path, undefined, headers);
  }

  /**
   * Make a POST request
   */
  async post<T = unknown>(
    path: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<HttpResponse<T>> {
    return this.request<T>('POST', path, data, headers);
  }

  /**
   * Make a streaming POST request
   */
  async *postStream<T = unknown>(
    path: string,
    data?: unknown,
    headers?: Record<string, string>
  ): AsyncGenerator<T> {
    const url = `${this.getBaseUrl()}${path}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'User-Agent': `NextMavens/1.0.0 (${process.platform}; ${process.arch})`,
      ...headers,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new APIError(
          this.service,
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      if (!response.body) {
        throw new APIError(this.service, 'No response body for streaming request');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6);
              if (data === '[DONE]') {
                return;
              }
              
              try {
                const parsed = JSON.parse(data);
                yield parsed as T;
              } catch (parseError) {
                // Skip invalid JSON lines
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableError(
          this.service,
          url,
          new Error(`Streaming request timeout after ${this.options.timeout}ms`)
        );
      }
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ServiceUnavailableError(this.service, url, error);
      }

      throw error;
    }
  }

  /**
   * Check if the service is reachable
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.request('GET', '/health', undefined, {}, );
      return response.status >= 200 && response.status < 300;
    } catch {
      return false;
    }
  }

  /**
   * Utility method to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}