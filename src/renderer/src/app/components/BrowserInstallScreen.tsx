import type { BrowserInstallPhase, BrowserInstallState, BrowserName } from '@shared/types';
import type { BrowserInstallProgressState } from '../types';
import { panelClass, primaryButtonClass } from '../uiClasses';
import { statusClassName } from '../utils';

interface BrowserInstallScreenProps {
  browserStates: BrowserInstallState[];
  browserInstallProgress: Partial<Record<BrowserName, BrowserInstallProgressState>>;
  hasInstalledBrowser: boolean;
  onInstallBrowser: (browser: BrowserName) => void;
}

export function BrowserInstallScreen({
  browserStates,
  browserInstallProgress,
  hasInstalledBrowser,
  onInstallBrowser,
}: BrowserInstallScreenProps): JSX.Element {
  return (
    <section className="mx-auto w-full max-w-4xl">
      <div className={panelClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary/75">Step 1</p>
            <h2 className="mt-1 text-xl font-bold text-foreground">Install browsers</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              You can continue after installing at least one browser runtime.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-bold tracking-wide ${
                hasInstalledBrowser
                  ? 'border-success/60 bg-success/12 text-success'
                  : 'border-warning/60 bg-warning/15 text-warning-foreground'
              }`}
            >
              {hasInstalledBrowser ? 'Ready to continue' : 'Required'}
            </span>
          </div>
        </div>

        <div className="grid gap-2">
          {browserStates.length > 0 ? (
            browserStates.map((state) => {
              const progressState = browserInstallProgress[state.browser];
              const isInstalled = state.installed || progressState?.phase === 'completed';
              const hasActiveProgressPhase =
                progressState !== undefined &&
                progressState.phase !== 'idle' &&
                progressState.phase !== 'completed' &&
                progressState.phase !== 'failed';
              const isInstalling = !isInstalled && (state.installInProgress || hasActiveProgressPhase);
              const installPhase: BrowserInstallPhase = isInstalled
                ? 'completed'
                : progressState?.phase ?? (state.lastError ? 'failed' : isInstalling ? 'installing' : 'idle');
              const progressSuffix =
                isInstalled
                  ? ' (100%)'
                  : typeof progressState?.progress === 'number'
                    ? ` (${Math.round(progressState.progress)}%)`
                    : '';
              const runtimeMessage = state.lastError
                ? state.lastError
                : `Status: ${installPhase}${progressSuffix}`;

              return (
                <div
                  key={state.browser}
                  className="grid gap-2 rounded-2xl border border-border/85 bg-background/48 px-3.5 py-2.5 transition duration-200 hover:border-primary/30 hover:bg-background/66 sm:grid-cols-[110px_110px_minmax(0,1fr)_auto] sm:items-center"
                >
                  <span className="text-sm font-semibold capitalize text-foreground">{state.browser}</span>
                  <span
                    className={`inline-flex h-6 min-w-[6rem] items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-none ${statusClassName(isInstalling ? 'installing' : isInstalled ? 'installed' : 'missing')}`}
                  >
                    {isInstalling ? 'installing' : isInstalled ? 'installed' : 'missing'}
                  </span>
                  <span className="truncate text-xs font-medium text-muted-foreground">{runtimeMessage}</span>
                  {isInstalling ? (
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/55 bg-primary/10 text-primary">
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 animate-spin">
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          fill="none"
                          stroke="currentColor"
                          strokeOpacity="0.25"
                          strokeWidth="3"
                        />
                        <path
                          d="M12 3a9 9 0 0 1 9 9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  ) : isInstalled ? null : (
                    <button
                      type="button"
                      className={primaryButtonClass}
                      onClick={() => onInstallBrowser(state.browser)}
                    >
                      Install
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="rounded-xl border border-border bg-background/55 px-3 py-2 text-sm text-muted-foreground">
              Loading browser runtime status...
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
