// src/agents/otherAgents.ts
import { BaseAgent } from './baseAgent';
import type { ChatCompletionMessageParam, StreamOptions } from '../types';

export class ExplainAgent extends BaseAgent {
  constructor() {
    super({
      systemPrompt: `You are an expert code educator. Your role is to explain code clearly and comprehensively.

**Explanation Structure**:
1. **Overview**: What the code does at a high level
2. **Step-by-Step**: Break down each significant section
3. **Key Concepts**: Explain important patterns or algorithms used
4. **Potential Issues**: Highlight edge cases or improvements
5. **Best Practices**: Note good/bad practices

**Style**:
- Use clear, jargon-free language
- Include code snippets to illustrate points
- Use analogies when helpful
- Be thorough but concise`,
    });
  }

  public getName(): string {
    return 'ExplainAgent';
  }

  public async explain(code: string, language?: string, options: StreamOptions = {}): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content: `Explain this ${language || 'code'}:

\`\`\`${language || ''}
${code}
\`\`\`

Provide a clear, educational explanation.`
      }
    ];

    return this.callLLM(messages, options);
  }
}

export class AskAgent extends BaseAgent {
  constructor() {
    super({
      systemPrompt: `You are an insightful code consultant. Analyze queries in context and provide precise, actionable advice.

**Response Format**:
1. **Direct Answer**: Address the question immediately
2. **Explanation**: Provide context and reasoning
3. **Code Examples**: Show concrete implementations when relevant
4. **Alternatives**: Suggest other approaches if applicable
5. **Warnings**: Note potential pitfalls

Be concise, accurate, and practical.`,
    });
  }

  public getName(): string {
    return 'AskAgent';
  }

  public async ask(
    query: string,
    code: string,
    language?: string,
    options: StreamOptions = {}
  ): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content: `${query}

**Code Context** (${language || 'unknown language'}):
\`\`\`${language || ''}
${code}
\`\`\`

Provide specific advice related to this code.`
      }
    ];

    return this.callLLM(messages, options);
  }
}

export class TestAgent extends BaseAgent {
  constructor() {
    super({
      systemPrompt: `You are a test-driven development expert. Generate comprehensive, well-structured unit tests.

**Test Requirements**:
1. **Coverage**: Test happy paths, edge cases, and error conditions
2. **Structure**: Use appropriate testing framework (Jest, pytest, etc.)
3. **Naming**: Clear, descriptive test names
4. **Assertions**: Specific, meaningful assertions
5. **Setup/Teardown**: Include necessary fixtures
6. **Mocking**: Mock external dependencies appropriately

**Test Categories**:
- Happy path tests
- Edge case tests
- Error handling tests
- Integration tests (when relevant)

Generate production-ready tests with proper structure and best practices.`,
    });
  }

  public getName(): string {
    return 'TestAgent';
  }

  public async generateTests(
    code: string,
    language: string,
    options: StreamOptions = {}
  ): Promise<string> {
    const framework = this.getTestFramework(language);
    
    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content: `Generate comprehensive unit tests for this ${language} code using ${framework}.

**Code to test**:
\`\`\`${language}
${code}
\`\`\`

Include:
- Test setup
- Multiple test cases (happy path, edge cases, errors)
- Proper assertions
- Clear test descriptions
- Mocking where needed`
      }
    ];

    return this.callLLM(messages, options);
  }

  private getTestFramework(language: string): string {
    const frameworks: Record<string, string> = {
      typescript: 'Jest',
      javascript: 'Jest',
      python: 'pytest',
      java: 'JUnit',
      csharp: 'xUnit',
      go: 'testing package',
      rust: 'built-in test framework',
    };
    return frameworks[language.toLowerCase()] || 'appropriate testing framework';
  }
}

export class HealthAgent extends BaseAgent {
  constructor() {
    super({
      systemPrompt: `You are a technical evaluator. Respond factually and concisely to health check queries.

Assess the system's operational status and capabilities without hallucination.`,
    });
  }

  public getName(): string {
    return 'HealthAgent';
  }

  public async checkHealth(query: string, options: StreamOptions = {}): Promise<string> {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'user', content: query }
    ];

    return this.callLLM(messages, options);
  }
}