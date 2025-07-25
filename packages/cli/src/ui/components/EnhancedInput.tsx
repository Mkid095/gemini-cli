import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

interface EnhancedInputProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}

export function EnhancedInput({ onSubmit, placeholder = "Type your message...", disabled = false, loading = false }: EnhancedInputProps) {
  const [value, setValue] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  // Removed blinking cursor effect to prevent re-renders

  useInput((input, key) => {
    if (disabled || loading) return;

    if (key.return) {
      if (value.trim()) {
        onSubmit(value.trim());
        setValue('');
        setCursorPosition(0);
      }
    } else if (key.escape) {
      setValue('');
      setCursorPosition(0);
    } else if (key.backspace || key.delete) {
      if (cursorPosition > 0) {
        const newValue = value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
        setValue(newValue);
        setCursorPosition(Math.max(0, cursorPosition - 1));
      }
    } else if (key.leftArrow) {
      setCursorPosition(Math.max(0, cursorPosition - 1));
    } else if (key.rightArrow) {
      setCursorPosition(Math.min(value.length, cursorPosition + 1));
    } else if (input && input.length > 0) {
      const newValue = value.slice(0, cursorPosition) + input + value.slice(cursorPosition);
      setValue(newValue);
      setCursorPosition(cursorPosition + input.length);
    }
  }, { isActive: !disabled && !loading });

  const displayValue = value || placeholder;
  const isPlaceholder = !value;

  return (
    <Box
      borderStyle="round"
      borderColor={disabled ? "gray" : loading ? "yellow" : "blue"}
      paddingX={2}
      paddingY={1}
      flexDirection="row"
      alignItems="center"
    >
      {/* Input Icon */}
      <Box marginRight={1}>
        {loading ? (
          <Text color="yellow">⏳</Text>
        ) : disabled ? (
          <Text color="gray">🔒</Text>
        ) : (
          <Text color="blue">💬</Text>
        )}
      </Box>

      {/* Input Field */}
      <Box flexGrow={1} position="relative">
        <Text color={isPlaceholder ? "gray" : "white"}>
          {displayValue.slice(0, cursorPosition)}
          {!disabled && !loading && !isPlaceholder && (
            <Text color="white" backgroundColor="blue">█</Text>
          )}
          {displayValue.slice(cursorPosition)}
        </Text>
      </Box>

      {/* Status Indicator */}
      <Box marginLeft={2}>
        {loading ? (
          <Text color="yellow">Processing...</Text>
        ) : disabled ? (
          <Text color="gray">Disabled</Text>
        ) : (
          <Text color="gray">
            Enter ↵ • Esc
          </Text>
        )}
      </Box>
    </Box>
  );
} 