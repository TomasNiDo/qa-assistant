import type { UpdateStatusEvent } from '@shared/types';
import { mutedButtonClass, panelClass, primaryButtonClass } from '../uiClasses';

interface UpdateBannerProps {
  event: UpdateStatusEvent;
  canInstallNow: boolean;
  isInstalling: boolean;
  onDismiss: () => void;
  onInstallNow: () => void;
}

export function UpdateBanner({
  event,
  canInstallNow,
  isInstalling,
  onDismiss,
  onInstallNow,
}: UpdateBannerProps): JSX.Element {
  return (
    <section className={`${panelClass} sticky top-3 z-40 border-primary/45 bg-card/94 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary/80">Application update</p>
          <h2 className="mt-1 text-base font-bold text-foreground">
            {event.phase === 'downloaded' ? 'Update ready to install' : 'Update in progress'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {event.message}
            {event.version ? ` (v${event.version})` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canInstallNow ? (
            <button
              type="button"
              className={primaryButtonClass}
              onClick={onInstallNow}
              disabled={isInstalling}
              aria-busy={isInstalling}
            >
              {isInstalling ? 'Restarting...' : 'Restart to update'}
            </button>
          ) : null}
          <button type="button" className={mutedButtonClass} onClick={onDismiss} aria-label="Dismiss update banner">
            Dismiss
          </button>
        </div>
      </div>

      {event.phase === 'downloading' && event.progressPercent !== null && event.progressPercent !== undefined ? (
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/70">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${Math.max(0, Math.min(100, event.progressPercent))}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Download progress: {Math.max(0, Math.min(100, event.progressPercent)).toFixed(1)}%
          </p>
        </div>
      ) : null}
    </section>
  );
}
