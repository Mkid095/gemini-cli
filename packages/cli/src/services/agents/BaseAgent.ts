import { LocalLLMConfig } from '../../types.js';
import { ToolResult } from '@nextmavens/cli-core';
import { CodebaseAnalyzer, ProjectStructure } from '../CodebaseAnalyzer.js';
import { LearningSystem, AdaptiveResponse } from '../LearningSystem.js';
import { ContextManager } from '../ContextManager.js';
import { CommandResult } from '../ShellCommandExecutor.js';

export interface AgentRequest {
  message: string;
  workingDirectory: string;
  conversationHistory?: ConversationTurn[];
  userPreferences?: UserPreferences;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  message: string;
  timestamp: Date;
  context?: {
    toolsUsed: string[];
    filesAccessed: string[];
    commandsExecuted: string[];
  };
}

export interface UserPreferences {
  responseStyle: 'concise' | 'detailed' | 'technical' | 'friendly';
  preferredLanguage: string;
  autoSave: boolean;
  showExplanations: boolean;
  learningMode: boolean;
}

export interface AgentResponse {
  content: string;
  toolResults: ToolResult[];
  commandResults?: CommandResult[];
  mcpResults?: any[];
  gitResults?: any[];
  qualityResults?: any[];
  databaseResults?: any[];
  error?: string;
  context?: {
    projectType: string;
    mainLanguage: string;
    codeFiles: number;
    totalFiles: number;
  };
}

export abstract class BaseAgent {
  protected codebaseAnalyzer: CodebaseAnalyzer;
  protected learningSystem: LearningSystem;
  protected contextManager: ContextManager;
  protected projectContext: ProjectStructure | null = null;
  protected userPreferences: UserPreferences = {
    responseStyle: 'detailed',
    preferredLanguage: 'en',
    autoSave: true,
    showExplanations: true,
    learningMode: true
  };
  protected performanceMetrics: Map<string, number> = new Map();
  protected sessionStartTime: Date = new Date();

