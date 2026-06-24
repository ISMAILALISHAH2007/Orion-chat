import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export type AIProviderName = 'openai' | 'anthropic' | 'gemini';

export function getProviderModel(provider: AIProviderName, modelId: string) {
  switch (provider) {
    case 'openai':
      return openai(modelId);
    case 'anthropic':
      return anthropic(modelId);
    case 'gemini':
      return google(modelId);
    default:
      return openai('gpt-4o');
  }
}

export function getDefaultModelForMode(mode: string) {
  switch (mode) {
    case 'developer':
      return getProviderModel('anthropic', 'claude-3-5-sonnet-20240620');
    case 'research':
      return getProviderModel('openai', 'o1-preview');
    case 'casual':
    default:
      return getProviderModel('openai', 'gpt-4o-mini');
  }
}
