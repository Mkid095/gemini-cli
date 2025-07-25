import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';

export interface CodeGenerationRequest {
  type: 'component' | 'function' | 'class' | 'interface' | 'test' | 'documentation' | 'refactor';
  language: 'typescript' | 'javascript' | 'react' | 'node' | 'python' | 'java' | 'vue' | 'angular';
  description: string;
  context: {
    projectType: string;
    existingCode?: string;
    dependencies: string[];
    patterns: string[];
    style: 'functional' | 'object_oriented' | 'procedural';
  };
  preferences: {
    naming: 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case';
    indentation: 2 | 4;
    quotes: 'single' | 'double';
    semicolons: boolean;
    trailingComma: boolean;
  };
}

export interface CodeGenerationResult {
  code: string;
  explanation: string;
  suggestions: string[];
  tests?: string;
  documentation?: string;
  refactoring?: RefactoringSuggestion[];
}

export interface RefactoringSuggestion {
  type: 'extract_method' | 'extract_class' | 'rename' | 'simplify' | 'optimize';
  description: string;
  before: string;
  after: string;
  reasoning: string;
  confidence: number;
}

export interface CodeTemplate {
  name: string;
  description: string;
  template: string;
  placeholders: string[];
  examples: string[];
}

export class CodeGenerationEngine {
  private templates: Map<string, CodeTemplate> = new Map();
  private patterns: Map<string, string> = new Map();
  private styleGuides: Map<string, any> = new Map();

  constructor() {
    this.initializeTemplates();
    this.initializePatterns();
    this.initializeStyleGuides();
  }

  async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResult> {
    const template = this.selectTemplate(request);
    const generatedCode = await this.applyTemplate(template, request);
    const explanation = this.generateExplanation(request, generatedCode);
    const suggestions = this.generateSuggestions(request, generatedCode);
    const tests = await this.generateTests(request, generatedCode);
    const documentation = await this.generateDocumentation(request, generatedCode);
    const refactoring = this.analyzeForRefactoring(generatedCode, request);

    return {
      code: generatedCode,
      explanation,
      suggestions,
      tests,
      documentation,
      refactoring
    };
  }

  async refactorCode(
    code: string,
    language: string,
    refactoringType: RefactoringSuggestion['type']
  ): Promise<RefactoringSuggestion[]> {
    const suggestions: RefactoringSuggestion[] = [];

    switch (refactoringType) {
      case 'extract_method':
        suggestions.push(...this.suggestMethodExtraction(code, language));
        break;
      case 'extract_class':
        suggestions.push(...this.suggestClassExtraction(code, language));
        break;
      case 'rename':
        suggestions.push(...this.suggestRenaming(code, language));
        break;
      case 'simplify':
        suggestions.push(...this.suggestSimplification(code, language));
        break;
      case 'optimize':
        suggestions.push(...this.suggestOptimization(code, language));
        break;
    }

    return suggestions;
  }

  async generateComponent(
    name: string,
    props: string[],
    language: 'react' | 'vue' | 'angular',
    style: 'functional' | 'class'
  ): Promise<CodeGenerationResult> {
    const request: CodeGenerationRequest = {
      type: 'component',
      language,
      description: `Generate a ${style} ${language} component named ${name} with props: ${props.join(', ')}`,
      context: {
        projectType: 'frontend',
        dependencies: [language],
        patterns: ['component'],
        style: 'functional'
      },
      preferences: {
        naming: 'PascalCase',
        indentation: 2,
        quotes: 'single',
        semicolons: true,
        trailingComma: true
      }
    };

    return this.generateCode(request);
  }

