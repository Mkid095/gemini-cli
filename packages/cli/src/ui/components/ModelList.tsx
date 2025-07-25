import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { DiscoveredModel } from '../../services/ModelDiscoveryService.js';
import { LocalLLMConfig } from '../../types.js';

interface ModelListProps {
  provider: 'lm-studio' | 'ollama';
  baseUrl: string;
  onModelSelect: (model: LocalLLMConfig) => void;
  onBack: () => void;
}

export function ModelList({ provider, baseUrl, onModelSelect, onBack }: ModelListProps) {
  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const discoverModels = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Simulate API call to discover models
        const response = await fetch(
          provider === 'lm-studio' 
            ? `${baseUrl}/v1/models`
            : `${baseUrl}/api/tags`
        );
        
        if (!response.ok) {
          throw new Error(`Failed to connect to ${provider} at ${baseUrl}`);
        }
        
        const data = await response.json();
        const discoveredModels: DiscoveredModel[] = [];
        
        if (provider === 'lm-studio') {
          if (data.data && Array.isArray(data.data)) {
            for (const model of data.data) {
              discoveredModels.push({
                id: model.id,
                name: model.id,
                provider: 'lm-studio',
                url: baseUrl,
                description: `LM Studio Model: ${model.id}`,
                parameters: model.object || 'Unknown'
              });
            }
          }
        } else {
          if (data.models && Array.isArray(data.models)) {
            for (const model of data.models) {
              discoveredModels.push({
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
        }
        
        setModels(discoveredModels);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    discoverModels();
  }, [provider, baseUrl]);

  useInput((input, key) => {
    if (isLoading || error) return;

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(models.length - 1, prev + 1));
    } else if (key.return) {
      const selectedModel = models[selectedIndex];
      if (selectedModel) {
        const modelConfig: LocalLLMConfig = {
          id: selectedModel.id,
          provider: selectedModel.provider,
          url: selectedModel.url,
          name: selectedModel.name
        };
        onModelSelect(modelConfig);
      }
    } else if (key.escape) {
      onBack();
    }
  });

  if (isLoading) {
    return (
      <Box flexDirection="column" alignItems="center" padding={2}>
        <Text color="blue">🔍 Discovering {provider} models...</Text>
        <Text color="gray">Connecting to {baseUrl}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" alignItems="center" padding={2}>
        <Text color="red">❌ Error: {error}</Text>
        <Text color="yellow">Please ensure {provider} is running at {baseUrl}</Text>
        <Text color="gray">Press Esc to go back</Text>
      </Box>
    );
  }

  if (models.length === 0) {
    return (
      <Box flexDirection="column" alignItems="center" padding={2}>
        <Text color="yellow">⚠️ No models found</Text>
        <Text color="gray">No models available in {provider} at {baseUrl}</Text>
        <Text color="gray">Press Esc to go back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={2}>
      {/* Header */}
      <Box flexDirection="column" alignItems="center" marginBottom={2}>
        <Text color="blue" bold>
          🤖 {provider.toUpperCase()} Models
        </Text>
        <Text color="gray">
          Available models at {baseUrl}
        </Text>
      </Box>

      {/* Model List */}
      <Box flexDirection="column" marginBottom={2}>
        {models.map((model, index) => (
          <Box
            key={model.id}
            flexDirection="row"
            alignItems="center"
            paddingX={2}
            paddingY={1}
            borderStyle={selectedIndex === index ? 'double' : 'single'}
            borderColor={selectedIndex === index ? 'blue' : 'gray'}
          >
            {/* Selection indicator */}
            <Box marginRight={2}>
              <Text color={selectedIndex === index ? 'blue' : 'gray'}>
                {selectedIndex === index ? '▶' : ' '}
              </Text>
            </Box>

            {/* Model info */}
            <Box flexDirection="column" flexGrow={1}>
              <Text color={selectedIndex === index ? 'blue' : 'white'} bold>
                {model.name}
              </Text>
              <Text color="gray">
                {model.description}
              </Text>
              <Text color="cyan">
                {provider === 'lm-studio' ? '🔧' : '🐳'} {provider.toUpperCase()} • {model.url}
                {model.size && ` • ${model.size}`}
                {model.parameters && ` • ${model.parameters}`}
              </Text>
            </Box>

            {/* Status indicator */}
            <Box marginLeft={2}>
              <Text color="green">●</Text>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Instructions */}
      <Box flexDirection="column" alignItems="center" marginTop={2}>
        <Text color="yellow" bold>
          Navigation Instructions:
        </Text>
        <Text color="gray">
          ↑↓ Arrow Keys: Navigate • Enter: Select • Esc: Back
        </Text>
      </Box>

      {/* Footer */}
      <Box marginTop={2} justifyContent="center">
        <Text color="gray">
          Found {models.length} model{models.length !== 1 ? 's' : ''} • Press Enter to select
        </Text>
      </Box>
    </Box>
  );
} 