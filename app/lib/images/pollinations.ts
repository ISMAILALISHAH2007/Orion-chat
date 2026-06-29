/**
 * Build a pollinations.ai image URL from a prompt.
 * Pollinations is free and keyless — used as the default image backend.
 */
export function buildPollinationsImageUrl(prompt: string, seed?: number): string {
  const s = seed ?? Math.floor(Math.random() * 1_000_000);
  return (
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=1024&height=1024&nologo=true&seed=${s}`
  );
}