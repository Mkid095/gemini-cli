import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface LearningPattern {
  id: string;
  pattern: string;
  type: 'command' | 'file_operation' | 'error_resolution' | 'code_pattern' | 'workflow';
  frequency: number;
  successRate: number;
  context: PatternContext;
  lastUsed: Date;
  confidence: number;
  adaptations: PatternAdaptation[];
}

export interface PatternContext {
  projectType: string;
  language: string;
  framework?: string;
  fileTypes: string[];
  commonCommands: string[];
  errorPatterns: string[];
  userPreferences: UserPreferences;
}

export interface PatternAdaptation {
  originalPattern: string;
  adaptedPattern: string;
  successRate: number;
  context: string;
  timestamp: Date;
}

export interface UserBehavior {
  preferredCommands: string[];
  commonWorkflows: WorkflowPattern[];
  errorPatterns: ErrorPattern[];
  successPatterns: SuccessPattern[];
  timeOfDay: Map<string, number>;
  sessionDuration: number;
  projectTypes: string[];
  learningStyle: 'visual' | 'textual' | 'interactive';
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced';
  userPreferences: UserPreferences;
}

export interface WorkflowPattern {
  name: string;
  steps: WorkflowStep[];
  frequency: number;
  successRate: number;
  averageDuration: number;
  lastUsed: Date;
}

export interface WorkflowStep {
  action: string;
  command?: string;
  fileOperation?: string;
  expectedOutcome: string;
  actualOutcome?: string;
  duration: number;
}

export interface ErrorPattern {
  error: string;
  frequency: number;
  resolutions: ErrorResolution[];
  context: string;
  lastOccurrence: Date;
}

export interface ErrorResolution {
  solution: string;
  successRate: number;
  steps: string[];
  timeToResolve: number;
  lastUsed: Date;
}

export interface SuccessPattern {
  action: string;
  context: string;
  frequency: number;
  efficiency: number;
  lastUsed: Date;
}

export interface UserPreferences {
  responseStyle: 'concise' | 'detailed' | 'technical' | 'friendly';
  preferredLanguage: string;
  autoSave: boolean;
  showExplanations: boolean;
  learningMode: boolean;
  codeStyle: 'functional' | 'object_oriented' | 'procedural';
  testingPreference: 'tdd' | 'bdd' | 'manual';
  documentationStyle: 'minimal' | 'comprehensive' | 'examples';
}

export interface AdaptiveResponse {
  confidence: number;
  suggestedActions: string[];
  alternativeApproaches: string[];
  learningInsights: string[];
  personalizedRecommendations: string[];
  workflowSuggestions: WorkflowSuggestion[];
  errorPrevention: string[];
  efficiencyTips: string[];
}

export interface WorkflowSuggestion {
  name: string;
  description: string;
  steps: string[];
  estimatedTime: number;
  confidence: number;
  basedOn: string[];
}

export interface LearningMetrics {
  totalInteractions: number;
  successfulInteractions: number;
  learningProgress: number;
  patternRecognitionAccuracy: number;
  adaptationSuccessRate: number;
  userSatisfaction: number;
  timeToMastery: number;
}

export class AdvancedLearningSystem {
  private learningDataPath: string;
  private patterns: Map<string, LearningPattern> = new Map();
  private userBehavior: UserBehavior;
  private adaptationThreshold = 0.7;
  private learningRate = 0.1;
  private decayRate = 0.95;
  private maxPatterns = 1000;
  private sessionStartTime: Date = new Date();

  constructor(workingDirectory: string) {
    this.learningDataPath = join(workingDirectory, '.nextmavens', 'learning');
    this.userBehavior = this.initializeUserBehavior();
    this.ensureLearningDirectory();
    this.loadLearningData();
  }

