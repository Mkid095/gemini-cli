/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { BaseTool, Icon, ToolResult } from './tools.js';
import { Type } from '@google/genai';
import { makeRelative, shortenPath } from '../utils/paths.js';
import { isWithinRoot } from '../utils/fileUtils.js';

/**
 * Parameters for the LS tool
 */
export interface LSToolParams {
  /**
   * The absolute path to the directory to list
   */
  path: string;

  /**
   * Array of glob patterns to ignore (optional)
   */
  ignore?: string[];

  /**
   * Whether to respect .gitignore and .geminiignore patterns (optional, defaults to true)
   */
  file_filtering_options?: {
    respect_git_ignore?: boolean;
    respect_gemini_ignore?: boolean;
  };
}

/**
 * File entry returned by LS tool
 */
export interface FileEntry {
  /**
   * Name of the file or directory
   */
  name: string;

  /**
   * Absolute path to the file or directory
   */
  path: string;

  /**
   * Whether this entry is a directory
   */
  isDirectory: boolean;

  /**
   * Size of the file in bytes (0 for directories)
   */
  size: number;

  /**
   * Last modified timestamp
   */
  modifiedTime: Date;
}

/**
 * Implementation of the LS tool logic
 */
export class LSTool extends BaseTool<LSToolParams, ToolResult> {
  static readonly Name = 'list_directory';

  constructor() {
    super(
      LSTool.Name,
      'ReadFolder',
      'Lists the names of files and subdirectories directly within a specified directory path. Can optionally ignore entries matching provided glob patterns.',
      Icon.Folder,
      {
        properties: {
          path: {
            description:
              'The absolute path to the directory to list (must be absolute, not relative)',
            type: Type.STRING,
          },
          ignore: {
            description: 'List of glob patterns to ignore',
            items: {
              type: Type.STRING,
            },
            type: Type.ARRAY,
          },
          file_filtering_options: {
            description:
              'Optional: Whether to respect ignore patterns from .gitignore or .geminiignore',
            type: Type.OBJECT,
            properties: {
              respect_git_ignore: {
                description: 'Whether to respect .gitignore patterns',
                type: Type.BOOLEAN,
              },
              respect_gemini_ignore: {
                description: 'Whether to respect .geminiignore patterns',
                type: Type.BOOLEAN,
              },
            },
          },
        },
        required: ['path'],
        type: Type.OBJECT,
      },
    );
  }

  validateToolParams(params: LSToolParams): string | null {
    if (!params.path) {
      return 'Path is required';
    }

    if (!path.isAbsolute(params.path)) {
      return 'Path must be absolute';
    }

    return null;
  }

  private shouldIgnore(filename: string, patterns?: string[]): boolean {
    if (!patterns || patterns.length === 0) {
      return false;
    }

    // Simple pattern matching - can be enhanced later
    return patterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(filename);
      }
      return filename === pattern;
    });
  }

  getDescription(params: LSToolParams): string {
    return `List directory contents of ${shortenPath(params.path)}`;
  }

  private errorResult(llmContent: string, returnDisplay: string): ToolResult {
    return {
      llmContent,
      returnDisplay,
    };
  }

  async execute(
    params: LSToolParams,
    _signal: AbortSignal,
  ): Promise<ToolResult> {
    try {
      const dirPath = params.path;
      const ignorePatterns = params.ignore || [];

      // Check if directory exists
      if (!fs.existsSync(dirPath)) {
        return this.errorResult(
          `Directory does not exist: ${dirPath}`,
          `❌ Directory not found: ${shortenPath(dirPath)}`,
        );
      }

      // Check if it's actually a directory
      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) {
        return this.errorResult(
          `Path is not a directory: ${dirPath}`,
          `❌ Not a directory: ${shortenPath(dirPath)}`,
        );
      }

      // Read directory contents
      const entries = fs.readdirSync(dirPath);
      const fileEntries: FileEntry[] = [];

      for (const entry of entries) {
        // Skip ignored files
        if (this.shouldIgnore(entry, ignorePatterns)) {
          continue;
        }

        const entryPath = path.join(dirPath, entry);
        const entryStat = fs.statSync(entryPath);

        fileEntries.push({
          name: entry,
          path: entryPath,
          isDirectory: entryStat.isDirectory(),
          size: entryStat.size,
          modifiedTime: entryStat.mtime,
        });
      }

      // Sort entries: directories first, then files, both alphabetically
      fileEntries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      const llmContent = JSON.stringify(fileEntries, null, 2);
      const returnDisplay = this.formatDirectoryListing(fileEntries, dirPath);

             return {
         llmContent,
         returnDisplay,
       };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.errorResult(
        `Error listing directory: ${errorMessage}`,
        `❌ Error: ${errorMessage}`,
      );
    }
  }

  private formatDirectoryListing(entries: FileEntry[], dirPath: string): string {
    if (entries.length === 0) {
      return `📁 ${shortenPath(dirPath)} (empty directory)`;
    }

    const lines = [`📁 ${shortenPath(dirPath)}`];
    
    for (const entry of entries) {
      const icon = entry.isDirectory ? '📁' : '📄';
      const size = entry.isDirectory ? '' : ` (${this.formatSize(entry.size)})`;
      lines.push(`  ${icon} ${entry.name}${size}`);
    }

    return lines.join('\n');
  }

  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
