import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type QaAssistantApi } from '@shared/ipc';

const api: QaAssistantApi = {
  healthPing: () => ipcRenderer.invoke(IPC_CHANNELS.healthPing),
  configGet: () => ipcRenderer.invoke(IPC_CHANNELS.configGet),
  configSet: (input) => ipcRenderer.invoke(IPC_CHANNELS.configSet, input),
  seedSampleProject: () => ipcRenderer.invoke(IPC_CHANNELS.seedSampleProject),

  projectCreate: (input) => ipcRenderer.invoke(IPC_CHANNELS.projectCreate, input),
  projectUpdate: (input) => ipcRenderer.invoke(IPC_CHANNELS.projectUpdate, input),
  projectDelete: (id) => ipcRenderer.invoke(IPC_CHANNELS.projectDelete, id),
  projectList: () => ipcRenderer.invoke(IPC_CHANNELS.projectList),

  testCreate: (input) => ipcRenderer.invoke(IPC_CHANNELS.testCreate, input),
  testUpdate: (input) => ipcRenderer.invoke(IPC_CHANNELS.testUpdate, input),
  testDelete: (id) => ipcRenderer.invoke(IPC_CHANNELS.testDelete, id),
  testList: (projectId) => ipcRenderer.invoke(IPC_CHANNELS.testList, projectId),
  stepList: (testCaseId) => ipcRenderer.invoke(IPC_CHANNELS.stepList, testCaseId),
  stepParse: (rawText) => ipcRenderer.invoke(IPC_CHANNELS.stepParse, rawText),

  runStart: (input) => ipcRenderer.invoke(IPC_CHANNELS.runStart, input),
  runCancel: (runId) => ipcRenderer.invoke(IPC_CHANNELS.runCancel, runId),
  runStatus: (runId) => ipcRenderer.invoke(IPC_CHANNELS.runStatus, runId),
  runActiveContext: () => ipcRenderer.invoke(IPC_CHANNELS.runActiveContext),
  runHistory: (testCaseId) => ipcRenderer.invoke(IPC_CHANNELS.runHistory, testCaseId),
  stepResults: (runId) => ipcRenderer.invoke(IPC_CHANNELS.stepResults, runId),
  runGetScreenshotDataUrl: (screenshotPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.runGetScreenshotDataUrl, screenshotPath),
  runBrowserStatus: () => ipcRenderer.invoke(IPC_CHANNELS.runBrowserStatus),
  runInstallBrowser: (browser) => ipcRenderer.invoke(IPC_CHANNELS.runInstallBrowser, browser),
  onRunUpdate: (listener) => {
    const channel = IPC_CHANNELS.runUpdate;
    const wrapped = (_event: unknown, payload: unknown) => {
      listener(payload as Parameters<typeof listener>[0]);
    };

    ipcRenderer.on(channel, wrapped);

    return () => {
      ipcRenderer.removeListener(channel, wrapped);
    };
  },
  onBrowserInstallUpdate: (listener) => {
    const channel = IPC_CHANNELS.runBrowserInstallUpdate;
    const wrapped = (_event: unknown, payload: unknown) => {
      listener(payload as Parameters<typeof listener>[0]);
    };

    ipcRenderer.on(channel, wrapped);

    return () => {
      ipcRenderer.removeListener(channel, wrapped);
    };
  },

  aiGenerateSteps: (input) => ipcRenderer.invoke(IPC_CHANNELS.aiGenerateSteps, input),
  aiGenerateBugReport: (input) => ipcRenderer.invoke(IPC_CHANNELS.aiGenerateBugReport, input),
};

contextBridge.exposeInMainWorld('qaApi', api);
