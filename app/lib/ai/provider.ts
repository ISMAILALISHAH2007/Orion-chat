import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';

export type ChatMode = 'casual' | 'developer' | 'research' | 'professional';
export type AIProviderName = 'openrouter' | 'gemini' | 'nvidia';

const DEFAULT_MODELS: Record<ChatMode, string> = {
  casual: 'google/lyria-3-pro-preview',
  developer: 'gemini-2.5-flash',
  research: 'meta/llama-3.1-8b-instruct',
  professional: 'meta/llama-3.1-70b-instruct',
};

const ENV_MODEL_KEYS: Record<ChatMode, string> = {
  casual: 'MODEL_CASUAL',
  developer: 'MODEL_DEVELOPER',
  research: 'MODEL_RESEARCH',
  professional: 'MODEL_PROFESSIONAL',
};

async function fetchWithTimeout(
  url: string | URL | Request,
  options?: RequestInit,
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const signal = options?.signal
    ? (AbortSignal.any ? AbortSignal.any([options.signal, controller.signal]) : controller.signal)
    : controller.signal;

  try {
    const response = await fetch(url, { ...options, signal });
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
      fetch: (url, init) => fetchWithTimeout(url, init, 3000), // Fail fast
    })
  : null;

const google = process.env.GEMINI_API_KEY
  ? createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    })
  : null;

const nvidia = process.env.NVIDIA_API_KEY
  ? createOpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
      fetch: (url, init) => fetchWithTimeout(url, init, 15000),
    })
  : null;

function resolveProvider(mode: ChatMode): AIProviderName {
  if (mode === 'casual' && openrouter) return 'openrouter';
  if (mode === 'developer' && google) return 'gemini';
  
  // High-tier workloads go to NVIDIA
  if ((mode === 'research' || mode === 'professional') && nvidia) return 'nvidia';
  
  if (google) return 'gemini';
  if (openrouter) return 'openrouter';
  return 'openrouter';
}

function getModelId(mode: ChatMode, provider: AIProviderName): string {
  if (provider === 'gemini') return process.env.MODEL_DEVELOPER || 'gemini-2.5-flash';
  if (provider === 'openrouter') return process.env.MODEL_CASUAL || 'google/lyria-3-pro-preview';
  
  if (provider === 'nvidia') {
    // Only these two models are guaranteed to work on all free NVIDIA keys without 404s
    if (mode === 'professional') return 'meta/llama-3.1-70b-instruct';
    return 'meta/llama-3.1-8b-instruct';
  }
  
  return DEFAULT_MODELS[mode];
}

export function getDefaultModelForMode(mode: string) {
  const m = (mode as ChatMode) in DEFAULT_MODELS ? (mode as ChatMode) : 'casual';
  const provider = resolveProvider(m);
  const modelId = getModelId(m, provider);

  if (provider === 'gemini' && google) return google(modelId);
  if (provider === 'nvidia' && nvidia) return nvidia.chat(modelId);
  if (provider === 'openrouter' && openrouter) return openrouter.chat(modelId);

  if (google) return google('gemini-2.5-flash');
  throw new Error('No AI provider configured.');
}

export function getHiddenFallbackModel(mode: string) {
  if (google) return google('gemini-2.5-flash');
  if (nvidia) return nvidia.chat('meta/llama-3.1-8b-instruct');
  if (openrouter) return openrouter.chat('openrouter/auto');
  throw new Error('No fallback AI provider configured.');
}

export function getVisionModel() {
  if (google) return google('gemini-2.5-flash');
  if (openrouter) return openrouter.chat('meta-llama/llama-3.2-90b-vision-instruct:free');
  throw new Error('No AI provider configured for vision.');
}

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