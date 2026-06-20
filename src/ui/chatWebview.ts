// src/ui/chatWebview.ts
import * as vscode from 'vscode';
import { getWebviewContent } from './webview.html';
import { ChatAgent } from '../agents/chatAgent';
import { ExplainAgent, AskAgent, TestAgent, HealthAgent } from '../agents/otherAgents';
import { FixAgent } from '../agents/fixAgent';
import { ConfigManager } from '../services/config';
import type { WebviewMessage, PendingEdit, FileEditSession, FixResult } from '../types';

export class ChatWebviewController implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private panel?: vscode.WebviewPanel;
  private context?: vscode.ExtensionContext;

  private chatAgent: ChatAgent;
  private explainAgent: ExplainAgent;
  private fixAgent: FixAgent;
  private askAgent: AskAgent;
  private testAgent: TestAgent;
  private healthAgent: HealthAgent;

  private isProcessing = false;
  private abortController: AbortController | null = null;
  private pendingEdit: PendingEdit | null = null;
  private fileEditSession: FileEditSession | null = null;

  constructor() {
    this.chatAgent = new ChatAgent();
    this.explainAgent = new ExplainAgent();
    this.fixAgent = new FixAgent();
    this.askAgent = new AskAgent();
    this.testAgent = new TestAgent();
    this.healthAgent = new HealthAgent();
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = getWebviewContent(webviewView.webview);
    this.setupMessageHandler(webviewView.webview);
    this.sendModelInfo(webviewView.webview);
  }

  public show(context: vscode.ExtensionContext): void {
    this.context = context;

    if (this.view) {
      this.view.show?.(true);
      return;
    }

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'privateCopilotChat',
      'Private Copilot',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.html = getWebviewContent(this.panel.webview);
    this.setupMessageHandler(this.panel.webview);
    this.sendModelInfo(this.panel.webview);

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.cleanup();
    });
  }

  private setupMessageHandler(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      try {
        switch (message.command) {
          case 'sendMessage':
            if (message.text) {
              await this.handleUserMessage(message.text);
            }
            break;
          case 'explainCode':
            await this.explainCode();
            break;
          case 'fixError':
            await this.fixError();
            break;
          case 'askSelected':
            await this.askAboutSelected();
            break;
          case 'generateTests':
            await this.generateTests();
            break;
          case 'healthCheck':
            await this.healthCheck();
            break;
          case 'stopGeneration':
            this.stopGeneration();
            break;
          case 'clearChat':
            this.clearChat();
            break;
          case 'acceptEdit':
            await this.acceptEdit();
            break;
          case 'rejectEdit':
            this.rejectEdit();
            break;
          default:
            console.warn('Unknown command:', message.command);
        }
      } catch (error) {
        console.error('Error handling message:', error);
        this.postMessage('updateChat', {
          role: 'ai',
          content: `Error: ${String(error)}`
        });
      }
    });
  }

  private async handleUserMessage(text: string): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.abortController = new AbortController();

    this.postMessage('updateChat', { role: 'user', content: text });
    this.postMessage('startProcessing');

    try {
      let accumulatedResponse = '';
      
      this.postMessage('startAiStream');

      const response = await this.chatAgent.generateResponse(text, {
        signal: this.abortController.signal,
        onChunk: (chunk) => {
          accumulatedResponse += chunk;
          this.postMessage('aiChunk', { content: chunk });
        }
      });

      this.postMessage('endAiStream', { content: response });

    } catch (error: any) {
      const errorMsg = error.name === 'AbortError' 
        ? '_Generation stopped by user._'
        : `Error: ${String(error)}`;
      
      this.postMessage('updateChat', { role: 'ai', content: errorMsg });
    } finally {
      this.postMessage('endProcessing');
      this.isProcessing = false;
      this.abortController = null;
    }
  }

  private async explainCode(): Promise<void> {
    if (this.isProcessing) return;

    const editor = this.getActiveEditor();
    if (!editor || editor.selection.isEmpty) {
      this.showMessage('Please select code to explain.', 'warning');
      return;
    }

    this.isProcessing = true;
    const selectedCode = editor.document.getText(editor.selection);
    const language = editor.document.languageId;

    this.postMessage('updateChat', {
      role: 'user',
      content: `**Explain this ${language} code:**\n\`\`\`${language}\n${selectedCode}\n\`\`\``
    });

    this.postMessage('startProcessing');
    this.postMessage('startAiStream');

    try {
      let fullResponse = '';
      
      await this.explainAgent.explain(selectedCode, language, {
        onChunk: (chunk) => {
          fullResponse += chunk;
          this.postMessage('aiChunk', { content: chunk });
        }
      });

      this.postMessage('endAiStream', { content: fullResponse });
    } catch (error) {
      this.postMessage('updateChat', {
        role: 'ai',
        content: `Error: ${String(error)}`
      });
    } finally {
      this.postMessage('endProcessing');
      this.isProcessing = false;
    }
  }

  private async fixError(): Promise<void> {
    if (this.isProcessing) return;

    const editor = this.getActiveEditor();
    if (!editor) {
      this.showMessage('Please open a file.', 'warning');
      return;
    }

    this.isProcessing = true;
    this.postMessage('startProcessing');

    try {
      const fullCode = editor.document.getText();
      let errorMessage = 'Please fix any issues in this code.';
      let contextCode = '';

      // Check for selection
      if (!editor.selection.isEmpty) {
        contextCode = editor.document.getText(editor.selection);
        errorMessage = 'Fix the selected code.';
      } else {
        // Look for diagnostics
        const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
        const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
        
        if (errors.length > 0) {
          const firstError = errors[0];
          errorMessage = firstError.message;
          
          // Get context around error
          const range = firstError.range;
          const startLine = Math.max(0, range.start.line - 5);
          const endLine = Math.min(editor.document.lineCount - 1, range.end.line + 5);
          contextCode = editor.document.getText(
            new vscode.Range(startLine, 0, endLine, editor.document.lineAt(endLine).text.length)
          );
        } else {
          contextCode = fullCode;
        }
      }

      this.postMessage('updateChat', {
        role: 'user',
        content: `**Fix:** ${errorMessage}\n\`\`\`\n${contextCode.substring(0, 500)}...\n\`\`\``
      });

      const fixResult = await this.fixAgent.fix(fullCode, errorMessage);

      if (typeof fixResult === 'string') {
        this.postMessage('updateChat', { role: 'ai', content: fixResult });
      } else {
        await this.applyFix(fixResult, editor);
      }

    } catch (error) {
      this.postMessage('updateChat', {
        role: 'ai',
        content: `Error: ${String(error)}`
      });
    } finally {
      this.postMessage('endProcessing');
      this.isProcessing = false;
    }
  }

  private async applyFix(fixResult: FixResult, editor: vscode.TextEditor): Promise<void> {
    const { explanation, edits } = fixResult;

    if (edits.length === 0) {
      this.postMessage('updateChat', {
        role: 'ai',
        content: `✅ ${explanation}`
      });
      return;
    }

    const edit = new vscode.WorkspaceEdit();
    const decorations: vscode.DecorationOptions[] = [];

    for (const e of edits) {
      const range = new vscode.Range(
        e.startLine - 1,
        e.startColumn - 1,
        e.endLine - 1,
        e.endColumn - 1
      );

      edit.replace(editor.document.uri, range, e.newText);

      decorations.push({
        range,
        renderOptions: {
          after: {
            contentText: ` → ${e.newText.substring(0, 20)}...`,
            color: 'rgb(0, 200, 0)'
          }
        }
      });
    }

    const decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
      border: '1px dashed',
      borderColor: new vscode.ThemeColor('editorInfo.foreground'),
    });

    editor.setDecorations(decorationType, decorations);

    this.pendingEdit = {
      edit,
      decorationType,
      originalContent: editor.document.getText(),
      editor,
      currentVersion: editor.document.getText()
    };

    const message = `${explanation}\n\n**Preview applied** (${edits.length} change${edits.length > 1 ? 's' : ''})`;
    const buttons = `<div class="action-buttons">
      <button data-command="acceptEdit" class="btn-success">✅ Accept</button>
      <button data-command="rejectEdit" class="btn-danger">❌ Reject</button>
    </div>`;

    this.postMessage('updateChat', {
      role: 'ai',
      content: message + buttons
    });
  }

  private async acceptEdit(): Promise<void> {
    if (!this.pendingEdit) return;

    const { edit, decorationType, editor } = this.pendingEdit;
    const applied = await vscode.workspace.applyEdit(edit);

    if (applied) {
      editor.setDecorations(decorationType, []);
      this.postMessage('updateChat', {
        role: 'ai',
        content: '✅ **Changes accepted and applied.**'
      });
    } else {
      this.showMessage('Failed to apply changes.', 'error');
    }

    this.pendingEdit = null;
  }

  private rejectEdit(): void {
    if (!this.pendingEdit) return;

    const { decorationType, editor } = this.pendingEdit;
    editor.setDecorations(decorationType, []);
    
    this.postMessage('updateChat', {
      role: 'ai',
      content: '❌ **Changes rejected.**'
    });

    this.pendingEdit = null;
  }

  private async askAboutSelected(): Promise<void> {
    if (this.isProcessing) return;

    const editor = this.getActiveEditor();
    if (!editor || editor.selection.isEmpty) {
      this.showMessage('Please select code first.', 'warning');
      return;
    }

    const question = await vscode.window.showInputBox({
      prompt: 'What would you like to know about this code?',
      placeHolder: 'e.g., How can I optimize this?'
    });

    if (!question) return;

    this.isProcessing = true;
    const selectedCode = editor.document.getText(editor.selection);
    const language = editor.document.languageId;

    this.postMessage('updateChat', {
      role: 'user',
      content: `**Question:** ${question}\n\n\`\`\`${language}\n${selectedCode}\n\`\`\``
    });

    this.postMessage('startProcessing');
    this.postMessage('startAiStream');

    try {
      let fullResponse = '';
      
      await this.askAgent.ask(question, selectedCode, language, {
        onChunk: (chunk) => {
          fullResponse += chunk;
          this.postMessage('aiChunk', { content: chunk });
        }
      });

      this.postMessage('endAiStream', { content: fullResponse });
    } catch (error) {
      this.postMessage('updateChat', {
        role: 'ai',
        content: `Error: ${String(error)}`
      });
    } finally {
      this.postMessage('endProcessing');
      this.isProcessing = false;
    }
  }

  private async generateTests(): Promise<void> {
    if (this.isProcessing) return;

    const editor = this.getActiveEditor();
    if (!editor || editor.selection.isEmpty) {
      this.showMessage('Please select code to generate tests for.', 'warning');
      return;
    }

    this.isProcessing = true;
    const selectedCode = editor.document.getText(editor.selection);
    const language = editor.document.languageId;

    this.postMessage('updateChat', {
      role: 'user',
      content: `**Generate tests for:**\n\`\`\`${language}\n${selectedCode}\n\`\`\``
    });

    this.postMessage('startProcessing');
    this.postMessage('startAiStream');

    try {
      let fullResponse = '';
      
      await this.testAgent.generateTests(selectedCode, language, {
        onChunk: (chunk) => {
          fullResponse += chunk;
          this.postMessage('aiChunk', { content: chunk });
        }
      });

      this.postMessage('endAiStream', { content: fullResponse });
    } catch (error) {
      this.postMessage('updateChat', {
        role: 'ai',
        content: `Error: ${String(error)}`
      });
    } finally {
      this.postMessage('endProcessing');
      this.isProcessing = false;
    }
  }

  private async healthCheck(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    const query = "Perform a system health check. Verify that you can respond appropriately and follow instructions.";

    this.postMessage('updateChat', { role: 'user', content: '**Running health check...**' });
    this.postMessage('startProcessing');
    this.postMessage('startAiStream');

    try {
      let fullResponse = '';
      
      await this.healthAgent.checkHealth(query, {
        onChunk: (chunk) => {
          fullResponse += chunk;
          this.postMessage('aiChunk', { content: chunk });
        }
      });

      this.postMessage('endAiStream', { content: fullResponse });
      this.showMessage('Health check completed', 'info');
    } catch (error) {
      this.postMessage('updateChat', {
        role: 'ai',
        content: `Health check failed: ${String(error)}`
      });
      this.showMessage('Health check failed', 'error');
    } finally {
      this.postMessage('endProcessing');
      this.isProcessing = false;
    }
  }

  private stopGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isProcessing = false;
    this.postMessage('endProcessing');
  }

  private clearChat(): void {
    this.chatAgent.clearHistory();
    this.postMessage('clearChat');
  }

  private getActiveEditor(): vscode.TextEditor | null {
    return vscode.window.activeTextEditor || null;
  }

  private postMessage(command: string, data: any = {}): void {
    const webview = this.panel?.webview || this.view?.webview;
    if (webview) {
      webview.postMessage({ command, ...data });
    }
  }

  private sendModelInfo(webview: vscode.Webview): void {
    const config = ConfigManager.getInstance().getConfig();
    webview.postMessage({
      command: 'setModelInfo',
      info: `Model: ${config.modelName}`
    });
  }

  private showMessage(message: string, type: 'info' | 'warning' | 'error'): void {
    const showFn = {
      info: vscode.window.showInformationMessage,
      warning: vscode.window.showWarningMessage,
      error: vscode.window.showErrorMessage
    }[type];
    
    showFn(message);
  }

  private cleanup(): void {
    if (this.pendingEdit) {
      this.pendingEdit.decorationType.dispose();
      this.pendingEdit = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public reinitialize(): void {
    this.chatAgent = new ChatAgent();
    this.explainAgent = new ExplainAgent();
    this.fixAgent = new FixAgent();
    this.askAgent = new AskAgent();
    this.testAgent = new TestAgent();
    this.healthAgent = new HealthAgent();
  }
}