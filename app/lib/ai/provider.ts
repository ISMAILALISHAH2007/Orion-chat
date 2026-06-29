import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

// Modes the chat route understands. Keep in sync with app/lib/validation.
export type ChatMode = 'casual' | 'developer' | 'research' | 'professional';

// Default model IDs 
const DEFAULT_MODELS: Record<ChatMode, string> = {
  casual: 'meta-llama/llama-3.3-70b-instruct:free',
  developer: 'nvidia/nemotron-3-super-120b-a12b:free',
  research: 'google/gemini-2.5-flash:free',
  professional: 'nousresearch/hermes-3-llama-3.1-405b:free',
};

const ENV_MODEL_KEYS: Record<ChatMode, string> = {
  casual: 'MODEL_CASUAL',
  developer: 'MODEL_DEVELOPER',
  research: 'MODEL_RESEARCH',
  professional: 'MODEL_PROFESSIONAL',
};

export type AIProviderName = 'openrouter' | 'gemini';

const openrouterApiKey = process.env.OPENROUTER_API_KEY ?? '';

const openrouter = openrouterApiKey
  ? createOpenRouter({
      apiKey: openrouterApiKey,
      baseURL: process.env.OPENROUTER_BASE_URL,
      appName: 'ULTRON',
      appUrl: process.env.NEXTAUTH_URL ?? 'http://localhost:8000',
    })
  : null;

const google = process.env.GEMINI_API_KEY
  ? createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const nvidia = process.env.NVIDIA_API_KEY
  ? createOpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    })
  : null;

function resolveProvider(): AIProviderName {
  if (google) return 'gemini';
  if (openrouter) return 'openrouter';
  return 'openrouter';
}

function getModelId(mode: ChatMode): string {
  // If using Gemini, ignore OpenRouter env vars and use optimal Gemini models
  if (google) {
    switch (mode) {
      case 'casual': return 'gemini-2.5-flash';
      case 'developer': return 'gemini-2.5-pro';
      case 'research': return 'gemini-2.5-pro';
      case 'professional': return 'gemini-2.5-flash';
    }
  }
  
  const envKey = ENV_MODEL_KEYS[mode];
  return process.env[envKey]?.trim() || DEFAULT_MODELS[mode];
}

/**
 * Get a model instance for a given mode.
 */
export function getDefaultModelForMode(mode: string) {
  const m = (mode as ChatMode) in DEFAULT_MODELS ? (mode as ChatMode) : 'casual';
  const modelId = getModelId(m);
  
  if (google) {
    return google(modelId);
  }

  if (openrouter) {
    return openrouter.chat(modelId);
  }

  throw new Error('No AI provider configured. Set GEMINI_API_KEY in .env.local.');
}

/**
 * Get a fallback model instance if the primary fails.
 */
export function getHiddenFallbackModel(mode: string) {
  if (nvidia) {
    // NVIDIA fallback models
    switch (mode as ChatMode) {
      case 'casual': return nvidia.chat('meta/llama-3.1-8b-instruct');
      case 'developer': return nvidia.chat('nvidia/llama-3.1-nemotron-70b-instruct');
      case 'research': return nvidia.chat('nvidia/nemotron-4-340b-instruct');
      case 'professional': return nvidia.chat('meta/llama-3.1-70b-instruct');
      default: return nvidia.chat('meta/llama-3.1-8b-instruct');
    }
  }
  
  if (openrouter) {
    return openrouter.chat(getModelId(mode as ChatMode));
  }
  
  throw new Error('No fallback AI provider configured.');
}

/**
 * Get a specific vision-capable model.
 */
export function getVisionModel() {
  if (google) {
    return google('gemini-2.5-flash');
  }
  if (openrouter) {
    return openrouter.chat('google/gemini-2.5-flash:free');
  }
  throw new Error('No AI provider configured for vision.');
}

/** Read-only inspection helpers — used by debug panels and admin views. */
export function getActiveProvider(): AIProviderName {
  return resolveProvider();
}

export function getModelsByMode(): Record<ChatMode, string> {
  return {
    casual: getModelId('casual'),
    developer: getModelId('developer'),
    research: getModelId('research'),
    professional: getModelId('professional'),
  };
}