  recordUserBehavior(
    action: string,
    projectType: string,
    sessionStart: Date,
    sessionEnd: Date
  ): void {
    // Update session duration
    this.userBehavior.sessionDuration = (sessionEnd.getTime() - sessionStart.getTime()) / 1000;
    
    // Update time of day patterns
    const hour = sessionEnd.getHours();
    const timeKey = `${hour}:00`;
    this.userBehavior.timeOfDay.set(timeKey, (this.userBehavior.timeOfDay.get(timeKey) || 0) + 1);
    
    // Update project types
    if (!this.userBehavior.projectTypes.includes(projectType)) {
      this.userBehavior.projectTypes.push(projectType);
    }
    
    // Record the action pattern
    this.recordPattern(action, projectType, true, this.userBehavior.sessionDuration);
    
    this.saveLearningData();
  }

  recordSuccess(action: string, context: string, duration: number): void {
    const successPattern: SuccessPattern = {
      action,
      context,
      frequency: 1,
      efficiency: 1.0 / duration,
      lastUsed: new Date()
    };
    
    this.userBehavior.successPatterns.push(successPattern);
    this.recordPattern(action, context, true, duration);
  }

  recordError(error: string, context: string, resolution?: string): void {
    const existingError = this.userBehavior.errorPatterns.find(e => e.error === error);
    
    if (existingError) {
      existingError.frequency++;
      existingError.lastOccurrence = new Date();
      
      if (resolution) {
        const existingResolution = existingError.resolutions.find(r => r.solution === resolution);
        if (existingResolution) {
          existingResolution.successRate = (existingResolution.successRate + 1) / 2;
          existingResolution.lastUsed = new Date();
        } else {
          existingError.resolutions.push({
            solution: resolution,
            successRate: 1.0,
            steps: [],
            timeToResolve: 0,
            lastUsed: new Date()
          });
        }
      }
    } else {
      const errorPattern: ErrorPattern = {
        error,
        frequency: 1,
        resolutions: resolution ? [{
          solution: resolution,
          successRate: 1.0,
          steps: [],
          timeToResolve: 0,
          lastUsed: new Date()
        }] : [],
        context,
        lastOccurrence: new Date()
      };
      
      this.userBehavior.errorPatterns.push(errorPattern);
    }
    
    this.recordPattern(error, context, false, 0);
  }

  recordWorkflow(workflow: WorkflowPattern): void {
    const existingWorkflow = this.userBehavior.commonWorkflows.find(w => w.name === workflow.name);
    
    if (existingWorkflow) {
      existingWorkflow.frequency++;
      existingWorkflow.lastUsed = new Date();
      existingWorkflow.successRate = (existingWorkflow.successRate + 1) / 2;
      existingWorkflow.averageDuration = (existingWorkflow.averageDuration + workflow.averageDuration) / 2;
    } else {
      this.userBehavior.commonWorkflows.push(workflow);
    }
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
    
    // Generate personalized recommendations
    const suggestedActions = this.generatePersonalizedActions(similarPatterns, availableTools, projectContext);
    const alternativeApproaches = this.generateAlternativeApproaches(similarPatterns, userMessage);
    const learningInsights = this.generateLearningInsights(similarPatterns, projectContext);
    const personalizedRecommendations = this.generatePersonalizedRecommendations(similarPatterns, projectContext);
    const workflowSuggestions = this.generateWorkflowSuggestions(similarPatterns, projectContext);
    const errorPrevention = this.generateErrorPrevention(similarPatterns, projectContext);
    const efficiencyTips = this.generateEfficiencyTips(similarPatterns, projectContext);
    
    // Record this interaction for learning
    this.recordPattern(
      userMessage,
      projectContext.type,
      confidence > this.adaptationThreshold,
      Date.now() - startTime
    );
    
    return {
      confidence,
      suggestedActions,
      alternativeApproaches,
      learningInsights,
      personalizedRecommendations,
      workflowSuggestions,
      errorPrevention,
      efficiencyTips
    };
  }

