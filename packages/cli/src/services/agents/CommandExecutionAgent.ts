import { BaseAgent, AgentRequest, AgentResponse } from './BaseAgent.js';
import { LocalLLMConfig } from '../../types.js';
import { ToolResult } from '@nextmavens/cli-core';
import { CommandResult, ShellCommandExecutor } from '../ShellCommandExecutor.js';
import { AdaptiveResponse } from '../LearningSystem.js';

export class CommandExecutionAgent extends BaseAgent {
  private shellExecutor: ShellCommandExecutor;

  constructor(model: LocalLLMConfig, workingDirectory: string) {
    super(model, workingDirectory);
    this.shellExecutor = new ShellCommandExecutor(workingDirectory);
  }

  protected getAvailableTools(): string[] {
    return ['shell_command', 'directory_creation', 'build_command', 'test_command', 'install_command'];
  }

  protected buildComprehensivePrompt(
    message: string,
    conversationContext: string,
    projectContext: any,
    adaptiveResponse: AdaptiveResponse
  ): string {
    return `You are Next Mavens, a specialized command execution AI assistant with deep understanding of shell commands, build processes, and development workflows.

USER REQUEST: "${message}"

CONVERSATION CONTEXT:
${conversationContext}

PROJECT CONTEXT:
${projectContext ? JSON.stringify(projectContext, null, 2) : 'No project context available'}

LEARNING INSIGHTS:
• Confidence Level: ${(adaptiveResponse.confidence * 100).toFixed(1)}%
• Suggested Actions: ${adaptiveResponse.suggestedActions.join(', ')}
• Learning Insights: ${adaptiveResponse.learningInsights.join(', ')}

AVAILABLE COMMAND OPERATIONS:
1. Shell Commands: "run command" or "execute command"
2. Build Commands: "build and check errors" or "npm run build"
3. Test Commands: "test and see results" or "npm test"
4. Install Commands: "install dependencies" or "npm install"
5. Directory Creation: "create directory" or "mkdir folder"
6. Custom Commands: Any shell command execution

INSTRUCTIONS:
1. Analyze the user's command execution request intelligently
2. Extract the appropriate command from natural language
3. Handle common development commands (build, test, install)
4. Provide helpful error analysis and suggestions
5. Consider project context for better command suggestions
6. Execute commands safely and provide detailed output

RESPONSE FORMAT:
- Be conversational and helpful
- Explain what command you're executing
- Provide detailed output and error analysis
- Suggest fixes for failed commands
- Consider project-specific commands

Now, intelligently process the command execution request: "${message}"`;
  }

