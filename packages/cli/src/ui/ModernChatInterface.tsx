import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { AgentRequest, AgentResponse } from '../services/agents/BaseAgent.js';
import { IntelligentAgent } from '../services/IntelligentAgent.js';
import { LocalLLMConfig } from '../types.js';
import { EnhancedInput } from './components/EnhancedInput.js';
import { MessageBubble } from './components/MessageBubble.js';
import { ChatHeader } from './components/ChatHeader.js';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
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

interface ModernChatInterfaceProps {
  model: LocalLLMConfig;
  workingDirectory: string;
}

// Static welcome message to prevent re-renders
const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `🎉 Welcome to **Next Mavens** - Your AI Coding Assistant!

I'm here to help you with:
• 📁 File operations (read, write, create, search)
• 💻 Command execution (build, test, install)
• 🔧 Git operations (status, commit, push, pull)
• 🔍 Code quality analysis and linting
• 🗄️ Database operations (Supabase, queries)
• 🔌 MCP server integration
• 📊 Codebase analysis and overview

What would you like to work on today?`,
  timestamp: new Date(),
  status: 'success'
};

export function ModernChatInterface({ model, workingDirectory }: ModernChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [agent] = useState(() => new IntelligentAgent(model));
  const { exit } = useApp();

  const handleSubmit = async (inputValue: string) => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      status: 'success'
    };

    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'loading'
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setIsLoading(true);

    // Add live task execution feedback
    const updateLoadingMessage = (content: string) => {
      setMessages(prev => prev.map(msg => 
        msg.status === 'loading' ? { ...msg, content } : msg
      ));
    };

    try {
      const request: AgentRequest = {
        message: userMessage.content,
        workingDirectory
      };

      // Show initial processing message
      updateLoadingMessage('🤔 Analyzing your request...');

      const response: AgentResponse = await agent.processRequest(request);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        status: 'success',
        toolResults: response.toolResults,
        commandResults: response.commandResults,
        gitResults: response.gitResults,
        qualityResults: response.qualityResults,
        databaseResults: response.databaseResults,
        mcpResults: response.mcpResults
      };

      setMessages(prev => prev.map(msg => 
        msg.status === 'loading' ? assistantMessage : msg
      ));

    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: new Date(),
        status: 'error'
      };

      setMessages(prev => prev.map(msg => 
        msg.status === 'loading' ? errorMessage : msg
      ));
      
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle global keyboard shortcuts
  useInput((input, key) => {
    if (key.escape) {
      exit();
    }
  });

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      {/* Header */}
      <ChatHeader
        workingDirectory={workingDirectory}
        isConnected={isConnected}
        modelName={model.name}
      />

      {/* Messages Container */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        <Box flexDirection="column" flexGrow={1}>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
              timestamp={message.timestamp}
              status={message.status}
              toolResults={message.toolResults}
              commandResults={message.commandResults}
              gitResults={message.gitResults}
              qualityResults={message.qualityResults}
              databaseResults={message.databaseResults}
              mcpResults={message.mcpResults}
            />
          ))}
        </Box>
      </Box>

      {/* Input Area */}
      <Box marginTop={2}>
        <EnhancedInput
          onSubmit={handleSubmit}
          placeholder="Type your message... (e.g., 'list directory', 'run npm test', 'analyze codebase')"
          disabled={!isConnected}
          loading={isLoading}
        />
      </Box>

      {/* Footer */}
      <Box marginTop={1} justifyContent="center">
        <Text color="gray">
          Press Esc to exit • Next Mavens CLI v1.0
        </Text>
      </Box>
    </Box>
  );
} 