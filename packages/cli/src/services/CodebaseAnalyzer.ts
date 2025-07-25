import fs from 'fs';
import path from 'path';
import { LSTool } from '@nextmavens/cli-core';

export interface FileInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  isCodeFile?: boolean;
}

export interface ProjectStructure {
  root: string;
  files: FileInfo[];
  codeFiles: FileInfo[];
  directories: FileInfo[];
  packageJson?: any;
  tsConfig?: any;
  readme?: string;
  gitignore?: string[];
}

export class CodebaseAnalyzer {
  private lsTool: LSTool;

  constructor() {
    this.lsTool = new LSTool();
  }

  async analyzeCodebase(workingDirectory: string): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      root: workingDirectory,
      files: [],
      codeFiles: [],
      directories: [],
    };

    try {
      // Get root directory listing using LSTool
      const rootResult = await this.lsTool.execute(
        { path: workingDirectory },
        new AbortController().signal
      );

      // Parse the JSON response from LSTool
      if (rootResult.llmContent) {
        try {
          const fileEntries = JSON.parse(rootResult.llmContent.toString());
          
          for (const entry of fileEntries) {
            const fileInfo: FileInfo = {
              path: entry.path,
              name: entry.name,
              type: entry.isDirectory ? 'directory' : 'file',
              size: entry.size,
              extension: path.extname(entry.name),
              isCodeFile: this.isCodeFile(entry.name, path.extname(entry.name))
            };

            structure.files.push(fileInfo);
            
            if (fileInfo.type === 'directory') {
              structure.directories.push(fileInfo);
            } else if (fileInfo.isCodeFile) {
              structure.codeFiles.push(fileInfo);
            }
          }
        } catch (parseError) {
          console.error('Error parsing LSTool response:', parseError);
          // Fallback to direct file system reading
          await this.fallbackAnalyzeCodebase(workingDirectory, structure);
        }
      } else {
        // Fallback to direct file system reading
        await this.fallbackAnalyzeCodebase(workingDirectory, structure);
      }

      // Load important configuration files
      await this.loadConfigFiles(structure);

      return structure;
    } catch (error) {
      console.error('Error analyzing codebase:', error);
      // Fallback to direct file system reading
      await this.fallbackAnalyzeCodebase(workingDirectory, structure);
      await this.loadConfigFiles(structure);
      return structure;
    }
  }

  private async fallbackAnalyzeCodebase(workingDirectory: string, structure: ProjectStructure): Promise<void> {
    try {
      const entries = fs.readdirSync(workingDirectory);
      
      for (const entry of entries) {
        const entryPath = path.join(workingDirectory, entry);
        const stats = fs.statSync(entryPath);
        
        const fileInfo: FileInfo = {
          path: entryPath,
          name: entry,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          extension: path.extname(entry),
          isCodeFile: this.isCodeFile(entry, path.extname(entry))
        };

        structure.files.push(fileInfo);
        
        if (fileInfo.type === 'directory') {
          structure.directories.push(fileInfo);
        } else if (fileInfo.isCodeFile) {
          structure.codeFiles.push(fileInfo);
        }
      }
    } catch (error) {
      console.error('Error in fallback codebase analysis:', error);
    }
  }

  private isCodeFile(name: string, extension: string): boolean {
    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
      '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.clj',
      '.hs', '.ml', '.fs', '.v', '.agda', '.coq', '.lean', '.m', '.r', '.jl',
      '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd', '.sql',
      '.html', '.htm', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
      '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
      '.md', '.txt', '.rst', '.tex', '.latex'
    ];

    return codeExtensions.includes(extension.toLowerCase()) || 
           name.includes('Dockerfile') || 
           name.includes('Makefile') ||
           name.includes('.gitignore') ||
           name.includes('package.json') ||
           name.includes('tsconfig.json');
  }

  private async loadConfigFiles(structure: ProjectStructure): Promise<void> {
    const configFiles = [
      'package.json',
      'tsconfig.json',
      'README.md',
      '.gitignore'
    ];

    for (const configFile of configFiles) {
      const filePath = path.join(structure.root, configFile);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          
          switch (configFile) {
            case 'package.json':
              structure.packageJson = JSON.parse(content);
              break;
            case 'tsconfig.json':
              structure.tsConfig = JSON.parse(content);
              break;
            case 'README.md':
              structure.readme = content;
              break;
            case '.gitignore':
              structure.gitignore = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
              break;
          }
        } catch (error) {
          console.error(`Error loading ${configFile}:`, error);
        }
      }
    }
  }

  async getFileContent(filePath: string): Promise<string | null> {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
      }
      return null;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return null;
    }
  }

  async findFiles(pattern: string, workingDirectory: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    
    try {
      const result = await this.lsTool.execute(
        { path: workingDirectory },
        new AbortController().signal
      );

      if (result.llmContent) {
        try {
          const fileEntries = JSON.parse(result.llmContent.toString());
          
          for (const entry of fileEntries) {
            if (entry.name.toLowerCase().includes(pattern.toLowerCase())) {
              const fileInfo: FileInfo = {
                path: entry.path,
                name: entry.name,
                type: entry.isDirectory ? 'directory' : 'file',
                size: entry.size,
                extension: path.extname(entry.name),
                isCodeFile: this.isCodeFile(entry.name, path.extname(entry.name))
              };
              files.push(fileInfo);
            }
          }
        } catch (parseError) {
          console.error('Error parsing LSTool response in findFiles:', parseError);
          // Fallback to direct file system reading
          await this.fallbackFindFiles(pattern, workingDirectory, files);
        }
      } else {
        // Fallback to direct file system reading
        await this.fallbackFindFiles(pattern, workingDirectory, files);
      }
    } catch (error) {
      console.error('Error finding files:', error);
      // Fallback to direct file system reading
      await this.fallbackFindFiles(pattern, workingDirectory, files);
    }

    return files;
  }

  private async fallbackFindFiles(pattern: string, workingDirectory: string, files: FileInfo[]): Promise<void> {
    try {
      const entries = fs.readdirSync(workingDirectory);
      
      for (const entry of entries) {
        if (entry.toLowerCase().includes(pattern.toLowerCase())) {
          const entryPath = path.join(workingDirectory, entry);
          const stats = fs.statSync(entryPath);
          
          const fileInfo: FileInfo = {
            path: entryPath,
            name: entry,
            type: stats.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            extension: path.extname(entry),
            isCodeFile: this.isCodeFile(entry, path.extname(entry))
          };
          files.push(fileInfo);
        }
      }
    } catch (error) {
      console.error('Error in fallback findFiles:', error);
    }
  }

  getProjectType(structure: ProjectStructure): string {
    if (structure.packageJson) {
      return 'Node.js/JavaScript/TypeScript';
    }
    
    // Check for other project types
    const hasPythonFiles = structure.codeFiles.some(f => f.extension === '.py');
    if (hasPythonFiles) return 'Python';
    
    const hasJavaFiles = structure.codeFiles.some(f => f.extension === '.java');
    if (hasJavaFiles) return 'Java';
    
    const hasCppFiles = structure.codeFiles.some(f => ['.cpp', '.c', '.h', '.hpp'].includes(f.extension || ''));
    if (hasCppFiles) return 'C/C++';
    
    return 'Unknown';
  }

  getMainLanguage(structure: ProjectStructure): string {
    const extensions = structure.codeFiles.map(f => f.extension).filter(Boolean);
    const extensionCounts: Record<string, number> = {};
    
    for (const ext of extensions) {
      if (ext) {
        extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
      }
    }
    
    const sorted = Object.entries(extensionCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : 'unknown';
  }
} 