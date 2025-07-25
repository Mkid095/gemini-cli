import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export interface ContextItem {
  id: string;
  type: 'conversation' | 'file' | 'command' | 'error' | 'suggestion' | 'pattern';
  content: string;
  metadata: Record<string, any>;
  timestamp: Date;
  relevance: number;
  tags: string[];
  relationships: string[];
}

export interface ConversationContext {
  sessionId: string;
  messages: ContextMessage[];
  currentFocus: string;
  userIntent: string;
  projectContext: ProjectContext;
  fileContext: FileContext;
  commandHistory: CommandContext[];
  errors: ErrorContext[];
  suggestions: SuggestionContext[];
  patterns: PatternContext[];
  relevanceScores: Map<string, number>;
}

export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata: {
    filePath?: string;
    lineNumber?: number;
    command?: string;
    toolUsed?: string;
    confidence?: number;
  };
}

export interface ProjectContext {
  type: string;
  language: string;
  framework?: string;
  dependencies: string[];
  structure: string[];
  recentChanges: string[];
  activeFiles: string[];
  gitStatus: string;
}

export interface FileContext {
  currentFile?: string;
  openFiles: string[];
  recentFiles: string[];
  fileChanges: FileChange[];
  fileDependencies: Map<string, string[]>;
}

export interface FileChange {
  filePath: string;
  type: 'created' | 'modified' | 'deleted';
  timestamp: Date;
  lines?: number[];
}

export interface CommandContext {
  command: string;
  output: string;
  success: boolean;
  timestamp: Date;
  workingDirectory: string;
  error?: string;
}

export interface ErrorContext {
  error: string;
  filePath?: string;
  lineNumber?: number;
  timestamp: Date;
  resolved: boolean;
  resolution?: string;
}

export interface SuggestionContext {
  suggestion: string;
  type: 'refactor' | 'optimize' | 'security' | 'performance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  filePath?: string;
  lineNumber?: number;
  timestamp: Date;
  applied: boolean;
}

export interface PatternContext {
  pattern: string;
  type: 'design_pattern' | 'anti_pattern' | 'code_smell';
  occurrences: number;
  files: string[];
  firstSeen: Date;
  lastSeen: Date;
}

export class IntelligentContextManager {
  private contextDataPath: string;
  private conversationContext: ConversationContext;
  private contextItems: Map<string, ContextItem> = new Map();
  private relevanceThreshold = 0.3;
  private maxContextItems = 1000;
  private contextWindowSize = 50;

  constructor(workingDirectory: string) {
    this.contextDataPath = join(workingDirectory, '.nextmavens', 'context');
    this.ensureContextDirectory();
    this.conversationContext = this.initializeConversationContext();
    this.loadContextData();
  }

  addMessage(role: 'user' | 'assistant' | 'system', content: string, metadata?: Record<string, any>): void {
    const message: ContextMessage = {
      role,
      content,
      timestamp: new Date(),
      metadata: metadata || {}
    };

    this.conversationContext.messages.push(message);
    this.updateRelevanceScores();
    this.saveContextData();
  }

  updateUserIntent(intent: string): void {
    this.conversationContext.userIntent = intent;
    this.addContextItem('conversation', `User intent: ${intent}`, {
      type: 'intent_update',
      confidence: 0.8
    });
  }

  updateCurrentFocus(focus: string): void {
    this.conversationContext.currentFocus = focus;
    this.addContextItem('conversation', `Current focus: ${focus}`, {
      type: 'focus_update',
      confidence: 0.9
    });
  }

  addFileContext(filePath: string, action: 'opened' | 'modified' | 'created' | 'deleted'): void {
    const fileContext = this.conversationContext.fileContext;
    
    switch (action) {
      case 'opened':
        if (!fileContext.openFiles.includes(filePath)) {
          fileContext.openFiles.push(filePath);
        }
        fileContext.currentFile = filePath;
        break;
      case 'modified':
        fileContext.fileChanges.push({
          filePath,
          type: 'modified',
          timestamp: new Date()
        });
        break;
      case 'created':
        fileContext.fileChanges.push({
          filePath,
          type: 'created',
          timestamp: new Date()
        });
        break;
      case 'deleted':
        fileContext.fileChanges.push({
          filePath,
          type: 'deleted',
          timestamp: new Date()
        });
        fileContext.openFiles = fileContext.openFiles.filter(f => f !== filePath);
        break;
    }

    this.addContextItem('file', `${action} file: ${filePath}`, {
      action,
      filePath,
      timestamp: new Date()
    });
  }

