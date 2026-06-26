import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

export type AIProviderName = 'openai' | 'anthropic' | 'gemini' | 'nvidia';

// Fallback rotator for the NVIDIA API keys
const getNvidiaKey = () => {
  return process.env.NVIDIA_API_KEY_1 ||
         process.env.NVIDIA_API_KEY_2 ||
         process.env.NVIDIA_API_KEY_3 ||
         process.env.NVIDIA_API_KEY_4 ||
         process.env.NVIDIA_API_KEY_5 ||
         '';
};

const nvidia = createOpenAI({
  apiKey: getNvidiaKey(),
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

export function getProviderModel(provider: string, modelId: string) {
  // If we request nvidia, use the nvidia custom OpenAI client
  if (provider === 'nvidia') {
    return nvidia(modelId);
  }

  // Fallbacks using standard environment keys
  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    return openai(modelId);
  }
  if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    return anthropic(modelId);
  }
  if (provider === 'gemini' && (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY)) {
    return google(modelId);
  }

  // Resilient fallback to nvidia using configured keys
  return nvidia('meta/llama-3.3-70b-instruct');
}

export function getDefaultModelForMode(mode: string) {
  switch (mode) {
    case 'developer':
      return getProviderModel('nvidia', 'meta/llama-3.3-70b-instruct');
    case 'research':
      return getProviderModel('nvidia', 'meta/llama-3.3-70b-instruct');
    case 'professional':
      return getProviderModel('nvidia', 'meta/llama-3.3-70b-instruct');
    case 'casual':
    default:
      return getProviderModel('nvidia', 'meta/llama-3.1-8b-instruct');
  }
}
