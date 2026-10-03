import { z } from 'zod';

export const ApiErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: ApiErrorBodySchema,
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export function apiSuccessSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
};

export function createApiSuccess<T>(data: T): ApiSuccessResponse<T> {
  return { success: true, data };
}
