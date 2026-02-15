import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/ipc';
import type { ApiResult } from '@shared/types';
import {
  aiGenerateBugReportInputSchema,
  aiGenerateStepsInputSchema,
  configSetInputSchema,
  parseIpcInput,
  projectCreateInputSchema,
  projectDeleteIdSchema,
  projectUpdateInputSchema,
  runCancelIdSchema,
  runGetScreenshotPathSchema,
  runGetScreenshotThumbnailPathSchema,
  runHistoryTestCaseIdSchema,
  runInstallBrowserSchema,
  runStartInputSchema,
  runStatusIdSchema,
  stepListTestCaseIdSchema,
  stepParseRawTextSchema,
  stepResultsRunIdSchema,
  testCreateInputSchema,
  testDeleteIdSchema,
  testListProjectIdSchema,
  testUpdateInputSchema,
} from './inputSchemas';
import type { Services } from '../services/services';

export function registerHandlers(services: Services): void {
  ipcMain.handle(IPC_CHANNELS.healthPing, async () => wrap(() => 'pong'));
  ipcMain.handle(IPC_CHANNELS.configGet, async () => wrap(() => services.configService.get()));
  ipcMain.handle(IPC_CHANNELS.configSet, async (_event, input) =>
    wrap(() => {
      const validated = parseIpcInput(configSetInputSchema, input, 'app.configSet payload');
      return services.configService.set(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.seedSampleProject, async () =>
    wrap(() => services.sampleSeedService.seedSampleProject()),
  );

  ipcMain.handle(IPC_CHANNELS.projectCreate, async (_event, input) =>
    wrap(() => {
      const validated = parseIpcInput(projectCreateInputSchema, input, 'project.create payload');
      return services.projectService.create(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.projectUpdate, async (_event, input) =>
    wrap(() => {
      const validated = parseIpcInput(projectUpdateInputSchema, input, 'project.update payload');
      return services.projectService.update(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.projectDelete, async (_event, id) =>
    wrap(() => {
      const validated = parseIpcInput(projectDeleteIdSchema, id, 'project.delete payload');
      return services.projectService.delete(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.projectList, async () => wrap(() => services.projectService.list()));

  ipcMain.handle(IPC_CHANNELS.testCreate, async (_event, input) =>
    wrap(() => {
      const validated = parseIpcInput(testCreateInputSchema, input, 'test.create payload');
      return services.testCaseService.create(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.testUpdate, async (_event, input) =>
    wrap(() => {
      const validated = parseIpcInput(testUpdateInputSchema, input, 'test.update payload');
      return services.testCaseService.update(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.testDelete, async (_event, id) =>
    wrap(() => {
      const validated = parseIpcInput(testDeleteIdSchema, id, 'test.delete payload');
      return services.testCaseService.delete(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.testList, async (_event, projectId) =>
    wrap(() => {
      const validated = parseIpcInput(testListProjectIdSchema, projectId, 'test.list payload');
      return services.testCaseService.list(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.stepList, async (_event, testCaseId) =>
    wrap(() => {
      const validated = parseIpcInput(
        stepListTestCaseIdSchema,
        testCaseId,
        'step.list payload',
      );
      return services.testCaseService.listSteps(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.stepParse, async (_event, rawText) =>
    wrap(() => {
      const validated = parseIpcInput(stepParseRawTextSchema, rawText, 'step.parse payload');
      return services.parserService.parse(validated);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.runStart, async (_event, input) =>
    wrap(() => {
      const validated = parseIpcInput(runStartInputSchema, input, 'run.start payload');
      return services.runService.start(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.runCancel, async (_event, runId) =>
    wrap(() => {
      const validated = parseIpcInput(runCancelIdSchema, runId, 'run.cancel payload');
      return services.runService.cancel(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.runStatus, async (_event, runId) =>
    wrap(() => {
      const validated = parseIpcInput(runStatusIdSchema, runId, 'run.status payload');
      return services.runService.status(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.runActiveContext, async () =>
    wrap(() => services.runService.activeContext()),
  );
  ipcMain.handle(IPC_CHANNELS.runHistory, async (_event, testCaseId) =>
    wrap(() => {
      const validated = parseIpcInput(
        runHistoryTestCaseIdSchema,
        testCaseId,
        'run.history payload',
      );
      return services.runService.history(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.stepResults, async (_event, runId) =>
    wrap(() => {
      const validated = parseIpcInput(stepResultsRunIdSchema, runId, 'run.stepResults payload');
      return services.runService.stepResults(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.runGetScreenshotDataUrl, async (_event, screenshotPath) =>
    wrap(() => {
      const validated = parseIpcInput(
        runGetScreenshotPathSchema,
        screenshotPath,
        'run.getScreenshotDataUrl payload',
      );
      return services.runService.getScreenshotDataUrl(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.runGetScreenshotThumbnailDataUrl, async (_event, screenshotPath) =>
    wrap(() => {
      const validated = parseIpcInput(
        runGetScreenshotThumbnailPathSchema,
        screenshotPath,
        'run.getScreenshotThumbnailDataUrl payload',
      );
      return services.runService.getScreenshotThumbnailDataUrl(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.runBrowserStatus, async () =>
    wrap(() => services.runService.browserStatuses()),
  );
  ipcMain.handle(IPC_CHANNELS.runInstallBrowser, async (_event, browser) =>
    wrapAsync(() => {
      const validated = parseIpcInput(
        runInstallBrowserSchema,
        browser,
        'run.installBrowser payload',
      );
      return services.runService.installBrowser(validated);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.aiGenerateSteps, async (_event, input) =>
    wrapAsync(() => {
      const validated = parseIpcInput(
        aiGenerateStepsInputSchema,
        input,
        'ai.generateSteps payload',
      );
      return services.aiService.generateSteps(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.aiGenerateBugReport, async (_event, input) =>
    wrapAsync(() => {
      const validated = parseIpcInput(
        aiGenerateBugReportInputSchema,
        input,
        'ai.generateBugReport payload',
      );
      return services.aiService.generateBugReport(validated);
    }),
  );
}

function wrap<T>(fn: () => T): ApiResult<T> {
  try {
    return { ok: true, data: fn() };
  } catch (error) {
    return { ok: false, error: { message: toMessage(error) } };
  }
}

async function wrapAsync<T>(fn: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: { message: toMessage(error) } };
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