  addCommandContext(command: string, output: string, success: boolean, workingDirectory: string, error?: string): void {
    const commandContext: CommandContext = {
      command,
      output,
      success,
      timestamp: new Date(),
      workingDirectory,
      error
    };

    this.conversationContext.commandHistory.push(commandContext);
    
    this.addContextItem('command', `Executed: ${command}`, {
      success,
      output: output.substring(0, 200), // Truncate long outputs
      workingDirectory,
      error
    });
  }

  addErrorContext(error: string, filePath?: string, lineNumber?: number): void {
    const errorContext: ErrorContext = {
      error,
      filePath,
      lineNumber,
      timestamp: new Date(),
      resolved: false
    };

    this.conversationContext.errors.push(errorContext);
    
    this.addContextItem('error', `Error: ${error}`, {
      filePath,
      lineNumber,
      resolved: false
    });
  }

  addSuggestionContext(suggestion: string, type: SuggestionContext['type'], priority: SuggestionContext['priority'], filePath?: string, lineNumber?: number): void {
    const suggestionContext: SuggestionContext = {
      suggestion,
      type,
      priority,
      filePath,
      lineNumber,
      timestamp: new Date(),
      applied: false
    };

    this.conversationContext.suggestions.push(suggestionContext);
    
    this.addContextItem('suggestion', `Suggestion: ${suggestion}`, {
      type,
      priority,
      filePath,
      lineNumber,
      applied: false
    });
  }

  addPatternContext(pattern: string, type: PatternContext['type'], filePath: string): void {
    const existingPattern = this.conversationContext.patterns.find(p => p.pattern === pattern && p.type === type);
    
    if (existingPattern) {
      existingPattern.occurrences++;
      existingPattern.lastSeen = new Date();
      if (!existingPattern.files.includes(filePath)) {
        existingPattern.files.push(filePath);
      }
    } else {
      const patternContext: PatternContext = {
        pattern,
        type,
        occurrences: 1,
        files: [filePath],
        firstSeen: new Date(),
        lastSeen: new Date()
      };
      this.conversationContext.patterns.push(patternContext);
    }
    
    this.addContextItem('pattern', `Pattern: ${pattern}`, {
      type,
      filePath,
      occurrences: existingPattern?.occurrences || 1
    });
  }

