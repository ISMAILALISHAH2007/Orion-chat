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

export const SLASH_COMMANDS = ['img', 'code', 'design', 'help'] as const;
export type SlashCommand = (typeof SLASH_COMMANDS)[number];

export const slashCommandSchema = z.object({
  command: z.enum(SLASH_COMMANDS),
  prompt: z.string(),
});

/** Detect image-generation intent in plain English (used in Developer mode). */
export const IMAGE_INTENT_REGEX =
  /^\s*(\/img\b)|(\b(draw|generate|render|create|make)\b.{0,40}\b(image|picture|illustration|photo|logo|icon|artwork|wallpaper|avatar)\b)/i;