  adaptPattern(originalPattern: string, newContext: string, success: boolean): void {
    const pattern = this.patterns.get(originalPattern);
    if (!pattern) return;
    
    const adaptation: PatternAdaptation = {
      originalPattern,
      adaptedPattern: this.generateAdaptedPattern(originalPattern, newContext),
      successRate: success ? 1.0 : 0.0,
      context: newContext,
      timestamp: new Date()
    };
    
    pattern.adaptations.push(adaptation);
    pattern.confidence = this.recalculateConfidence(pattern);
    
    // Update learning rate based on success
    if (success) {
      this.learningRate = Math.min(0.2, this.learningRate + 0.01);
    } else {
      this.learningRate = Math.max(0.05, this.learningRate - 0.01);
    }
  }

  getLearningMetrics(): LearningMetrics {
    const totalInteractions = this.patterns.size;
    const successfulInteractions = Array.from(this.patterns.values())
      .filter(p => p.successRate > 0.5).length;
    
    const learningProgress = this.calculateLearningProgress();
    const patternRecognitionAccuracy = this.calculatePatternRecognitionAccuracy();
    const adaptationSuccessRate = this.calculateAdaptationSuccessRate();
    const userSatisfaction = this.calculateUserSatisfaction();
    const timeToMastery = this.calculateTimeToMastery();
    
    return {
      totalInteractions,
      successfulInteractions,
      learningProgress,
      patternRecognitionAccuracy,
      adaptationSuccessRate,
      userSatisfaction,
      timeToMastery
    };
  }

  updateUserPreferences(preferences: Partial<UserPreferences>): void {
    this.userBehavior.userPreferences = {
      ...this.userBehavior.userPreferences,
      ...preferences
    };
    this.saveLearningData();
  }

  getPersonalizedSuggestions(context: string): string[] {
    const suggestions: string[] = [];
    
    // Based on user preferences
    const prefs = this.userBehavior.userPreferences;
    if (prefs.responseStyle === 'detailed') {
      suggestions.push('Provide detailed explanations with examples');
    } else if (prefs.responseStyle === 'concise') {
      suggestions.push('Keep responses brief and to the point');
    }
    
    // Based on learning style
    if (this.userBehavior.learningStyle === 'visual') {
      suggestions.push('Include visual aids or diagrams when possible');
    } else if (this.userBehavior.learningStyle === 'interactive') {
      suggestions.push('Encourage interactive exploration and experimentation');
    }
    
    // Based on expertise level
    if (this.userBehavior.expertiseLevel === 'beginner') {
      suggestions.push('Provide step-by-step guidance and explanations');
    } else if (this.userBehavior.expertiseLevel === 'advanced') {
      suggestions.push('Focus on advanced techniques and optimizations');
    }
    
    // Based on common workflows
    this.userBehavior.commonWorkflows
      .filter(w => w.frequency > 3)
      .forEach(workflow => {
        suggestions.push(`Consider using the "${workflow.name}" workflow for similar tasks`);
      });
    
    return suggestions;
  }

  private findSimilarPatterns(userMessage: string): LearningPattern[] {
    const similarPatterns: Array<{ pattern: LearningPattern; similarity: number }> = [];
    
    this.patterns.forEach(pattern => {
      const similarity = this.calculateSimilarity(userMessage, pattern.pattern);
      if (similarity > 0.3) { // 30% similarity threshold
        similarPatterns.push({ pattern, similarity });
      }
    });
    
    return similarPatterns
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .map(item => item.pattern);
  }

