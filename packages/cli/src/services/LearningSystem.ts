import fs from 'fs';
import path from 'path';

export interface LearningPattern {
  pattern: string;
  successRate: number;
  averageResponseTime: number;
  userSatisfaction: number;
  usageCount: number;
  lastUsed: Date;
  context: string[];
}

export interface UserBehavior {
  preferredCommands: string[];
  commonWorkflows: string[];
  errorPatterns: string[];
  successPatterns: string[];
  timeOfDay: Map<number, number>; // hour -> frequency
  sessionDuration: number;
  projectTypes: string[];
}

export interface AdaptiveResponse {
  confidence: number;
  suggestedActions: string[];
  alternativeApproaches: string[];
  learningInsights: string[];
}

export class LearningSystem {
  private patterns: Map<string, LearningPattern> = new Map();
  private userBehavior: UserBehavior;
  private learningDataPath: string;
  private adaptationThreshold = 0.7;

  constructor(workingDirectory: string) {
    this.learningDataPath = path.join(workingDirectory, '.nextmavens', 'learning');
    this.userBehavior = {
      preferredCommands: [],
      commonWorkflows: [],
      errorPatterns: [],
      successPatterns: [],
      timeOfDay: new Map(),
      sessionDuration: 0,
      projectTypes: []
    };
    this.ensureLearningDirectory();
    this.loadLearningData();
  }

