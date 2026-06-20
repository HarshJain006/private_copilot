// src/services/config.ts
import * as vscode from 'vscode';
import type { CopilotConfig } from '../types';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: vscode.WorkspaceConfiguration;

  private constructor() {
    this.config = vscode.workspace.getConfiguration('privateCopilot');
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public refresh(): void {
    this.config = vscode.workspace.getConfiguration('privateCopilot');
  }

  public getConfig(): CopilotConfig {
    return {
      apiBaseUrl: this.config.get('apiBaseUrl', 'http://localhost:11434/v1'),
      apiKey: this.config.get('apiKey', 'ollama'),
      modelName: this.config.get('modelName', 'qwen2.5-coder:7b'),
      temperature: this.config.get('temperature', 0.7),
      maxTokens: this.config.get('maxTokens', 2048),
      enableCompletions: this.config.get('enableCompletions', true),
      fixMaxTokens: this.config.get('fixMaxTokens', 4096),
      streamDelay: this.config.get('streamDelay', 50),
    };
  }

  public get<T>(key: string, defaultValue?: T): T {
    return this.config.get(key, defaultValue as T);
  }

  public async update(key: string, value: any, global = false): Promise<void> {
    await this.config.update(key, value, global);
    this.refresh();
  }
}