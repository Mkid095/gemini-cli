/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Export local LLM infrastructure
export * from './local-llm/index.js';

// Export basic types
export enum AuthType {
  USE_LOCAL_LLM = 'local-llm',
}

export interface ContentGenerator {
  generateContent(request: any): Promise<any>;
  generateContentStream(request: any): Promise<AsyncGenerator<any>>;
  countTokens(request: any): Promise<any>;
}

export interface Config {
  getModel(): string;
  getDebugMode(): boolean;
  getTargetDir(): string;
  getWorkingDir(): string;
  getSessionId(): string;
}

// Export basic utilities
export * from './utils/paths.js';
export * from './utils/errors.js';
export * from './utils/fileUtils.js';

// Export basic tools
export * from './tools/tools.js';
export * from './tools/read-file.js';
export * from './tools/ls.js';
export * from './tools/write-file.js';
export * from './tools/memoryTool.js';

// Export session ID
export { sessionId } from './utils/session.js';
