import { google } from '@ai-sdk/google';

export type AIProviderName = 'gemini';

export function getProviderModel(provider: string, modelId: string) {
  // We strictly use gemini everywhere now
  return google(modelId || 'gemini-2.5-flash');
}

export function getDefaultModelForMode(mode: string) {
  switch (mode) {
    case 'developer':
      return getProviderModel('gemini', 'gemini-2.5-pro');
    case 'research':
      return getProviderModel('gemini', 'gemini-2.5-pro');
    case 'professional':
      return getProviderModel('gemini', 'gemini-2.5-pro');
    case 'casual':
    default:
      return getProviderModel('gemini', 'gemini-2.5-flash');
  }
}
