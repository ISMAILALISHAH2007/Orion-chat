/**
 * Free AI image generation using pollinations.ai.
 * Pollinations is free and keyless — used as the default image backend.
 * 
 * Architecture:
 * - Builds image URLs for multiple models as fallbacks
 * - Verifies the URL actually returns an image before returning
 * - Uses exponential backoff retry for reliability
 * - Returns a fallback URL even if verification fails (best-effort)
 */

// Available models on pollinations.ai (in order of preference)
export const IMAGE_MODELS = ['flux', 'turbo', 'stable-diffusion', 'any-dark'] as const;
export type ImageModel = (typeof IMAGE_MODELS)[number];

export interface ImageResult {
  url: string;
  model: ImageModel;
  verified: boolean;
}

/**
 * Build a pollinations.ai image URL from a prompt using a specific model.
 * Pollinations generates images on-the-fly when the URL is accessed.
 */
export function buildPollinationsImageUrl(
  prompt: string,
  options?: {
    model?: ImageModel;
    width?: number;
    height?: number;
    seed?: number;
  }
): string {
  const model = options?.model || 'flux';
  const width = options?.width || 1024;
  const height = options?.height || 1024;
  const seed = options?.seed ?? Math.floor(Math.random() * 1_000_000);

  // Remove nologo=true since it requires an account
  return (
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${width}&height=${height}&seed=${seed}&model=${model}&enhance=false`
  );
}

/**
 * Verify that an image URL actually returns a valid image.
 * Performs a HEAD request to check the response status.
 * Falls back to GET if HEAD is not supported.
 */
async function verifyImageUrl(url: string, timeoutMs = 8000): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // First try HEAD (faster)
    const headRes = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    if (headRes.ok) return true;

    // If HEAD fails (some CDNs block it), try GET with range
    const getRes = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Range: 'bytes=0-0' }, // Just fetch first byte
    });

    return getRes.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generate an image URL with retry logic across multiple models.
 * 
 * Strategy:
 * 1. Try each model in order (flux → turbo → stable-diffusion → any-dark)
 * 2. For each model, retry up to RETRY_COUNT times with exponential backoff
 * 3. After getting a URL, verify it returns an actual image
 * 4. If all models fail, return the best-effort URL from the primary model
 * 
 * Returns an ImageResult with the URL, model used, and whether it was verified.
 */
export async function generateImageWithFallback(
  prompt: string,
  options?: {
    preferredModel?: ImageModel;
    retryCount?: number;
    verifyTimeout?: number;
  }
): Promise<ImageResult> {
  const retryCount = options?.retryCount ?? 2;
  const verifyTimeout = options?.verifyTimeout ?? 8000;
  const preferredModel = options?.preferredModel;

  // Order models: preferred first, then the rest
  const models = preferredModel
    ? [preferredModel, ...IMAGE_MODELS.filter(m => m !== preferredModel)]
    : [...IMAGE_MODELS];

  // Try each model with retries
  for (const model of models) {
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const url = buildPollinationsImageUrl(prompt, { model });

        // On last attempt, skip verification and return best-effort
        const isLastAttempt =
          model === models[models.length - 1] && attempt === retryCount;

        if (isLastAttempt) {
          console.warn(
            `[Pollinations] All models failed, returning best-effort URL for "${prompt.substring(0, 50)}..."`
          );
          return { url, model, verified: false };
        }

        // Verify the URL returns a real image
        const verified = await verifyImageUrl(url, verifyTimeout);

        if (verified) {
          console.log(
            `[Pollinations] Image generated with model ${model} (attempt ${attempt + 1})`
          );
          return { url, model, verified: true };
        }

        // Verification failed — log and retry
        console.warn(
          `[Pollinations] Model ${model} attempt ${attempt + 1} failed verification`
        );

        // Exponential backoff: 1s, 2s, 3s...
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
        }
      } catch (err) {
        console.error(
          `[Pollinations] Model ${model} attempt ${attempt + 1} error:`,
          err instanceof Error ? err.message : err
        );

        // Wait before retry
        if (attempt < retryCount) {
          await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
        }
      }
    }
  }

  // Ultimate fallback: return a URL from the primary model without verification
  const fallbackUrl = buildPollinationsImageUrl(prompt, { model: 'flux' });
  return { url: fallbackUrl, model: 'flux', verified: false };
}

/**
 * Quick check if the Pollinations service is currently available.
 * Hits the models endpoint which acts as a health check.
 */
export async function checkPollinationsHealth(timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://image.pollinations.ai/models', {
      signal: controller.signal,
      headers: { 'User-Agent': 'ORION/1.0' },
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
