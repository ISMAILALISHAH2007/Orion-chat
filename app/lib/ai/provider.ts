import { createGoogleGenerativeAI } from '@ai-sdk/google';

export type AIProviderName = 'gemini';

const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

export function getProviderModel(provider: string, modelId: string) {
  // We strictly use gemini everywhere now
  return googleProvider(modelId || 'gemini-2.5-flash');
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
