import { z } from 'zod';

export function nonEmptyTrimmedString(fieldMessage: string): z.ZodString {
  return z.string().trim().min(1, fieldMessage);
}

export const idSchema = nonEmptyTrimmedString('ID is required.');
export const browserSchema = z.enum(['chromium', 'firefox', 'webkit']);
export const urlSchema = z
  .string()
  .trim()
  .url('Base URL must be a valid URL including protocol (https://...).');

const metadataSchema = z.record(z.string());

const projectInputShape = {
  name: nonEmptyTrimmedString('Project name is required.'),
  baseUrl: urlSchema,
  envLabel: z.string().trim().optional(),
  metadata: metadataSchema.optional(),
};

function normalizeProjectInput<T extends { envLabel?: string }>(input: T): T & { envLabel: string } {
  return {
    ...input,
    envLabel: input.envLabel && input.envLabel.length > 0 ? input.envLabel : 'local',
  };
}

export const configSetInputSchema = z
  .object({
    defaultBrowser: browserSchema,
    stepTimeoutSeconds: z.number().finite('Step timeout must be a finite number.'),
    continueOnFailure: z.boolean(),
    enableSampleProjectSeed: z.boolean(),
  })
  .strict();

export const projectCreateInputSchema = z
  .object(projectInputShape)
  .strict()
  .transform((input) => normalizeProjectInput(input));

export const projectUpdateInputSchema = z
  .object({
    id: idSchema,
    ...projectInputShape,
  })
  .strict()
  .transform((input) => normalizeProjectInput(input));

export const projectDeleteIdSchema = idSchema;

export const testCreateInputSchema = z
  .object({
    projectId: idSchema,
    title: nonEmptyTrimmedString('Test title is required.'),
    steps: z
      .array(nonEmptyTrimmedString('Step cannot be empty.'))
      .min(1, 'At least one step is required.'),
  })
  .strict();

export const testUpdateInputSchema = z
  .object({
    id: idSchema,
    projectId: idSchema,
    title: nonEmptyTrimmedString('Test title is required.'),
    steps: z
      .array(nonEmptyTrimmedString('Step cannot be empty.'))
      .min(1, 'At least one step is required.'),
  })
  .strict();

export const testDeleteIdSchema = idSchema;
export const testListProjectIdSchema = idSchema;
export const stepListTestCaseIdSchema = idSchema;
export const stepParseRawTextSchema = z.string().trim();

export const runStartInputSchema = z
  .object({
    testCaseId: idSchema,
    browser: browserSchema,
  })
  .strict();

export const runCancelIdSchema = idSchema;
export const runStatusIdSchema = idSchema;
export const runHistoryTestCaseIdSchema = idSchema;
export const stepResultsRunIdSchema = idSchema;
export const runGetScreenshotPathSchema = nonEmptyTrimmedString('Screenshot path is required.');
export const runInstallBrowserSchema = browserSchema;

export const aiGenerateStepsInputSchema = z
  .object({
    title: nonEmptyTrimmedString('Test title is required.'),
    baseUrl: urlSchema,
    metadataJson: z.string().trim().optional(),
  })
  .strict();

export const aiGenerateBugReportInputSchema = z
  .object({
    runId: idSchema,
  })
  .strict();

export function parseIpcInput<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  payload: unknown,
  label: string,
): T {
  const parsed = schema.safeParse(payload);
  if (parsed.success) {
    return parsed.data;
  }

  const issue = parsed.error.issues[0];
  throw new Error(`Invalid ${label}: ${issue?.message ?? 'Invalid input.'}`);
}