  async generateFunction(
    name: string,
    parameters: string[],
    returnType: string,
    language: 'typescript' | 'javascript' | 'python'
  ): Promise<CodeGenerationResult> {
    const request: CodeGenerationRequest = {
      type: 'function',
      language,
      description: `Generate a function named ${name} with parameters: ${parameters.join(', ')} returning ${returnType}`,
      context: {
        projectType: 'general',
        dependencies: [],
        patterns: ['function'],
        style: 'functional'
      },
      preferences: {
        naming: 'camelCase',
        indentation: 2,
        quotes: 'single',
        semicolons: true,
        trailingComma: true
      }
    };

    return this.generateCode(request);
  }

  async generateTest(
    targetCode: string,
    testFramework: 'jest' | 'mocha' | 'vitest' | 'pytest',
    language: 'typescript' | 'javascript' | 'python'
  ): Promise<CodeGenerationResult> {
    const request: CodeGenerationRequest = {
      type: 'test',
      language,
      description: `Generate ${testFramework} tests for the provided code`,
      context: {
        projectType: 'testing',
        existingCode: targetCode,
        dependencies: [testFramework],
        patterns: ['test'],
        style: 'functional'
      },
      preferences: {
        naming: 'camelCase',
        indentation: 2,
        quotes: 'single',
        semicolons: true,
        trailingComma: true
      }
    };

    return this.generateCode(request);
  }

  private selectTemplate(request: CodeGenerationRequest): CodeTemplate {
    const templateKey = `${request.type}_${request.language}`;
    const template = this.templates.get(templateKey);
    
    if (!template) {
      // Fallback to generic template
      return this.templates.get('generic') || this.createGenericTemplate();
    }
    
    return template;
  }

  private async applyTemplate(template: CodeTemplate, request: CodeGenerationRequest): Promise<string> {
    let code = template.template;
    
    // Replace placeholders
    template.placeholders.forEach(placeholder => {
      const value = this.resolvePlaceholder(placeholder, request);
      code = code.replace(new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g'), value);
    });
    
    // Apply style guide
    code = this.applyStyleGuide(code, request.preferences);
    
    // Apply patterns
    code = this.applyPatterns(code, request.context.patterns);
    
    return code;
  }

  private resolvePlaceholder(placeholder: string, request: CodeGenerationRequest): string {
    switch (placeholder) {
      case 'COMPONENT_NAME':
        return this.extractNameFromDescription(request.description);
      case 'PROPS':
        return this.extractPropsFromDescription(request.description);
      case 'FUNCTION_NAME':
        return this.extractNameFromDescription(request.description);
      case 'PARAMETERS':
        return this.extractParametersFromDescription(request.description);
      case 'RETURN_TYPE':
        return this.extractReturnTypeFromDescription(request.description);
      case 'LANGUAGE':
        return request.language;
      case 'STYLE':
        return request.context.style;
      default:
        return placeholder;
    }
  }

  private extractNameFromDescription(description: string): string {
    const nameMatch = description.match(/(?:named|called)\s+(\w+)/i);
    return nameMatch ? nameMatch[1] : 'Component';
  }

  private extractPropsFromDescription(description: string): string {
    const propsMatch = description.match(/props:\s*([^,]+(?:,\s*[^,]+)*)/i);
    if (!propsMatch) return '';
    
    return propsMatch[1].split(',').map(prop => {
      const cleanProp = prop.trim();
      return `  ${cleanProp}: ${this.inferTypeFromName(cleanProp)};`;
    }).join('\n');
  }

  private extractParametersFromDescription(description: string): string {
    const paramsMatch = description.match(/parameters:\s*([^,]+(?:,\s*[^,]+)*)/i);
    if (!paramsMatch) return '';
    
    return paramsMatch[1].split(',').map(param => {
      const cleanParam = param.trim();
      return `${cleanParam}: ${this.inferTypeFromName(cleanParam)}`;
    }).join(', ');
  }

  private extractReturnTypeFromDescription(description: string): string {
    const returnMatch = description.match(/returning\s+(\w+)/i);
    return returnMatch ? returnMatch[1] : 'void';
  }

  private inferTypeFromName(name: string): string {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('id')) return 'string | number';
    if (lowerName.includes('count') || lowerName.includes('number')) return 'number';
    if (lowerName.includes('is') || lowerName.includes('has') || lowerName.includes('can')) return 'boolean';
    if (lowerName.includes('list') || lowerName.includes('array')) return 'any[]';
    if (lowerName.includes('obj') || lowerName.includes('data')) return 'object';
    if (lowerName.includes('func') || lowerName.includes('callback')) return 'Function';
    
    return 'any';
  }