  getRelevantContext(query: string, limit: number = 10): ContextItem[] {
    const relevantItems: Array<{ item: ContextItem; score: number }> = [];
    
    this.contextItems.forEach(item => {
      const score = this.calculateRelevanceScore(query, item);
      if (score > this.relevanceThreshold) {
        relevantItems.push({ item, score });
      }
    });
    
    return relevantItems
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => item);
  }

  getConversationSummary(): string {
    const messages = this.conversationContext.messages;
    const recentMessages = messages.slice(-this.contextWindowSize);
    
    let summary = `Recent conversation (${recentMessages.length} messages):\n\n`;
    
    recentMessages.forEach((message, index) => {
      const role = message.role === 'user' ? '👤' : message.role === 'assistant' ? '🤖' : '⚙️';
      const time = message.timestamp.toLocaleTimeString();
      const content = message.content.length > 100 
        ? message.content.substring(0, 100) + '...' 
        : message.content;
      
      summary += `${index + 1}. ${role} [${time}]: ${content}\n`;
    });
    
    if (this.conversationContext.currentFocus) {
      summary += `\nCurrent focus: ${this.conversationContext.currentFocus}\n`;
    }
    
    if (this.conversationContext.userIntent) {
      summary += `User intent: ${this.conversationContext.userIntent}\n`;
    }
    
    return summary;
  }

  getProjectContext(): ProjectContext {
    return this.conversationContext.projectContext;
  }

  updateProjectContext(updates: Partial<ProjectContext>): void {
    this.conversationContext.projectContext = {
      ...this.conversationContext.projectContext,
      ...updates
    };
    this.saveContextData();
  }

  getFileContext(): FileContext {
    return this.conversationContext.fileContext;
  }

  getRecentCommands(limit: number = 10): CommandContext[] {
    return this.conversationContext.commandHistory
      .slice(-limit)
      .reverse();
  }

  getRecentErrors(limit: number = 5): ErrorContext[] {
    return this.conversationContext.errors
      .filter(error => !error.resolved)
      .slice(-limit)
      .reverse();
  }

  getActiveSuggestions(): SuggestionContext[] {
    return this.conversationContext.suggestions
      .filter(suggestion => !suggestion.applied)
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
  }

  getPatternInsights(): string[] {
    const insights: string[] = [];
    
    this.conversationContext.patterns.forEach(pattern => {
      if (pattern.occurrences > 3) {
        insights.push(`Frequent ${pattern.type}: "${pattern.pattern}" (${pattern.occurrences} occurrences)`);
      }
    });
    
    return insights;
  }

  markErrorResolved(errorId: string, resolution?: string): void {
    const error = this.conversationContext.errors.find(e => e.error.includes(errorId));
    if (error) {
      error.resolved = true;
      error.resolution = resolution;
    }
  }

  markSuggestionApplied(suggestionId: string): void {
    const suggestion = this.conversationContext.suggestions.find(s => s.suggestion.includes(suggestionId));
    if (suggestion) {
      suggestion.applied = true;
    }
  }

  getContextForLLM(query: string): string {
    const relevantContext = this.getRelevantContext(query, 5);
    const conversationSummary = this.getConversationSummary();
    const projectContext = this.getProjectContext();
    const recentCommands = this.getRecentCommands(3);
    const activeSuggestions = this.getActiveSuggestions().slice(0, 3);
    const patternInsights = this.getPatternInsights();
    
    let context = `CONVERSATION CONTEXT:\n${conversationSummary}\n\n`;
    
    if (relevantContext.length > 0) {
      context += `RELEVANT CONTEXT:\n`;
      relevantContext.forEach(item => {
        context += `- ${item.type.toUpperCase()}: ${item.content}\n`;
      });
      context += '\n';
    }
    
    context += `PROJECT CONTEXT:\n`;
    context += `- Type: ${projectContext.type}\n`;
    context += `- Language: ${projectContext.language}\n`;
    if (projectContext.framework) {
      context += `- Framework: ${projectContext.framework}\n`;
    }
    context += `- Dependencies: ${projectContext.dependencies.length}\n`;
    context += `- Active files: ${projectContext.activeFiles.length}\n\n`;
    
    if (recentCommands.length > 0) {
      context += `RECENT COMMANDS:\n`;
      recentCommands.forEach(cmd => {
        const status = cmd.success ? '✅' : '❌';
        context += `${status} ${cmd.command}\n`;
      });
      context += '\n';
    }
    
    if (activeSuggestions.length > 0) {
      context += `ACTIVE SUGGESTIONS:\n`;
      activeSuggestions.forEach(suggestion => {
        context += `- ${suggestion.priority.toUpperCase()}: ${suggestion.suggestion}\n`;
      });
      context += '\n';
    }
    
    if (patternInsights.length > 0) {
      context += `PATTERN INSIGHTS:\n`;
      patternInsights.forEach(insight => {
        context += `- ${insight}\n`;
      });
      context += '\n';
    }
    
    return context;
  }

  private addContextItem(type: ContextItem['type'], content: string, metadata: Record<string, any>): void {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const item: ContextItem = {
      id,
      type,
      content,
      metadata,
      timestamp: new Date(),
      relevance: 1.0,
      tags: this.extractTags(content),
      relationships: this.findRelationships(content)
    };
    
    this.contextItems.set(id, item);
    
    // Maintain max context items
    if (this.contextItems.size > this.maxContextItems) {
      const oldestItem = Array.from(this.contextItems.entries())[0];
      this.contextItems.delete(oldestItem[0]);
    }
  }

  private calculateRelevanceScore(query: string, item: ContextItem): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = item.content.toLowerCase().split(/\s+/);
    
    let score = 0;
    let matches = 0;
    
    queryWords.forEach(queryWord => {
      contentWords.forEach(contentWord => {
        if (contentWord.includes(queryWord) || queryWord.includes(contentWord)) {
          matches++;
          score += 0.1;
        }
      });
    });
    
    // Boost score for exact matches
    if (item.content.toLowerCase().includes(query.toLowerCase())) {
      score += 0.5;
    }
    
    // Boost score for recent items
    const ageInMinutes = (Date.now() - item.timestamp.getTime()) / (1000 * 60);
    const recencyBoost = Math.max(0, 1 - ageInMinutes / 60); // Decay over 1 hour
    score += recencyBoost * 0.3;
    
    // Boost score for high relevance items
    score += item.relevance * 0.2;
    
    return Math.min(1.0, score);
  }

  private updateRelevanceScores(): void {
    // Update relevance scores based on recent activity
    this.contextItems.forEach(item => {
      const recentMessages = this.conversationContext.messages.slice(-10);
      let relevance = 0.5; // Base relevance
      
      recentMessages.forEach(message => {
        if (this.hasSemanticSimilarity(item.content, message.content)) {
          relevance += 0.1;
        }
      });
      
      item.relevance = Math.min(1.0, relevance);
    });
  }

  private hasSemanticSimilarity(content1: string, content2: string): boolean {
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size > 0.3; // 30% similarity threshold
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    
    // Extract file extensions
    const fileExtensions = content.match(/\.\w+/g);
    if (fileExtensions) {
      tags.push(...fileExtensions.map(ext => `file:${ext}`));
    }
    
    // Extract programming concepts
    const concepts = ['function', 'class', 'interface', 'type', 'import', 'export', 'async', 'await'];
    concepts.forEach(concept => {
      if (content.toLowerCase().includes(concept)) {
        tags.push(`concept:${concept}`);
      }
    });
    
    // Extract error types
    const errorTypes = ['error', 'warning', 'exception', 'failed', 'success'];
    errorTypes.forEach(errorType => {
      if (content.toLowerCase().includes(errorType)) {
        tags.push(`status:${errorType}`);
      }
    });
    
    return tags;
  }

  private findRelationships(content: string): string[] {
    const relationships: string[] = [];
    
    // Find references to other context items
    this.contextItems.forEach(item => {
      if (item.content !== content && this.hasSemanticSimilarity(content, item.content)) {
        relationships.push(item.id);
      }
    });
    
    return relationships;
  }

  private initializeConversationContext(): ConversationContext {
    return {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      messages: [],
      currentFocus: '',
      userIntent: '',
      projectContext: {
        type: 'unknown',
        language: 'unknown',
        dependencies: [],
        structure: [],
        recentChanges: [],
        activeFiles: [],
        gitStatus: 'unknown'
      },
      fileContext: {
        openFiles: [],
        recentFiles: [],
        fileChanges: [],
        fileDependencies: new Map()
      },
      commandHistory: [],
      errors: [],
      suggestions: [],
      patterns: [],
      relevanceScores: new Map()
    };
  }

  private ensureContextDirectory(): void {
    if (!existsSync(this.contextDataPath)) {
      mkdirSync(this.contextDataPath, { recursive: true });
    }
  }

  private loadContextData(): void {
    try {
      const contextFile = join(this.contextDataPath, 'context.json');
      if (existsSync(contextFile)) {
        const data = JSON.parse(readFileSync(contextFile, 'utf-8'));
        this.conversationContext = {
          ...this.conversationContext,
          ...data,
          relevanceScores: new Map(data.relevanceScores || [])
        };
      }
      
      const itemsFile = join(this.contextDataPath, 'items.json');
      if (existsSync(itemsFile)) {
        const itemsData = JSON.parse(readFileSync(itemsFile, 'utf-8'));
        this.contextItems = new Map(Object.entries(itemsData).map(([id, item]: [string, any]) => [
          id,
          { ...item, timestamp: new Date(item.timestamp) }
        ]));
      }
    } catch (error) {
      console.warn('Failed to load context data:', error);
    }
  }

  private saveContextData(): void {
    try {
      const contextFile = join(this.contextDataPath, 'context.json');
      const contextData = {
        ...this.conversationContext,
        relevanceScores: Array.from(this.conversationContext.relevanceScores.entries())
      };
      writeFileSync(contextFile, JSON.stringify(contextData, null, 2));
      
      const itemsFile = join(this.contextDataPath, 'items.json');
      const itemsData = Object.fromEntries(this.contextItems);
      writeFileSync(itemsFile, JSON.stringify(itemsData, null, 2));
    } catch (error) {
      console.warn('Failed to save context data:', error);
    }
  }
} 