  private calculateConfidence(patterns: LearningPattern[], userMessage: string): number {
    if (patterns.length === 0) return 0.1;
    
    const totalConfidence = patterns.reduce((sum, pattern) => {
      const similarity = this.calculateSimilarity(userMessage, pattern.pattern);
      return sum + (pattern.confidence * similarity);
    }, 0);
    
    return Math.min(1.0, totalConfidence / patterns.length);
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private generatePersonalizedActions(
    patterns: LearningPattern[],
    availableTools: string[],
    projectContext: any
  ): string[] {
    const actions: string[] = [];
    
    // Based on successful patterns
    patterns
      .filter(p => p.successRate > 0.7)
      .forEach(pattern => {
        actions.push(`Use successful pattern: ${pattern.pattern}`);
      });
    
    // Based on user preferences
    const prefs = this.userBehavior.userPreferences;
    if (prefs.codeStyle === 'functional') {
      actions.push('Prefer functional programming patterns');
    } else if (prefs.codeStyle === 'object_oriented') {
      actions.push('Use object-oriented design patterns');
    }
    
    // Based on available tools
    availableTools.forEach(tool => {
      if (this.userBehavior.preferredCommands.includes(tool)) {
        actions.push(`Use preferred tool: ${tool}`);
      }
    });
    
    return actions.slice(0, 5);
  }

  private generateAlternativeApproaches(patterns: LearningPattern[], userMessage: string): string[] {
    const approaches: string[] = [];
    
    patterns.forEach(pattern => {
      pattern.adaptations.forEach(adaptation => {
        if (adaptation.successRate > 0.5) {
          approaches.push(`Alternative: ${adaptation.adaptedPattern}`);
        }
      });
    });
    
    // Generate based on user behavior
    this.userBehavior.commonWorkflows
      .filter(w => w.successRate > 0.6)
      .forEach(workflow => {
        approaches.push(`Workflow approach: ${workflow.name}`);
      });
    
    return approaches.slice(0, 3);
  }

  private generateLearningInsights(patterns: LearningPattern[], projectContext: any): string[] {
    const insights: string[] = [];
    
    // Pattern frequency insights
    const frequentPatterns = patterns.filter(p => p.frequency > 5);
    if (frequentPatterns.length > 0) {
      insights.push(`You frequently use: ${frequentPatterns[0].pattern}`);
    }
    
    // Success rate insights
    const highSuccessPatterns = patterns.filter(p => p.successRate > 0.8);
    if (highSuccessPatterns.length > 0) {
      insights.push(`High success rate with: ${highSuccessPatterns[0].pattern}`);
    }
    
    // Project-specific insights
    if (projectContext.type) {
      insights.push(`Working with ${projectContext.type} project type`);
    }
    
    // Time-based insights
    const currentHour = new Date().getHours();
    const peakHour = Array.from(this.userBehavior.timeOfDay.entries())
      .sort((a, b) => b[1] - a[1])[0];
    if (peakHour && peakHour[0] !== `${currentHour}:00`) {
      insights.push(`Peak productivity time: ${peakHour[0]}`);
    }
    
    return insights;
  }

  private generatePersonalizedRecommendations(patterns: LearningPattern[], projectContext: any): string[] {
    const recommendations: string[] = [];
    
    // Based on error patterns
    this.userBehavior.errorPatterns
      .filter(e => e.frequency > 2)
      .forEach(error => {
        const bestResolution = error.resolutions
          .sort((a, b) => b.successRate - a.successRate)[0];
        if (bestResolution) {
          recommendations.push(`For "${error.error}", try: ${bestResolution.solution}`);
        }
      });
    
    // Based on success patterns
    this.userBehavior.successPatterns
      .filter(s => s.efficiency > 0.8)
      .forEach(success => {
        recommendations.push(`Efficient approach: ${success.action}`);
      });
    
    // Based on learning progress
    const metrics = this.getLearningMetrics();
    if (metrics.learningProgress < 0.5) {
      recommendations.push('Consider exploring new patterns to expand your toolkit');
    } else if (metrics.learningProgress > 0.8) {
      recommendations.push('You\'re making excellent progress! Try advanced techniques');
    }
    
    return recommendations.slice(0, 3);
  }

  private generateWorkflowSuggestions(patterns: LearningPattern[], projectContext: any): WorkflowSuggestion[] {
    const suggestions: WorkflowSuggestion[] = [];
    
    this.userBehavior.commonWorkflows
      .filter(w => w.successRate > 0.6)
      .forEach(workflow => {
        suggestions.push({
          name: workflow.name,
          description: `Proven workflow with ${(workflow.successRate * 100).toFixed(0)}% success rate`,
          steps: workflow.steps.map(s => s.action),
          estimatedTime: workflow.averageDuration,
          confidence: workflow.successRate,
          basedOn: [`${workflow.frequency} previous uses`]
        });
      });
    
    return suggestions.slice(0, 3);
  }

  private generateErrorPrevention(patterns: LearningPattern[], projectContext: any): string[] {
    const prevention: string[] = [];
    
    this.userBehavior.errorPatterns
      .filter(e => e.frequency > 1)
      .forEach(error => {
        prevention.push(`Watch out for: ${error.error}`);
      });
    
    // Based on project context
    if (projectContext.language === 'typescript') {
      prevention.push('Enable strict TypeScript checks to catch errors early');
    }
    
    return prevention.slice(0, 3);
  }

  private generateEfficiencyTips(patterns: LearningPattern[], projectContext: any): string[] {
    const tips: string[] = [];
    
    // Based on session duration
    if (this.userBehavior.sessionDuration > 3600) { // 1 hour
      tips.push('Consider taking breaks to maintain productivity');
    }
    
    // Based on preferred commands
    if (this.userBehavior.preferredCommands.length > 0) {
      tips.push(`Use shortcuts for: ${this.userBehavior.preferredCommands.slice(0, 3).join(', ')}`);
    }
    
    // Based on success patterns
    this.userBehavior.successPatterns
      .filter(s => s.efficiency > 0.9)
      .forEach(success => {
        tips.push(`Optimize: ${success.action} (high efficiency)`);
      });
    
    return tips.slice(0, 3);
  }

  private recordPattern(
    pattern: string,
    context: string,
    success: boolean,
    duration: number
  ): void {
    const existingPattern = this.patterns.get(pattern);
    
    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.successRate = (existingPattern.successRate + (success ? 1 : 0)) / 2;
      existingPattern.lastUsed = new Date();
      existingPattern.confidence = this.recalculateConfidence(existingPattern);
    } else {
      const newPattern: LearningPattern = {
        id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        pattern,
        type: this.classifyPatternType(pattern),
        frequency: 1,
        successRate: success ? 1.0 : 0.0,
        context: {
          projectType: context,
          language: 'unknown',
          fileTypes: [],
          commonCommands: [],
          errorPatterns: [],
          userPreferences: this.userBehavior.userPreferences
        },
        lastUsed: new Date(),
        confidence: 0.5,
        adaptations: []
      };
      
      this.patterns.set(pattern, newPattern);
    }
    
    // Maintain max patterns
    if (this.patterns.size > this.maxPatterns) {
      const oldestPattern = Array.from(this.patterns.entries())[0];
      this.patterns.delete(oldestPattern[0]);
    }
  }

