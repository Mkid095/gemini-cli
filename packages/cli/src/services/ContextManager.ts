import fs from 'fs';
import path from 'path';

export interface ContextItem {
  id: string;
  type: 'file' | 'command' | 'error' | 'insight' | 'preference';
  content: string;
  timestamp: Date;
  relevance: number;
  tags: string[];
  metadata: Record<string, any>;
}

export interface ConversationContext {
  sessionId: string;
  startTime: Date;
  messages: ContextItem[];
  currentFocus: string[];
  projectState: Record<string, any>;
  userIntent: string;
  pendingActions: string[];
}

export interface ContextWindow {
  maxItems: number;
  items: ContextItem[];
  currentFocus: string[];
  relevanceThreshold: number;
}

export class ContextManager {
  private contextWindow: ContextWindow;
  private conversationContext: ConversationContext;
  private contextDataPath: string;
  private sessionStartTime: Date;

  constructor(workingDirectory: string) {
    this.contextDataPath = path.join(workingDirectory, '.nextmavens', 'context');
    this.sessionStartTime = new Date();
    
    this.contextWindow = {
      maxItems: 50,
      items: [],
      currentFocus: [],
      relevanceThreshold: 0.3
    };
    
    this.conversationContext = {
      sessionId: this.generateSessionId(),
      startTime: this.sessionStartTime,
      messages: [],
      currentFocus: [],
      projectState: {},
      userIntent: '',
      pendingActions: []
    };
    
    this.ensureContextDirectory();
    this.loadContext();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private ensureContextDirectory(): void {
    const dir = path.dirname(this.contextDataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadContext(): void {
    try {
      const contextFile = path.join(this.contextDataPath, 'context.json');
      if (fs.existsSync(contextFile)) {
        const data = JSON.parse(fs.readFileSync(contextFile, 'utf-8'));
        this.contextWindow = { ...this.contextWindow, ...data.contextWindow };
        this.conversationContext = { ...this.conversationContext, ...data.conversationContext };
      }
    } catch (error) {
      console.log('Context data not found, starting fresh');
    }
  }

  private saveContext(): void {
    try {
      const data = {
        contextWindow: this.contextWindow,
        conversationContext: this.conversationContext,
        lastUpdated: new Date().toISOString()
      };
      
      fs.writeFileSync(
        path.join(this.contextDataPath, 'context.json'),
        JSON.stringify(data, null, 2)
      );
    } catch (error) {
      console.log('Failed to save context:', error);
    }
  }

  addContextItem(
    type: ContextItem['type'],
    content: string,
    tags: string[] = [],
    metadata: Record<string, any> = {}
  ): void {
    const item: ContextItem = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type,
      content,
      timestamp: new Date(),
      relevance: this.calculateRelevance(content, tags),
      tags,
      metadata
    };

    this.contextWindow.items.push(item);
    this.conversationContext.messages.push(item);
    
    // Maintain context window size
    if (this.contextWindow.items.length > this.contextWindow.maxItems) {
      this.contextWindow.items = this.contextWindow.items
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, this.contextWindow.maxItems);
    }
    
    this.updateCurrentFocus(item);
    this.saveContext();
  }

  private calculateRelevance(content: string, tags: string[]): number {
    let relevance = 0.5; // Base relevance
    
    // Increase relevance for recent items
    const timeSince = Date.now() - this.sessionStartTime.getTime();
    const timeFactor = Math.max(0.1, 1 - (timeSince / (1000 * 60 * 60))); // Decay over 1 hour
    relevance += timeFactor * 0.3;
    
    // Increase relevance for important tags
    const importantTags = ['error', 'critical', 'important', 'urgent', 'fix'];
    const importantTagCount = tags.filter(tag => importantTags.includes(tag.toLowerCase())).length;
    relevance += importantTagCount * 0.1;
    
    // Increase relevance for file operations
    if (content.includes('file') || content.includes('read') || content.includes('write')) {
      relevance += 0.2;
    }
    
    // Increase relevance for errors
    if (content.includes('error') || content.includes('failed') || content.includes('exception')) {
      relevance += 0.3;
    }
    
    return Math.min(relevance, 1.0);
  }

  private updateCurrentFocus(item: ContextItem): void {
    // Update current focus based on the new item
    if (item.type === 'error') {
      this.contextWindow.currentFocus = ['error-resolution', 'debugging'];
    } else if (item.type === 'file') {
      this.contextWindow.currentFocus = ['file-operations', 'code-analysis'];
    } else if (item.type === 'command') {
      this.contextWindow.currentFocus = ['command-execution', 'automation'];
    }
    
    this.conversationContext.currentFocus = [...this.contextWindow.currentFocus];
  }

  getRelevantContext(query: string, limit: number = 10): ContextItem[] {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    
    const relevantItems = this.contextWindow.items
      .filter(item => {
        // Check if item is above relevance threshold
        if (item.relevance < this.contextWindow.relevanceThreshold) {
          return false;
        }
        
        // Check for word overlap
        const itemWords = new Set(item.content.toLowerCase().split(/\s+/));
        const intersection = new Set([...queryWords].filter(x => itemWords.has(x)));
        const overlap = intersection.size / queryWords.size;
        
        return overlap > 0.2; // At least 20% word overlap
      })
      .sort((a, b) => {
        // Sort by relevance and recency
        const recencyA = this.calculateRecency(a.timestamp);
        const recencyB = this.calculateRecency(b.timestamp);
        return (b.relevance * recencyB) - (a.relevance * recencyA);
      })
      .slice(0, limit);
    
    return relevantItems;
  }

  private calculateRecency(timestamp: Date): number {
    const timeSince = Date.now() - timestamp.getTime();
    return Math.max(0.1, 1 - (timeSince / (1000 * 60 * 30))); // Decay over 30 minutes
  }

  updateUserIntent(intent: string): void {
    this.conversationContext.userIntent = intent;
    this.addContextItem('insight', `User intent: ${intent}`, ['intent', 'user-behavior']);
  }

  addPendingAction(action: string): void {
    this.conversationContext.pendingActions.push(action);
    this.addContextItem('command', `Pending: ${action}`, ['pending', 'action']);
  }

  completePendingAction(action: string): void {
    const index = this.conversationContext.pendingActions.indexOf(action);
    if (index > -1) {
      this.conversationContext.pendingActions.splice(index, 1);
      this.addContextItem('command', `Completed: ${action}`, ['completed', 'action']);
    }
  }

  updateProjectState(key: string, value: any): void {
    this.conversationContext.projectState[key] = value;
    this.addContextItem('insight', `Project state updated: ${key} = ${JSON.stringify(value)}`, ['project-state']);
  }

  getConversationSummary(): string {
    const sessionDuration = Date.now() - this.sessionStartTime.getTime();
    const minutes = Math.floor(sessionDuration / (1000 * 60));
    
    const itemCounts = this.contextWindow.items.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    let summary = `**Conversation Summary**\n\n`;
    summary += `• Session duration: ${minutes} minutes\n`;
    summary += `• Total context items: ${this.contextWindow.items.length}\n`;
    summary += `• Current focus: ${this.contextWindow.currentFocus.join(', ')}\n`;
    summary += `• Pending actions: ${this.conversationContext.pendingActions.length}\n\n`;
    
    summary += `**Context Breakdown:**\n`;
    for (const [type, count] of Object.entries(itemCounts)) {
      summary += `• ${type}: ${count} items\n`;
    }
    
    if (this.conversationContext.userIntent) {
      summary += `\n**Current Intent:** ${this.conversationContext.userIntent}`;
    }
    
    return summary;
  }

  getContextForLLM(query: string): string {
    const relevantItems = this.getRelevantContext(query, 5);
    const currentFocus = this.contextWindow.currentFocus;
    const pendingActions = this.conversationContext.pendingActions;
    
    let context = `**Conversation Context:**\n\n`;
    
    if (relevantItems.length > 0) {
      context += `**Relevant Recent Items:**\n`;
      for (const item of relevantItems) {
        const timeAgo = this.getTimeAgo(item.timestamp);
        context += `• [${timeAgo}] ${item.type.toUpperCase()}: ${item.content}\n`;
      }
      context += `\n`;
    }
    
    if (currentFocus.length > 0) {
      context += `**Current Focus:** ${currentFocus.join(', ')}\n`;
    }
    
    if (pendingActions.length > 0) {
      context += `**Pending Actions:** ${pendingActions.join(', ')}\n`;
    }
    
    if (this.conversationContext.userIntent) {
      context += `**User Intent:** ${this.conversationContext.userIntent}\n`;
    }
    
    return context;
  }

  private getTimeAgo(timestamp: Date): string {
    const timeSince = Date.now() - timestamp.getTime();
    const minutes = Math.floor(timeSince / (1000 * 60));
    
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  clearContext(): void {
    this.contextWindow.items = [];
    this.conversationContext.messages = [];
    this.conversationContext.pendingActions = [];
    this.contextWindow.currentFocus = [];
    this.saveContext();
  }

  exportContext(): string {
    return JSON.stringify({
      contextWindow: this.contextWindow,
      conversationContext: this.conversationContext,
      exportTime: new Date().toISOString()
    }, null, 2);
  }

  getContextStats(): Record<string, any> {
    const itemCounts = this.contextWindow.items.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const avgRelevance = this.contextWindow.items.reduce((sum, item) => sum + item.relevance, 0) / this.contextWindow.items.length;
    
    return {
      totalItems: this.contextWindow.items.length,
      itemCounts,
      averageRelevance: avgRelevance,
      currentFocus: this.contextWindow.currentFocus,
      pendingActions: this.conversationContext.pendingActions.length,
      sessionDuration: Date.now() - this.sessionStartTime.getTime()
    };
  }
} 