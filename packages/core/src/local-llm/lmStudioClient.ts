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
 * LM Studio API response types (OpenAI-compatible)
 */
interface LMStudioModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

interface LMStudioModelsResponse {
  object: 'list';
  data: LMStudioModel[];
}

interface LMStudioChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LMStudioChatRequest {
  model: string;
  messages: LMStudioChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string[];
}

interface LMStudioChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface LMStudioChatStreamResponse {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
}

/**
 * LM Studio client implementation using OpenAI-compatible API
 */
export class LMStudioClient implements LocalLLMClient {
  public readonly service = 'lmstudio' as const;
  public readonly config: ServiceConfig;
  private httpClient: HttpClient;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.httpClient = new HttpClient('lmstudio', config);
  }

  /**
   * Check if LM Studio service is available and healthy
   */
  async checkHealth(): Promise<ServiceStatus> {
    try {
      const startTime = Date.now();
      
      // Try to get models list as health check
      await this.httpClient.get('/v1/models');
      
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
   * List available models from LM Studio
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.httpClient.get<LMStudioModelsResponse>('/v1/models');
      
      return response.data.data.map(model => ({
        id: model.id,
        name: this.formatModelName(model.id),
        description: `LM Studio model: ${model.id}`,
        capabilities: this.getModelCapabilities(model.id),
      }));
    } catch (error) {
      if (error instanceof Error && error.message.includes('fetch')) {
        throw new ServiceUnavailableError(
          'lmstudio',
          `http://${this.config.host}:${this.config.port}`,
          error
        );
      }
      throw error;
    }
  }

  /**
   * Generate content using LM Studio
   */
  async generateContent(request: GenerateContentRequest): Promise<GenerateContentResponse> {
    try {
      const lmStudioRequest = this.convertToLMStudioRequest(request);
      
      const response = await this.httpClient.post<LMStudioChatResponse>(
        '/v1/chat/completions',
        lmStudioRequest
      );

      return this.convertFromLMStudioResponse(response.data);
    } catch (error) {
      if (error instanceof APIError && error.statusCode === 404) {
        throw new ModelNotFoundError('lmstudio', request.model);
      }
      throw error;
    }
  }

  /**
   * Generate content with streaming response
   */
  async *generateContentStream(request: GenerateContentRequest): AsyncGenerator<GenerateContentResponse> {
    try {
      const lmStudioRequest = this.convertToLMStudioRequest(request, true);
      
      let fullContent = '';
      let usage: GenerateContentResponse['usage'];
      
      for await (const chunk of this.httpClient.postStream<LMStudioChatStreamResponse>(
        '/v1/chat/completions',
        lmStudioRequest
      )) {
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.content) {
          fullContent += delta.content;
          
          yield {
            content: delta.content,
            model: request.model,
            finishReason: chunk.choices[0]?.finish_reason === 'stop' ? 'stop' : undefined,
          };
        }
        
        // Final chunk might contain usage information
        if (chunk.choices[0]?.finish_reason === 'stop') {
          // Note: LM Studio streaming doesn't always provide usage info in stream
          // We'll provide the accumulated content as final response
          yield {
            content: '',
            model: request.model,
            finishReason: 'stop',
            usage,
          };
        }
      }
    } catch (error) {
      if (error instanceof APIError && error.statusCode === 404) {
        throw new ModelNotFoundError('lmstudio', request.model);
      }
      throw error;
    }
  }

  /**
   * Convert internal request format to LM Studio format
   */
  private convertToLMStudioRequest(
    request: GenerateContentRequest,
    stream = false
  ): LMStudioChatRequest {
    const messages: LMStudioChatMessage[] = [];
    
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
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream,
    };
  }

  /**
   * Convert LM Studio response to internal format
   */
  private convertFromLMStudioResponse(response: LMStudioChatResponse): GenerateContentResponse {
    const choice = response.choices[0];
    
    return {
      content: choice?.message?.content || '',
      model: response.model,
      finishReason: choice?.finish_reason === 'stop' ? 'stop' : 
                   choice?.finish_reason === 'length' ? 'length' : undefined,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
    };
  }

  /**
   * Format model name for display
   */
  private formatModelName(modelId: string): string {
    // Convert model ID to a more readable name
    return modelId
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/\.(bin|gguf|safetensors)$/i, '');
  }

  /**
   * Get model capabilities based on model ID
   */
  private getModelCapabilities(modelId: string): ModelCapabilities {
    // Default capabilities for LM Studio models
    // In a real implementation, this could be more sophisticated
    // based on model type detection
    return {
      supportsStreaming: true,
      supportsChat: true,
      supportsCompletion: true,
      supportsSystemMessages: true,
      maxContextLength: this.estimateContextLength(modelId),
    };
  }

  /**
   * Estimate context length based on model name
   */
  private estimateContextLength(modelId: string): number {
    const lowerModelId = modelId.toLowerCase();
    
    // Common context lengths for different model types
    if (lowerModelId.includes('32k')) return 32768;
    if (lowerModelId.includes('16k')) return 16384;
    if (lowerModelId.includes('8k')) return 8192;
    if (lowerModelId.includes('4k')) return 4096;
    
    // Default context length for most models
    return 4096;
  }

  /**
   * Update client configuration
   */
  updateConfig(config: ServiceConfig): void {
    (this as any).config = config;
    this.httpClient = new HttpClient('lmstudio', config);
  }
}