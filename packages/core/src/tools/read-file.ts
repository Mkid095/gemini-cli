/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { makeRelative, shortenPath } from '../utils/paths.js';
import { BaseTool, Icon, ToolLocation, ToolResult } from './tools.js';
import { Type } from '@google/genai';
import {
  processSingleFileContent,
  getSpecificMimeType,
} from '../utils/fileUtils.js';

/**
 * Parameters for the ReadFile tool
 */
export interface ReadFileToolParams {
  /**
   * The absolute path to the file to read
   */
  absolute_path: string;

  /**
   * The line number to start reading from (optional)
   */
  offset?: number;

  /**
   * The number of lines to read (optional)
   */
  limit?: number;
}

/**
 * Implementation of the ReadFile tool logic
 */
export class ReadFileTool extends BaseTool<ReadFileToolParams, ToolResult> {
  static readonly Name: string = 'read_file';

  constructor() {
    super(
      ReadFileTool.Name,
      'ReadFile',
      'Reads and returns the content of a specified file from the local filesystem. Handles text, images (PNG, JPG, GIF, WEBP, SVG, BMP), and PDF files. For text files, it can read specific line ranges.',
      Icon.FileSearch,
      {
        properties: {
          absolute_path: {
            description:
              "The absolute path to the file to read (e.g., '/home/user/project/file.txt'). Relative paths are not supported. You must provide an absolute path.",
            type: Type.STRING,
          },
          offset: {
            description:
              "Optional: For text files, the 0-based line number to start reading from. Requires 'limit' to be set. Use for paginating through large files.",
            type: Type.NUMBER,
          },
          limit: {
            description:
              "Optional: For text files, maximum number of lines to read. Use with 'offset' to paginate through large files. If omitted, reads the entire file (if feasible, up to a default limit).",
            type: Type.NUMBER,
          },
        },
        required: ['absolute_path'],
        type: Type.OBJECT,
      },
    );
  }

  validateToolParams(params: ReadFileToolParams): string | null {
    if (!params.absolute_path) {
      return 'File path is required';
    }

    const filePath = params.absolute_path;
    if (!path.isAbsolute(filePath)) {
      return `File path must be absolute, but was relative: ${filePath}. You must provide an absolute path.`;
    }

    if (params.offset !== undefined && params.offset < 0) {
      return 'Offset must be a non-negative number';
    }
    if (params.limit !== undefined && params.limit <= 0) {
      return 'Limit must be a positive number';
    }

    return null;
  }

  getDescription(params: ReadFileToolParams): string {
    const relativePath = makeRelative(params.absolute_path, process.cwd());
    return `Read file: ${shortenPath(relativePath)}`;
  }

  toolLocations(params: ReadFileToolParams): ToolLocation[] {
    return [{ path: params.absolute_path }];
  }

  async execute(
    params: ReadFileToolParams,
    _signal: AbortSignal,
  ): Promise<ToolResult> {
    try {
      const filePath = params.absolute_path;

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return {
          llmContent: `File not found: ${filePath}`,
          returnDisplay: `❌ File not found: ${shortenPath(filePath)}`,
        };
      }

      // Check if it's actually a file
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        return {
          llmContent: `Path is not a file: ${filePath}`,
          returnDisplay: `❌ Not a file: ${shortenPath(filePath)}`,
        };
      }

      // Get file info
      const mimeType = getSpecificMimeType(filePath);
      const fileSize = stat.size;

      // Process file content based on type
      const content = await processSingleFileContent(
        filePath,
        process.cwd(),
        params.offset,
        params.limit,
      );

      const llmContent = content.llmContent;
      const returnDisplay = `📄 ${shortenPath(filePath)} (${fileSize} bytes)`;

      return {
        llmContent,
        returnDisplay,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        llmContent: `Error reading file: ${errorMessage}`,
        returnDisplay: `❌ Error: ${errorMessage}`,
      };
    }
  }
}
