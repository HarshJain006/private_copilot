// src/services/llmService.ts
import { OpenAI } from 'openai';
import type {
  ChatCompletionChunk,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionCreateParams,
} from 'openai/resources/chat/completions';
import type { ChatCompletionMessageParam, StreamOptions } from '../types';
import { ConfigManager } from './config';

export class LLMService {
  private static instance: LLMService;
  private client: OpenAI | null = null;
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;

  private constructor() {
    this.initializeClient();
  }

  public static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService();
    }
    return LLMService.instance;
  }

  private initializeClient(): void {
    try {
      const config = ConfigManager.getInstance().getConfig();
      this.client = new OpenAI({
        baseURL: config.apiBaseUrl,
        apiKey: config.apiKey,
      });
      console.log('LLM Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LLM client:', error);
      throw error;
    }
  }

  public reinitialize(): void {
    this.client = null;
    this.initializeClient();
  }

  public async complete(
    messages: ChatCompletionMessageParam[],
    options: StreamOptions = {}
  ): Promise<string> {
    if (!this.client) {
      throw new Error('LLM client not initialized');
    }

    const config = ConfigManager.getInstance().getConfig();
    const { signal, onChunk, onComplete, onError } = options;

    try {
      if (onChunk) {
        return await this.streamCompletion(messages, config, signal, onChunk);
      } else {
        return await this.nonStreamCompletion(messages, config);
      }
    } catch (error: any) {
      if (onError) {
        onError(error);
      }
      
      const msg = String(error?.message ?? error);
      if ((msg.includes('connect') || msg.includes('ECONNREFUSED')) && this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        console.log(`Connection failed, retrying... (${this.retryCount}/${this.MAX_RETRIES})`);
        await this.delay(1000 * this.retryCount);
        return this.complete(messages, options);
      }
      
      this.retryCount = 0;
      throw error;
    }
  }

  private async streamCompletion(
    messages: ChatCompletionMessageParam[],
    config: any,
    signal?: AbortSignal,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const streamArgs: ChatCompletionCreateParamsStreaming = {
      model: config.modelName,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: true,
    };

    const stream = await this.client!.chat.completions.create(streamArgs, { signal });
    let fullResponse = '';

    for await (const chunk of stream as AsyncIterable<ChatCompletionChunk>) {
      const content = chunk.choices?.[0]?.delta?.content || '';
      if (content) {
        fullResponse += content;
        if (onChunk) {
          onChunk(content);
        }
      }
    }

    this.retryCount = 0;
    return fullResponse;
  }

  private async nonStreamCompletion(
    messages: ChatCompletionMessageParam[],
    config: any
  ): Promise<string> {
    const args: ChatCompletionCreateParams = {
      model: config.modelName,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    };

    const response = await this.client!.chat.completions.create(args);
    this.retryCount = 0;
    return response.choices?.[0]?.message?.content || '';
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public isInitialized(): boolean {
    return this.client !== null;
  }
}