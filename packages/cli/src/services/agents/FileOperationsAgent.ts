import { BaseAgent, AgentRequest, AgentResponse } from './BaseAgent.js';
import { LocalLLMConfig } from '../../types.js';
import { ToolResult } from '@nextmavens/cli-core';
import { CommandResult } from '../ShellCommandExecutor.js';
import { AdaptiveResponse } from '../LearningSystem.js';
import { LSTool, ReadFileTool, WriteFileTool } from '@nextmavens/cli-core';
import path from 'path';
import fs from 'fs';

export class FileOperationsAgent extends BaseAgent {
  private tools: Map<string, any> = new Map();

  constructor(model: LocalLLMConfig, workingDirectory: string) {
    super(model, workingDirectory);
    
    // Initialize file operation tools
    this.tools.set('list_directory', new LSTool());
    this.tools.set('read_file', new ReadFileTool());
    this.tools.set('write_file', new WriteFileTool());
  }

  protected getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  protected buildComprehensivePrompt(
    message: string,
    conversationContext: string,
    projectContext: any,
    adaptiveResponse: AdaptiveResponse
  ): string {
    return `You are Next Mavens, a specialized file operations AI assistant with deep understanding of file systems and codebases.

USER REQUEST: "${message}"

CONVERSATION CONTEXT:
${conversationContext}

PROJECT CONTEXT:
${projectContext ? JSON.stringify(projectContext, null, 2) : 'No project context available'}

LEARNING INSIGHTS:
• Confidence Level: ${(adaptiveResponse.confidence * 100).toFixed(1)}%
• Suggested Actions: ${adaptiveResponse.suggestedActions.join(', ')}
• Learning Insights: ${adaptiveResponse.learningInsights.join(', ')}

AVAILABLE FILE OPERATIONS:
1. Read Files: "read filename" or "show filename"
2. Write Files: "create filename with content" or "write filename"
3. List Directory: "list directory" or "show files"
4. Search Files: "search for pattern" or "find files"

INSTRUCTIONS:
1. Analyze the user's file operation request intelligently
2. Determine the best file operation to perform
3. Extract file paths and content accurately
4. Handle relative and absolute paths correctly
5. Provide helpful file analysis and insights
6. Consider project context for better file suggestions

RESPONSE FORMAT:
- Be conversational and helpful
- Explain what file operation you're performing
- Provide file analysis when reading files
- Suggest next steps based on context

Now, intelligently process the file operation request: "${message}"`;
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
      operations.push(`🎯 High confidence file operation (${(adaptiveResponse.confidence * 100).toFixed(1)}%)`);
    } else {
      operations.push(`⚠️ Low confidence - proceeding carefully`);
    }

    // File read operations
    if (lowerMessage.includes('read') || lowerMessage.includes('show') || lowerMessage.includes('open') || lowerMessage.includes('view')) {
      const filePath = await this.extractFilePath(message, workingDirectory);
      if (filePath) {
        const result = await this.tools.get('read_file').processSingleFileContent(filePath, workingDirectory);
        toolResults.push(result);
        results.push(`📖 Read file: ${filePath}`);
        this.contextManager.addContextItem('file', `Read file: ${filePath}`, ['file-operation', 'read']);
        
        // Add file analysis
        const analysis = await this.analyzeFileContent(filePath, result.llmContent.toString());
        results.push(`📊 Analysis: ${analysis.language} file with ${analysis.functions.length} functions, ${analysis.classes.length} classes`);
      }
    }

