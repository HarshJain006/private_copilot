// src/types/index.ts
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import * as vscode from 'vscode';

export interface CopilotConfig {
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  enableCompletions: boolean;
  fixMaxTokens: number;
  streamDelay: number;
}

export interface StreamOptions {
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

export interface CodeEdit {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  newText: string;
}

export interface FixResult {
  explanation: string;
  edits: CodeEdit[];
}

export interface FileEditSession {
  uri: vscode.Uri;
  filename: string;
  fullCode: string;
  currentVersion: string;
  chunkSize: number;
  isReading: boolean;
  isEditing: boolean;
  abortController?: AbortController;
}

export interface PendingEdit {
  edit: vscode.WorkspaceEdit;
  decorationType: vscode.TextEditorDecorationType;
  originalContent: string;
  editor: vscode.TextEditor;
  currentVersion: string;
}

export interface WebviewMessage {
  command: string;
  text?: string;
  role?: 'user' | 'ai';
  content?: string;
  append?: boolean;
}

export type AgentRole = 'completion' | 'chat' | 'explain' | 'fix' | 'ask' | 'health' | 'test';

export interface AgentConfig {
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export { ChatCompletionMessageParam };