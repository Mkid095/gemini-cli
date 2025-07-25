import React, { useState, useRef, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { ChatHeader } from './ChatHeader.js';
import { MessageBubble } from './MessageBubble.js';
import { EnhancedInput } from './EnhancedInput.js';
import { LocalLLMConfig } from '../../types.js';
import { IntelligentAgent } from '../../services/IntelligentAgent.js';
import { AdvancedCodeAnalyzer } from '../../services/AdvancedCodeAnalyzer.js';
import { IntelligentContextManager } from '../../services/IntelligentContextManager.js';
import { AdvancedLearningSystem } from '../../services/AdvancedLearningSystem.js';
import { CodeGenerationEngine } from '../../services/CodeGenerationEngine.js';

interface AdvancedChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status: 'loading' | 'success' | 'error' | 'executing';
  metadata?: {
    type: 'text' | 'code' | 'file' | 'command' | 'analysis' | 'generation';
    language?: string;
    filePath?: string;
    lineNumbers?: number[];
    suggestions?: string[];
    refactoring?: any[];
    insights?: string[];
  };
  toolResults?: any[];
  commandResults?: any[];
  gitResults?: any[];
  qualityResults?: any[];
  databaseResults?: any[];
  mcpResults?: any[];
}

interface AdvancedChatInterfaceProps {
  model: LocalLLMConfig;
  workingDirectory: string;
}

// Create a loading welcome message that will be replaced with LLM-generated content
const LOADING_WELCOME_MESSAGE: AdvancedChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '🤖 Initializing Next Mavens...',
  timestamp: new Date(),
  status: 'loading',
  metadata: {
    type: 'text'
  }
};

