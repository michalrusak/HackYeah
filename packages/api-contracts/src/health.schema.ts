import { z } from 'zod';
import { apiSuccessSchema } from './response.types.js';

export const HealthDataSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
  database: z.enum(['up', 'down']),
});

export type HealthData = z.infer<typeof HealthDataSchema>;

export const HealthResponseSchema = apiSuccessSchema(HealthDataSchema);

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
