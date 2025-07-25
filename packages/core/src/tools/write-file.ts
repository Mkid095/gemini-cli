/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import * as Diff from 'diff';
import {
  BaseTool,
  ToolResult,
  FileDiff,
  Icon,
} from './tools.js';
import { Type } from '@google/genai';
import { makeRelative, shortenPath } from '../utils/paths.js';
import { getErrorMessage, isNodeError } from '../utils/errors.js';
import { DEFAULT_DIFF_OPTIONS } from './diffOptions.js';

/**
 * Parameters for the WriteFile tool
 */
export interface WriteFileToolParams {
  /**
   * The absolute path to the file to write to
   */
  file_path: string;

  /**
   * The content to write to the file
   */
  content: string;

  /**
   * Whether the proposed content was modified by the user.
   */
  modified_by_user?: boolean;
}

/**
 * Implementation of the WriteFile tool logic
 */
export class WriteFileTool extends BaseTool<WriteFileToolParams, ToolResult> {
  static readonly Name: string = 'write_file';

  constructor() {
    super(
      WriteFileTool.Name,
      'WriteFile',
      `Writes content to a specified file in the local filesystem.

      The user has the ability to modify \`content\`. If modified, this will be stated in the response.`,
      Icon.Pencil,
      {
        properties: {
          file_path: {
            description:
              "The absolute path to the file to write to (e.g., '/home/user/project/file.txt'). Relative paths are not supported.",
            type: Type.STRING,
          },
          content: {
            description: 'The content to write to the file.',
            type: Type.STRING,
          },
        },
        required: ['file_path', 'content'],
        type: Type.OBJECT,
      },
    );
  }

  validateToolParams(params: WriteFileToolParams): string | null {
    if (!params.file_path) {
      return 'File path is required';
    }

    if (!params.content) {
      return 'Content is required';
    }

    const filePath = params.file_path;
    if (!path.isAbsolute(filePath)) {
      return `File path must be absolute, but was relative: ${filePath}. You must provide an absolute path.`;
    }

    return null;
  }

  getDescription(params: WriteFileToolParams): string {
    const relativePath = makeRelative(params.file_path, process.cwd());
    return `Write to file: ${shortenPath(relativePath)}`;
  }

  async execute(
    params: WriteFileToolParams,
    _abortSignal: AbortSignal,
  ): Promise<ToolResult> {
    try {
      const filePath = params.file_path;
      const content = params.content;

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      // Read existing content if file exists
      let originalContent: string | null = null;
      let fileExists = false;

      try {
        if (fs.existsSync(filePath)) {
          fileExists = true;
          originalContent = await fs.promises.readFile(filePath, 'utf8');
        }
      } catch (error) {
        // File exists but can't be read, treat as new file
        originalContent = null;
        fileExists = false;
      }

      // Write the new content
      await fs.promises.writeFile(filePath, content, 'utf8');

      // Generate diff if file existed
      let diff: string | null = null;
      if (fileExists && originalContent !== null) {
        diff = Diff.createPatch(
          path.basename(filePath),
          originalContent,
          content,
          undefined,
          undefined,
          DEFAULT_DIFF_OPTIONS,
        );
      }

      const fileSize = Buffer.byteLength(content, 'utf8');
      const relativePath = makeRelative(filePath, process.cwd());

      let llmContent: string;
      let returnDisplay: string | FileDiff;

      if (fileExists) {
        llmContent = `Updated file: ${relativePath} (${fileSize} bytes)`;
        if (diff) {
          returnDisplay = {
            fileDiff: diff,
            fileName: relativePath,
            originalContent,
            newContent: content,
          };
        } else {
          returnDisplay = `📝 Updated: ${shortenPath(relativePath)} (${fileSize} bytes)`;
        }
      } else {
        llmContent = `Created file: ${relativePath} (${fileSize} bytes)`;
        returnDisplay = `📝 Created: ${shortenPath(relativePath)} (${fileSize} bytes)`;
      }

      return {
        llmContent,
        returnDisplay,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      return {
        llmContent: `Error writing file: ${errorMessage}`,
        returnDisplay: `❌ Error: ${errorMessage}`,
      };
    }
  }
}