  private applyStyleGuide(code: string, preferences: CodeGenerationRequest['preferences']): string {
    // Apply indentation
    const indent = ' '.repeat(preferences.indentation);
    code = code.replace(/\t/g, indent);
    
    // Apply quotes
    if (preferences.quotes === 'single') {
      code = code.replace(/"/g, "'");
    } else {
      code = code.replace(/'/g, '"');
    }
    
    // Apply semicolons
    if (!preferences.semicolons) {
      code = code.replace(/;/g, '');
    }
    
    // Apply trailing commas
    if (preferences.trailingComma) {
      code = code.replace(/(\w+):\s*(\w+)(\s*})/g, '$1: $2,$3');
    }
    
    return code;
  }

  private applyPatterns(code: string, patterns: string[]): string {
    patterns.forEach(pattern => {
      const patternCode = this.patterns.get(pattern);
      if (patternCode) {
        code = code.replace(/\/\/\s*PATTERN_PLACEHOLDER/, patternCode);
      }
    });
    
    return code;
  }

  private generateExplanation(request: CodeGenerationRequest, code: string): string {
    return `Generated ${request.type} in ${request.language} based on your requirements. The code follows ${request.context.style} programming style and includes proper type annotations.`;
  }

  private generateSuggestions(request: CodeGenerationRequest, code: string): string[] {
    const suggestions: string[] = [];
    
    suggestions.push('Consider adding error handling for edge cases');
    suggestions.push('Add input validation for better robustness');
    suggestions.push('Include JSDoc comments for better documentation');
    
    if (request.type === 'component') {
      suggestions.push('Consider adding PropTypes or TypeScript interfaces for props validation');
      suggestions.push('Add loading and error states for better UX');
    }
    
    if (request.type === 'function') {
      suggestions.push('Consider adding unit tests for the function');
      suggestions.push('Add parameter validation');
    }
    
    return suggestions;
  }

  private async generateTests(request: CodeGenerationRequest, code: string): Promise<string | undefined> {
    if (request.type === 'test') return undefined;
    
    const testRequest: CodeGenerationRequest = {
      ...request,
      type: 'test',
      description: `Generate tests for the ${request.type}`,
      context: {
        ...request.context,
        existingCode: code
      }
    };
    
    const testResult = await this.generateCode(testRequest);
    return testResult.code;
  }

  private async generateDocumentation(request: CodeGenerationRequest, code: string): Promise<string | undefined> {
    const docRequest: CodeGenerationRequest = {
      ...request,
      type: 'documentation',
      description: `Generate documentation for the ${request.type}`,
      context: {
        ...request.context,
        existingCode: code
      }
    };
    
    const docResult = await this.generateCode(docRequest);
    return docResult.code;
  }

  private analyzeForRefactoring(code: string, request: CodeGenerationRequest): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    
    // Analyze code complexity
    const lines = code.split('\n');
    const functions = lines.filter(line => line.includes('function') || line.includes('=>'));
    
    if (functions.length > 3) {
      suggestions.push({
        type: 'extract_class',
        description: 'Multiple functions detected - consider extracting into a class',
        before: code.substring(0, 200) + '...',
        after: '// Extracted class structure would go here',
        reasoning: 'Grouping related functions into a class improves organization and maintainability',
        confidence: 0.7
      });
    }
    
    // Analyze long functions
    const longFunctions = functions.filter(func => {
      const startIndex = lines.indexOf(func);
      const endIndex = lines.findIndex((line, index) => index > startIndex && line.includes('}'));
      return endIndex - startIndex > 20;
    });
    
    if (longFunctions.length > 0) {
      suggestions.push({
        type: 'extract_method',
        description: 'Long functions detected - consider breaking them down',
        before: longFunctions[0],
        after: '// Extracted methods would go here',
        reasoning: 'Shorter functions are easier to understand, test, and maintain',
        confidence: 0.8
      });
    }
    
    return suggestions;
  }

