import { LocalLLMConfig } from '../types.js';

export interface DiscoveredModel {
  id: string;
  name: string;
  provider: 'lm-studio' | 'ollama';
  url: string;
  description?: string;
  size?: string;
  parameters?: string;
}

export class ModelDiscoveryService {
  private async discoverLMStudioModels(baseUrl: string): Promise<DiscoveredModel[]> {
    try {
      const response = await fetch(`${baseUrl}/v1/models`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const models: DiscoveredModel[] = [];
      
      if (data.data && Array.isArray(data.data)) {
        for (const model of data.data) {
          models.push({
            id: model.id,
            name: model.id,
            provider: 'lm-studio',
            url: baseUrl,
            description: `LM Studio Model: ${model.id}`,
            parameters: model.object || 'Unknown'
          });
        }
      }
      
      return models;
    } catch (error) {
      console.log(`Failed to discover LM Studio models: ${error}`);
      return [];
    }
  }

  private async discoverOllamaModels(baseUrl: string): Promise<DiscoveredModel[]> {
    try {
      const response = await fetch(`${baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const models: DiscoveredModel[] = [];
      
      if (data.models && Array.isArray(data.models)) {
        for (const model of data.models) {
          models.push({
            id: model.name,
            name: model.name,
            provider: 'ollama',
            url: baseUrl,
            description: `Ollama Model: ${model.name}`,
            size: model.size ? `${(model.size / 1024 / 1024 / 1024).toFixed(1)}GB` : 'Unknown',
            parameters: model.digest ? model.digest.substring(0, 8) : 'Unknown'
          });
        }
      }
      
      return models;
    } catch (error) {
      console.log(`Failed to discover Ollama models: ${error}`);
      return [];
    }
  }

  async discoverModels(provider: 'lm-studio' | 'ollama', baseUrl: string): Promise<DiscoveredModel[]> {
    console.log(`🔍 Discovering ${provider} models at ${baseUrl}...`);
    
    switch (provider) {
      case 'lm-studio':
        return await this.discoverLMStudioModels(baseUrl);
      case 'ollama':
        return await this.discoverOllamaModels(baseUrl);
      default:
        return [];
    }
  }

  async discoverAllProviders(): Promise<{ [key: string]: DiscoveredModel[] }> {
    const providers = [
      { provider: 'lm-studio' as const, url: 'http://localhost:1234' },
      { provider: 'lm-studio' as const, url: 'http://localhost:8080' },
      { provider: 'ollama' as const, url: 'http://localhost:11434' },
      { provider: 'ollama' as const, url: 'http://localhost:3000' }
    ];

    const results: { [key: string]: DiscoveredModel[] } = {};

    for (const { provider, url } of providers) {
      const models = await this.discoverModels(provider, url);
      if (models.length > 0) {
        const key = `${provider}-${url}`;
        results[key] = models;
      }
    }

    return results;
  }
} 