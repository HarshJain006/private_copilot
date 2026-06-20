// src/agents/completionAgent.ts
import * as vscode from 'vscode';
import { BaseAgent } from './baseAgent';
import type { ChatCompletionMessageParam } from '../types';

export class CompletionAgent extends BaseAgent {
  constructor() {
    super({
      systemPrompt: `You are an intelligent code completion assistant. Your task is to predict and suggest the most likely next code based on context.

**Rules**:
1. Analyze the code context carefully
2. Consider the current programming language and its idioms
3. Match the existing code style (indentation, naming conventions)
4. Suggest only the completion, not explanations
5. Ensure syntactically correct code
6. Use appropriate design patterns

**Output Format**:
- Return ONLY the code suggestion
- Wrap in markdown code block with language
- No additional commentary
- Match the indentation level of the cursor position`,
      temperature: 0.3, // Lower temperature for more deterministic completions
    });
  }

  public getName(): string {
    return 'CompletionAgent';
  }

  public async provideCompletion(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<string> {
    const context = this.getContextWindow(document, position, 60);
    const language = document.languageId;
    
    const cursorLine = document.lineAt(position.line).text;
    const beforeCursor = cursorLine.substring(0, position.character);
    const afterCursor = cursorLine.substring(position.character);

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content: `Complete the code at the cursor position.

**Language**: ${language}
**Context**:
\`\`\`${language}
${context}
\`\`\`

**Current line**: "${cursorLine}"
**Before cursor**: "${beforeCursor}"
**After cursor**: "${afterCursor}"

Provide only the completion code that should be inserted at the cursor.`
      }
    ];

    const completion = await this.callLLM(messages);
    return this.extractCodeBlock(completion, language);
  }

  public async suggestNextEdit(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<string> {
    const context = this.getContextWindow(document, position, 100);
    const language = document.languageId;

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content: `Predict the most likely next edit or addition to this code.

**Language**: ${language}
**Context**:
\`\`\`${language}
${context}
\`\`\`

Suggest what the developer is likely to write next. Consider:
- Current function/class structure
- Patterns in the existing code
- Common next steps in development flow

Return only the code suggestion.`
      }
    ];

    const suggestion = await this.callLLM(messages);
    return this.extractCodeBlock(suggestion, language);
  }
}