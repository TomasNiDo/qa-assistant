/// <reference types="vite/client" />

import type { QaAssistantApi } from '@shared/ipc';

declare global {
  interface Window {
    qaApi: QaAssistantApi;
  }
}

export {};
