import { app, clipboard, ipcMain, nativeImage, shell } from 'electron';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { IPC_CHANNELS } from '@shared/ipc';
import type { ApiResult } from '@shared/types';
import { validateRendererDevUrl } from '../security';
import {
  aiGenerateBugReportInputSchema,
  aiGenerateStepsInputSchema,
  copyImageToClipboardDataUrlSchema,
  configSetInputSchema,
  featureCreateInputSchema,
  featureDeleteIdSchema,
  featureListProjectIdSchema,
  featureUpdateInputSchema,
  generateFeatureScenariosInputSchema,
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
  testExecutionSummaryFeatureIdSchema,
  testListFeatureIdSchema,
  testValidateCustomCodeSyntaxSchema,
  testUpdateInputSchema,
} from './inputSchemas';
import type { Services } from '../services/services';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface RegisterHandlersOptions {
  installUpdateNow?: () => boolean | Promise<boolean>;
}

export function registerHandlers(services: Services, options: RegisterHandlersOptions = {}): void {
  ipcMain.handle(IPC_CHANNELS.healthPing, async () => wrap(() => 'pong'));
  ipcMain.handle(IPC_CHANNELS.appGetVersion, async () => wrap(() => app.getVersion()));
  ipcMain.handle(IPC_CHANNELS.copyImageToClipboard, async (_event, dataUrl) =>
    wrap(() => {
      const validated = parseIpcInput(
        copyImageToClipboardDataUrlSchema,
        dataUrl,
        'app.copyImageToClipboard payload',
      );
      const image = nativeImage.createFromDataURL(validated);
      if (image.isEmpty()) {
        throw new Error('Unable to decode image data for clipboard copy.');
      }

      clipboard.writeImage(image);
      return true;
    }),
  );
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
  ipcMain.handle(IPC_CHANNELS.featureCreate, async (_event, input) =>
    wrap(() => {
      const validated = parseIpcInput(featureCreateInputSchema, input, 'feature.create payload');
      return services.featureService.create(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.featureUpdate, async (_event, input) =>
    wrap(() => {
      const validated = parseIpcInput(featureUpdateInputSchema, input, 'feature.update payload');
      return services.featureService.update(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.featureDelete, async (_event, id) =>
    wrap(() => {
      const validated = parseIpcInput(featureDeleteIdSchema, id, 'feature.delete payload');
      return services.featureService.delete(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.featureList, async (_event, projectId) =>
    wrap(() => {
      const validated = parseIpcInput(
        featureListProjectIdSchema,
        projectId,
        'feature.list payload',
      );
      return services.featureService.list(validated);
    }),
  );

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
  ipcMain.handle(IPC_CHANNELS.testListByFeature, async (_event, featureId) =>
    wrap(() => {
      const validated = parseIpcInput(
        testListFeatureIdSchema,
        featureId,
        'test.listByFeature payload',
      );
      return services.testCaseService.listByFeature(validated);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.testExecutionSummaryByFeature, async (_event, featureId) =>
    wrap(() => {
      const validated = parseIpcInput(
        testExecutionSummaryFeatureIdSchema,
        featureId,
        'test.executionSummaryByFeature payload',
      );
      return services.testCaseService.executionSummaryByFeature(validated);
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
  ipcMain.handle(IPC_CHANNELS.testValidateCustomCodeSyntax, async (_event, customCode) =>
    wrap(() => {
      const validated = parseIpcInput(
        testValidateCustomCodeSyntaxSchema,
        customCode,
        'test.validateCustomCodeSyntax payload',
      );
      return services.testCaseService.validateCustomCodeSyntax(validated);
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
  ipcMain.handle(IPC_CHANNELS.openStepDocs, async () =>
    wrapAsync(async () => {
      await shell.openExternal(resolveStepDocsUrl());
      return true;
    }),
  );
  ipcMain.handle(IPC_CHANNELS.installUpdateNow, async () =>
    wrapAsync(async () => {
      if (!options.installUpdateNow) {
        throw new Error('In-app update install is unavailable in this build.');
      }

      return options.installUpdateNow();
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
  ipcMain.handle(IPC_CHANNELS.generateFeatureScenarios, async (_event, input) =>
    wrapAsync(async () => {
      const validated = parseIpcInput(
        generateFeatureScenariosInputSchema,
        input,
        'ai.generateFeatureScenarios payload',
      );
      const feature = services.featureService.getById(validated.featureId);
      if (!feature) {
        return {
          success: false as const,
          message: 'Feature not found.',
        };
      }

      const project = services.projectService.getById(feature.projectId);
      if (!project) {
        return {
          success: false as const,
          message: 'Project not found for selected feature.',
        };
      }

      const existingDraftTitles = services.testCaseService
        .listByFeature(feature.id)
        .filter((testCase) => testCase.planningStatus === 'drafted')
        .map((testCase) => testCase.title);

      try {
        const generated = await services.aiService.generateFeatureScenarioDrafts({
          projectName: project.name,
          featureTitle: feature.title,
          acceptanceCriteria: feature.acceptanceCriteria,
          existingDraftTitles,
        });

        if (generated.length === 0) {
          return {
            success: false as const,
            message: 'AI returned no valid scenarios.',
          };
        }

        const inserted = generated.map((scenario) =>
          services.testCaseService.create({
            featureId: feature.id,
            title: scenario.title,
            testType: scenario.type,
            priority: scenario.priority,
            planningStatus: 'drafted',
            isAiGenerated: true,
          }),
        );

        return {
          success: true as const,
          scenarios: inserted,
        };
      } catch (error) {
        return {
          success: false as const,
          message: toMessage(error),
        };
      }
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

function resolveStepDocsUrl(): string {
  const rawRendererUrl = process.env.ELECTRON_RENDERER_URL?.trim();
  if (rawRendererUrl) {
    const rendererDevUrl = validateRendererDevUrl(rawRendererUrl);
    return new URL('/step-guide.html', rendererDevUrl).toString();
  }

  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const candidates = [
    ...(resourcesPath ? [resolve(resourcesPath, 'step-guide.html')] : []),
    resolve(__dirname, '../../renderer/step-guide.html'),
    resolve(process.cwd(), 'out/renderer/step-guide.html'),
    resolve(process.cwd(), 'src/renderer/public/step-guide.html'),
  ];
  const docsPath = candidates.find((candidate) => existsSync(candidate));
  if (!docsPath) {
    throw new Error(`Step guide not found. Checked: ${candidates.join(', ')}`);
  }

  return pathToFileURL(docsPath).toString();
}
