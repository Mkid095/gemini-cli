import { ShellCommandExecutor, CommandResult } from './ShellCommandExecutor.js';
import fs from 'fs';
import path from 'path';

export interface CodeQualityMetrics {
  complexity: number;
  maintainability: number;
  reliability: number;
  security: number;
  testCoverage: number;
  documentation: number;
}

export interface CodeIssue {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  rule: string;
  category: string;
}

export interface DependencyAnalysis {
  outdated: string[];
  vulnerable: string[];
  unused: string[];
  circular: string[];
  size: number;
  depth: number;
}

export interface PerformanceMetrics {
  bundleSize: number;
  loadTime: number;
  memoryUsage: number;
  cpuUsage: number;
  bottlenecks: string[];
}

export class CodeQualityAnalyzer {
  private shellExecutor: ShellCommandExecutor;

  constructor(workingDirectory: string) {
    this.shellExecutor = new ShellCommandExecutor(workingDirectory);
  }

  async analyzeCodeQuality(): Promise<{ metrics: CodeQualityMetrics; issues: CodeIssue[] }> {
    const metrics: CodeQualityMetrics = {
      complexity: 0,
      maintainability: 0,
      reliability: 0,
      security: 0,
      testCoverage: 0,
      documentation: 0
    };

    const issues: CodeIssue[] = [];

    // Analyze TypeScript/JavaScript files
    await this.analyzeTypeScriptFiles(metrics, issues);
    
    // Analyze dependencies
    await this.analyzeDependencies(metrics, issues);
    
    // Analyze test coverage
    await this.analyzeTestCoverage(metrics, issues);
    
    // Analyze documentation
    await this.analyzeDocumentation(metrics, issues);

    return { metrics, issues };
  }

