import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { ModelSelector } from './ModelSelector.js';
import { AdvancedChatInterface } from './components/AdvancedChatInterface.js';
import { LocalLLMConfig } from '../types.js';

export function App() {
  const [selectedModel, setSelectedModel] = useState<LocalLLMConfig | null>(null);
  const [workingDirectory] = useState(() => process.cwd());

  const handleModelSelect = (model: LocalLLMConfig) => {
    setSelectedModel(model);
  };

  if (!selectedModel) {
    return <ModelSelector onModelSelect={handleModelSelect} />;
  }

  return (
    <Box flexDirection="column" height="100%">
      <AdvancedChatInterface
        model={selectedModel}
        workingDirectory={workingDirectory}
      />
    </Box>
  );
} 