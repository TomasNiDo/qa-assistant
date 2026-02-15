import type { AppConfig } from '@shared/types';
import { panelClass } from '../uiClasses';

interface WorkspaceDefaultsPanelProps {
  appConfig: AppConfig | null;
}

export function WorkspaceDefaultsPanel({ appConfig }: WorkspaceDefaultsPanelProps): JSX.Element {
  return (
    <section className={panelClass}>
      <h3 className="text-sm font-bold tracking-wide text-foreground">Workspace defaults</h3>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <p>Default browser: {appConfig?.defaultBrowser ?? 'chromium'}</p>
        <p>Model target: gemini-2.5-flash</p>
        <p>Local DB only: enabled</p>
      </div>
    </section>
  );
}
