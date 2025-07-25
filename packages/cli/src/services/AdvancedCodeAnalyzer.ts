import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { execSync } from 'child_process';

export interface CodeStructure {
  imports: ImportInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: InterfaceInfo[];
  types: TypeInfo[];
  variables: VariableInfo[];
  dependencies: DependencyInfo[];
  complexity: ComplexityMetrics;
  patterns: CodePattern[];
  suggestions: CodeSuggestion[];
}

export interface ImportInfo {
  path: string;
  type: 'default' | 'named' | 'namespace';
  items: string[];
  line: number;
  isExternal: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'default' | 'named' | 'type';
  line: number;
  isReexport: boolean;
}

export interface FunctionInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: string;
  line: number;
  complexity: number;
  documentation: string;
  isAsync: boolean;
  isGenerator: boolean;
  visibility: 'public' | 'private' | 'protected';
}

export interface ClassInfo {
  name: string;
  extends?: string;
  implements: string[];
  methods: MethodInfo[];
  properties: PropertyInfo[];
  line: number;
  documentation: string;
  isAbstract: boolean;
}

export interface InterfaceInfo {
  name: string;
  extends: string[];
  properties: PropertyInfo[];
  methods: MethodInfo[];
  line: number;
  documentation: string;
}

export interface TypeInfo {
  name: string;
  definition: string;
  line: number;
  isUnion: boolean;
  isIntersection: boolean;
}

export interface VariableInfo {
  name: string;
  type: string;
  value?: string;
  line: number;
  isConst: boolean;
  isLet: boolean;
  scope: 'global' | 'function' | 'block';
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer';
  isLocal: boolean;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
  halsteadMetrics: {
    volume: number;
    difficulty: number;
    effort: number;
  };
}

export interface CodePattern {
  type: 'design_pattern' | 'anti_pattern' | 'best_practice' | 'code_smell';
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  line: number;
  suggestion: string;
}

export interface CodeSuggestion {
  type: 'refactor' | 'optimize' | 'security' | 'performance' | 'readability';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  line: number;
  code: string;
  reasoning: string;
}

export interface ParameterInfo {
  name: string;
  type: string;
  defaultValue?: string;
  isOptional: boolean;
  isRest: boolean;
}

export interface MethodInfo extends FunctionInfo {
  isStatic: boolean;
  isGetter: boolean;
  isSetter: boolean;
  decorators: string[];
}

export interface PropertyInfo {
  name: string;
  type: string;
  defaultValue?: string;
  line: number;
  isStatic: boolean;
  isReadonly: boolean;
  decorators: string[];
}

export class AdvancedCodeAnalyzer {
  private astCache: Map<string, any> = new Map();
  private projectStructure: Map<string, CodeStructure> = new Map();

  async analyzeFile(filePath: string): Promise<CodeStructure> {
    const content = readFileSync(filePath, 'utf-8');
    const ext = extname(filePath);
    
    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
      return await this.analyzeTypeScriptFile(filePath, content);
    }
    
