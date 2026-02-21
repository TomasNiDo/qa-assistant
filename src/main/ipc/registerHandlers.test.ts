import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { IPC_CHANNELS } from '@shared/ipc';
import { registerHandlers } from './registerHandlers';
import type { Services } from '../services/services';

const { ipcMainHandleMock, shellOpenExternalMock } = vi.hoisted(() => ({
  ipcMainHandleMock: vi.fn(),
  shellOpenExternalMock: vi.fn(async () => undefined),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: ipcMainHandleMock,
  },
  shell: {
    openExternal: shellOpenExternalMock,
  },
}));

type Handler = (event: unknown, payload?: unknown) => Promise<unknown>;

function createServicesMock() {
  const projectCreate = vi.fn((input: { name: string; baseUrl: string; envLabel: string }) => ({
    id: 'project-1',
    name: input.name,
    baseUrl: input.baseUrl,
    envLabel: input.envLabel,
    metadataJson: '{}',
    createdAt: '2025-01-01T00:00:00.000Z',
  }));

  const testCreate = vi.fn((input: { title: string; steps: string[]; projectId: string }) => ({
    id: 'test-1',
    projectId: input.projectId,
    title: input.title,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  }));

  const runStart = vi.fn((input: { testCaseId: string; browser: 'chromium' | 'firefox' | 'webkit' }) => ({
    id: 'run-1',
    testCaseId: input.testCaseId,
    browser: input.browser,
    status: 'running',
    startedAt: '2025-01-01T00:00:00.000Z',
    endedAt: null,
  }));
  const runInstallBrowser = vi.fn(async (browser: 'chromium' | 'firefox' | 'webkit') => ({
    browser,
    installed: true,
    installInProgress: false,
    executablePath: null,
    lastError: null,
  }));
  const aiGenerateSteps = vi.fn(async () => []);

  const services = {
    configService: {
      get: vi.fn(() => ({
        defaultBrowser: 'chromium',
        stepTimeoutSeconds: 10,
        continueOnFailure: false,
        enableSampleProjectSeed: false,
      })),
      set: vi.fn((input) => input),
    },
    sampleSeedService: {
      seedSampleProject: vi.fn(() => ({
        project: {
          id: 'project-seed-1',
          name: 'Sample QA Project',
          baseUrl: 'https://example.com',
          envLabel: 'local',
          metadataJson: '{}',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        testCase: {
          id: 'test-seed-1',
          projectId: 'project-seed-1',
          title: 'Sample login flow',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
        createdProject: true,
        createdTestCase: true,
      })),
    },
    projectService: {
      create: projectCreate,
      update: vi.fn((input) => ({
        id: input.id,
        name: input.name,
        baseUrl: input.baseUrl,
        envLabel: input.envLabel,
        metadataJson: '{}',
        createdAt: '2025-01-01T00:00:00.000Z',
      })),
      delete: vi.fn(() => true),
      list: vi.fn(() => []),
      getById: vi.fn(() => null),
    },
    testCaseService: {
      create: testCreate,
      update: vi.fn((input) => ({
        id: input.id,
        projectId: input.projectId,
        title: input.title,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      })),
      delete: vi.fn(() => true),
      list: vi.fn(() => []),
      listSteps: vi.fn(() => []),
      getById: vi.fn(() => null),
    },
    parserService: {
      parse: vi.fn(() => ({
        ok: true,
        source: 'strict',
        action: { type: 'click', target: 'Continue' },
      })),
    },
    runService: {
      setRunUpdateEmitter: vi.fn(),
      setBrowserInstallUpdateEmitter: vi.fn(),
      start: runStart,
      cancel: vi.fn(() => true),
      status: vi.fn(() => null),
      activeContext: vi.fn(() => null),
      history: vi.fn(() => []),
      stepResults: vi.fn(() => []),
      getScreenshotDataUrl: vi.fn(() => 'data:image/png;base64,AAA'),
      getScreenshotThumbnailDataUrl: vi.fn(() => 'data:image/jpeg;base64,THUMB'),
      browserStatuses: vi.fn(() => []),
      installBrowser: runInstallBrowser,
    },
    aiService: {
      generateSteps: aiGenerateSteps,
      generateBugReport: vi.fn(async () => ({
        title: 'Bug title',
        environment: 'local | chromium | https://example.com',
        stepsToReproduce: [],
        expectedResult: 'Expected',
        actualResult: 'Actual',
        evidence: [],
      })),
    },
  } as unknown as Services;

  const spies = {
    projectCreate,
    testCreate,
    runStart,
    runInstallBrowser,
    aiGenerateSteps,
  };

  return {
    services,
    spies,
  };
}

function getRegisteredHandler(channel: string): Handler {
  const call = ipcMainHandleMock.mock.calls.find(([registeredChannel]) => registeredChannel === channel);
  if (!call) {
    throw new Error(`Handler for channel "${channel}" was not registered.`);
  }

  return call[1] as Handler;
}

async function invoke(channel: string, payload?: unknown): Promise<unknown> {
  const handler = getRegisteredHandler(channel);
  return handler({}, payload);
}

describe('registerHandlers IPC input validation', () => {
  beforeEach(() => {
    ipcMainHandleMock.mockReset();
    shellOpenExternalMock.mockReset();
    shellOpenExternalMock.mockResolvedValue(undefined);
  });

  it('rejects blank project name payloads', async () => {
    const { services, spies } = createServicesMock();
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.projectCreate, {
      name: '   ',
      baseUrl: 'https://example.com',
    });

    expect(result).toEqual({
      ok: false,
      error: { message: expect.stringContaining('Invalid project.create payload: Project name is required.') },
    });
    expect(spies.projectCreate).not.toHaveBeenCalled();
  });

  it('rejects invalid project baseUrl payloads', async () => {
    const { services, spies } = createServicesMock();
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.projectCreate, {
      name: 'Checkout',
      baseUrl: 'example.com',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        message: expect.stringContaining(
          'Invalid project.create payload: Base URL must be a valid URL including protocol (https://...).',
        ),
      },
    });
    expect(spies.projectCreate).not.toHaveBeenCalled();
  });

  it('rejects blank test title payloads', async () => {
    const { services, spies } = createServicesMock();
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.testCreate, {
      projectId: 'project-1',
      title: '   ',
      steps: ['Click "Continue"'],
    });

    expect(result).toEqual({
      ok: false,
      error: { message: expect.stringContaining('Invalid test.create payload: Test title is required.') },
    });
    expect(spies.testCreate).not.toHaveBeenCalled();
  });

  it('rejects empty step lists', async () => {
    const { services, spies } = createServicesMock();
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.testCreate, {
      projectId: 'project-1',
      title: 'Checkout flow',
      steps: [],
    });

    expect(result).toEqual({
      ok: false,
      error: { message: expect.stringContaining('Invalid test.create payload: At least one step is required.') },
    });
    expect(spies.testCreate).not.toHaveBeenCalled();
  });

  it('rejects step entries that become empty after trimming', async () => {
    const { services, spies } = createServicesMock();
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.testCreate, {
      projectId: 'project-1',
      title: 'Checkout flow',
      steps: ['   ', 'Click "Continue"'],
    });

    expect(result).toEqual({
      ok: false,
      error: { message: expect.stringContaining('Invalid test.create payload: Step cannot be empty.') },
    });
    expect(spies.testCreate).not.toHaveBeenCalled();
  });

  it('rejects unknown keys on strict object payloads', async () => {
    const { services, spies } = createServicesMock();
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.projectCreate, {
      name: 'Checkout',
      baseUrl: 'https://example.com',
      extra: 'not-allowed',
    });

    expect(result).toEqual({
      ok: false,
      error: { message: expect.stringContaining('Invalid project.create payload: Unrecognized key(s) in object') },
    });
    expect(spies.projectCreate).not.toHaveBeenCalled();
  });

  it('accepts and normalizes whitespace-padded payloads', async () => {
    const { services, spies } = createServicesMock();
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.projectCreate, {
      name: '  Checkout  ',
      baseUrl: '  https://example.com/path  ',
      envLabel: '   ',
      metadata: { team: 'qa' },
    });

    expect(result).toEqual({ ok: true, data: expect.any(Object) });
    expect(spies.projectCreate).toHaveBeenCalledWith({
      name: 'Checkout',
      baseUrl: 'https://example.com/path',
      envLabel: 'local',
      metadata: { team: 'qa' },
    });
  });

  it('keeps success path behavior for valid payloads', async () => {
    const { services, spies } = createServicesMock();
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.runStart, {
      testCaseId: '  test-1  ',
      browser: 'chromium',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'run-1',
        testCaseId: 'test-1',
        browser: 'chromium',
        status: 'running',
        startedAt: '2025-01-01T00:00:00.000Z',
        endedAt: null,
      },
    });
    expect(spies.runStart).toHaveBeenCalledWith({
      testCaseId: 'test-1',
      browser: 'chromium',
    });
  });

  it('registers thumbnail screenshot handler and returns data for valid payloads', async () => {
    const { services } = createServicesMock();
    registerHandlers(services);

    const runService = services.runService as unknown as {
      getScreenshotThumbnailDataUrl: ReturnType<typeof vi.fn>;
    };

    const result = await invoke(IPC_CHANNELS.runGetScreenshotThumbnailDataUrl, '  /tmp/shot.png  ');

    expect(result).toEqual({
      ok: true,
      data: 'data:image/jpeg;base64,THUMB',
    });
    expect(runService.getScreenshotThumbnailDataUrl).toHaveBeenCalledWith('/tmp/shot.png');
  });

  it('validates thumbnail screenshot payloads before invoking service', async () => {
    const { services } = createServicesMock();
    registerHandlers(services);

    const runService = services.runService as unknown as {
      getScreenshotThumbnailDataUrl: ReturnType<typeof vi.fn>;
    };

    const result = await invoke(IPC_CHANNELS.runGetScreenshotThumbnailDataUrl, '   ');

    expect(result).toEqual({
      ok: false,
      error: {
        message: expect.stringContaining(
          'Invalid run.getScreenshotThumbnailDataUrl payload: Screenshot path is required.',
        ),
      },
    });
    expect(runService.getScreenshotThumbnailDataUrl).not.toHaveBeenCalled();
  });

  it('shapes sync service exceptions into ApiResult errors', async () => {
    const { services, spies } = createServicesMock();
    spies.projectCreate.mockImplementationOnce(() => {
      throw new Error('project write failed');
    });
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.projectCreate, {
      name: 'Checkout',
      baseUrl: 'https://example.com',
    });

    expect(result).toEqual({
      ok: false,
      error: { message: 'project write failed' },
    });
  });

  it('shapes async service rejections into ApiResult errors', async () => {
    const { services, spies } = createServicesMock();
    spies.aiGenerateSteps.mockRejectedValueOnce(new Error('AI unavailable'));
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.aiGenerateSteps, {
      title: 'Checkout flow',
      baseUrl: 'https://example.com',
    });

    expect(result).toEqual({
      ok: false,
      error: { message: 'AI unavailable' },
    });
  });

  it('validates async payloads before invoking services', async () => {
    const { services, spies } = createServicesMock();
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.aiGenerateSteps, {
      title: 'Checkout flow',
      baseUrl: 'example.com',
    });

    expect(result).toEqual({
      ok: false,
      error: {
        message: expect.stringContaining(
          'Invalid ai.generateSteps payload: Base URL must be a valid URL including protocol (https://...).',
        ),
      },
    });
    expect(spies.aiGenerateSteps).not.toHaveBeenCalled();
  });

  it('accepts valid async payloads and forwards validated values', async () => {
    const { services, spies } = createServicesMock();
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.runInstallBrowser, 'firefox');

    expect(result).toEqual({
      ok: true,
      data: {
        browser: 'firefox',
        installed: true,
        installInProgress: false,
        executablePath: null,
        lastError: null,
      },
    });
    expect(spies.runInstallBrowser).toHaveBeenCalledWith('firefox');
  });

  it('opens step docs in default browser', async () => {
    const { services } = createServicesMock();
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.openStepDocs);

    expect(result).toEqual({
      ok: true,
      data: true,
    });
    expect(shellOpenExternalMock).toHaveBeenCalledTimes(1);
    expect(shellOpenExternalMock).toHaveBeenCalledWith(expect.stringContaining('step-guide.html'));
  });

  it('installs downloaded updates when install callback is configured', async () => {
    const { services } = createServicesMock();
    const installUpdateNow = vi.fn(() => true);
    registerHandlers(services, { installUpdateNow });

    const result = await invoke(IPC_CHANNELS.installUpdateNow);

    expect(result).toEqual({
      ok: true,
      data: true,
    });
    expect(installUpdateNow).toHaveBeenCalledTimes(1);
  });

  it('returns error when in-app update install is unavailable', async () => {
    const { services } = createServicesMock();
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.installUpdateNow);

    expect(result).toEqual({
      ok: false,
      error: { message: 'In-app update install is unavailable in this build.' },
    });
  });

  it('prefers docs from process.resourcesPath when available', async () => {
    const { services } = createServicesMock();
    const docsDir = mkdtempSync(join(tmpdir(), 'qa-assistant-docs-'));
    const docsPath = join(docsDir, 'step-guide.html');
    const previousResourcesPath = (process as NodeJS.Process & { resourcesPath?: string })
      .resourcesPath;
    writeFileSync(docsPath, '<!doctype html><title>Step Guide</title>', 'utf8');

    (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath = docsDir;

    try {
      registerHandlers(services);

      const result = await invoke(IPC_CHANNELS.openStepDocs);

      expect(result).toEqual({
        ok: true,
        data: true,
      });
      expect(shellOpenExternalMock).toHaveBeenCalledWith(pathToFileURL(docsPath).toString());
    } finally {
      if (previousResourcesPath === undefined) {
        Reflect.deleteProperty(process as unknown as Record<string, unknown>, 'resourcesPath');
      } else {
        (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath =
          previousResourcesPath;
      }
      rmSync(docsDir, { force: true, recursive: true });
    }
  });

  it('returns API errors when opening step docs fails', async () => {
    const { services } = createServicesMock();
    shellOpenExternalMock.mockRejectedValueOnce(new Error('browser open failed'));
    registerHandlers(services);

    const result = await invoke(IPC_CHANNELS.openStepDocs);

    expect(result).toEqual({
      ok: false,
      error: { message: 'browser open failed' },
    });
  });
});
