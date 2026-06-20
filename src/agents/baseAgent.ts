// src/agents/baseAgent.ts
import * as vscode from 'vscode';
import type { ChatCompletionMessageParam, StreamOptions, AgentConfig } from '../types';
import { LLMService } from '../services/llmService';

export abstract class BaseAgent {
  protected systemPrompt: string;
  protected llmService: LLMService;
  protected temperature?: number;
  protected maxTokens?: number;

  constructor(config: AgentConfig) {
    this.systemPrompt = config.systemPrompt;
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
    this.llmService = LLMService.getInstance();
  }

  protected async callLLM(
    messages: ChatCompletionMessageParam[],
    options: StreamOptions = {}
  ): Promise<string> {
    const fullMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: this.systemPrompt },
      ...messages
    ];

    return this.llmService.complete(fullMessages, options);
  }

  protected getContextWindow(
    document: vscode.TextDocument,
    position: vscode.Position,
    lines = 50
  ): string {
    const fullText = document.getText();
    const linesArray = fullText.split('\n');
    const startLine = Math.max(0, position.line - Math.floor(lines / 2));
    const endLine = Math.min(linesArray.length, position.line + Math.floor(lines / 2));
    return linesArray.slice(startLine, endLine).join('\n');
  }

  protected extractCodeBlock(text: string, language?: string): string {
    const langPattern = language ? `(${language})?` : '([\\w-]+)?';
    const regex = new RegExp(`\`\`\`${langPattern}\\s*\\n([\\s\\S]*?)\\n\`\`\``, 'g');
    const matches = Array.from(text.matchAll(regex));
    
    if (matches.length > 0) {
      return matches.map(m => m[2].trim()).join('\n\n');
    }
    
    return text.trim();
  }

  public abstract getName(): string;
}