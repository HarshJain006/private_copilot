// src/agents/fixAgent.ts
import { BaseAgent } from './baseAgent';
import type { ChatCompletionMessageParam, FixResult } from '../types';

export class FixAgent extends BaseAgent {
  constructor() {
    super({
      systemPrompt: `You are an expert code debugging and fixing engine. Your job is to analyze code, identify errors, and provide precise fixes.

**CRITICAL RULES**:
1. Output ONLY valid JSON - no markdown, no backticks, no comments
2. Keep explanations brief and technical
3. Provide minimal edits - don't rewrite unless necessary
4. Lines and columns are 1-based (first line = 1, first column = 1)
5. Reference the ORIGINAL code positions, not modified versions
6. "newText" contains the exact replacement text
7. If no errors: return { "explanation": "No issues found.", "edits": [] }
8. Never assume or invent context

**MANDATORY OUTPUT FORMAT**:
{
  "explanation": "brief technical summary of issue and fix",
  "edits": [
    {
      "startLine": number,
      "startColumn": number,
      "endLine": number,
      "endColumn": number,
      "newText": "exact replacement text"
    }
  ]
}

**Edit Examples**:
- Replace "var" with "const": startLine=5, startColumn=1, endLine=5, endColumn=4, newText="const"
- Fix missing semicolon: startLine=10, startColumn=25, endLine=10, endColumn=25, newText=";"
- Replace entire line: startLine=7, startColumn=1, endLine=7, endColumn=50, newText="new line content"`,
      maxTokens: 4096,
    });
  }

  public getName(): string {
    return 'FixAgent';
  }

  public async fix(
    code: string,
    errorMessage: string
  ): Promise<FixResult | string> {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content: `Fix this error in the code below.

**Error**: ${errorMessage}

**Code** (line numbers are 1-based):
\`\`\`
${code}
\`\`\`

Return ONLY valid JSON with the fix.`
      }
    ];

    try {
      const response = await this.callLLM(messages);
      return this.parseFixResult(response);
    } catch (error) {
      return `Failed to generate fix: ${String(error)}`;
    }
  }

  private parseFixResult(response: string): FixResult | string {
    const trimmed = response.trim();
    
    if (!trimmed) {
      return 'No fix returned. Check LLM configuration.';
    }

    // Extract JSON even if wrapped in markdown
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : trimmed;

    try {
      const parsed = JSON.parse(jsonStr);
      
      // Validate structure
      if (typeof parsed.explanation !== 'string') {
        throw new Error('Missing or invalid "explanation" field');
      }
      
      if (!Array.isArray(parsed.edits)) {
        throw new Error('Missing or invalid "edits" array');
      }

      // Validate each edit
      for (const edit of parsed.edits) {
        if (
          typeof edit.startLine !== 'number' ||
          typeof edit.startColumn !== 'number' ||
          typeof edit.endLine !== 'number' ||
          typeof edit.endColumn !== 'number' ||
          typeof edit.newText !== 'string'
        ) {
          throw new Error('Invalid edit structure');
        }
      }

      return parsed as FixResult;
    } catch (error) {
      return `Invalid JSON response:\n\n\`\`\`json\n${jsonStr}\n\`\`\`\n\nError: ${String(error)}`;
    }
  }

  public async suggestImprovement(code: string, language: string): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content: `Analyze this ${language} code and suggest improvements for:
- Performance
- Readability
- Best practices
- Potential bugs

**Code**:
\`\`\`${language}
${code}
\`\`\`

Provide specific, actionable suggestions with examples.`
      }
    ];

    return this.callLLM(messages);
  }
}