  protected async executeOperationsWithLearning(
    message: string,
    workingDirectory: string,
    toolResults: ToolResult[],
    commandResults: CommandResult[],
    mcpResults: any[],
    gitResults: any[],
    qualityResults: any[],
    databaseResults: any[],
    adaptiveResponse: AdaptiveResponse
  ): Promise<string> {
    
    const lowerMessage = message.toLowerCase();
    let results = [];
    let operations = [];

    // Use learning insights to guide operations
    if (adaptiveResponse.confidence > 0.7) {
      operations.push(`🎯 High confidence command execution (${(adaptiveResponse.confidence * 100).toFixed(1)}%)`);
    } else {
      operations.push(`⚠️ Low confidence - proceeding carefully`);
    }

    // Update shell executor working directory
    this.shellExecutor = new ShellCommandExecutor(workingDirectory);

    // Command execution
    if (lowerMessage.includes('run') || lowerMessage.includes('execute') || lowerMessage.includes('command') || 
        lowerMessage.includes('build') || lowerMessage.includes('test') || lowerMessage.includes('install')) {
      const command = this.extractCommand(message);
      if (command) {
        console.log(`🔄 Executing command: ${command}`);
        const result = await this.shellExecutor.executeCommand(command);
        commandResults.push(result);
        
        if (result.success) {
          results.push(`✅ Command executed successfully: ${command}`);
          results.push(`📤 Output: ${result.stdout}`);
          this.contextManager.addContextItem('command', `Executed: ${command}`, ['shell-command', 'success']);
        } else {
          results.push(`❌ Command failed: ${command}`);
          results.push(`📤 Error: ${result.stderr}`);
          this.contextManager.addContextItem('command', `Failed: ${command}`, ['shell-command', 'error']);
          
          // Add error analysis
          const errorAnalysis = await this.analyzeCommandError(command, result.stderr);
          results.push(`🔍 Analysis: ${errorAnalysis}`);
        }
      }
    }

    // Build commands
    if (lowerMessage.includes('build') || (lowerMessage.includes('npm') && lowerMessage.includes('build'))) {
      const command = 'npm run build';
      const result = await this.shellExecutor.executeCommand(command);
      commandResults.push(result);
      
      if (result.success) {
        results.push(`✅ Build completed successfully`);
        results.push(`📤 Output: ${result.stdout}`);
        this.contextManager.addContextItem('command', 'Build successful', ['build-command', 'success']);
      } else {
        results.push(`❌ Build failed`);
        results.push(`📤 Error: ${result.stderr}`);
        this.contextManager.addContextItem('command', 'Build failed', ['build-command', 'error']);
        
        // Add build error analysis
        const buildAnalysis = await this.analyzeBuildError(result.stderr);
        results.push(`🔍 Build Analysis: ${buildAnalysis}`);
      }
    }

    // Test commands
    if (lowerMessage.includes('test') || (lowerMessage.includes('npm') && lowerMessage.includes('test'))) {
      const command = 'npm test';
      const result = await this.shellExecutor.executeCommand(command);
      commandResults.push(result);
      
      if (result.success) {
        results.push(`✅ Tests completed successfully`);
        results.push(`📤 Output: ${result.stdout}`);
        this.contextManager.addContextItem('command', 'Tests successful', ['test-command', 'success']);
      } else {
        results.push(`❌ Tests failed`);
        results.push(`📤 Error: ${result.stderr}`);
        this.contextManager.addContextItem('command', 'Tests failed', ['test-command', 'error']);
        
        // Add test error analysis
        const testAnalysis = await this.analyzeTestError(result.stderr);
        results.push(`🔍 Test Analysis: ${testAnalysis}`);
      }
    }

    // Install commands
    if (lowerMessage.includes('install') || (lowerMessage.includes('npm') && lowerMessage.includes('install'))) {
      const command = 'npm install';
      const result = await this.shellExecutor.executeCommand(command);
      commandResults.push(result);
      
      if (result.success) {
        results.push(`✅ Dependencies installed successfully`);
        results.push(`📤 Output: ${result.stdout}`);
        this.contextManager.addContextItem('command', 'Install successful', ['install-command', 'success']);
      } else {
        results.push(`❌ Installation failed`);
        results.push(`📤 Error: ${result.stderr}`);
        this.contextManager.addContextItem('command', 'Install failed', ['install-command', 'error']);
        
        // Add install error analysis
        const installAnalysis = await this.analyzeInstallError(result.stderr);
        results.push(`🔍 Install Analysis: ${installAnalysis}`);
      }
    }

    // Directory creation
    if (lowerMessage.includes('mkdir') || lowerMessage.includes('create directory') || lowerMessage.includes('make folder')) {
      const dirPath = this.extractDirectoryPath(message, workingDirectory);
      if (dirPath) {
        const result = await this.shellExecutor.mkdir(dirPath);
        commandResults.push(result);
        
        if (result.success) {
          results.push(`✅ Directory created: ${dirPath}`);
          this.contextManager.addContextItem('command', `Created directory: ${dirPath}`, ['directory-creation', 'success']);
        } else {
          results.push(`❌ Failed to create directory: ${dirPath}`);
          results.push(`📤 Error: ${result.stderr}`);
          this.contextManager.addContextItem('command', `Failed to create: ${dirPath}`, ['directory-creation', 'error']);
        }
      }
    }

    // Add learning insights
    if (adaptiveResponse.learningInsights.length > 0) {
      results.push(`🧠 Learning: ${adaptiveResponse.learningInsights[0]}`);
    }

    return results.length > 0 ? 
      `**Command Operations Completed:**\n${operations.join('\n')}\n\n${results.join('\n')}` : 
      'No command operations were performed.';
  }