  private classifyPatternType(pattern: string): LearningPattern['type'] {
    const lowerPattern = pattern.toLowerCase();
    
    if (lowerPattern.includes('git') || lowerPattern.includes('commit') || lowerPattern.includes('push')) {
      return 'command';
    } else if (lowerPattern.includes('read') || lowerPattern.includes('write') || lowerPattern.includes('file')) {
      return 'file_operation';
    } else if (lowerPattern.includes('error') || lowerPattern.includes('fix') || lowerPattern.includes('resolve')) {
      return 'error_resolution';
    } else if (lowerPattern.includes('function') || lowerPattern.includes('class') || lowerPattern.includes('import')) {
      return 'code_pattern';
    } else {
      return 'workflow';
    }
  }

  private generateAdaptedPattern(originalPattern: string, newContext: string): string {
    // Simple adaptation - in a real implementation, this would be more sophisticated
    return `${originalPattern} (adapted for ${newContext})`;
  }

  private recalculateConfidence(pattern: LearningPattern): number {
    const frequencyWeight = Math.min(1.0, pattern.frequency / 10);
    const successWeight = pattern.successRate;
    const recencyWeight = this.calculateRecencyWeight(pattern.lastUsed);
    
    return (frequencyWeight * 0.3 + successWeight * 0.4 + recencyWeight * 0.3);
  }

