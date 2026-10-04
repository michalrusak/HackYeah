import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ErrorCodes,
  OpenRouterCompletionSchema,
  type ErrorCode,
} from '@repo/api-contracts';
import type { JsonSchema } from '../pipes/zod-validation.pipe.js';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 60_000;

export class AiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
  ) {
    super(code);
    this.name = 'AiError';
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompleteJsonOptions<T> {
  /** Nazwa schematu przekazywana OpenRouterowi, np. `idea_expansion`. */
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  resultSchema: JsonSchema<T>;
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  /** Etykieta w logu telemetrycznym. */
  event: string;
}

export interface GeneratedImage {
  mimeType: string;
  data: Buffer;
  model: string;
  /** Tekst zwrócony razem z obrazem — używany jako opis alternatywny. */
  text: string;
}

/**
 * Generyczny klient OpenRoutera dla modułów poza matchmakingiem. Zachowuje
 * zachowanie oryginalnego `OpenRouterService`: jedno żądanie, bez streamingu
 * i bez ponowień, twardy timeout i telemetria bez treści użytkownika.
 */
@Injectable()
export class OpenRouterClient {
  private readonly logger = new Logger(OpenRouterClient.name);

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async completeJson<T>(options: CompleteJsonOptions<T>): Promise<T> {
    const body = {
      model: this.textModel(),
      stream: false,
      max_tokens: options.maxTokens ?? 1500,
      reasoning: { enabled: false },
      provider: { require_parameters: true, allow_fallbacks: false },
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: options.schemaName,
          strict: true,
          schema: options.jsonSchema,
        },
      },
      messages: [
        { role: 'system', content: options.system },
        ...options.messages,
      ],
    };

    const payload = await this.request(body, options.event);
    const completion = OpenRouterCompletionSchema.safeParse(payload);
    if (!completion.success) {
      throw new AiError(ErrorCodes.AI_INVALID_RESPONSE, 502);
    }
    const choice = completion.data.choices[0];
    if (!choice || choice.finish_reason !== 'stop') {
      throw new AiError(ErrorCodes.AI_INVALID_RESPONSE, 502);
    }
    let content: unknown;
    try {
      content = JSON.parse(choice.message.content);
    } catch {
      throw new AiError(ErrorCodes.AI_INVALID_RESPONSE, 502);
    }
    const parsed = options.resultSchema.safeParse(content);
    if (!parsed.success) {
      throw new AiError(ErrorCodes.AI_INVALID_RESPONSE, 502);
    }
    return parsed.data;
  }

  async generateImage(prompt: string, event: string): Promise<GeneratedImage> {
    const model = this.config.get<string>(
      'OPENROUTER_IMAGE_MODEL',
      'google/gemini-2.5-flash-image-preview',
    );
    const payload = await this.request(
      {
        model,
        stream: false,
        modalities: ['image', 'text'],
        messages: [{ role: 'user', content: prompt }],
      },
      event,
    );
    const image = readGeneratedImage(payload);
    if (!image) throw new AiError(ErrorCodes.AI_INVALID_RESPONSE, 502);
    return { ...image, model };
  }

  private textModel(): string {
    return this.config.get<string>('OPENROUTER_MODEL', 'qwen/qwen3.8-27b');
  }

  private async request(
    body: Record<string, unknown>,
    event: string,
  ): Promise<unknown> {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let status = 'error';
    try {
      const key = this.config.get<string>('OPENROUTER_API_KEY')?.trim();
      if (!key) throw new AiError(ErrorCodes.AI_NOT_CONFIGURED, 503);
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        this.logger.error(`OpenRouter error HTTP ${response.status}: ${errBody}`);
        throw new AiError(
          response.status === 429
            ? ErrorCodes.RATE_LIMIT
            : ErrorCodes.AI_UNAVAILABLE,
          response.status === 429 ? 429 : 503,
        );
      }
      let parsed: unknown;
      try {
        parsed = await response.json();
      } catch {
        throw new AiError(ErrorCodes.AI_INVALID_RESPONSE, 502);
      }
      status = 'ok';
      return parsed;
    } catch (error) {
      const failure = controller.signal.aborted
        ? new AiError(ErrorCodes.AI_TIMEOUT, 504)
        : error instanceof AiError
          ? error
          : new AiError(ErrorCodes.AI_UNAVAILABLE, 503);
      status = failure.code;
      throw failure;
    } finally {
      clearTimeout(timeout);
      // Telemetria nie zawiera treści użytkownika ani odpowiedzi modelu.
      this.logger.log({
        event,
        durationMs: Date.now() - started,
        status,
      });
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Wyciąga obraz data-URL z odpowiedzi modelu obrazkowego OpenRoutera. */
function readGeneratedImage(
  payload: unknown,
): { mimeType: string; data: Buffer; text: string } | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return null;
  const choice = payload.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) return null;
  const message = choice.message;
  const text = typeof message.content === 'string' ? message.content.trim() : '';
  if (!Array.isArray(message.images)) return null;
  const first = message.images[0];
  if (!isRecord(first) || !isRecord(first.image_url)) return null;
  const url = first.image_url.url;
  if (typeof url !== 'string') return null;
  const match = /^data:([^;]+);base64,(.+)$/.exec(url);
  if (!match?.[1] || !match[2]) return null;
  return {
    mimeType: match[1],
    data: Buffer.from(match[2], 'base64'),
    text,
  };
}
