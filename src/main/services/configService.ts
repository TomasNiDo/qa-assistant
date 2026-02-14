import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { AppConfig } from '@shared/types';

const DEFAULT_CONFIG: AppConfig = {
  defaultBrowser: 'chromium',
  stepTimeoutSeconds: 10,
  continueOnFailure: false,
  enableSampleProjectSeed: false,
};

export class ConfigService {
  constructor(private readonly configFile: string) {}

  get(): AppConfig {
    if (!existsSync(this.configFile)) {
      this.save(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.configFile, 'utf8')) as Partial<AppConfig>;
      return sanitizeConfig(parsed);
    } catch {
      this.save(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }
  }

  set(input: AppConfig): AppConfig {
    const sanitized = sanitizeConfig(input);
    this.save(sanitized);
    return sanitized;
  }

  private save(config: AppConfig): void {
    writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf8');
  }
}

function sanitizeConfig(input: Partial<AppConfig>): AppConfig {
  const defaultBrowser =
    input.defaultBrowser === 'chromium' ||
    input.defaultBrowser === 'firefox' ||
    input.defaultBrowser === 'webkit'
      ? input.defaultBrowser
      : DEFAULT_CONFIG.defaultBrowser;

  const timeout = Number(input.stepTimeoutSeconds);
  const stepTimeoutSeconds = Number.isFinite(timeout)
    ? Math.max(1, Math.min(120, Math.round(timeout)))
    : DEFAULT_CONFIG.stepTimeoutSeconds;

  return {
    defaultBrowser,
    stepTimeoutSeconds,
    continueOnFailure: Boolean(input.continueOnFailure),
    enableSampleProjectSeed: Boolean(input.enableSampleProjectSeed),
  };
}