export function AdvancedChatInterface({ model, workingDirectory }: AdvancedChatInterfaceProps) {
  const [messages, setMessages] = useState<AdvancedChatMessage[]>([LOADING_WELCOME_MESSAGE]);
  const [streamingContent, setStreamingContent] = useState<{ [key: string]: string }>({});
  const [streamingActive, setStreamingActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [agent] = useState(() => new IntelligentAgent(model));
  const [codeAnalyzer] = useState(() => new AdvancedCodeAnalyzer());
  const [contextManager] = useState(() => new IntelligentContextManager(workingDirectory));
  const [learningSystem] = useState(() => new AdvancedLearningSystem(workingDirectory));
  const [codeGenerator] = useState(() => new CodeGenerationEngine());
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [welcomeGenerated, setWelcomeGenerated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { exit } = useApp();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Generate welcome message using LLM with streaming (only once)
  useEffect(() => {
    if (welcomeGenerated) return; // Prevent multiple calls
    
    const generateWelcomeMessage = async () => {
      setWelcomeGenerated(true); // Mark as generated to prevent re-runs
      
      try {
        const welcomePrompt = `You are Next Mavens, an advanced AI coding assistant. Generate a welcoming, engaging, and informative welcome message for a user who has just opened the application.

The message should:
1. Welcome the user warmly and professionally
2. Briefly explain your capabilities as a coding assistant
3. Highlight key features like code analysis, generation, refactoring, testing, etc.
4. Provide 3-5 example requests the user can try
5. Use emojis and formatting to make it visually appealing
6. Keep it concise but comprehensive
7. End with an encouraging call to action

Make it feel personal and helpful. The user is in a terminal-based interface, so use markdown formatting that works well in a terminal.

Welcome message:`;

        // Create streaming welcome message
        const welcomeMessage: AdvancedChatMessage = {
          id: 'welcome',
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          status: 'loading',
          metadata: {
            type: 'text'
          }
        };

        setMessages([welcomeMessage]);

        // Stream the welcome response
        setStreamingActive(true);
        const streamingResponse = await sendToLLMStreaming(welcomePrompt);
        let welcomeContent = '';
        
        // Use batched updates to reduce re-renders
        let batchCounter = 0;
        const batchSize = 5; // Update every 5 chunks
        
        for await (const chunk of streamingResponse) {
          welcomeContent += chunk;
          batchCounter++;
          
          // Only update every few chunks to reduce re-renders
          if (batchCounter % batchSize === 0 || chunk.includes('\n') || chunk.includes('.')) {
            setStreamingContent(prev => ({ ...prev, welcome: welcomeContent }));
          }
          
          // Minimal delay to prevent excessive re-renders
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Final update
        setStreamingContent(prev => ({ ...prev, welcome: welcomeContent }));
        
        // Update the actual message with final content
        setMessages(prev => prev.map(msg => 
          msg.id === 'welcome' ? { ...msg, content: welcomeContent } : msg
        ));
        
        // Clear streaming content and mark as inactive
        setStreamingContent(prev => {
          const newContent = { ...prev };
          delete newContent.welcome;
          return newContent;
        });
        setStreamingActive(false);

        // Mark welcome message as complete
        setMessages(prev => prev.map(msg => 
          msg.id === 'welcome' ? { ...msg, status: 'success' } : msg
        ));
        
        // Generate initial suggestions (use default to avoid additional LLM calls)
        setSuggestions(getDefaultSuggestions());
      } catch (error) {
        // Fallback welcome message if LLM fails
        const fallbackMessage: AdvancedChatMessage = {
          id: 'welcome',
          role: 'assistant',
          content: `🎉 Welcome to Next Mavens - Your Advanced AI Coding Assistant!

I'm here to help you with all your coding tasks. What would you like to work on today?`,
          timestamp: new Date(),
          status: 'success',
          metadata: {
            type: 'text'
          }
        };
        setMessages([fallbackMessage]);
        setSuggestions(getDefaultSuggestions());
      }
    };

    generateWelcomeMessage();
  }, []); // Empty dependency array - only run once on mount

  const sendToLLM = async (message: string): Promise<string> => {
    try {
      if (model.provider === 'lm-studio') {
        return await sendToLMStudio(message);
      } else if (model.provider === 'ollama') {
        return await sendToOllama(message);
      } else {
        throw new Error(`Unsupported provider: ${model.provider}`);
      }
    } catch (error) {
      throw new Error(`LLM API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const sendToLMStudio = async (message: string): Promise<string> => {
    const response = await fetch(`${model.url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.name,
        messages: [
          {
            role: 'system',
            content: 'You are Next Mavens, an intelligent AI coding assistant with deep understanding of codebases, file operations, and software development best practices.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LM Studio API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    let fullContent = '';
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.choices?.[0]?.delta?.content) {
                fullContent += parsed.choices[0].delta.content;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullContent || 'No response from model';
  };

  const sendToOllama = async (message: string): Promise<string> => {
    const response = await fetch(`${model.url}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.name,
        prompt: `You are Next Mavens, an intelligent AI coding assistant with deep understanding of codebases, file operations, and software development best practices.

User: ${message}`,
        stream: true,
        options: {
          temperature: 0.7,
          num_predict: 2000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    let fullContent = '';
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.response) {
                fullContent += parsed.response;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullContent || 'No response from model';
  };

  const handleSubmit = async (inputValue: string) => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: AdvancedChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      status: 'success',
      metadata: {
        type: 'text'
      }
    };

    const loadingMessage: AdvancedChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'loading',
      metadata: {
        type: 'text'
      }
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setIsLoading(true);

    // Add live task execution feedback
    const updateLoadingMessage = (content: string, metadata?: AdvancedChatMessage['metadata']) => {
      setMessages(prev => prev.map(msg => 
        msg.status === 'loading' ? { ...msg, content, metadata } : msg
      ));
    };

    try {
      // Update context with user message
      contextManager.addMessage('user', userMessage.content);
      
      // Analyze intent and provide intelligent response
      updateLoadingMessage('🤔 Analyzing your request...', { type: 'analysis' });

      // Get adaptive response from learning system
      const adaptiveResponse = learningSystem.getAdaptiveResponse(
        userMessage.content,
        { type: 'unknown', language: 'unknown' },
        ['file_operations', 'command_execution', 'code_generation', 'analysis']
      );

      updateLoadingMessage('🧠 Processing with advanced AI...', { type: 'analysis' });

      // Process with intelligent agent using streaming
      const response = await processRequestWithStreaming(
        userMessage.content,
        workingDirectory,
        updateLoadingMessage
      );

      // Enhanced response processing
      let enhancedContent = response.content;
      let metadata: AdvancedChatMessage['metadata'] = { type: 'text' };

      // Detect if this is a code generation request
      if (userMessage.content.toLowerCase().includes('generate') || 
          userMessage.content.toLowerCase().includes('create') ||
          userMessage.content.toLowerCase().includes('make')) {
        
        updateLoadingMessage('🚀 Generating code...', { type: 'generation' });
        
        const generationRequest = {
          type: 'component' as const,
          language: 'typescript' as const,
          description: userMessage.content,
          context: {
            projectType: 'frontend',
            dependencies: ['react', 'typescript'],
            patterns: ['component'],
            style: 'functional' as const
          },
          preferences: {
            naming: 'PascalCase' as const,
            indentation: 2 as const,
            quotes: 'single' as const,
            semicolons: true,
            trailingComma: true
          }
        };

        const generationResult = await codeGenerator.generateCode(generationRequest);
        enhancedContent = `## Generated Code\n\n\`\`\`typescript\n${generationResult.code}\n\`\`\`\n\n## Explanation\n\n${generationResult.explanation}\n\n## Suggestions\n\n${generationResult.suggestions.map(s => `- ${s}`).join('\n')}`;
        metadata = {
          type: 'generation',
          language: 'typescript',
          suggestions: generationResult.suggestions
        };
      }

      // Detect if this is a code analysis request
      if (userMessage.content.toLowerCase().includes('analyze') || 
          userMessage.content.toLowerCase().includes('review') ||
          userMessage.content.toLowerCase().includes('check')) {
        
        updateLoadingMessage('🔍 Analyzing code...', { type: 'analysis' });
        
        // Analyze current file or project
        const analysisResult = await codeAnalyzer.generateCodeInsights(workingDirectory + '/package.json');
        enhancedContent += `\n\n## Code Analysis\n\n${analysisResult.insights.map(insight => `- ${insight}`).join('\n')}\n\n## Recommendations\n\n${analysisResult.recommendations.map(rec => `- ${rec.title}: ${rec.description}`).join('\n')}`;
        metadata = {
          type: 'analysis',
          insights: analysisResult.insights,
          suggestions: analysisResult.recommendations.map(rec => rec.title)
        };
      }

      // Add learning insights
      if (adaptiveResponse.learningInsights.length > 0) {
        enhancedContent += `\n\n## Learning Insights\n\n${adaptiveResponse.learningInsights.map(insight => `- ${insight}`).join('\n')}`;
      }

      // Add personalized recommendations
      if (adaptiveResponse.personalizedRecommendations.length > 0) {
        enhancedContent += `\n\n## Personalized Recommendations\n\n${adaptiveResponse.personalizedRecommendations.map(rec => `- ${rec}`).join('\n')}`;
      }

      const assistantMessage: AdvancedChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: enhancedContent,
        timestamp: new Date(),
        status: 'success',
        metadata,
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

      // Update context with assistant response
      contextManager.addMessage('assistant', assistantMessage.content);
      
      // Record user behavior for learning
      learningSystem.recordUserBehavior(
        userMessage.content,
        'typescript',
        new Date(),
        new Date()
      );

      // Update suggestions based on new conversation context (use default to avoid additional LLM calls)
      setSuggestions(getDefaultSuggestions());

    } catch (error) {
      const errorMessage: AdvancedChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n\nI encountered an issue while processing your request. Please try again or rephrase your question.`,
        timestamp: new Date(),
        status: 'error',
        metadata: {
          type: 'text'
        }
      };

      setMessages(prev => prev.map(msg => 
        msg.status === 'loading' ? errorMessage : msg
      ));
      
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // New function to handle streaming requests
  const processRequestWithStreaming = async (
    message: string,
    workingDirectory: string,
    updateLoadingMessage: (content: string, metadata?: AdvancedChatMessage['metadata']) => void
  ) => {
        // Create a streaming response handler
    const handleStreamingResponse = async (streamGenerator: AsyncGenerator<string>) => {
      let fullContent = '';
      
      // Find the loading message
      const loadingMessage = messages.find(msg => msg.status === 'loading');
      if (!loadingMessage) return '';
      
      setStreamingActive(true);
      
      let batchCounter = 0;
      const batchSize = 5; // Update every 5 chunks
      
      for await (const chunk of streamGenerator) {
        fullContent += chunk;
        batchCounter++;
        
        // Only update every few chunks to reduce re-renders
        if (batchCounter % batchSize === 0 || chunk.includes('\n') || chunk.includes('.')) {
          setStreamingContent(prev => ({ ...prev, [loadingMessage.id]: fullContent }));
        }
        
        // Minimal delay to prevent excessive re-renders
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Final update
      setStreamingContent(prev => ({ ...prev, [loadingMessage.id]: fullContent }));
      
      setStreamingActive(false);
      return fullContent;
    };

    // Create a streaming prompt for the LLM
    const streamingPrompt = `You are Next Mavens, an intelligent AI coding assistant. Generate a helpful, informative response to the user's request.

User's message: "${message}"

Generate a comprehensive response that:
1. Addresses the user's request directly
2. Provides helpful context and suggestions
3. Uses a friendly, professional tone
4. Offers next steps or additional help if appropriate

Response:`;

    // Get streaming response from LLM
    const streamingResponse = await sendToLLMStreaming(streamingPrompt);
    const content = await handleStreamingResponse(streamingResponse);

    // Return the response in the expected format
    return {
      content,
      toolResults: [],
      commandResults: [],
      gitResults: [],
      qualityResults: [],
      databaseResults: [],
      mcpResults: []
    };
  };

  // New function to send streaming requests to LLM
  const sendToLLMStreaming = async (message: string): Promise<AsyncGenerator<string>> => {
    if (model.provider === 'lm-studio') {
      return sendToLMStudioStreaming(message);
    } else if (model.provider === 'ollama') {
      return sendToOllamaStreaming(message);
    } else {
      throw new Error(`Unsupported provider: ${model.provider}`);
    }
  };

  const sendToLMStudioStreaming = async (message: string): Promise<AsyncGenerator<string>> => {
    const response = await fetch(`${model.url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.name,
        messages: [
          {
            role: 'system',
            content: 'You are Next Mavens, an intelligent AI coding assistant with deep understanding of codebases, file operations, and software development best practices.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LM Studio API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();

    return (async function* () {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const parsed = JSON.parse(data);
                if (parsed.choices?.[0]?.delta?.content) {
                  yield parsed.choices[0].delta.content;
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    })();
  };

  const sendToOllamaStreaming = async (message: string): Promise<AsyncGenerator<string>> => {
    const response = await fetch(`${model.url}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.name,
        prompt: `You are Next Mavens, an intelligent AI coding assistant with deep understanding of codebases, file operations, and software development best practices.

User: ${message}`,
        stream: true,
        options: {
          temperature: 0.7,
          num_predict: 2000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();

    return (async function* () {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.response) {
                  yield parsed.response;
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    })();
  };

  const handleSuggestionSelect = (suggestion: string) => {
    handleSubmit(suggestion);
    setShowSuggestions(false);
    setCurrentSuggestionIndex(0);
  };

  const getSuggestions = async (): Promise<string[]> => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.metadata?.suggestions) {
      return lastMessage.metadata.suggestions;
    }
    
    try {
      // Generate contextual suggestions using LLM
      const suggestionsPrompt = `You are Next Mavens, an AI coding assistant. Based on the current conversation context, generate 5 helpful and relevant suggestions for what the user might want to do next.

Current conversation context: ${messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}

Generate 5 suggestions that are:
1. Relevant to the current conversation
2. Practical and actionable
3. Varied in scope (from simple to complex)
4. Specific to coding and development tasks
5. Written as natural language requests

Return only the suggestions, one per line, without numbering or bullet points:`;

      const suggestionsResponse = await sendToLLM(suggestionsPrompt);
      const suggestions = suggestionsResponse.split('\n').filter(s => s.trim()).slice(0, 5);
      
      return suggestions.length > 0 ? suggestions : getDefaultSuggestions();
    } catch (error) {
      return getDefaultSuggestions();
    }
  };

  const getDefaultSuggestions = (): string[] => {
    return [
      'Analyze my codebase and suggest improvements',
      'Generate a React component with TypeScript',
      'Create comprehensive tests for my code',
      'Refactor this function for better performance',
      'Set up a database schema for my project'
    ];
  };

  // Handle global keyboard shortcuts
  useInput((input, key) => {
    if (key.escape) {
      if (showSuggestions) {
        setShowSuggestions(false);
        setCurrentSuggestionIndex(0);
      } else {
        exit();
      }
    } else if (key.tab && showSuggestions) {
      setCurrentSuggestionIndex(prev => (prev + 1) % suggestions.length);
    } else if (key.return && showSuggestions) {
      handleSuggestionSelect(suggestions[currentSuggestionIndex]);
    } else if (input.toLowerCase() === 's') {
      setShowSuggestions(!showSuggestions);
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
      <Box flexDirection="column" flexGrow={1} marginY={1}>
        {React.useMemo(() => 
          messages.map((message) => {
            // Use streaming content if available, otherwise use message content
            const displayContent = streamingContent[message.id] || message.content;
            
            return (
              <MessageBubble
                key={message.id}
                role={message.role}
                content={displayContent}
                timestamp={message.timestamp}
                status={message.status}
                toolResults={message.toolResults}
                commandResults={message.commandResults}
                gitResults={message.gitResults}
                qualityResults={message.qualityResults}
                databaseResults={message.databaseResults}
                mcpResults={message.mcpResults}
              />
            );
          }), [messages, streamingContent]
        )}
        
        {/* Suggestions Panel */}
        {showSuggestions && (
          <Box flexDirection="column" borderStyle="single" borderColor="blue" padding={1} marginTop={1}>
            <Text color="blue" bold>💡 Suggestions (Tab to navigate, Enter to select, Esc to close)</Text>
            {suggestions.map((suggestion, index) => (
              <Box
                key={index}
                paddingX={1}
                paddingY={0.5}
              >
                <Text color={index === currentSuggestionIndex ? 'white' : 'gray'}>
                  {index === currentSuggestionIndex ? '▶ ' : '  '}{suggestion}
                </Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Input Area */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
        <EnhancedInput
          onSubmit={handleSubmit}
          placeholder="💬 Type your message... (S for suggestions, Esc to exit)"
          disabled={isLoading}
        />
        
        {/* Status Bar */}
        <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
          <Text color="gray">
            {isLoading ? '⏳ Processing...' : 'Ready'}
          </Text>
          <Text color="gray">
            {messages.length} messages • {model.name}
          </Text>
        </Box>
      </Box>
    </Box>
  );
} 