import { LocalLLMConfig } from '../types.js';
import { BaseAgent, AgentRequest, AgentResponse } from './agents/BaseAgent.js';
import { FileOperationsAgent } from './agents/FileOperationsAgent.js';
import { CommandExecutionAgent } from './agents/CommandExecutionAgent.js';
import { GitService } from './GitService.js';
import { CodeQualityAnalyzer } from './CodeQualityAnalyzer.js';
import { DatabaseService } from './DatabaseService.js';
import { MCPClient } from './MCPClient.js';
import { ToolResult } from '@nextmavens/cli-core';
import { CommandResult } from './ShellCommandExecutor.js';
import { AdaptiveResponse } from './LearningSystem.js';

// Re-export types for compatibility
export { AgentRequest, AgentResponse };

export class IntelligentAgent {
  private fileAgent: FileOperationsAgent;
  private commandAgent: CommandExecutionAgent;
  private gitService: GitService;
  private qualityAnalyzer: CodeQualityAnalyzer;
  private databaseService: DatabaseService;
  private mcpClient: MCPClient;
  private workingDirectory: string;

  constructor(private model: LocalLLMConfig) {
    this.workingDirectory = process.cwd();
    this.fileAgent = new FileOperationsAgent(model, this.workingDirectory);
    this.commandAgent = new CommandExecutionAgent(model, this.workingDirectory);
    this.gitService = new GitService(this.workingDirectory);
    this.qualityAnalyzer = new CodeQualityAnalyzer(this.workingDirectory);
    this.databaseService = new DatabaseService(this.workingDirectory);
    this.mcpClient = new MCPClient();
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    try {
      const { message, workingDirectory } = request;
      this.workingDirectory = workingDirectory;

      // Update all services with current working directory
      this.updateServices(workingDirectory);

      // Use LLM to analyze intent and generate response
      const intent = await this.analyzeIntentWithLLM(message);
      
      // Execute operations based on LLM-determined intent
      const operations = await this.executeOperationsWithLLM(intent, request);
      
      // Generate final response using LLM
      const finalResponse = await this.generateResponseWithLLM(message, intent, operations);

      return {
        content: finalResponse,
        toolResults: operations.toolResults || [],
        commandResults: operations.commandResults || [],
        gitResults: operations.gitResults || [],
        qualityResults: operations.qualityResults || [],
        databaseResults: operations.databaseResults || [],
        mcpResults: operations.mcpResults || []
      };
    } catch (error) {
      // Use LLM to generate error response
      const errorResponse = await this.generateErrorResponseWithLLM(
        request.message, 
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      return {
        content: errorResponse,
        toolResults: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private updateServices(workingDirectory: string): void {
    this.fileAgent = new FileOperationsAgent(this.model, workingDirectory);
    this.commandAgent = new CommandExecutionAgent(this.model, workingDirectory);
    this.gitService = new GitService(workingDirectory);
    this.qualityAnalyzer = new CodeQualityAnalyzer(workingDirectory);
    this.databaseService = new DatabaseService(workingDirectory);
  }

  private async analyzeIntentWithLLM(message: string): Promise<any> {
    const prompt = `Analyze the following user message and determine the intent and required operations. Return a JSON object with the following structure:

{
  "primaryIntent": "file_operations|command_execution|git_operations|code_quality|database_operations|mcp_operations|codebase_analysis|general_conversation",
  "confidence": 0.0-1.0,
  "operations": ["operation1", "operation2"],
  "parameters": {
    "command": "extracted command if any",
    "filePath": "extracted file path if any",
    "query": "extracted query if any",
    "message": "extracted commit message if any"
  },
  "context": "brief explanation of what the user wants"
}

User message: "${message}"

Available operations:
- file_operations: read, write, create, list, search files
- command_execution: run shell commands, build, test, install
- git_operations: status, commit, push, pull, branch operations
- code_quality: analyze code quality, run linting, generate reports
- database_operations: connect to databases, execute queries
- mcp_operations: connect to MCP servers, list tools
- codebase_analysis: analyze project structure, provide overview
- general_conversation: greetings, help requests, general questions

Respond only with the JSON object:`;

    try {
      const response = await this.sendToLLM(prompt);
      return JSON.parse(response);
    } catch (error) {
      // Fallback to basic intent analysis
      return {
        primaryIntent: 'general_conversation',
        confidence: 0.5,
        operations: [],
        parameters: {},
        context: 'Unable to analyze intent, treating as general conversation'
      };
    }
  }

  private async executeOperationsWithLLM(intent: any, request: AgentRequest): Promise<any> {
    const results = {
      toolResults: [],
      commandResults: [],
      gitResults: [],
      qualityResults: [],
      databaseResults: [],
      mcpResults: []
    };

    try {
      switch (intent.primaryIntent) {
        case 'file_operations':
          return await this.fileAgent.processRequest(request);
        
        case 'command_execution':
          return await this.commandAgent.processRequest(request);
        
        case 'git_operations':
          return await this.executeGitOperationsWithLLM(intent, request);
        
        case 'code_quality':
          return await this.executeCodeQualityWithLLM(intent, request);
        
        case 'database_operations':
          return await this.executeDatabaseOperationsWithLLM(intent, request);
        
        case 'mcp_operations':
          return await this.executeMCPOperationsWithLLM(intent, request);
        
        case 'codebase_analysis':
          return await this.fileAgent.processRequest(request);
        
        default:
          return results;
      }
    } catch (error) {
      console.error('Error executing operations:', error);
      return results;
    }
  }

  private async executeGitOperationsWithLLM(intent: any, request: AgentRequest): Promise<any> {
    const { message } = request;
    const gitResults: any[] = [];
    
    try {
      if (intent.parameters.command === 'status') {
        const status = await this.gitService.status();
        gitResults.push({ type: 'status', data: status });
      } else if (intent.parameters.message) {
        const result = await this.gitService.commit(intent.parameters.message);
        gitResults.push({ type: 'commit', data: result });
      } else if (intent.parameters.command === 'push') {
        const result = await this.gitService.push();
        gitResults.push({ type: 'push', data: result });
      } else if (intent.parameters.command === 'pull') {
        const result = await this.gitService.pull();
        gitResults.push({ type: 'pull', data: result });
      }
    } catch (error) {
      console.error('Git operation error:', error);
    }

    return { gitResults };
  }

  private async executeCodeQualityWithLLM(intent: any, request: AgentRequest): Promise<any> {
    const qualityResults: any[] = [];
    
    try {
      if (intent.operations.includes('analyze')) {
        const report = await this.qualityAnalyzer.generateReport();
        qualityResults.push({ type: 'analysis', data: report });
      } else if (intent.operations.includes('lint')) {
        const { metrics, issues } = await this.qualityAnalyzer.analyzeCodeQuality();
        qualityResults.push({ type: 'lint', data: { metrics, issues } });
      }
    } catch (error) {
      console.error('Code quality operation error:', error);
    }

    return { qualityResults };
  }

  private async executeDatabaseOperationsWithLLM(intent: any, request: AgentRequest): Promise<any> {
    const databaseResults: any[] = [];
    
    try {
      if (intent.operations.includes('connect') && intent.parameters.query) {
        const projectUrl = intent.parameters.query;
        const apiKey = process.env.SUPABASE_API_KEY || '';
        
        if (apiKey) {
          const connection = await this.databaseService.connectSupabase(projectUrl, apiKey);
          databaseResults.push({ type: 'connect', data: connection });
        }
      } else if (intent.operations.includes('query') && intent.parameters.query) {
        const connections = await this.databaseService.listConnections();
        
        if (connections.length > 0) {
          const connectionId = connections[0];
          const result = await this.databaseService.executeQuery(connectionId, { 
            sql: intent.parameters.query 
          });
          databaseResults.push({ type: 'query', data: result });
        }
      }
    } catch (error) {
      console.error('Database operation error:', error);
    }

    return { databaseResults };
  }

  private async executeMCPOperationsWithLLM(intent: any, request: AgentRequest): Promise<any> {
    const mcpResults: any[] = [];
    
    try {
      if (intent.operations.includes('list')) {
        const servers = await this.mcpClient.listServers();
        const tools = await this.mcpClient.listTools();
        mcpResults.push({ type: 'list', data: { servers, tools } });
      } else if (intent.operations.includes('connect') && intent.parameters.command) {
        const [command, ...args] = intent.parameters.command.split(' ');
        const server = await this.mcpClient.connectToServer(command, args);
        mcpResults.push({ type: 'connect', server });
      }
    } catch (error) {
      console.error('MCP operation error:', error);
    }

    return { mcpResults };
  }

  private async generateResponseWithLLM(message: string, intent: any, operations: any): Promise<string> {
    const prompt = `You are Next Mavens, an intelligent AI coding assistant. Generate a helpful, informative response to the user's request.

User's message: "${message}"

Intent analysis: ${JSON.stringify(intent, null, 2)}

Operations performed: ${JSON.stringify(operations, null, 2)}

Generate a comprehensive response that:
1. Addresses the user's request directly
2. Explains what operations were performed (if any)
3. Provides helpful context and suggestions
4. Uses a friendly, professional tone
5. Includes any relevant results from operations
6. Offers next steps or additional help if appropriate

Response:`;

    try {
      return await this.sendToLLM(prompt);
    } catch (error) {
      return `I understand you said: "${message}". I'm here to help you with your coding tasks. How can I assist you today?`;
    }
  }

  private async generateErrorResponseWithLLM(message: string, error: string): Promise<string> {
    const prompt = `You are Next Mavens, an intelligent AI coding assistant. The user encountered an error while trying to process their request.

User's message: "${message}"
Error: "${error}"

Generate a helpful error response that:
1. Acknowledges the error occurred
2. Explains what went wrong in simple terms
3. Suggests possible solutions or alternatives
4. Maintains a helpful and supportive tone
5. Encourages the user to try again or ask for help differently

Error response:`;

    try {
      return await this.sendToLLM(prompt);
    } catch (error) {
      return `I encountered an issue while processing your request: "${message}". The error was: ${error}. Please try again or rephrase your question.`;
    }
  }

  private async sendToLLM(message: string): Promise<string> {
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