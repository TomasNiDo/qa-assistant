import type { AppConfig } from '@shared/types';

interface HelloPageProps {
  healthStatus: string;
  config: AppConfig | null;
  onPing: () => Promise<void>;
  onLoadConfig: () => Promise<void>;
  onSaveConfig: () => Promise<void>;
  onUpdateConfig: (config: AppConfig) => void;
}

export function HelloPage(props: HelloPageProps): JSX.Element {
  const { healthStatus, config, onPing, onLoadConfig, onSaveConfig, onUpdateConfig } = props;

  return (
    <section className="panel">
      <h2>Hello</h2>
      <p>Use this screen to verify preload + IPC roundtrip and local config read/write helpers.</p>

      <div className="row">
        <button type="button" onClick={() => void onPing()}>
          Run Health Ping
        </button>
        <button type="button" onClick={() => void onLoadConfig()}>
          Load Config
        </button>
        <button type="button" onClick={() => void onSaveConfig()} disabled={!config}>
          Save Config
        </button>
      </div>

      <p>IPC roundtrip status: {healthStatus || 'not checked yet'}</p>

      {config ? (
        <div className="grid two">
          <label>
            Default Browser
            <select
              value={config.defaultBrowser}
              onChange={(event) =>
                onUpdateConfig({
                  ...config,
                  defaultBrowser: event.target.value as AppConfig['defaultBrowser'],
                })
              }
            >
              <option value="chromium">Chromium</option>
              <option value="firefox">Firefox</option>
              <option value="webkit">WebKit</option>
            </select>
          </label>

          <label>
            Step Timeout Seconds
            <input
              type="number"
              min={1}
              max={120}
              value={config.stepTimeoutSeconds}
              onChange={(event) =>
                onUpdateConfig({
                  ...config,
                  stepTimeoutSeconds: Number(event.target.value),
                })
              }
            />
          </label>

          <label>
            Continue On Failure
            <select
              value={String(config.continueOnFailure)}
              onChange={(event) =>
                onUpdateConfig({
                  ...config,
                  continueOnFailure: event.target.value === 'true',
                })
              }
            >
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </label>
        </div>
      ) : null}
    </section>
  );
}