  protected async enhancedFallbackProcessing(
    message: string,
    workingDirectory: string,
    toolResults: ToolResult[],
    commandResults: CommandResult[],
    mcpResults: any[],
    gitResults: any[],
    qualityResults: any[],
    databaseResults: any[],
    adaptiveResponse: AdaptiveResponse
  ): Promise<string> {
    
    const lowerMessage = message.toLowerCase();
    
    this.contextManager.addContextItem('error', 'LLM unavailable, using command execution fallback', ['fallback', 'error']);
    
    // Basic command extraction and execution
    if (lowerMessage.includes('run') || lowerMessage.includes('execute')) {
      const command = this.extractCommand(message);
      if (command) {
        const result = await this.shellExecutor.executeCommand(command);
        commandResults.push(result);
        
        if (result.success) {
          return `✅ Command executed: ${command}\n\nOutput:\n${result.stdout}\n\n⚠️ Using fallback mode - LLM unavailable for enhanced analysis.`;
        } else {
          return `❌ Command failed: ${command}\n\nError:\n${result.stderr}\n\n⚠️ Using fallback mode - LLM unavailable for enhanced analysis.`;
        }
      }
    }
    
    return `I understand you want to execute commands: "${message}". I'm currently in enhanced fallback mode. Please try again when the LLM is available for full intelligent command assistance.`;
  }

  private extractCommand(message: string): string | null {
    const patterns = [
      /(?:run|execute|command)\s+(.+?)(?:\s+and\s+see|\s+to\s+see|\s+for\s+errors?|\s+and\s+give|\s+to\s+check)/i,
      /(?:run|execute|command)\s+(.+)/i,
      /(?:build|test|install)\s+(?:and\s+see\s+what\s+errors?\s+I\s+have\s+and\s+give\s+me\s+a\s+summary?)/i,
      /(?:build|test|install)\s+(?:and\s+check\s+errors?)/i,
      /(?:build|test|install)\s+(?:and\s+see\s+errors?)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Handle specific commands
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('build') && lowerMessage.includes('errors')) {
      return 'npm run build';
    }
    if (lowerMessage.includes('test') && lowerMessage.includes('errors')) {
      return 'npm test';
    }
    if (lowerMessage.includes('install') && lowerMessage.includes('errors')) {
      return 'npm install';
    }
    if (lowerMessage.includes('build')) {
      return 'npm run build';
    }
    if (lowerMessage.includes('test')) {
      return 'npm test';
    }
    if (lowerMessage.includes('install')) {
      return 'npm install';
    }

    return null;
  }

  private extractDirectoryPath(message: string, workingDirectory: string): string | null {
    const patterns = [
      /(?:mkdir|create directory|make folder)\s+(.+)/i,
      /(?:create|make)\s+(?:a\s+)?(?:directory|folder)\s+(?:called\s+)?(.+)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        let dirPath = match[1].trim().replace(/^["']|["']$/g, '');
        
        if (!dirPath.startsWith('/') && !dirPath.startsWith('./')) {
          dirPath = `./${dirPath}`;
        }
        
        return dirPath;
      }
    }

    return null;
  }

  private async analyzeCommandError(command: string, error: string): Promise<string> {
    const analysisPrompt = `Analyze this command error and provide helpful suggestions:

Command: ${command}
Error: ${error}

Please provide:
1. What went wrong
2. How to fix it
3. Alternative approaches

Keep the response concise and actionable.`;

    try {
      return await this.sendToLLM(analysisPrompt);
    } catch (error) {
      return 'Unable to analyze error - check command syntax and permissions';
    }
  }

  private async analyzeBuildError(error: string): Promise<string> {
    const analysisPrompt = `Analyze this build error and provide helpful suggestions:

Build Error: ${error}

Please provide:
1. Common causes of this build error
2. How to fix it
3. Prevention tips

Keep the response concise and actionable.`;

    try {
      return await this.sendToLLM(analysisPrompt);
    } catch (error) {
      return 'Unable to analyze build error - check dependencies and configuration';
    }
  }

  private async analyzeTestError(error: string): Promise<string> {
    const analysisPrompt = `Analyze this test error and provide helpful suggestions:

Test Error: ${error}

Please provide:
1. Common causes of test failures
2. How to fix the failing tests
3. Testing best practices

Keep the response concise and actionable.`;

    try {
      return await this.sendToLLM(analysisPrompt);
    } catch (error) {
      return 'Unable to analyze test error - check test files and dependencies';
    }
  }

  private async analyzeInstallError(error: string): Promise<string> {
    const analysisPrompt = `Analyze this installation error and provide helpful suggestions:

Install Error: ${error}

Please provide:
1. Common causes of installation failures
2. How to fix it
3. Alternative installation methods

Keep the response concise and actionable.`;

    try {
      return await this.sendToLLM(analysisPrompt);
    } catch (error) {
      return 'Unable to analyze install error - check network connection and package.json';
    }
  }
} 