  constructor(
    protected model: LocalLLMConfig,
    protected workingDirectory: string
  ) {
    this.codebaseAnalyzer = new CodebaseAnalyzer();
    this.learningSystem = new LearningSystem(workingDirectory);
    this.contextManager = new ContextManager(workingDirectory);
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { message, workingDirectory } = request;
      const toolResults: ToolResult[] = [];
      const commandResults: CommandResult[] = [];
      const mcpResults: any[] = [];
      const gitResults: any[] = [];
      const qualityResults: any[] = [];
      const databaseResults: any[] = [];

      // Initialize project context if not already done
      if (!this.projectContext) {
        this.projectContext = await this.codebaseAnalyzer.analyzeCodebase(workingDirectory);
      }

      // Update services with current working directory
      this.learningSystem = new LearningSystem(workingDirectory);
      this.contextManager = new ContextManager(workingDirectory);

      // Use LLM to intelligently process the entire request
      const response = await this.processRequestWithLLM(
        message, 
        workingDirectory, 
        toolResults, 
        commandResults, 
        mcpResults, 
        gitResults, 
        qualityResults, 
        databaseResults
      );

      return {
        content: response,
        toolResults,
        commandResults,
        mcpResults,
        gitResults,
        qualityResults,
        databaseResults,
        context: {
          projectType: this.codebaseAnalyzer.getProjectType(this.projectContext),
          mainLanguage: this.codebaseAnalyzer.getMainLanguage(this.projectContext),
          codeFiles: this.projectContext.codeFiles.length,
          totalFiles: this.projectContext.files.length
        }
      };
    } catch (error) {
      return {
        content: `Error processing request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        toolResults: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  protected async processRequestWithLLM(
    message: string, 
    workingDirectory: string, 
    toolResults: ToolResult[],
    commandResults: CommandResult[],
    mcpResults: any[],
    gitResults: any[],
    qualityResults: any[],
    databaseResults: any[]
  ): Promise<string> {
    
    const startTime = Date.now();
    
    // Build comprehensive context
    const projectContext = this.projectContext ? {
      type: this.codebaseAnalyzer.getProjectType(this.projectContext),
      language: this.codebaseAnalyzer.getMainLanguage(this.projectContext),
      files: this.projectContext.files.length,
      codeFiles: this.projectContext.codeFiles.length,
      packageJson: this.projectContext.packageJson
    } : null;

    // Get adaptive response from learning system
    const adaptiveResponse = this.learningSystem.getAdaptiveResponse(
      message, 
      projectContext || { type: 'unknown', language: 'unknown' },
      this.getAvailableTools()
    );

    // Get conversation context
    const conversationContext = this.contextManager.getContextForLLM(message);
    
    // Update user intent
    this.contextManager.updateUserIntent(message);
    
    // Add context item for this request
    this.contextManager.addContextItem('command', message, ['user-request'], {
      confidence: adaptiveResponse.confidence,
      suggestedActions: adaptiveResponse.suggestedActions.length
    });

    // Create advanced comprehensive prompt
    const comprehensivePrompt = this.buildComprehensivePrompt(
      message, 
      conversationContext, 
      projectContext, 
      adaptiveResponse
    );

    try {
      // Get LLM analysis with full context
      const llmAnalysis = await this.sendToLLM(comprehensivePrompt);
      
      // Execute operations with learning-enhanced understanding
      const operations = await this.executeOperationsWithLearning(
        message, 
        workingDirectory, 
        toolResults, 
        commandResults, 
        mcpResults, 
        gitResults, 
        qualityResults, 
        databaseResults,
        adaptiveResponse
      );
      
      // Record performance metrics
      const responseTime = Date.now() - startTime;
      this.performanceMetrics.set('lastResponseTime', responseTime);
      
      // Record user behavior for learning
      this.learningSystem.recordUserBehavior(
        message,
        projectContext?.type || 'unknown',
        this.sessionStartTime,
        new Date()
      );
      
      // Generate final response using LLM
      const finalResponse = await this.generateFinalResponseWithLLM(
        message,
        llmAnalysis,
        operations,
        adaptiveResponse
      );
      
      return finalResponse;
      
    } catch (error) {
      // Enhanced fallback with learning context
      return await this.enhancedFallbackProcessing(
        message, 
        workingDirectory, 
        toolResults, 
        commandResults, 
        mcpResults, 
        gitResults, 
        qualityResults, 
        databaseResults,
        adaptiveResponse
      );
    }
  }

  protected abstract getAvailableTools(): string[];
  protected abstract buildComprehensivePrompt(
    message: string,
    conversationContext: string,
    projectContext: any,
    adaptiveResponse: AdaptiveResponse
  ): string;
  protected abstract executeOperationsWithLearning(
    message: string,
    workingDirectory: string,
    toolResults: ToolResult[],
    commandResults: CommandResult[],
    mcpResults: any[],
    gitResults: any[],
    qualityResults: any[],
    databaseResults: any[],
    adaptiveResponse: AdaptiveResponse
  ): Promise<string>;
  protected abstract enhancedFallbackProcessing(
    message: string,
    workingDirectory: string,
    toolResults: ToolResult[],
    commandResults: CommandResult[],
    mcpResults: any[],
    gitResults: any[],
    qualityResults: any[],
    databaseResults: any[],
    adaptiveResponse: AdaptiveResponse
  ): Promise<string>;

  protected async generateFinalResponseWithLLM(
    message: string,
    llmAnalysis: string,
    operations: string,
    adaptiveResponse: AdaptiveResponse
  ): Promise<string> {
    const prompt = `You are Next Mavens, an intelligent AI coding assistant. Generate a comprehensive, helpful response based on the following information:

User's original request: "${message}"

LLM Analysis: ${llmAnalysis}

Operations performed: ${operations}

Learning insights: ${adaptiveResponse.learningInsights.join(', ')}

Suggested actions: ${adaptiveResponse.suggestedActions.join(', ')}

Alternative approaches: ${adaptiveResponse.alternativeApproaches.join(', ')}

Generate a response that:
1. Directly addresses the user's request
2. Explains what was done and why
3. Provides helpful context and insights
4. Includes any relevant learning insights
5. Offers personalized recommendations
6. Uses a friendly, professional tone
7. Encourages further interaction

Response:`;

    try {
      return await this.sendToLLM(prompt);
    } catch (error) {
      // Fallback to combining analysis and operations
      return `${llmAnalysis}\n\n${operations}`;
    }
  }

  protected async sendToLLM(message: string): Promise<string> {
    try {
      if (this.model.provider === 'lm-studio') {
        return await this.sendToLMStudio(message);
      } else if (this.model.provider === 'ollama') {
        return await this.sendToOllama(message);
      } else {
        throw new Error(`Unsupported provider: ${this.model.provider}`);
      }
    } catch (error) {
      throw new Error(`LLM API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async sendToLMStudio(message: string): Promise<string> {
    const response = await fetch(`${this.model.url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model.name,
        messages: [
          {
            role: 'system',
            content: 'You are Next Mavens, an intelligent AI coding assistant with deep understanding of codebases, file operations, and software development best practices. Always provide helpful, accurate, and actionable responses.'
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
  }

  private async sendToOllama(message: string): Promise<string> {
    const response = await fetch(`${this.model.url}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model.name,
        prompt: `You are Next Mavens, an intelligent AI coding assistant with deep understanding of codebases, file operations, and software development best practices. Always provide helpful, accurate, and actionable responses.

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
  }
} 