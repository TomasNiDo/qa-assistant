export const panelClass =
  'rounded-md border border-border bg-card px-4 py-3 shadow-[var(--shadow-soft)]';

export const fieldClass =
  'w-full rounded-md border border-border bg-input px-3 py-2 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60';

export const primaryButtonClass =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-success/60 bg-primary px-3.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-success hover:border-success active:bg-success/88 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/40 disabled:cursor-not-allowed disabled:opacity-60';

export const mutedButtonClass =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-[11px] font-medium text-secondary-foreground transition-colors hover:border-border-strong hover:text-foreground hover:bg-muted/45 active:bg-muted/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60';

export const dangerButtonClass =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-danger/45 bg-danger/12 px-3 text-[11px] font-medium text-danger transition-colors hover:bg-danger/18 hover:border-danger/60 active:bg-danger/26 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/28 disabled:cursor-not-allowed disabled:opacity-60';

export const subtleButtonClass =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-[11px] font-medium text-secondary-foreground transition-colors hover:border-border-strong hover:text-foreground hover:bg-muted/45 active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60';

export const appShellClass =
  'grid h-screen w-screen grid-cols-[280px_minmax(0,1fr)] overflow-hidden bg-background';

export const onboardingShellClass = appShellClass;

export const pageSectionClass = `${panelClass} space-y-3`;

export const pageTitleClass = 'text-2xl font-semibold tracking-tight text-foreground';
export const pageSubtitleClass = 'text-xs text-secondary-foreground';
export const sectionTitleClass = 'text-[13px] font-semibold text-foreground';
export const fieldLabelClass = 'block text-xs font-semibold text-secondary-foreground';
export const helperTextClass = 'text-xs text-muted-foreground';

export const tagClass =
  'inline-flex items-center rounded-md border border-info/30 bg-info/12 px-2 py-0.5 text-[10px] font-semibold text-info';
export const aiTagClass =
  'inline-flex items-center rounded-md border border-purple/35 bg-purple/14 px-2 py-0.5 text-[10px] font-semibold text-purple';

export const listRowClass =
  'flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 transition-colors hover:border-border-strong';

export const sidebarActionButtonClass =
  'inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-secondary-foreground transition-colors hover:border-border-strong hover:text-foreground hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25';
