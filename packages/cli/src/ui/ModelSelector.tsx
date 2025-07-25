import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { LocalLLMConfig } from '../types.js';
import { ModelList } from './components/ModelList.js';

interface ModelSelectorProps {
  onModelSelect: (model: LocalLLMConfig) => void;
}

interface ProviderOption {
  id: string;
  name: string;
  provider: 'lm-studio' | 'ollama';
  url: string;
  description: string;
}

export function ModelSelector({ onModelSelect }: ModelSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<ProviderOption | null>(null);

  // Available providers
  const providers: ProviderOption[] = [
    {
      id: 'lm-studio-default',
      name: 'LM Studio - Default',
      provider: 'lm-studio',
      url: 'http://localhost:1234',
      description: 'Default LM Studio server on port 1234'
    },
    {
      id: 'ollama-default',
      name: 'Ollama - Default',
      provider: 'ollama',
      url: 'http://localhost:11434',
      description: 'Default Ollama server on port 11434'
    },
    {
      id: 'lm-studio-custom',
      name: 'LM Studio - Custom',
      provider: 'lm-studio',
      url: 'http://localhost:8080',
      description: 'Custom LM Studio server on port 8080'
    },
    {
      id: 'ollama-custom',
      name: 'Ollama - Custom',
      provider: 'ollama',
      url: 'http://localhost:3000',
      description: 'Custom Ollama server on port 3000'
    }
  ];

  useInput((input, key) => {
    if (selectedProvider) return; // Let ModelList handle input

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(providers.length - 1, prev + 1));
    } else if (key.return) {
      const provider = providers[selectedIndex];
      if (provider) {
        setSelectedProvider(provider);
      }
    } else if (key.escape) {
      process.exit(0);
    }
  });

  const handleBackToProviders = () => {
    setSelectedProvider(null);
  };

  // Show model list if provider is selected
  if (selectedProvider) {
    return (
      <ModelList
        provider={selectedProvider.provider}
        baseUrl={selectedProvider.url}
        onModelSelect={onModelSelect}
        onBack={handleBackToProviders}
      />
    );
  }

  // Show provider selection
  return (
    <Box flexDirection="column" padding={2}>
      {/* Header */}
      <Box flexDirection="column" alignItems="center" marginBottom={2}>
        <Text color="blue" bold>
          🚀 Next Mavens - Provider Selection
        </Text>
        <Text color="gray">
          Choose your AI model provider
        </Text>
      </Box>

      {/* Provider List */}
      <Box flexDirection="column" marginBottom={2}>
        {providers.map((provider, index) => (
          <Box
            key={provider.id}
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

            {/* Provider info */}
            <Box flexDirection="column" flexGrow={1}>
              <Text color={selectedIndex === index ? 'blue' : 'white'} bold>
                {provider.name}
              </Text>
              <Text color="gray">
                {provider.description}
              </Text>
              <Text color="cyan">
                {provider.provider === 'lm-studio' ? '🔧' : '🐳'} {provider.provider.toUpperCase()} • {provider.url}
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
          ↑↓ Arrow Keys: Navigate • Enter: Select Provider • Esc: Exit
        </Text>
      </Box>

      {/* Footer */}
      <Box marginTop={2} justifyContent="center">
        <Text color="gray">
          Press Enter to discover models from selected provider
        </Text>
      </Box>
    </Box>
  );
} 