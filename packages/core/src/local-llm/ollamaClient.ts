/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HttpClient } from './httpClient.js';
import {
  LocalLLMClient,
  ServiceConfig,
  ServiceStatus,
  ModelInfo,
  GenerateContentRequest,
  GenerateContentResponse,
  ModelCapabilities,
  ServiceUnavailableError,
  APIError,
  ModelNotFoundError,
} from './types.js';

/**
 * Ollama API response types
 */
interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaModelsResponse {
  models: OllamaModel[];
}

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    stop?: string[];
  };
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    stop?: string[];
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Ollama client implementation using Ollama-specific API
 */
export class OllamaClient implements LocalLLMClient {
  public readonly service = 'ollama' as const;
  public readonly config: ServiceConfig;
  private httpClient: HttpClient;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.httpClient = new HttpClient('ollama', config);
  }

  /**
   * Check if Ollama service is available and healthy
   */
  async checkHealth(): Promise<ServiceStatus> {
    try {
      const startTime = Date.now();
      
      // Try to get models list as health check
      await this.httpClient.get('/api/tags');
      
      const responseTime = Date.now() - startTime;
      
      return {
        available: true,
        endpoint: `http://${this.config.host}:${this.config.port}`,
        responseTime,
      };
    } catch (error) {
      return {
        available: false,
        endpoint: `http://${this.config.host}:${this.config.port}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List available models from Ollama
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.httpClient.get<OllamaModelsResponse>('/api/tags');
      
      return response.data.models.map(model => ({
        id: model.name,
        name: this.formatModelName(model.name),
        size: this.formatModelSize(model.size),
        description: `Ollama model: ${model.name} (${model.details.parameter_size})`,
        capabilities: this.getModelCapabilities(model),
      }));
    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new ServiceUnavailableError(
          'ollama',
          `http://${this.config.host}:${this.config.port}`,
          error
        );
      }
      throw error;
    }
  }

  /**
   * Generate content using Ollama
   */
  async generateContent(request: GenerateContentRequest): Promise<GenerateContentResponse> {
    try {
      // Use chat API if we have multiple messages or system message
      if (request.messages.length > 1 || request.systemMessage) {
        return await this.generateChatContent(request);
      } else {
        // Use generate API for simple single prompts
        return await this.generateSimpleContent(request);
      }
    } catch (error) {
      if (error instanceof APIError && error.statusCode === 404) {
        throw new ModelNotFoundError('ollama', request.model);
      }
      throw error;
    }
  }

  /**
   * Generate content with streaming response
   */
  async *generateContentStream(request: GenerateContentRequest): AsyncGenerator<GenerateContentResponse> {
    try {
      // Use chat API if we have multiple messages or system message
      if (request.messages.length > 1 || request.systemMessage) {
        yield* this.generateChatContentStream(request);
      } else {
        // Use generate API for simple single prompts
        yield* this.generateSimpleContentStream(request);
      }
    } catch (error) {
      if (error instanceof APIError && error.statusCode === 404) {
        throw new ModelNotFoundError('ollama', request.model);
      }
      throw error;
    }
  }

  /**
   * Generate content using Ollama chat API
   */
  private async generateChatContent(request: GenerateContentRequest): Promise<GenerateContentResponse> {
    const ollamaRequest = this.convertToChatRequest(request);
    
    const response = await this.httpClient.post<OllamaChatResponse>(
      '/api/chat',
      ollamaRequest
    );

    return this.convertFromChatResponse(response.data);
  }

  /**
   * Generate content using Ollama generate API
   */
  private async generateSimpleContent(request: GenerateContentRequest): Promise<GenerateContentResponse> {
    const ollamaRequest = this.convertToGenerateRequest(request);
    
    const response = await this.httpClient.post<OllamaGenerateResponse>(
      '/api/generate',
      ollamaRequest
    );

    return this.convertFromGenerateResponse(response.data);
  }

  /**
   * Generate streaming content using Ollama chat API
   */
  private async *generateChatContentStream(request: GenerateContentRequest): AsyncGenerator<GenerateContentResponse> {
    const ollamaRequest = this.convertToChatRequest(request, true);
    
    let fullContent = '';
    
    for await (const chunk of this.httpClient.postStream<OllamaChatResponse>(
      '/api/chat',
      ollamaRequest
    )) {
      if (chunk.message?.content) {
        fullContent += chunk.message.content;
        
        yield {
          content: chunk.message.content,
          model: request.model,
          finishReason: chunk.done ? 'stop' : undefined,
        };
      }
      
      if (chunk.done) {
        // Final chunk with usage information
        yield {
          content: '',
          model: request.model,
          finishReason: 'stop',
          usage: this.extractUsageFromChatResponse(chunk),
        };
      }
    }
  }

  /**
   * Generate streaming content using Ollama generate API
   */
  private async *generateSimpleContentStream(request: GenerateContentRequest): AsyncGenerator<GenerateContentResponse> {
    const ollamaRequest = this.convertToGenerateRequest(request, true);
    
    let fullContent = '';
    
    for await (const chunk of this.httpClient.postStream<OllamaGenerateResponse>(
      '/api/generate',
      ollamaRequest
    )) {
      if (chunk.response) {
        fullContent += chunk.response;
        
        yield {
          content: chunk.response,
          model: request.model,
          finishReason: chunk.done ? 'stop' : undefined,
        };
      }
      
      if (chunk.done) {
        // Final chunk with usage information
        yield {
          content: '',
          model: request.model,
          finishReason: 'stop',
          usage: this.extractUsageFromGenerateResponse(chunk),
        };
      }
    }
  }

  /**
   * Convert internal request format to Ollama chat format
   */
  private convertToChatRequest(
    request: GenerateContentRequest,
    stream = false
  ): OllamaChatRequest {
    const messages: OllamaChatMessage[] = [];
    
    // Add system message if provided
    if (request.systemMessage) {
      messages.push({
        role: 'system',
        content: request.systemMessage,
      });
    }
    
    // Convert chat messages
    messages.push(...request.messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    })));

    return {
      model: request.model,
      messages,
      stream,
      options: {
        temperature: request.temperature,
        num_predict: request.maxTokens,
      },
    };
  }

  /**
   * Convert internal request format to Ollama generate format
   */
  private convertToGenerateRequest(
    request: GenerateContentRequest,
    stream = false
  ): OllamaGenerateRequest {
    // For generate API, we need to convert messages to a single prompt
    let prompt = '';
    
    if (request.systemMessage) {
      prompt += `System: ${request.systemMessage}\n\n`;
    }
    
    // Combine all messages into a single prompt
    for (const message of request.messages) {
      prompt += `${message.role === 'user' ? 'Human' : 'Assistant'}: ${message.content}\n`;
    }
    
    prompt += 'Assistant: ';

    return {
      model: request.model,
      prompt,
      stream,
      options: {
        temperature: request.temperature,
        num_predict: request.maxTokens,
      },
    };
  }

  /**
   * Convert Ollama chat response to internal format
   */
  private convertFromChatResponse(response: OllamaChatResponse): GenerateContentResponse {
    return {
      content: response.message?.content || '',
      model: response.model,
      finishReason: response.done ? 'stop' : undefined,
      usage: this.extractUsageFromChatResponse(response),
    };
  }

  /**
   * Convert Ollama generate response to internal format
   */
  private convertFromGenerateResponse(response: OllamaGenerateResponse): GenerateContentResponse {
    return {
      content: response.response || '',
      model: response.model,
      finishReason: response.done ? 'stop' : undefined,
      usage: this.extractUsageFromGenerateResponse(response),
    };
  }

  /**
   * Extract usage information from Ollama chat response
   */
  private extractUsageFromChatResponse(response: OllamaChatResponse) {
    if (!response.prompt_eval_count && !response.eval_count) {
      return undefined;
    }

    return {
      promptTokens: response.prompt_eval_count || 0,
      completionTokens: response.eval_count || 0,
      totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
    };
  }

  /**
   * Extract usage information from Ollama generate response
   */
  private extractUsageFromGenerateResponse(response: OllamaGenerateResponse) {
    if (!response.prompt_eval_count && !response.eval_count) {
      return undefined;
    }

    return {
      promptTokens: response.prompt_eval_count || 0,
      completionTokens: response.eval_count || 0,
      totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
    };
  }

  /**
   * Format model name for display
   */
  private formatModelName(modelName: string): string {
    // Remove version tags and format for display
    return modelName
      .replace(/:[^:]*$/, '') // Remove version tag (e.g., :latest, :7b)
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Format model size for display
   */
  private formatModelSize(sizeBytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = sizeBytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get model capabilities based on model information
   */
  private getModelCapabilities(model: OllamaModel): ModelCapabilities {
    return {
      supportsStreaming: true,
      supportsChat: true,
      supportsCompletion: true,
      supportsSystemMessages: true,
      maxContextLength: this.estimateContextLength(model),
    };
  }

  /**
   * Estimate context length based on model information
   */
  private estimateContextLength(model: OllamaModel): number {
    const modelName = model.name.toLowerCase();
    const parameterSize = model.details.parameter_size.toLowerCase();
    
    // Context length estimation based on model family and size
    if (modelName.includes('llama2') || modelName.includes('llama-2')) {
      return 4096;
    }
    
    if (modelName.includes('codellama') || modelName.includes('code-llama')) {
      return 16384; // Code Llama typically has longer context
    }
    
    if (modelName.includes('mistral')) {
      return 8192;
    }
    
    if (modelName.includes('gemma')) {
      return 8192;
    }
    
    // Default based on parameter size
    if (parameterSize.includes('70b') || parameterSize.includes('65b')) {
      return 4096;
    }
    
    if (parameterSize.includes('13b') || parameterSize.includes('7b')) {
      return 4096;
    }
    
    // Default context length
    return 2048;
  }

  /**
   * Update client configuration
   */
  updateConfig(config: ServiceConfig): void {
    (this as any).config = config;
    this.httpClient = new HttpClient('ollama', config);
  }
}