  private ensureLearningDirectory(): void {
    const dir = path.dirname(this.learningDataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadLearningData(): void {
    try {
      const patternsFile = path.join(this.learningDataPath, 'patterns.json');
      const behaviorFile = path.join(this.learningDataPath, 'behavior.json');
      
      if (fs.existsSync(patternsFile)) {
        const patternsData = JSON.parse(fs.readFileSync(patternsFile, 'utf-8'));
        this.patterns = new Map(Object.entries(patternsData));
      }
      
      if (fs.existsSync(behaviorFile)) {
        this.userBehavior = JSON.parse(fs.readFileSync(behaviorFile, 'utf-8'));
      }
    } catch (error) {
      console.log('Learning data not found, starting fresh');
    }
  }

  private saveLearningData(): void {
    try {
      const patternsData = Object.fromEntries(this.patterns);
      fs.writeFileSync(
        path.join(this.learningDataPath, 'patterns.json'),
        JSON.stringify(patternsData, null, 2)
      );
      
      fs.writeFileSync(
        path.join(this.learningDataPath, 'behavior.json'),
        JSON.stringify(this.userBehavior, null, 2)
      );
    } catch (error) {
      console.log('Failed to save learning data:', error);
    }
  }

  recordPattern(
    pattern: string,
    success: boolean,
    responseTime: number,
    context: string[],
    userFeedback?: number
  ): void {
    const existing = this.patterns.get(pattern);
    const satisfaction = userFeedback || (success ? 0.8 : 0.3);
    
    if (existing) {
      existing.usageCount++;
      existing.successRate = (existing.successRate * (existing.usageCount - 1) + (success ? 1 : 0)) / existing.usageCount;
      existing.averageResponseTime = (existing.averageResponseTime * (existing.usageCount - 1) + responseTime) / existing.usageCount;
      existing.userSatisfaction = (existing.userSatisfaction * (existing.usageCount - 1) + satisfaction) / existing.usageCount;
      existing.lastUsed = new Date();
      existing.context = [...new Set([...existing.context, ...context])];
    } else {
      this.patterns.set(pattern, {
        pattern,
        successRate: success ? 1 : 0,
        averageResponseTime: responseTime,
        userSatisfaction: satisfaction,
        usageCount: 1,
        lastUsed: new Date(),
        context
      });
    }
    
    this.saveLearningData();
  }

  recordUserBehavior(
    command: string,
    projectType: string,
    sessionStart: Date,
    sessionEnd: Date
  ): void {
    // Record preferred commands
    if (!this.userBehavior.preferredCommands.includes(command)) {
      this.userBehavior.preferredCommands.push(command);
    }
    
    // Record project types
    if (!this.userBehavior.projectTypes.includes(projectType)) {
      this.userBehavior.projectTypes.push(projectType);
    }
    
    // Record time of day
    const hour = sessionStart.getHours();
    const currentFreq = this.userBehavior.timeOfDay.get(hour) || 0;
    this.userBehavior.timeOfDay.set(hour, currentFreq + 1);
    
    // Record session duration
    const duration = sessionEnd.getTime() - sessionStart.getTime();
    this.userBehavior.sessionDuration = (this.userBehavior.sessionDuration + duration) / 2;
    
    this.saveLearningData();
  }

  getAdaptiveResponse(
    userMessage: string,
    projectContext: any,
    availableTools: string[]
  ): AdaptiveResponse {
    const startTime = Date.now();
    
    // Find similar patterns
    const similarPatterns = this.findSimilarPatterns(userMessage);
    const confidence = this.calculateConfidence(similarPatterns, userMessage);
    
    // Generate suggestions based on learning
    const suggestedActions = this.generateSuggestions(similarPatterns, availableTools);
    const alternativeApproaches = this.generateAlternatives(similarPatterns, userMessage);
    const learningInsights = this.generateInsights(similarPatterns, projectContext);
    
    // Record this interaction for learning
    this.recordPattern(
      userMessage,
      confidence > this.adaptationThreshold,
      Date.now() - startTime,
      [projectContext.type, projectContext.language],
      confidence
    );
    
    return {
      confidence,
      suggestedActions,
      alternativeApproaches,
      learningInsights
    };
  }

  private findSimilarPatterns(userMessage: string): LearningPattern[] {
    const patterns = Array.from(this.patterns.values());
    const similar: { pattern: LearningPattern; similarity: number }[] = [];
    
    for (const pattern of patterns) {
      const similarity = this.calculateSimilarity(userMessage, pattern.pattern);
      if (similarity > 0.3) { // Threshold for similarity
        similar.push({ pattern, similarity });
      }
    }
    
    return similar
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map(item => item.pattern);
  }

  private calculateSimilarity(message1: string, message2: string): number {
    const words1 = new Set(message1.toLowerCase().split(/\s+/));
    const words2 = new Set(message2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private calculateConfidence(patterns: LearningPattern[], userMessage: string): number {
    if (patterns.length === 0) return 0.5;
    
    const weightedConfidence = patterns.reduce((sum, pattern) => {
      const recency = this.calculateRecency(pattern.lastUsed);
      const relevance = this.calculateSimilarity(userMessage, pattern.pattern);
      return sum + (pattern.successRate * pattern.userSatisfaction * recency * relevance);
    }, 0);
    
    return Math.min(weightedConfidence / patterns.length, 1.0);
  }

  private calculateRecency(lastUsed: Date): number {
    const daysSince = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0.1, 1 - (daysSince / 30)); // Decay over 30 days
  }

  private generateSuggestions(patterns: LearningPattern[], availableTools: string[]): string[] {
    const suggestions: string[] = [];
    
    // Based on successful patterns
    const successfulPatterns = patterns.filter(p => p.successRate > 0.7);
    for (const pattern of successfulPatterns.slice(0, 3)) {
      suggestions.push(`Based on similar successful requests: ${pattern.pattern}`);
    }
    
    // Based on user preferences
    if (this.userBehavior.preferredCommands.length > 0) {
      suggestions.push(`You often use: ${this.userBehavior.preferredCommands.slice(0, 3).join(', ')}`);
    }
    
    // Based on project type
    if (this.userBehavior.projectTypes.length > 0) {
      suggestions.push(`For ${this.userBehavior.projectTypes[0]} projects, consider: analyze code quality, run tests`);
    }
    
    return suggestions;
  }

  private generateAlternatives(patterns: LearningPattern[], userMessage: string): string[] {
    const alternatives: string[] = [];
    
    // Find patterns that were successful but different
    const differentSuccessful = patterns.filter(p => 
      p.successRate > 0.6 && 
      this.calculateSimilarity(userMessage, p.pattern) < 0.7
    );
    
    for (const pattern of differentSuccessful.slice(0, 2)) {
      alternatives.push(`Alternative approach: ${pattern.pattern}`);
    }
    
    return alternatives;
  }

  private generateInsights(patterns: LearningPattern[], projectContext: any): string[] {
    const insights: string[] = [];
    
    // Performance insights
    const avgResponseTime = patterns.reduce((sum, p) => sum + p.averageResponseTime, 0) / patterns.length;
    if (avgResponseTime > 5000) {
      insights.push('Consider optimizing your workflow - responses are taking longer than usual');
    }
    
    // Success rate insights
    const avgSuccessRate = patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length;
    if (avgSuccessRate < 0.6) {
      insights.push('You might want to be more specific in your requests for better results');
    }
    
    // Context insights
    const commonContexts = patterns.flatMap(p => p.context);
    const contextFreq = commonContexts.reduce((acc, context) => {
      acc[context] = (acc[context] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const mostCommonContext = Object.entries(contextFreq)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (mostCommonContext) {
      insights.push(`You work most often with ${mostCommonContext[0]} projects`);
    }
    
    return insights;
  }

  getPersonalizedRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Time-based recommendations
    const currentHour = new Date().getHours();
    const peakHours = Array.from(this.userBehavior.timeOfDay.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => hour);
    
    if (peakHours.includes(currentHour)) {
      recommendations.push('This is your most productive time - consider tackling complex tasks');
    }
    
    // Workflow recommendations
    if (this.userBehavior.commonWorkflows.length > 0) {
      recommendations.push(`Consider automating: ${this.userBehavior.commonWorkflows[0]}`);
    }
    
    // Error prevention
    if (this.userBehavior.errorPatterns.length > 0) {
      recommendations.push(`Common issue: ${this.userBehavior.errorPatterns[0]} - try being more specific`);
    }
    
    return recommendations;
  }

  exportLearningReport(): string {
    const totalPatterns = this.patterns.size;
    const avgSuccessRate = Array.from(this.patterns.values())
      .reduce((sum, p) => sum + p.successRate, 0) / totalPatterns;
    
    const mostUsedPatterns = Array.from(this.patterns.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);
    
    let report = `**Learning Report**\n\n`;
    report += `• Total patterns learned: ${totalPatterns}\n`;
    report += `• Average success rate: ${(avgSuccessRate * 100).toFixed(1)}%\n`;
    report += `• Most used commands: ${this.userBehavior.preferredCommands.slice(0, 3).join(', ')}\n`;
    report += `• Project types: ${this.userBehavior.projectTypes.join(', ')}\n\n`;
    
    report += `**Top Patterns:**\n`;
    for (const pattern of mostUsedPatterns) {
      report += `• "${pattern.pattern}" (${pattern.usageCount} uses, ${(pattern.successRate * 100).toFixed(1)}% success)\n`;
    }
    
    return report;
  }
} 