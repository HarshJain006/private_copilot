// src/extension.ts
import * as vscode from 'vscode';
import { ChatWebviewController } from './ui/chatWebview';
import { InlineCompletionProvider, InlineCompletionItemProvider } from './providers/completionProvider';
import { ConfigManager } from './services/config';
import { LLMService } from './services/llmService';

let chatController: ChatWebviewController;
let completionProvider: InlineCompletionProvider;
let inlineCompletionProvider: InlineCompletionItemProvider;

export function activate(context: vscode.ExtensionContext): void {
  console.log('Private Copilot is activating...');

  // Validate configuration
  const config = ConfigManager.getInstance().getConfig();
  if (!config.apiKey || config.apiKey === 'your-api-key') {
    vscode.window.showWarningMessage(
      'Private Copilot: Please configure your API key in settings.',
      'Open Settings'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'privateCopilot.apiKey');
      }
    });
  }

  // Initialize services
  try {
    LLMService.getInstance();
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to initialize LLM service: ${String(error)}`);
    return;
  }

  // Initialize chat controller
  chatController = new ChatWebviewController();

  // Register webview view provider (sidebar)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'privateCopilotChat',
      chatController,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // Initialize completion providers
  completionProvider = new InlineCompletionProvider();
  inlineCompletionProvider = new InlineCompletionItemProvider();

  // Register completion providers for common languages
  const languages = [
    'typescript',
    'javascript',
    'python',
    'java',
    'csharp',
    'cpp',
    'c',
    'go',
    'rust',
    'php',
    'ruby',
    'swift',
    'kotlin',
    'html',
    'css',
    'json',
    'yaml',
    'markdown'
  ];

  for (const lang of languages) {
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        lang,
        completionProvider,
        '.', ' ', '\n', '(', '{', '['
      )
    );
  }

  // Register inline completion provider (VS Code 1.68+)
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      inlineCompletionProvider
    )
  );

  // Register commands
  registerCommands(context);

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('privateCopilot')) {
        handleConfigChange();
      }
    })
  );

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = '$(robot) Copilot';
  statusBarItem.tooltip = 'Private Copilot - Click to open chat';
  statusBarItem.command = 'privateCopilot.openChat';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  console.log('✅ Private Copilot activated successfully!');
  vscode.window.showInformationMessage('Private Copilot is ready!');
}

function registerCommands(context: vscode.ExtensionContext): void {
  const commands = [
    {
      id: 'privateCopilot.openChat',
      handler: () => chatController.show(context)
    },
    {
      id: 'privateCopilot.explainCode',
      handler: () => {
        chatController.show(context);
        vscode.commands.executeCommand('workbench.view.extension.privateCopilot');
      }
    },
    {
      id: 'privateCopilot.fixError',
      handler: () => {
        chatController.show(context);
        vscode.commands.executeCommand('workbench.view.extension.privateCopilot');
      }
    },
    {
      id: 'privateCopilot.askAboutCode',
      handler: () => {
        chatController.show(context);
        vscode.commands.executeCommand('workbench.view.extension.privateCopilot');
      }
    },
    {
      id: 'privateCopilot.generateTests',
      handler: () => {
        chatController.show(context);
        vscode.commands.executeCommand('workbench.view.extension.privateCopilot');
      }
    },
    {
      id: 'privateCopilot.healthCheck',
      handler: async () => {
        try {
          await LLMService.getInstance().complete([
            { role: 'user', content: 'Hello, are you working?' }
          ]);
          vscode.window.showInformationMessage('✅ LLM is healthy and responding!');
        } catch (error) {
          vscode.window.showErrorMessage(`❌ LLM health check failed: ${String(error)}`);
        }
      }
    },
    {
      id: 'privateCopilot.toggleCompletions',
      handler: async () => {
        const config = ConfigManager.getInstance();
        const current = config.get<boolean>('enableCompletions', true);
        await config.update('enableCompletions', !current);
        vscode.window.showInformationMessage(
          `Completions ${!current ? 'enabled' : 'disabled'}`
        );
      }
    },
    {
      id: 'privateCopilot.openSettings',
      handler: () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'privateCopilot');
      }
    }
  ];

  for (const cmd of commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(cmd.id, cmd.handler)
    );
  }
}

function handleConfigChange(): void {
  console.log('Configuration changed, reinitializing...');
  
  ConfigManager.getInstance().refresh();
  LLMService.getInstance().reinitialize();
  chatController.reinitialize();
  completionProvider.reinitialize();
  inlineCompletionProvider.reinitialize();

  vscode.window.showInformationMessage('Private Copilot configuration updated');
}

export function deactivate(): void {
  console.log('Private Copilot deactivated');
}