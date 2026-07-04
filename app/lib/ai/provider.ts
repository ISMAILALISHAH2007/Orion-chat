import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

// Modes the chat route understands. Keep in sync with app/lib/validation.
export type ChatMode = 'casual' | 'developer' | 'research' | 'professional';

// Default model IDs for OpenRouter
const DEFAULT_MODELS: Record<ChatMode, string> = {
  casual: 'gemini-2.5-flash',
  developer: 'gemini-2.5-flash',
  research: 'gemini-2.5-flash',
  professional: 'gemini-2.5-flash',
};

const ENV_MODEL_KEYS: Record<ChatMode, string> = {
  casual: 'MODEL_CASUAL',
  developer: 'MODEL_DEVELOPER',
  research: 'MODEL_RESEARCH',
  professional: 'MODEL_PROFESSIONAL',
};

export type AIProviderName = 'openrouter' | 'gemini';

// Helper for fetch timeout to prevent API hangs and slow responses
async function fetchWithTimeout(
  url: string | URL | Request,
  options?: RequestInit,
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  // If the SDK passes a signal, we want to abort if EITHER the SDK aborts OR our timeout fires
  const signal = options?.signal
    ? (AbortSignal.any ? AbortSignal.any([options.signal, controller.signal]) : controller.signal)
    : controller.signal;

  try {
    const response = await fetch(url, {
      ...options,
      signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`API Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

const openrouterApiKey = process.env.OPENROUTER_API_KEY ?? '';

const openrouter = openrouterApiKey
  ? createOpenRouter({
    apiKey: openrouterApiKey,
    baseURL: process.env.OPENROUTER_BASE_URL,
    appName: 'ULTRON',
    appUrl: process.env.NEXTAUTH_URL ?? 'http://localhost:8000',
    fetch: (url, init) => fetchWithTimeout(url, init, 60000), // 60 seconds timeout
  })
  : null;

const google = process.env.GEMINI_API_KEY
  ? createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    fetch: (url, init) => fetchWithTimeout(url, init, 60000), // 60 seconds timeout
  })
  : null;

const nvidia = process.env.NVIDIA_API_KEY
  ? createOpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: 'https://integrate.api.nvidia.com/v1',
    fetch: (url, init) => fetchWithTimeout(url, init, 30000), // 30 seconds timeout for fallback
  })
  : null;

function resolveProvider(mode: ChatMode): AIProviderName {
  // OpenRouter is rate-limited out; route EVERYTHING to native Gemini
  if (google) return 'gemini';
  if (openrouter) return 'openrouter';
  return 'openrouter';
}

function getModelId(mode: ChatMode, provider: AIProviderName): string {
  const envKey = ENV_MODEL_KEYS[mode];
  const envModel = process.env[envKey]?.trim();

  if (envModel) return envModel;

  if (provider === 'gemini') {
    return 'gemini-2.5-pro';
  }
  return DEFAULT_MODELS[mode];
}

/**
 * Get a model instance for a given mode.
 */
export function getDefaultModelForMode(mode: string) {
  const m = (mode as ChatMode) in DEFAULT_MODELS ? (mode as ChatMode) : 'casual';
  const provider = resolveProvider(m);
  const modelId = getModelId(m, provider);

  if (provider === 'gemini' && google) {
    return google(modelId);
  }

  if (openrouter) {
    return openrouter.chat(modelId);
  }

  if (google) {
    return google('gemini-2.5-flash');
  }

  throw new Error('No AI provider configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY in .env.local.');
}

/**
 * Get a fallback model instance if the primary fails.
 */
export function getHiddenFallbackModel(mode: string) {
  if (nvidia) {
    // NVIDIA fallback models (using meta/llama-3.1-8b-instruct for high speed and reliability)
    switch (mode as ChatMode) {
      case 'casual': return nvidia.chat('meta/llama-3.1-8b-instruct');
      case 'developer': return nvidia.chat('meta/llama-3.1-8b-instruct');
      case 'research': return nvidia.chat('meta/llama-3.1-8b-instruct');
      case 'professional': return nvidia.chat('meta/llama-3.1-8b-instruct');
      default: return nvidia.chat('meta/llama-3.1-8b-instruct');
    }
  }

  // If NVIDIA is not available, try the other primary provider
  const m = (mode as ChatMode) in DEFAULT_MODELS ? (mode as ChatMode) : 'casual';
  const primaryProvider = resolveProvider(m);
  const fallbackProvider = primaryProvider === 'gemini' ? 'openrouter' : 'gemini';
  const modelId = getModelId(m, fallbackProvider);

  if (fallbackProvider === 'openrouter' && openrouter) {
    return openrouter.chat(modelId);
  }
  if (fallbackProvider === 'gemini' && google) {
    return google(modelId);
  }

  // If we only have OpenRouter and it's the primary, use a hardcoded ultra-reliable free fallback
  if (openrouter) {
    return openrouter.chat('openrouter/auto');
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
    // Free vision endpoint that reliably supports image payloads
    return openrouter.chat('meta-llama/llama-3.2-90b-vision-instruct:free');
  }
  throw new Error('No AI provider configured for vision.');
}

/** Read-only inspection helpers — used by debug panels and admin views. */
export function getActiveProvider(mode?: string): AIProviderName {
  const m = (mode as ChatMode) in DEFAULT_MODELS ? (mode as ChatMode) : 'casual';
  return resolveProvider(m);
}

export function getModelsByMode(): Record<ChatMode, string> {
  return {
    casual: getModelId('casual', resolveProvider('casual')),
    developer: getModelId('developer', resolveProvider('developer')),
    research: getModelId('research', resolveProvider('research')),
    professional: getModelId('professional', resolveProvider('professional')),
  };
}