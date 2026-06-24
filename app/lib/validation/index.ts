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