  private suggestMethodExtraction(code: string, language: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    
    // Simple heuristic for method extraction
    const lines = code.split('\n');
    let currentFunction = '';
    let functionStart = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('function') || line.includes('=>')) {
        if (currentFunction) {
          // Check if previous function was too long
          if (i - functionStart > 25) {
            suggestions.push({
              type: 'extract_method',
              description: `Extract methods from long function starting at line ${functionStart + 1}`,
              before: currentFunction.substring(0, 100) + '...',
              after: '// Extracted helper methods would go here',
              reasoning: 'Function is too long and should be broken down into smaller, focused methods',
              confidence: 0.8
            });
          }
        }
        
        currentFunction = line;
        functionStart = i;
      }
    }
    
    return suggestions;
  }

  private suggestClassExtraction(code: string, language: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    
    const lines = code.split('\n');
    const functions = lines.filter(line => line.includes('function'));
    
    if (functions.length > 3) {
      suggestions.push({
        type: 'extract_class',
        description: 'Extract related functions into a class',
        before: functions.slice(0, 2).join('\n') + '...',
        after: 'class ExtractedClass {\n  // Methods would go here\n}',
        reasoning: 'Multiple related functions suggest a need for better organization through classes',
        confidence: 0.7
      });
    }
    
    return suggestions;
  }

  private suggestRenaming(code: string, language: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    
    // Look for generic variable names
    const genericNames = ['data', 'item', 'obj', 'temp', 'x', 'y', 'z'];
    const lines = code.split('\n');
    
    genericNames.forEach(name => {
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      if (regex.test(code)) {
        suggestions.push({
          type: 'rename',
          description: `Rename generic variable '${name}' to something more descriptive`,
          before: `const ${name} = ...`,
          after: `const descriptiveName = ...`,
          reasoning: 'Descriptive variable names improve code readability and maintainability',
          confidence: 0.9
        });
      }
    });
    
    return suggestions;
  }

  private suggestSimplification(code: string, language: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    
    // Look for complex conditional expressions
    const complexConditionals = code.match(/if\s*\([^)]{50,}\)/g);
    if (complexConditionals) {
      suggestions.push({
        type: 'simplify',
        description: 'Simplify complex conditional expressions',
        before: complexConditionals[0],
        after: '// Extract complex condition into a well-named function',
        reasoning: 'Complex conditions are hard to read and understand',
        confidence: 0.8
      });
    }
    
    // Look for nested loops
    const nestedLoops = code.match(/for[^{]*\{[^}]*for[^{]*\{/g);
    if (nestedLoops) {
      suggestions.push({
        type: 'simplify',
        description: 'Simplify nested loops',
        before: '// Nested loops detected',
        after: '// Consider using array methods like map, filter, reduce',
        reasoning: 'Nested loops can often be simplified using functional programming methods',
        confidence: 0.7
      });
    }
    
    return suggestions;
  }

  private suggestOptimization(code: string, language: string): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];
    
    // Look for inefficient patterns
    if (code.includes('.forEach') && code.includes('push')) {
      suggestions.push({
        type: 'optimize',
        description: 'Replace forEach + push with map',
        before: 'array.forEach(item => result.push(transform(item)))',
        after: 'const result = array.map(item => transform(item))',
        reasoning: 'map is more functional and often more efficient than forEach + push',
        confidence: 0.8
      });
    }
    
    // Look for multiple array iterations
    const arrayMethods = code.match(/\.(map|filter|reduce|forEach)/g);
    if (arrayMethods && arrayMethods.length > 2) {
      suggestions.push({
        type: 'optimize',
        description: 'Combine multiple array operations',
        before: 'array.map().filter().map()',
        after: 'array.reduce() // Single pass through array',
        reasoning: 'Multiple array iterations can be combined into a single pass for better performance',
        confidence: 0.7
      });
    }
    
    return suggestions;
  }

  private initializeTemplates(): void {
    // React Component Template
    this.templates.set('component_react', {
      name: 'React Component',
      description: 'Functional React component with TypeScript',
      template: `import React from 'react';

interface {{COMPONENT_NAME}}Props {
{{PROPS}}
}

export const {{COMPONENT_NAME}}: React.FC<{{COMPONENT_NAME}}Props> = (props) => {
  return (
    <div>
      <h1>{{COMPONENT_NAME}}</h1>
      {/* Component content goes here */}
    </div>
  );
};

export default {{COMPONENT_NAME}};`,
      placeholders: ['COMPONENT_NAME', 'PROPS'],
      examples: ['Button', 'Card', 'Modal']
    });

    // TypeScript Function Template
    this.templates.set('function_typescript', {
      name: 'TypeScript Function',
      description: 'TypeScript function with proper typing',
      template: `/**
 * {{FUNCTION_NAME}} - {{DESCRIPTION}}
 * @param {{PARAMETERS}}
 * @returns {{RETURN_TYPE}}
 */
export const {{FUNCTION_NAME}} = ({{PARAMETERS}}): {{RETURN_TYPE}} => {
  // Function implementation goes here
  return result;
};`,
      placeholders: ['FUNCTION_NAME', 'PARAMETERS', 'RETURN_TYPE', 'DESCRIPTION'],
      examples: ['calculateTotal', 'formatDate', 'validateInput']
    });

    // Generic Template
    this.templates.set('generic', {
      name: 'Generic Template',
      description: 'Generic code template',
      template: `// {{DESCRIPTION}}
// Generated for {{LANGUAGE}} using {{STYLE}} style

{{CODE_PLACEHOLDER}}`,
      placeholders: ['DESCRIPTION', 'LANGUAGE', 'STYLE', 'CODE_PLACEHOLDER'],
      examples: ['Basic structure', 'Boilerplate code']
    });
  }

  private initializePatterns(): void {
    this.patterns.set('component', `
// Component pattern
const Component = ({ prop1, prop2 }) => {
  const [state, setState] = useState(initialValue);
  
  useEffect(() => {
    // Side effects
  }, []);
  
  return (
    <div>
      {/* JSX content */}
    </div>
  );
};`);

    this.patterns.set('function', `
// Function pattern
const functionName = (param1: Type1, param2: Type2): ReturnType => {
  // Function body
  return result;
};`);

    this.patterns.set('test', `
// Test pattern
describe('Component/Function Name', () => {
  it('should behave correctly', () => {
    // Test implementation
    expect(result).toBe(expected);
  });
});`);
  }

  private initializeStyleGuides(): void {
    this.styleGuides.set('typescript', {
      naming: 'camelCase',
      indentation: 2,
      quotes: 'single',
      semicolons: true,
      trailingComma: true
    });

    this.styleGuides.set('javascript', {
      naming: 'camelCase',
      indentation: 2,
      quotes: 'single',
      semicolons: true,
      trailingComma: true
    });

    this.styleGuides.set('python', {
      naming: 'snake_case',
      indentation: 4,
      quotes: 'single',
      semicolons: false,
      trailingComma: false
    });
  }

  private createGenericTemplate(): CodeTemplate {
    return {
      name: 'Generic Template',
      description: 'Fallback template for unsupported types',
      template: `// Generated code for {{LANGUAGE}}
// {{DESCRIPTION}}

// Implementation goes here`,
      placeholders: ['LANGUAGE', 'DESCRIPTION'],
      examples: ['Basic structure']
    };
  }
} 