    return this.createEmptyStructure();
  }

  async analyzeProject(projectPath: string): Promise<Map<string, CodeStructure>> {
    const files = this.getAllCodeFiles(projectPath);
    
    for (const file of files) {
      try {
        const structure = await this.analyzeFile(file);
        this.projectStructure.set(file, structure);
      } catch (error) {
        console.warn(`Failed to analyze ${file}: ${error}`);
      }
    }
    
    return this.projectStructure;
  }

  async generateCodeInsights(filePath: string): Promise<{
    structure: CodeStructure;
    insights: string[];
    recommendations: CodeSuggestion[];
    patterns: CodePattern[];
  }> {
    const structure = await this.analyzeFile(filePath);
    const insights = this.generateInsights(structure);
    const recommendations = this.generateRecommendations(structure);
    const patterns = this.detectPatterns(structure);
    
    return {
      structure,
      insights,
      recommendations,
      patterns
    };
  }

  async suggestRefactoring(filePath: string): Promise<CodeSuggestion[]> {
    const structure = await this.analyzeFile(filePath);
    return this.generateRefactoringSuggestions(structure);
  }

  async analyzeDependencies(projectPath: string): Promise<{
    direct: DependencyInfo[];
    transitive: DependencyInfo[];
    conflicts: string[];
    vulnerabilities: string[];
    recommendations: string[];
  }> {
    const packageJsonPath = join(projectPath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      return { direct: [], transitive: [], conflicts: [], vulnerabilities: [], recommendations: [] };
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const direct = this.parseDependencies(packageJson);
    const conflicts = this.detectDependencyConflicts(direct);
    const vulnerabilities = await this.checkVulnerabilities(projectPath);
    const recommendations = this.generateDependencyRecommendations(direct);

    return {
      direct,
      transitive: [], // Would need npm ls to get transitive deps
      conflicts,
      vulnerabilities,
      recommendations
    };
  }

  private async analyzeTypeScriptFile(filePath: string, content: string): Promise<CodeStructure> {
    // This is a simplified version - in a real implementation, you'd use TypeScript compiler API
    const lines = content.split('\n');
    const structure = this.createEmptyStructure();
    
    // Parse imports
    structure.imports = this.parseImports(lines);
    
    // Parse exports
    structure.exports = this.parseExports(lines);
    
    // Parse functions
    structure.functions = this.parseFunctions(lines);
    
    // Parse classes
    structure.classes = this.parseClasses(lines);
    
    // Parse interfaces
    structure.interfaces = this.parseInterfaces(lines);
    
    // Parse types
    structure.types = this.parseTypes(lines);
    
    // Parse variables
    structure.variables = this.parseVariables(lines);
    
    // Calculate complexity
    structure.complexity = this.calculateComplexity(content);
    
    // Detect patterns
    structure.patterns = this.detectPatterns(structure);
    
    // Generate suggestions
    structure.suggestions = this.generateSuggestions(structure);
    
    return structure;
  }

  private parseImports(lines: string[]): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const importRegex = /import\s+(?:(?:\*\s+as\s+(\w+))|(?:(\w+)(?:\s*,\s*\{([^}]+)\})?)|(?:(\w+)\s+from\s+['"]([^'"]+)['"]))/g;
    
    lines.forEach((line, index) => {
      const match = importRegex.exec(line);
      if (match) {
        imports.push({
          path: match[5] || '',
          type: match[1] ? 'namespace' : match[2] ? 'named' : 'default',
          items: match[3] ? match[3].split(',').map(s => s.trim()) : [],
          line: index + 1,
          isExternal: !match[5]?.startsWith('.')
        });
      }
    });
    
    return imports;
  }

  private parseExports(lines: string[]): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const exportRegex = /export\s+(?:(?:default\s+)?(\w+)|(?:const|let|var|function|class)\s+(\w+))/g;
    
    lines.forEach((line, index) => {
      const match = exportRegex.exec(line);
      if (match) {
        exports.push({
          name: match[1] || match[2] || '',
          type: line.includes('default') ? 'default' : 'named',
          line: index + 1,
          isReexport: line.includes('from')
        });
      }
    });
    
    return exports;
  }

  private parseFunctions(lines: string[]): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const functionRegex = /(?:async\s+)?(?:function\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g;
    
    lines.forEach((line, index) => {
      const match = functionRegex.exec(line);
      if (match) {
        functions.push({
          name: match[1],
          parameters: this.parseParameters(match[2]),
          returnType: match[3]?.trim() || 'any',
          line: index + 1,
          complexity: this.calculateFunctionComplexity(lines, index),
          documentation: this.extractDocumentation(lines, index),
          isAsync: line.includes('async'),
          isGenerator: line.includes('*'),
          visibility: this.determineVisibility(line)
        });
      }
    });
    
    return functions;
  }

  private parseClasses(lines: string[]): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const classRegex = /(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{/g;
    
    lines.forEach((line, index) => {
      const match = classRegex.exec(line);
      if (match) {
        classes.push({
          name: match[1],
          extends: match[2],
          implements: match[3] ? match[3].split(',').map(s => s.trim()) : [],
          methods: this.parseMethods(lines, index),
          properties: this.parseProperties(lines, index),
          line: index + 1,
          documentation: this.extractDocumentation(lines, index),
          isAbstract: line.includes('abstract')
        });
      }
    });
    
    return classes;
  }

  private parseInterfaces(lines: string[]): InterfaceInfo[] {
    const interfaces: InterfaceInfo[] = [];
    const interfaceRegex = /interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*\{/g;
    
    lines.forEach((line, index) => {
      const match = interfaceRegex.exec(line);
      if (match) {
        interfaces.push({
          name: match[1],
          extends: match[2] ? match[2].split(',').map(s => s.trim()) : [],
          properties: this.parseInterfaceProperties(lines, index),
          methods: this.parseInterfaceMethods(lines, index),
          line: index + 1,
          documentation: this.extractDocumentation(lines, index)
        });
      }
    });
    
    return interfaces;
  }

  private parseTypes(lines: string[]): TypeInfo[] {
    const types: TypeInfo[] = [];
    const typeRegex = /type\s+(\w+)\s*=\s*([^;]+);/g;
    
    lines.forEach((line, index) => {
      const match = typeRegex.exec(line);
      if (match) {
        types.push({
          name: match[1],
          definition: match[2].trim(),
          line: index + 1,
          isUnion: match[2].includes('|'),
          isIntersection: match[2].includes('&')
        });
      }
    });
    
    return types;
  }

  private parseVariables(lines: string[]): VariableInfo[] {
    const variables: VariableInfo[] = [];
    const variableRegex = /(?:const|let|var)\s+(\w+)(?:\s*:\s*([^=]+))?\s*(?:=\s*([^;]+))?/g;
    
    lines.forEach((line, index) => {
      const match = variableRegex.exec(line);
      if (match) {
        variables.push({
          name: match[1],
          type: match[2]?.trim() || 'any',
          value: match[3]?.trim(),
          line: index + 1,
          isConst: line.includes('const'),
          isLet: line.includes('let'),
          scope: this.determineVariableScope(lines, index)
        });
      }
    });
    
    return variables;
  }

  private parseParameters(paramString: string): ParameterInfo[] {
    if (!paramString.trim()) return [];
    
    return paramString.split(',').map(param => {
      const trimmed = param.trim();
      const optional = trimmed.includes('?');
      const rest = trimmed.startsWith('...');
      const [name, type] = trimmed.replace('?', '').replace('...', '').split(':').map(s => s.trim());
      
      return {
        name: name || '',
        type: type || 'any',
        isOptional: optional,
        isRest: rest
      };
    });
  }

  private parseMethods(lines: string[], classStartLine: number): MethodInfo[] {
    const methods: MethodInfo[] = [];
    const methodRegex = /(?:static\s+)?(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g;
    
    // Find class end
    let braceCount = 0;
    let inClass = false;
    
    for (let i = classStartLine; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('{')) {
        if (!inClass) inClass = true;
        braceCount++;
      }
      if (line.includes('}')) {
        braceCount--;
        if (braceCount === 0 && inClass) break;
      }
      
      if (inClass) {
        const match = methodRegex.exec(line);
        if (match) {
          methods.push({
            name: match[1],
            parameters: this.parseParameters(match[2]),
            returnType: match[3]?.trim() || 'any',
            line: i + 1,
            complexity: this.calculateFunctionComplexity(lines, i),
            documentation: this.extractDocumentation(lines, i),
            isAsync: line.includes('async'),
            isGenerator: line.includes('*'),
            visibility: this.determineVisibility(line),
            isStatic: line.includes('static'),
            isGetter: line.includes('get '),
            isSetter: line.includes('set '),
            decorators: this.extractDecorators(line)
          });
        }
      }
    }
    
    return methods;
  }

  private parseProperties(lines: string[], classStartLine: number): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    const propertyRegex = /(?:static\s+)?(?:readonly\s+)?(\w+)(?:\s*:\s*([^=;]+))?\s*(?:=\s*([^;]+))?/g;
    
    // Similar logic to parseMethods for finding class boundaries
    let braceCount = 0;
    let inClass = false;
    
    for (let i = classStartLine; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('{')) {
        if (!inClass) inClass = true;
        braceCount++;
      }
      if (line.includes('}')) {
        braceCount--;
        if (braceCount === 0 && inClass) break;
      }
      
      if (inClass && !line.includes('(') && !line.includes('function')) {
        const match = propertyRegex.exec(line);
        if (match) {
          properties.push({
            name: match[1],
            type: match[2]?.trim() || 'any',
            defaultValue: match[3]?.trim(),
            line: i + 1,
            isStatic: line.includes('static'),
            isReadonly: line.includes('readonly'),
            decorators: this.extractDecorators(line)
          });
        }
      }
    }
    
    return properties;
  }

  private parseInterfaceProperties(lines: string[], interfaceStartLine: number): PropertyInfo[] {
    // Similar to parseProperties but for interfaces
    return [];
  }

  private parseInterfaceMethods(lines: string[], interfaceStartLine: number): MethodInfo[] {
    // Similar to parseMethods but for interfaces
    return [];
  }

  private calculateComplexity(content: string): ComplexityMetrics {
    const lines = content.split('\n');
    let cyclomaticComplexity = 1; // Base complexity
    
    // Count decision points
    const decisionPatterns = [
      /if\s*\(/g,
      /else\s*if\s*\(/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /switch\s*\(/g,
      /case\s+/g,
      /catch\s*\(/g,
      /\|\|/g,
      /&&/g
    ];
    
    decisionPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        cyclomaticComplexity += matches.length;
      }
    });
    
    return {
      cyclomaticComplexity,
      cognitiveComplexity: this.calculateCognitiveComplexity(content),
      maintainabilityIndex: this.calculateMaintainabilityIndex(content),
      halsteadMetrics: this.calculateHalsteadMetrics(content)
    };
  }

  private calculateFunctionComplexity(lines: string[], functionStartLine: number): number {
    // Simplified complexity calculation for a function
    let complexity = 1;
    let braceCount = 0;
    let inFunction = false;
    
    for (let i = functionStartLine; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('{')) {
        if (!inFunction) inFunction = true;
        braceCount++;
      }
      if (line.includes('}')) {
        braceCount--;
        if (braceCount === 0 && inFunction) break;
      }
      
      if (inFunction) {
        if (line.includes('if') || line.includes('for') || line.includes('while') || 
            line.includes('switch') || line.includes('case') || line.includes('catch')) {
          complexity++;
        }
      }
    }
    
    return complexity;
  }

  private calculateCognitiveComplexity(content: string): number {
    // Simplified cognitive complexity calculation
    let complexity = 0;
    const patterns = [
      /if\s*\(/g,
      /else\s*if\s*\(/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /switch\s*\(/g,
      /catch\s*\(/g,
      /\|\|/g,
      /&&/g
    ];
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  private calculateMaintainabilityIndex(content: string): number {
    // Simplified maintainability index calculation
    const lines = content.split('\n');
    const loc = lines.length;
    const complexity = this.calculateComplexity(content).cyclomaticComplexity;
    
    // Simplified formula: MI = 171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC)
    const halsteadVolume = this.calculateHalsteadMetrics(content).volume;
    const mi = 171 - 5.2 * Math.log(halsteadVolume) - 0.23 * complexity - 16.2 * Math.log(loc);
    
    return Math.max(0, Math.min(100, mi));
  }

  private calculateHalsteadMetrics(content: string): { volume: number; difficulty: number; effort: number } {
    // Simplified Halstead metrics calculation
    const words = content.split(/\s+/);
    const uniqueWords = new Set(words);
    
    const volume = words.length * Math.log2(uniqueWords.size);
    const difficulty = uniqueWords.size / 2; // Simplified
    const effort = volume * difficulty;
    
    return { volume, difficulty, effort };
  }

  private detectPatterns(structure: CodeStructure): CodePattern[] {
    const patterns: CodePattern[] = [];
    
    // Detect design patterns
    if (structure.classes.length > 0) {
      patterns.push({
        type: 'design_pattern',
        name: 'Class-based Architecture',
        description: 'Uses classes for object-oriented design',
        severity: 'low',
        line: 1,
        suggestion: 'Consider using functional programming patterns for better testability'
      });
    }
    
    // Detect anti-patterns
    if (structure.functions.some(f => f.complexity > 10)) {
      patterns.push({
        type: 'anti_pattern',
        name: 'Complex Function',
        description: 'Function has high cyclomatic complexity',
        severity: 'high',
        line: structure.functions.find(f => f.complexity > 10)?.line || 1,
        suggestion: 'Break down complex function into smaller, more manageable functions'
      });
    }
    
    // Detect code smells
    if (structure.variables.some(v => v.name.length > 20)) {
      patterns.push({
        type: 'code_smell',
        name: 'Long Variable Name',
        description: 'Variable name is excessively long',
        severity: 'medium',
        line: structure.variables.find(v => v.name.length > 20)?.line || 1,
        suggestion: 'Use shorter, more descriptive variable names'
      });
    }
    
    return patterns;
  }

  private generateSuggestions(structure: CodeStructure): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];
    
    // Performance suggestions
    if (structure.functions.some(f => f.isAsync)) {
      suggestions.push({
        type: 'performance',
        title: 'Optimize Async Functions',
        description: 'Consider using Promise.all for parallel async operations',
        priority: 'medium',
        line: 1,
        code: '// Example: Promise.all([async1(), async2()])',
        reasoning: 'Parallel execution can improve performance'
      });
    }
    
    // Security suggestions
    if (structure.functions.some(f => f.parameters.some(p => p.type === 'any'))) {
      suggestions.push({
        type: 'security',
        title: 'Type Safety',
        description: 'Avoid using "any" type for better type safety',
        priority: 'high',
        line: 1,
        code: '// Use specific types instead of any',
        reasoning: 'Type safety prevents runtime errors'
      });
    }
    
    // Readability suggestions
    if (structure.functions.some(f => f.complexity > 5)) {
      suggestions.push({
        type: 'readability',
        title: 'Simplify Complex Functions',
        description: 'Break down complex functions into smaller ones',
        priority: 'high',
        line: 1,
        code: '// Extract helper functions for better readability',
        reasoning: 'Smaller functions are easier to understand and test'
      });
    }
    
    return suggestions;
  }

  private generateRefactoringSuggestions(structure: CodeStructure): CodeSuggestion[] {
    const suggestions: CodeSuggestion[] = [];
    
    // Extract method suggestions
    structure.functions.forEach(func => {
      if (func.complexity > 8) {
        suggestions.push({
          type: 'refactor',
          title: `Extract Method: ${func.name}`,
          description: `Function ${func.name} is too complex and should be broken down`,
          priority: 'high',
          line: func.line,
          code: `// Extract helper methods from ${func.name}`,
          reasoning: `Complexity of ${func.complexity} exceeds recommended threshold of 8`
        });
      }
    });
    
    // Extract class suggestions
    if (structure.functions.length > 10) {
      suggestions.push({
        type: 'refactor',
        title: 'Extract Class',
        description: 'Consider extracting related functions into a class',
        priority: 'medium',
        line: 1,
        code: '// Group related functions into a class',
        reasoning: 'Large number of functions suggests need for better organization'
      });
    }
    
    return suggestions;
  }

  private generateInsights(structure: CodeStructure): string[] {
    const insights: string[] = [];
    
    insights.push(`File contains ${structure.functions.length} functions`);
    insights.push(`File contains ${structure.classes.length} classes`);
    insights.push(`File contains ${structure.interfaces.length} interfaces`);
    insights.push(`Average function complexity: ${this.calculateAverageComplexity(structure.functions)}`);
    insights.push(`Maintainability index: ${structure.complexity.maintainabilityIndex.toFixed(1)}`);
    
    if (structure.functions.some(f => f.isAsync)) {
      insights.push('Contains async functions - consider performance implications');
    }
    
    if (structure.patterns.length > 0) {
      insights.push(`Detected ${structure.patterns.length} code patterns`);
    }
    
    return insights;
  }

  private generateRecommendations(structure: CodeStructure): CodeSuggestion[] {
    return this.generateRefactoringSuggestions(structure);
  }

  private calculateAverageComplexity(functions: FunctionInfo[]): number {
    if (functions.length === 0) return 0;
    const total = functions.reduce((sum, func) => sum + func.complexity, 0);
    return total / functions.length;
  }

  private extractDocumentation(lines: string[], lineIndex: number): string {
    const doc: string[] = [];
    
    // Look for JSDoc comments above the line
    for (let i = lineIndex - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('*')) {
        doc.unshift(line.replace('*', '').trim());
      } else if (line.startsWith('/**')) {
        break;
      } else if (line.startsWith('//')) {
        doc.unshift(line.replace('//', '').trim());
      } else {
        break;
      }
    }
    
    return doc.join(' ');
  }

  private determineVisibility(line: string): 'public' | 'private' | 'protected' {
    if (line.includes('private')) return 'private';
    if (line.includes('protected')) return 'protected';
    return 'public';
  }

  private determineVariableScope(lines: string[], lineIndex: number): 'global' | 'function' | 'block' {
    // Simplified scope determination
    for (let i = lineIndex; i >= 0; i--) {
      const line = lines[i];
      if (line.includes('function') || line.includes('=>')) return 'function';
      if (line.includes('{') && !line.includes('}')) return 'block';
    }
    return 'global';
  }

  private extractDecorators(line: string): string[] {
    const decorators: string[] = [];
    const decoratorRegex = /@(\w+)/g;
    let match;
    
    while ((match = decoratorRegex.exec(line)) !== null) {
      decorators.push(match[1]);
    }
    
    return decorators;
  }

  private getAllCodeFiles(dir: string): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    
    const traverse = (currentDir: string) => {
      const items = readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = join(currentDir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          traverse(fullPath);
        } else if (stat.isFile() && extensions.includes(extname(item))) {
          files.push(fullPath);
        }
      }
    };
    
    traverse(dir);
    return files;
  }

  private parseDependencies(packageJson: any): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    
    if (packageJson.dependencies) {
      Object.entries(packageJson.dependencies).forEach(([name, version]) => {
        dependencies.push({
          name,
          version: version as string,
          type: 'production',
          isLocal: false
        });
      });
    }
    
    if (packageJson.devDependencies) {
      Object.entries(packageJson.devDependencies).forEach(([name, version]) => {
        dependencies.push({
          name,
          version: version as string,
          type: 'development',
          isLocal: false
        });
      });
    }
    
    return dependencies;
  }

  private detectDependencyConflicts(dependencies: DependencyInfo[]): string[] {
    const conflicts: string[] = [];
    const versions = new Map<string, string[]>();
    
    dependencies.forEach(dep => {
      if (!versions.has(dep.name)) {
        versions.set(dep.name, []);
      }
      versions.get(dep.name)!.push(dep.version);
    });
    
    versions.forEach((versions, name) => {
      if (versions.length > 1 && new Set(versions).size > 1) {
        conflicts.push(`${name}: ${versions.join(', ')}`);
      }
    });
    
    return conflicts;
  }

  private async checkVulnerabilities(projectPath: string): Promise<string[]> {
    // In a real implementation, this would run npm audit
    return [];
  }

  private generateDependencyRecommendations(dependencies: DependencyInfo[]): string[] {
    const recommendations: string[] = [];
    
    // Check for outdated packages
    dependencies.forEach(dep => {
      if (dep.version.includes('^') || dep.version.includes('~')) {
        recommendations.push(`Consider pinning ${dep.name} to a specific version for better reproducibility`);
      }
    });
    
    // Check for large number of dependencies
    if (dependencies.length > 50) {
      recommendations.push('Consider reducing the number of dependencies to improve build times and security');
    }
    
    return recommendations;
  }

  private createEmptyStructure(): CodeStructure {
    return {
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      interfaces: [],
      types: [],
      variables: [],
      dependencies: [],
      complexity: {
        cyclomaticComplexity: 1,
        cognitiveComplexity: 0,
        maintainabilityIndex: 100,
        halsteadMetrics: {
          volume: 0,
          difficulty: 0,
          effort: 0
        }
      },
      patterns: [],
      suggestions: []
    };
  }
} 