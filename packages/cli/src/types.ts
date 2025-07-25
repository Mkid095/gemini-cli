export interface LocalLLMConfig {
  id: string;
  name: string;
  provider: 'lm-studio' | 'ollama';
  url: string;
  contextLength?: number;
  parameters?: number;
}

export interface ModelDetectionResult {
  models: LocalLLMConfig[];
  isLoading: boolean;
  error: string | null;
}

export interface CodingSession {
  id: string;
  model: LocalLLMConfig;
  messages: ChatMessage[];
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: any;
  error?: string;
} 