  private async analyzeTypeScriptFiles(metrics: CodeQualityMetrics, issues: CodeIssue[]): Promise<void> {
    // Run ESLint if available
    const eslintResult = await this.shellExecutor.executeCommand('npx eslint . --format=json --ext .ts,.tsx,.js,.jsx 2>/dev/null || echo "[]"');
    
    if (eslintResult.success && eslintResult.stdout !== '[]') {
      try {
        const eslintOutput = JSON.parse(eslintResult.stdout);
        for (const file of eslintOutput) {
          for (const message of file.messages) {
            issues.push({
              file: file.filePath,
              line: message.line,
              column: message.column,
              severity: message.severity === 2 ? 'error' : 'warning',
              message: message.message,
              rule: message.ruleId,
              category: this.categorizeIssue(message.ruleId)
            });
          }
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Run TypeScript compiler for type checking
    const tscResult = await this.shellExecutor.executeCommand('npx tsc --noEmit --pretty false 2>&1 || echo ""');
    
    if (tscResult.stdout.includes('error')) {
      const lines = tscResult.stdout.split('\n');
      for (const line of lines) {
        const match = line.match(/(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(.+)/);
        if (match) {
          issues.push({
            file: match[1].trim(),
            line: parseInt(match[2]),
            column: parseInt(match[3]),
            severity: match[4] as 'error' | 'warning',
            message: match[5].trim(),
            rule: 'typescript',
            category: 'type-checking'
          });
        }
      }
    }

    // Calculate complexity metrics
    await this.calculateComplexityMetrics(metrics, issues);
  }

  private async analyzeDependencies(metrics: CodeQualityMetrics, issues: CodeIssue[]): Promise<void> {
    // Check for outdated packages
    const outdatedResult = await this.shellExecutor.executeCommand('npm outdated --json 2>/dev/null || echo "{}"');
    
    if (outdatedResult.success && outdatedResult.stdout !== '{}') {
      try {
        const outdated = JSON.parse(outdatedResult.stdout);
        for (const [packageName, info] of Object.entries(outdated)) {
          issues.push({
            file: 'package.json',
            line: 1,
            column: 1,
            severity: 'warning',
            message: `Package ${packageName} is outdated. Current: ${(info as any).current}, Latest: ${(info as any).latest}`,
            rule: 'outdated-dependency',
            category: 'dependencies'
          });
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Check for security vulnerabilities
    const auditResult = await this.shellExecutor.executeCommand('npm audit --json 2>/dev/null || echo "{}"');
    
    if (auditResult.success && auditResult.stdout !== '{}') {
      try {
        const audit = JSON.parse(auditResult.stdout);
        if (audit.vulnerabilities) {
          for (const [packageName, vuln] of Object.entries(audit.vulnerabilities)) {
            const vulnerability = vuln as any;
            issues.push({
              file: 'package.json',
              line: 1,
              column: 1,
              severity: 'error',
              message: `Security vulnerability in ${packageName}: ${vulnerability.title}`,
              rule: 'security-vulnerability',
              category: 'security'
            });
          }
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Check for unused dependencies
    await this.checkUnusedDependencies(issues);
  }

  private async analyzeTestCoverage(metrics: CodeQualityMetrics, issues: CodeIssue[]): Promise<void> {
    // Run tests with coverage if available
    const coverageResult = await this.shellExecutor.executeCommand('npm test -- --coverage --watchAll=false 2>/dev/null || echo ""');
    
    if (coverageResult.success && coverageResult.stdout.includes('Coverage')) {
      const coverageMatch = coverageResult.stdout.match(/All files\s+\|\s+(\d+)/);
      if (coverageMatch) {
        metrics.testCoverage = parseInt(coverageMatch[1]);
        
        if (metrics.testCoverage < 80) {
          issues.push({
            file: 'test-coverage',
            line: 1,
            column: 1,
            severity: 'warning',
            message: `Test coverage is ${metrics.testCoverage}%, below recommended 80%`,
            rule: 'low-coverage',
            category: 'testing'
          });
        }
      }
    }
  }

  private async analyzeDocumentation(metrics: CodeQualityMetrics, issues: CodeIssue[]): Promise<void> {
    const files = await this.getCodeFiles();
    let documentedFiles = 0;
    let totalFiles = 0;

    for (const file of files) {
      if (this.isCodeFile(file)) {
        totalFiles++;
        const content = fs.readFileSync(file, 'utf-8');
        
        // Check for JSDoc comments
        if (content.includes('/**') || content.includes('/*') || content.includes('//')) {
          documentedFiles++;
        } else {
          issues.push({
            file,
            line: 1,
            column: 1,
            severity: 'info',
            message: 'File lacks documentation comments',
            rule: 'missing-documentation',
            category: 'documentation'
          });
        }
      }
    }

    metrics.documentation = totalFiles > 0 ? (documentedFiles / totalFiles) * 100 : 0;
  }

  private async calculateComplexityMetrics(metrics: CodeQualityMetrics, issues: CodeIssue[]): Promise<void> {
    const files = await this.getCodeFiles();
    let totalComplexity = 0;
    let totalFiles = 0;

    for (const file of files) {
      if (this.isCodeFile(file)) {
        totalFiles++;
        const content = fs.readFileSync(file, 'utf-8');
        const complexity = this.calculateCyclomaticComplexity(content);
        totalComplexity += complexity;

        if (complexity > 10) {
          issues.push({
            file,
            line: 1,
            column: 1,
            severity: 'warning',
            message: `High cyclomatic complexity: ${complexity}`,
            rule: 'high-complexity',
            category: 'complexity'
          });
        }
      }
    }

    metrics.complexity = totalFiles > 0 ? totalComplexity / totalFiles : 0;
    metrics.maintainability = Math.max(0, 100 - metrics.complexity * 5);
  }

  private calculateCyclomaticComplexity(content: string): number {
    const complexityKeywords = [
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'catch', '&&', '||', '?', ':', 'for...of', 'for...in'
    ];
    
    let complexity = 1; // Base complexity
    
    for (const keyword of complexityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  private async checkUnusedDependencies(issues: CodeIssue[]): Promise<void> {
    // This would require a more sophisticated analysis
    // For now, we'll check for obvious unused dependencies
    const packageJsonPath = path.join(this.shellExecutor['workingDirectory'], 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        for (const [depName] of Object.entries(dependencies)) {
          // Simple check - look for import statements
          const files = await this.getCodeFiles();
          let found = false;
          
          for (const file of files) {
            if (this.isCodeFile(file)) {
              const content = fs.readFileSync(file, 'utf-8');
              if (content.includes(`from '${depName}'`) || content.includes(`require('${depName}')`)) {
                found = true;
                break;
              }
            }
          }
          
          if (!found) {
            issues.push({
              file: 'package.json',
              line: 1,
              column: 1,
              severity: 'warning',
              message: `Potentially unused dependency: ${depName}`,
              rule: 'unused-dependency',
              category: 'dependencies'
            });
          }
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }
  }

  private async getCodeFiles(): Promise<string[]> {
    const result = await this.shellExecutor.executeCommand('find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" 2>/dev/null || echo ""');
    
    if (result.success) {
      return result.stdout.split('\n').filter(line => line.trim() && !line.includes('node_modules'));
    }
    
    return [];
  }

  private isCodeFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
  }

  private categorizeIssue(ruleId: string): string {
    if (ruleId.includes('security') || ruleId.includes('vulnerability')) return 'security';
    if (ruleId.includes('complexity') || ruleId.includes('cognitive')) return 'complexity';
    if (ruleId.includes('style') || ruleId.includes('format')) return 'style';
    if (ruleId.includes('unused') || ruleId.includes('no-unused')) return 'unused';
    if (ruleId.includes('import') || ruleId.includes('export')) return 'imports';
    return 'general';
  }

  async generateReport(): Promise<string> {
    const { metrics, issues } = await this.analyzeCodeQuality();
    
    let report = `**Code Quality Report**\n\n`;
    
    // Metrics summary
    report += `**Metrics:**\n`;
    report += `• Complexity: ${metrics.complexity.toFixed(1)}\n`;
    report += `• Maintainability: ${metrics.maintainability.toFixed(1)}%\n`;
    report += `• Test Coverage: ${metrics.testCoverage}%\n`;
    report += `• Documentation: ${metrics.documentation.toFixed(1)}%\n\n`;
    
    // Issues summary
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;
    
    report += `**Issues Found:**\n`;
    report += `• Errors: ${errorCount}\n`;
    report += `• Warnings: ${warningCount}\n`;
    report += `• Info: ${infoCount}\n\n`;
    
    // Top issues
    if (issues.length > 0) {
      report += `**Top Issues:**\n`;
      const topIssues = issues.slice(0, 5);
      for (const issue of topIssues) {
        report += `• ${issue.severity.toUpperCase()}: ${issue.message} (${issue.file}:${issue.line})\n`;
      }
    }
    
    return report;
  }
} 