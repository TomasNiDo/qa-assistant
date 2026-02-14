import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@shared/ipc';
import type { ApiResult } from '@shared/types';
import type { Services } from '../services/services';

export function registerHandlers(services: Services): void {
  ipcMain.handle(IPC_CHANNELS.healthPing, async () => wrap(() => 'pong'));
  ipcMain.handle(IPC_CHANNELS.configGet, async () => wrap(() => services.configService.get()));
  ipcMain.handle(IPC_CHANNELS.configSet, async (_event, input) =>
    wrap(() => services.configService.set(input)),
  );

  ipcMain.handle(IPC_CHANNELS.projectCreate, async (_event, input) =>
    wrap(() => services.projectService.create(input)),
  );
  ipcMain.handle(IPC_CHANNELS.projectUpdate, async (_event, input) =>
    wrap(() => services.projectService.update(input)),
  );
  ipcMain.handle(IPC_CHANNELS.projectDelete, async (_event, id) =>
    wrap(() => services.projectService.delete(id)),
  );
  ipcMain.handle(IPC_CHANNELS.projectList, async () => wrap(() => services.projectService.list()));

  ipcMain.handle(IPC_CHANNELS.testCreate, async (_event, input) =>
    wrap(() => services.testCaseService.create(input)),
  );
  ipcMain.handle(IPC_CHANNELS.testUpdate, async (_event, input) =>
    wrap(() => services.testCaseService.update(input)),
  );
  ipcMain.handle(IPC_CHANNELS.testDelete, async (_event, id) =>
    wrap(() => services.testCaseService.delete(id)),
  );
  ipcMain.handle(IPC_CHANNELS.testList, async (_event, projectId) =>
    wrap(() => services.testCaseService.list(projectId)),
  );
  ipcMain.handle(IPC_CHANNELS.stepList, async (_event, testCaseId) =>
    wrap(() => services.testCaseService.listSteps(testCaseId)),
  );
  ipcMain.handle(IPC_CHANNELS.stepParse, async (_event, rawText) =>
    wrap(() => services.parserService.parse(rawText)),
  );

  ipcMain.handle(IPC_CHANNELS.runStart, async (_event, input) =>
    wrap(() => services.runService.start(input)),
  );
  ipcMain.handle(IPC_CHANNELS.runCancel, async (_event, runId) =>
    wrap(() => services.runService.cancel(runId)),
  );
  ipcMain.handle(IPC_CHANNELS.runStatus, async (_event, runId) =>
    wrap(() => services.runService.status(runId)),
  );
  ipcMain.handle(IPC_CHANNELS.runHistory, async (_event, testCaseId) =>
    wrap(() => services.runService.history(testCaseId)),
  );
  ipcMain.handle(IPC_CHANNELS.stepResults, async (_event, runId) =>
    wrap(() => services.runService.stepResults(runId)),
  );

  ipcMain.handle(IPC_CHANNELS.aiGenerateSteps, async (_event, input) =>
    wrapAsync(() => services.aiService.generateSteps(input)),
  );
  ipcMain.handle(IPC_CHANNELS.aiGenerateBugReport, async (_event, input) =>
    wrapAsync(() => services.aiService.generateBugReport(input)),
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
