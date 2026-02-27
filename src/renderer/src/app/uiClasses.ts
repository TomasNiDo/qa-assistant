export const panelClass =
  'rounded-2xl bg-card/45 px-4 py-3 shadow-[0_20px_40px_-32px_hsl(220_70%_3%/0.9)] backdrop-blur-[2px]';

export const fieldClass =
  'w-full rounded-xl bg-background/55 px-3 py-2 text-xs text-foreground outline-none transition placeholder:text-muted-foreground focus:bg-background/75';

export const primaryButtonClass =
  'inline-flex h-8 items-center justify-center rounded-full bg-primary/95 px-3.5 text-[11px] font-semibold text-primary-foreground shadow-[0_12px_28px_-20px_hsl(220_86%_60%/0.9)] transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60';

export const mutedButtonClass =
  'inline-flex h-8 items-center justify-center rounded-full bg-secondary/50 px-3 text-[11px] font-medium text-secondary-foreground transition hover:bg-secondary/72 disabled:cursor-not-allowed disabled:opacity-60';

export const dangerButtonClass =
  'inline-flex h-8 items-center justify-center rounded-full bg-danger/10 px-3 text-[11px] font-medium text-danger transition hover:bg-danger/16 disabled:cursor-not-allowed disabled:opacity-60';

export const subtleButtonClass =
  'inline-flex h-8 items-center justify-center rounded-full bg-secondary/35 px-3 text-[11px] font-medium text-[#aebdd2] transition hover:bg-secondary/55 disabled:cursor-not-allowed disabled:opacity-60';

export const appShellClass =
  'grid h-screen w-screen grid-cols-[314px_minmax(0,1fr)] overflow-hidden bg-background';

export const onboardingShellClass = appShellClass;
