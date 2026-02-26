import type { BrowserInstallPhase, BrowserInstallState, BrowserName } from '@shared/types';
import type { BrowserInstallProgressState } from '../types';
import { panelClass, primaryButtonClass } from '../uiClasses';
import { statusClassName } from '../utils';

interface BrowserInstallScreenProps {
  browserStates: BrowserInstallState[];
  browserInstallProgress: Partial<Record<BrowserName, BrowserInstallProgressState>>;
  hasInstalledBrowser: boolean;
  onInstallBrowser: (browser: BrowserName) => void;
  onBackToWorkspace?: () => void;
}

export function BrowserInstallScreen({
  browserStates,
  browserInstallProgress,
  hasInstalledBrowser,
  onInstallBrowser,
  onBackToWorkspace,
}: BrowserInstallScreenProps): JSX.Element {
  return (
    <section className="flex h-full flex-col justify-center px-8 py-8">
      <div className={`${panelClass} mx-auto w-full max-w-[940px]`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-[#e8eff9]">Install browsers</h2>
            <p className="text-sm text-[#8f99a8]">Continue after installing at least one browser runtime.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary/80 px-3 py-1 text-[11px] text-[#bccadd]">Required</span>
            {onBackToWorkspace ? (
              <button
                type="button"
                className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-secondary-foreground transition hover:bg-secondary/80"
                onClick={onBackToWorkspace}
              >
                Back
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          {browserStates.map((state) => {
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

            const runtimeMessage = state.lastError ? state.lastError : `Status: ${installPhase === 'completed' ? 'installed' : 'not installed'}`;

            return (
              <div
                key={state.browser}
                className="grid items-center gap-3 rounded-md bg-background/55 px-3 py-2 sm:grid-cols-[160px_minmax(0,1fr)_auto]"
              >
                <div>
                  <p className="text-lg font-semibold capitalize text-[#e4edf9]">{state.browser}</p>
                  <p className="text-xs text-[#8b96a5]">{runtimeMessage}</p>
                </div>
                <span
                  className={`justify-self-start rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClassName(isInstalling ? 'installing' : isInstalled ? 'installed' : 'missing')}`}
                >
                  {isInstalling ? 'Installing' : isInstalled ? 'Installed' : 'Missing'}
                </span>
                {isInstalling ? (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/14 text-primary">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 animate-spin">
                      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
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
          })}

          {browserStates.length === 0 ? <p className="text-xs text-muted-foreground">Loading browser runtime status...</p> : null}
        </div>

        <div className="mt-4 flex justify-center">
          <span className="rounded-full bg-secondary/85 px-3 py-1 text-xs text-[#edf3fb]">
            {hasInstalledBrowser ? 'Ready' : 'Install at least one browser to continue'}
          </span>
        </div>
      </div>
    </section>
  );
}

