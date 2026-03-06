import type { ThemeMode } from '../types';

interface ThemeToggleProps {
  theme: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

function themeButtonClass(theme: ThemeMode, mode: ThemeMode): string {
  const isActive = theme === mode;
  const activeIconColor = mode === 'light' ? 'text-[#F8FAFC]' : 'text-[#0C0C0C]';
  const inactiveIconColor = theme === 'dark' ? 'text-[#737373]' : 'text-[#9CA3AF]';

  return [
    'inline-flex h-5 w-5 items-center justify-center rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
    isActive ? `bg-[#22C55E] ${activeIconColor}` : `bg-transparent ${inactiveIconColor}`,
  ].join(' ');
}

export function ThemeToggle({ theme, onChange }: ThemeToggleProps): JSX.Element {
  return (
    <div
      className={`inline-flex h-6 items-center gap-1.5 rounded-xl p-1 ${
        theme === 'dark' ? 'bg-[#1A1A1A]' : 'bg-[#E2E8F0]'
      }`}
      role="group"
      aria-label="Theme mode"
    >
      <button
        type="button"
        className={themeButtonClass(theme, 'light')}
        onClick={() => onChange('light')}
        aria-pressed={theme === 'light'}
        aria-label="Switch to light mode"
        title="Light mode"
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
          <path
            d="M12 3v2.5M12 18.5V21M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M3 12h2.5M18.5 12H21M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8M12 16a4 4 0 1 0 0-8a4 4 0 0 0 0 8Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <button
        type="button"
        className={themeButtonClass(theme, 'dark')}
        onClick={() => onChange('dark')}
        aria-pressed={theme === 'dark'}
        aria-label="Switch to dark mode"
        title="Dark mode"
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
          <path
            d="M12 3.5a8.5 8.5 0 1 0 8.4 10.1a8 8 0 1 1-8-10.1Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
