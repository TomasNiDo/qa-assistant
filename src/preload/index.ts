import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type QaAssistantApi } from '@shared/ipc';

const api: QaAssistantApi = {
  healthPing: () => ipcRenderer.invoke(IPC_CHANNELS.healthPing),

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
  runHistory: (testCaseId) => ipcRenderer.invoke(IPC_CHANNELS.runHistory, testCaseId),
  stepResults: (runId) => ipcRenderer.invoke(IPC_CHANNELS.stepResults, runId),

  aiGenerateSteps: (input) => ipcRenderer.invoke(IPC_CHANNELS.aiGenerateSteps, input),
  aiGenerateBugReport: (input) => ipcRenderer.invoke(IPC_CHANNELS.aiGenerateBugReport, input),
};

contextBridge.exposeInMainWorld('qaApi', api);
