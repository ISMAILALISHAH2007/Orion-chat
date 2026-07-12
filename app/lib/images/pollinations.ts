/**
 * Build a pollinations.ai image URL from a prompt.
 * Pollinations is free and keyless — used as the default image backend.
 * Uses the stable pollinations.ai image generation API.
 */
export function buildPollinationsImageUrl(prompt: string, seed?: number): string {
  const s = seed ?? Math.floor(Math.random() * 1_000_000);
  // Using the main pollinations.ai endpoint for image generation
  return (
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=1024&height=1024&nologo=true&seed=${s}&model=stable-diffusion`
  );
}
