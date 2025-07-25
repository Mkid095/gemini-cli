import React from 'react';
import { Box, Text } from 'ink';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'loading' | 'success' | 'error' | 'executing';
  toolResults?: any[];
  commandResults?: any[];
  gitResults?: any[];
  qualityResults?: any[];
  databaseResults?: any[];
  mcpResults?: any[];
}

export const MessageBubble = React.memo(({
  role,
  content,
  timestamp,
  status = 'success',
  toolResults,
  commandResults,
  gitResults,
  qualityResults,
  databaseResults,
  mcpResults
}: MessageBubbleProps) => {
  const isUser = role === 'user';
  const isSystem = role === 'system';
  const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderLoadingAnimation = () => {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const [frameIndex, setFrameIndex] = React.useState(0);

    React.useEffect(() => {
      const interval = setInterval(() => {
        setFrameIndex(prev => (prev + 1) % frames.length);
      }, 100);
      return () => clearInterval(interval);
    }, []);

    return (
      <Text color="blue">
        {frames[frameIndex]} AI is thinking...
      </Text>
    );
  };

  const renderStatusIndicator = () => {
    switch (status) {
      case 'loading':
        return <Text color="yellow">⏳ Processing...</Text>;
      case 'error':
        return <Text color="red">❌ Error occurred</Text>;
      case 'executing':
        return <Text color="green">⚡ Executing command...</Text>;
      default:
        return null;
    }
  };

  const renderResultsSummary = () => {
    if (status !== 'success') return null;

    const results = [];
    if (toolResults && toolResults.length > 0) {
      results.push(<Text key="tools" color="cyan">🔧 {toolResults.length} tool operations</Text>);
    }
    if (commandResults && commandResults.length > 0) {
      results.push(<Text key="commands" color="green">💻 {commandResults.length} commands executed</Text>);
    }
    if (gitResults && gitResults.length > 0) {
      results.push(<Text key="git" color="magenta">🔧 {gitResults.length} git operations</Text>);
    }
    if (qualityResults && qualityResults.length > 0) {
      results.push(<Text key="quality" color="yellow">🔍 {qualityResults.length} quality analyses</Text>);
    }
    if (databaseResults && databaseResults.length > 0) {
      results.push(<Text key="database" color="blue">🗄️ {databaseResults.length} database operations</Text>);
    }
    if (mcpResults && mcpResults.length > 0) {
      results.push(<Text key="mcp" color="red">🔌 {mcpResults.length} MCP operations</Text>);
    }

    if (results.length > 0) {
      return (
        <Box marginTop={1} flexDirection="column">
          {results}
        </Box>
      );
    }

    return null;
  };

  return (
    <Box
      marginY={1}
      flexDirection="row"
      justifyContent={isUser ? 'flex-end' : 'flex-start'}
    >
      <Box
        paddingX={2}
        paddingY={1}
        borderStyle="round"
        borderColor={isUser ? 'blue' : 'gray'}
      >
        <Box flexDirection="column" width="100%">
          {/* Message Header */}
          <Box justifyContent="space-between" marginBottom={1}>
            <Text color={isUser ? 'blue' : 'white'} bold>
              {isUser ? 'You' : 'Next Mavens'}
            </Text>
            <Text color="gray">
              {timeString}
            </Text>
          </Box>

          {/* Message Content */}
          <Box marginBottom={1}>
            {status === 'loading' ? (
              renderLoadingAnimation()
            ) : (
              <Text color={isUser ? 'blue' : 'white'}>
                {content}
              </Text>
            )}
          </Box>

          {/* Status Indicator */}
          {renderStatusIndicator()}

          {/* Results Summary */}
          {renderResultsSummary()}
        </Box>
      </Box>
    </Box>
  );
}); 