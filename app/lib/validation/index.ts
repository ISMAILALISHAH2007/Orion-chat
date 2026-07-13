import { z } from 'zod';

export const chatMessageSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  mode: z.enum(['casual', 'developer', 'research', 'professional']).default('casual'),
});

export const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const SLASH_COMMANDS = ['img', 'video', 'code', 'design', 'help'] as const;
export type SlashCommand = (typeof SLASH_COMMANDS)[number];

export const slashCommandSchema = z.object({
  command: z.enum(SLASH_COMMANDS),
  prompt: z.string(),
});

/** Detect image-generation intent in plain English. */
export const IMAGE_INTENT_REGEX =
  /^\s*(\/img\b)|(\b(draw|generate|render|create|make|build)\b.{0,60}\b(image|picture|illustration|photo|logo|icon|artwork|wallpaper|avatar|img|pic|art)\b)/i;

/** Detect video-generation intent. */
export const VIDEO_INTENT_REGEX =
  /^\s*(\/video\b)|(\b(generate|create|make|animate|render)\b.{0,40}\b(video|animation|gif|mp4|clip)\b)/i;