  private calculateRecencyWeight(lastUsed: Date): number {
    const daysSince = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0.1, Math.pow(this.decayRate, daysSince));
  }

  private calculateLearningProgress(): number {
    const totalPatterns = this.patterns.size;
    const successfulPatterns = Array.from(this.patterns.values())
      .filter(p => p.successRate > 0.7).length;
    
    return totalPatterns > 0 ? successfulPatterns / totalPatterns : 0;
  }

  private calculatePatternRecognitionAccuracy(): number {
    // Simplified calculation - in reality, this would be based on actual recognition accuracy
    return 0.8;
  }

  private calculateAdaptationSuccessRate(): number {
    const allAdaptations = Array.from(this.patterns.values())
      .flatMap(p => p.adaptations);
    
    if (allAdaptations.length === 0) return 0;
    
    const successfulAdaptations = allAdaptations.filter(a => a.successRate > 0.5).length;
    return successfulAdaptations / allAdaptations.length;
  }

  private calculateUserSatisfaction(): number {
    // Simplified calculation based on success patterns and error patterns
    const totalInteractions = this.userBehavior.successPatterns.length + this.userBehavior.errorPatterns.length;
    if (totalInteractions === 0) return 0.5;
    
    const successWeight = this.userBehavior.successPatterns.length / totalInteractions;
    const errorWeight = 1 - (this.userBehavior.errorPatterns.length / totalInteractions);
    
    return (successWeight + errorWeight) / 2;
  }

  private calculateTimeToMastery(): number {
    // Simplified calculation - time from first pattern to high confidence
    const highConfidencePatterns = Array.from(this.patterns.values())
      .filter(p => p.confidence > 0.8);
    
    if (highConfidencePatterns.length === 0) return 0;
    
    const firstPattern = highConfidencePatterns
      .sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime())[0];
    
    return (firstPattern.lastUsed.getTime() - this.sessionStartTime.getTime()) / (1000 * 60 * 60); // hours
  }

  private initializeUserBehavior(): UserBehavior {
    return {
      preferredCommands: [],
      commonWorkflows: [],
      errorPatterns: [],
      successPatterns: [],
      timeOfDay: new Map(),
      sessionDuration: 0,
      projectTypes: [],
      learningStyle: 'interactive',
      expertiseLevel: 'intermediate',
      userPreferences: {
        responseStyle: 'detailed',
        preferredLanguage: 'en',
        autoSave: true,
        showExplanations: true,
        learningMode: true,
        codeStyle: 'functional',
        testingPreference: 'tdd',
        documentationStyle: 'comprehensive'
      }
    };
  }

  private ensureLearningDirectory(): void {
    if (!existsSync(this.learningDataPath)) {
      mkdirSync(this.learningDataPath, { recursive: true });
    }
  }

  private loadLearningData(): void {
    try {
      const patternsFile = join(this.learningDataPath, 'patterns.json');
      if (existsSync(patternsFile)) {
        const patternsData = JSON.parse(readFileSync(patternsFile, 'utf-8'));
        this.patterns = new Map(Object.entries(patternsData).map(([id, pattern]: [string, any]) => [
          id,
          { ...pattern, lastUsed: new Date(pattern.lastUsed) }
        ]));
      }
      
      const behaviorFile = join(this.learningDataPath, 'behavior.json');
      if (existsSync(behaviorFile)) {
        const behaviorData = JSON.parse(readFileSync(behaviorFile, 'utf-8'));
        this.userBehavior = {
          ...this.userBehavior,
          ...behaviorData,
          timeOfDay: new Map(behaviorData.timeOfDay || [])
        };
      }
    } catch (error) {
      console.warn('Failed to load learning data:', error);
    }
  }

  private saveLearningData(): void {
    try {
      const patternsFile = join(this.learningDataPath, 'patterns.json');
      const patternsData = Object.fromEntries(this.patterns);
      writeFileSync(patternsFile, JSON.stringify(patternsData, null, 2));
      
      const behaviorFile = join(this.learningDataPath, 'behavior.json');
      const behaviorData = {
        ...this.userBehavior,
        timeOfDay: Array.from(this.userBehavior.timeOfDay.entries())
      };
      writeFileSync(behaviorFile, JSON.stringify(behaviorData, null, 2));
    } catch (error) {
      console.warn('Failed to save learning data:', error);
    }
  }
} 