    // File write operations
    if (lowerMessage.includes('write') || lowerMessage.includes('create') || lowerMessage.includes('save') || lowerMessage.includes('generate')) {
      const { filePath, content } = await this.extractFileCreationRequest(message, workingDirectory);
      if (filePath && content) {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          await this.createDirectory(dir);
        }

        const result = await this.tools.get('write_file').processSingleFileContent(filePath, content);
        toolResults.push(result);
        results.push(`📝 Created file: ${filePath}`);
        this.contextManager.addContextItem('file', `Created file: ${filePath}`, ['file-operation', 'write']);
      }
    }

    // Directory listing
    if (lowerMessage.includes('list') || lowerMessage.includes('ls') || lowerMessage.includes('dir') || lowerMessage.includes('files')) {
      const result = await this.tools.get('list_directory').processSingleFileContent(workingDirectory, workingDirectory);
      toolResults.push(result);
      results.push(`📁 Listed directory contents`);
      this.contextManager.addContextItem('command', 'Listed directory', ['file-operation', 'list']);
      
      // Add directory summary
      const summary = this.generateDirectorySummary(result.llmContent.toString());
      results.push(`📊 Summary: ${summary}`);
    }

    // File search
    if (lowerMessage.includes('search') || lowerMessage.includes('find')) {
      const searchTerm = this.extractSearchTerm(message);
      if (searchTerm) {
        const matchingFiles = await this.codebaseAnalyzer.findFiles(searchTerm, workingDirectory);
        results.push(`🔎 Found ${matchingFiles.length} files matching "${searchTerm}"`);
        this.contextManager.addContextItem('command', `Search: ${searchTerm}`, ['file-operation', 'search']);
        
        if (matchingFiles.length > 0) {
          results.push(`📋 Files: ${matchingFiles.slice(0, 5).map(f => f.name).join(', ')}`);
        }
      }
    }

    // Add learning insights
    if (adaptiveResponse.learningInsights.length > 0) {
      results.push(`🧠 Learning: ${adaptiveResponse.learningInsights[0]}`);
    }

    return results.length > 0 ? 
      `**File Operations Completed:**\n${operations.join('\n')}\n\n${results.join('\n')}` : 
      'No file operations were performed.';
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
    
    this.contextManager.addContextItem('error', 'LLM unavailable, using file operation fallback', ['fallback', 'error']);
    
    if (lowerMessage.includes('list') || lowerMessage.includes('ls') || lowerMessage.includes('dir')) {
      const result = await this.tools.get('list_directory').processSingleFileContent(workingDirectory, workingDirectory);
      toolResults.push(result);
      return `📁 Directory listing:\n${result.content}\n\n⚠️ Using fallback mode - LLM unavailable for enhanced file analysis.`;
    }
    
    return `I understand you want to perform file operations: "${message}". I'm currently in enhanced fallback mode. Please try again when the LLM is available for full intelligent file assistance.`;
  }

  private async extractFilePath(message: string, workingDirectory: string): Promise<string | null> {
    const patterns = [
      /(?:read|show|open|view)\s+(.+?)(?:\s|$)/i,
      /file\s+(.+?)(?:\s|$)/i,
      /content\s+of\s+(.+?)(?:\s|$)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        let filePath = match[1].trim().replace(/^["']|["']$/g, '');
        
        if (!path.isAbsolute(filePath)) {
          filePath = path.join(workingDirectory, filePath);
        }
        
        return filePath;
      }
    }

    // Try to find files by name in the project
    if (this.projectContext) {
      const words = message.split(/\s+/);
      for (const word of words) {
        const skipWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        if (skipWords.includes(word.toLowerCase())) continue;
        
        if (word.includes('.') || word.length > 3) {
          const matchingFiles = this.projectContext.files.filter(f => 
            f.name.toLowerCase().includes(word.toLowerCase())
          );
          if (matchingFiles.length === 1) {
            return matchingFiles[0].path;
          }
        }
      }
    }

    return null;
  }

  private async extractFileCreationRequest(message: string, workingDirectory: string): Promise<{ filePath: string | null, content: string | null }> {
    const patterns = [
      /(?:create|write|save)\s+(?:a\s+)?(?:file\s+)?(?:called\s+)?([^\s]+(?:\.[^\s]+)?)\s+(?:with|containing|as)\s+(.+)/i,
      /(?:create|write|save)\s+([^\s]+(?:\.[^\s]+)?)\s+(?:with|containing|as)\s+(.+)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        let filePath = match[1].trim().replace(/^["']|["']$/g, '');
        const content = match[2].trim();
        
        if (!path.isAbsolute(filePath)) {
          filePath = path.join(workingDirectory, filePath);
        }
        
        return { filePath, content };
      }
    }

    return { filePath: null, content: null };
  }

  private extractSearchTerm(message: string): string | null {
    const patterns = [
      /(?:search|find|grep)\s+(.+?)(?:\s|$)/i,
      /(?:look\s+for|find\s+files\s+with)\s+(.+?)(?:\s|$)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  private generateDirectorySummary(lsOutput: string): string {
    const lines = lsOutput.split('\n').filter(line => line.trim());
    const files = lines.filter(line => !line.startsWith('d'));
    const dirs = lines.filter(line => line.startsWith('d'));
    
    return `${files.length} files, ${dirs.length} directories`;
  }

  private async analyzeFileContent(filePath: string, content: string): Promise<any> {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    
    const analysis = {
      language: this.getLanguageFromExtension(extension),
      functions: this.extractFunctions(content, extension),
      classes: this.extractClasses(content, extension),
      imports: this.extractImports(content, extension)
    };

    return analysis;
  }

  private getLanguageFromExtension(extension: string): string {
    const languageMap: Record<string, string> = {
      'js': 'JavaScript', 'ts': 'TypeScript', 'jsx': 'React JSX', 'tsx': 'React TypeScript',
      'py': 'Python', 'java': 'Java', 'cpp': 'C++', 'c': 'C', 'cs': 'C#',
      'php': 'PHP', 'rb': 'Ruby', 'go': 'Go', 'rs': 'Rust', 'swift': 'Swift',
      'html': 'HTML', 'css': 'CSS', 'json': 'JSON', 'md': 'Markdown'
    };
    return languageMap[extension] || 'Unknown';
  }

  private extractFunctions(content: string, extension: string): string[] {
    if (['js', 'ts', 'jsx', 'tsx'].includes(extension)) {
      const patterns = [/function\s+(\w+)\s*\(/g, /const\s+(\w+)\s*=\s*\(/g, /let\s+(\w+)\s*=\s*\(/g];
      const functions: string[] = [];
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          functions.push(match[1]);
        }
      }
      return [...new Set(functions)];
    }
    return [];
  }

  private extractClasses(content: string, extension: string): string[] {
    const classPattern = /class\s+(\w+)/g;
    const classes: string[] = [];
    let match;
    while ((match = classPattern.exec(content)) !== null) {
      classes.push(match[1]);
    }
    return classes;
  }

  private extractImports(content: string, extension: string): string[] {
    const importPatterns = [
      /import\s+(.+?)\s+from\s+['"](.+?)['"]/g,
      /import\s+['"](.+?)['"]/g,
      /require\s*\(\s*['"](.+?)['"]\s*\)/g
    ];
    const imports: string[] = [];
    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        imports.push(match[1] || match[2]);
      }
    }
    return [...new Set(imports)];
  }

  private async createDirectory(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
} 