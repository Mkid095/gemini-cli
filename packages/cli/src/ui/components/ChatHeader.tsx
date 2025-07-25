import React from 'react';
import { Box, Text } from 'ink';

interface ChatHeaderProps {
  workingDirectory: string;
  isConnected: boolean;
  modelName: string;
}

export const ChatHeader = React.memo(({ workingDirectory, isConnected, modelName }: ChatHeaderProps) => {
  const getStatusColor = () => isConnected ? 'green' : 'red';
  const getStatusIcon = () => isConnected ? '🟢' : '🔴';
  const getStatusText = () => isConnected ? 'Connected' : 'Disconnected';

  return (
    <Box
      borderStyle="double"
      borderColor="blue"
      paddingX={2}
      paddingY={1}
      marginBottom={2}
      justifyContent="space-between"
      alignItems="center"
    >
      {/* Left side - Title and Status */}
      <Box flexDirection="row" alignItems="center">
        <Text color="blue" bold>
          🚀 Next Mavens
        </Text>
        <Text color="gray">
          AI Coding Assistant
        </Text>
        <Box marginLeft={2} flexDirection="row" alignItems="center">
          <Text color={getStatusColor()}>
            {getStatusIcon()}
          </Text>
          <Text color={getStatusColor()}>
            {getStatusText()}
          </Text>
        </Box>
      </Box>

      {/* Right side - Model and Directory */}
      <Box flexDirection="column" alignItems="flex-end">
        <Text color="cyan">
          🤖 {modelName}
        </Text>
        <Text color="gray">
          📁 {workingDirectory}
        </Text>
      </Box>
    </Box>
  );
}); 