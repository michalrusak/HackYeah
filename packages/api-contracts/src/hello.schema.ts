import { z } from 'zod';
import { apiSuccessSchema } from './response.types.js';

export const HelloDataSchema = z.object({
  message: z.string(),
});

export type HelloData = z.infer<typeof HelloDataSchema>;

export const HelloResponseSchema = apiSuccessSchema(HelloDataSchema);

export type HelloResponse = z.infer<typeof HelloResponseSchema>;
