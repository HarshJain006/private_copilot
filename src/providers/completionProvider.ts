// src/providers/completionProvider.ts
import * as vscode from 'vscode';
import { CompletionAgent } from '../agents/completionAgent';
import { ConfigManager } from '../services/config';

export class InlineCompletionProvider implements vscode.CompletionItemProvider<vscode.CompletionItem> {
  private agent: CompletionAgent;
  private lastTriggerTime = 0;
  private readonly DEBOUNCE_MS = 500;

  constructor() {
    this.agent = new CompletionAgent();
  }

  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.CompletionItem[] | undefined> {
    const config = ConfigManager.getInstance().getConfig();
    
    if (!config.enableCompletions) {
      return undefined;
    }

    // Debounce to avoid excessive API calls
    const now = Date.now();
    if (now - this.lastTriggerTime < this.DEBOUNCE_MS) {
      return undefined;
    }
    this.lastTriggerTime = now;

    // Only trigger after meaningful input
    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    if (linePrefix.trim().length < 2) {
      return undefined;
    }

    try {
      const suggestion = await this.agent.provideCompletion(document, position);
      
      if (token.isCancellationRequested || !suggestion) {
        return undefined;
      }

      const item = new vscode.CompletionItem(
        '✨ AI Suggestion',
        vscode.CompletionItemKind.Snippet
      );
      
      item.insertText = new vscode.SnippetString(suggestion);
      item.documentation = new vscode.MarkdownString(
        `**AI-Generated Completion**\n\n\`\`\`${document.languageId}\n${suggestion}\n\`\`\``
      );
      item.detail = 'Private Copilot';
      item.sortText = '0'; // Show at top of list

      return [item];
    } catch (error) {
      console.error('Completion failed:', error);
      return undefined;
    }
  }

  public reinitialize(): void {
    this.agent = new CompletionAgent();
  }
}

// Inline completion provider (VS Code 1.68+)
export class InlineCompletionItemProvider implements vscode.InlineCompletionItemProvider {
  private agent: CompletionAgent;
  private lastTriggerTime = 0;
  private readonly DEBOUNCE_MS = 1000;

  constructor() {
    this.agent = new CompletionAgent();
  }

  public async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const config = ConfigManager.getInstance().getConfig();
    
    if (!config.enableCompletions) {
      return undefined;
    }

    // Only trigger when manually invoked or after pause in typing
    if (context.triggerKind !== vscode.InlineCompletionTriggerKind.Invoke) {
      return undefined;
    }

    const now = Date.now();
    if (now - this.lastTriggerTime < this.DEBOUNCE_MS) {
      return undefined;
    }
    this.lastTriggerTime = now;

    try {
      const suggestion = await this.agent.provideCompletion(document, position);
      
      if (token.isCancellationRequested || !suggestion) {
        return undefined;
      }

      const item = new vscode.InlineCompletionItem(suggestion);
      item.range = new vscode.Range(position, position);

      return [item];
    } catch (error) {
      console.error('Inline completion failed:', error);
      return undefined;
    }
  }

  public reinitialize(): void {
    this.agent = new CompletionAgent();
  }
}