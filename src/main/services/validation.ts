import { z } from 'zod';

const urlSchema = z.string().url();

export function validateBaseUrl(baseUrl: string): void {
  const parsed = urlSchema.safeParse(baseUrl);
  if (!parsed.success) {
    throw new Error('Base URL must be a valid URL including protocol (https://...).');
  }
}

export function safeMetadataJson(metadata?: Record<string, string>): string {
  return JSON.stringify(metadata ?? {});
}
