// src/agents/chatAgent.ts
import { BaseAgent } from './baseAgent';
import type { ChatCompletionMessageParam, StreamOptions } from '../types';

export class ChatAgent extends BaseAgent {
  private chatHistory: ChatCompletionMessageParam[] = [];

  constructor() {
    super({
      systemPrompt: `You are an expert AI coding assistant. Your role is to help developers write better code through:

1. **Code Analysis**: Examine code structure, patterns, and potential improvements
2. **Problem Solving**: Break down complex problems into manageable steps
3. **Best Practices**: Suggest industry-standard approaches and patterns
4. **Code Generation**: Create clean, well-documented code with proper formatting

**Response Format**:
- Use markdown for formatting
- Wrap ALL code in \`\`\`language blocks (specify language: python, typescript, javascript, etc.)
- Be concise but thorough
- Explain your reasoning when suggesting changes
- Highlight potential issues or edge cases

**Style Guidelines**:
- Use clear variable names
- Add comments for complex logic
- Follow language-specific conventions
- Consider performance and maintainability

Be helpful, accurate, and professional. If you're unsure, say so rather than guessing.`,
    });
  }

  public getName(): string {
    return 'ChatAgent';
  }

  public async generateResponse(
    userInput: string,
    options: StreamOptions = {}
  ): Promise<string> {
    this.addToHistory('user', userInput);
    
    try {
      const response = await this.callLLM(this.chatHistory.slice(1), options);
      
      if (options.signal?.aborted) {
        return '_Generation stopped by user._';
      }
      
      this.addToHistory('assistant', response);
      return response;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return '_Generation stopped by user._';
      }
      throw error;
    }
  }

  public addToHistory(role: 'user' | 'assistant', content: string): void {
    this.chatHistory.push({ role, content });
    
    // Keep history manageable (last 20 messages)
    if (this.chatHistory.length > 20) {
      this.chatHistory = this.chatHistory.slice(-20);
    }
  }

  public clearHistory(): void {
    this.chatHistory = [];
  }

  public getHistory(): ChatCompletionMessageParam[] {
    return [...this.chatHistory];
  }

  public setHistory(history: ChatCompletionMessageParam[]): void {
    this.chatHistory = history;
  }
}