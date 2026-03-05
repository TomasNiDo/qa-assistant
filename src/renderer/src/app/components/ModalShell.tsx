import type { ReactNode } from 'react';

interface ModalShellProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  maxWidthClass?: string;
}

export function ModalShell({ title, children, onClose, maxWidthClass = 'max-w-[460px]' }: ModalShellProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-8">
      <div
        className={`w-full ${maxWidthClass} rounded-md border border-border bg-card px-4 py-4 shadow-[0_24px_72px_-30px_rgb(0_0_0/0.95)]`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
            aria-label="Close modal"
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
