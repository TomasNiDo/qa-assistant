import type { ThemeMode } from '../types';

interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-card/88 text-foreground shadow-[0_14px_40px_-24px_hsl(from_var(--primary)_h_s_l/0.9)] backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:bg-secondary/75 md:right-6 md:top-5"
      onClick={onToggle}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M12 4.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V5.25A.75.75 0 0 1 12 4.5Zm0 12.75a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V18a.75.75 0 0 1 .75-.75Zm7.5-5.25a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75Zm-12.75 0a.75.75 0 0 1-.75.75H4.5a.75.75 0 0 1 0-1.5H6a.75.75 0 0 1 .75.75Zm9.028-4.778a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06Zm-9.616 9.616a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06Zm11.736 1.06a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 1 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0Zm-9.616-9.616a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM12 8.25a3.75 3.75 0 1 1 0 7.5a3.75 3.75 0 0 1 0-7.5Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M14.5 3.2a.75.75 0 0 1 .76.96a7.25 7.25 0 1 0 8.58 8.58a.75.75 0 0 1 .96.76A9.25 9.25 0 1 1 14.5 3.2Z"
            fill="currentColor"
          />
        </svg>
      )}
    </button>
  );
}
