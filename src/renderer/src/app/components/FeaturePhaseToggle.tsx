interface FeaturePhaseToggleProps {
  activePhase: 'planning' | 'execution';
  onChangePhase: (phase: 'planning' | 'execution') => void;
  canOpenExecution: boolean;
}

export function FeaturePhaseToggle({
  activePhase,
  onChangePhase,
  canOpenExecution,
}: FeaturePhaseToggleProps): JSX.Element {
  return (
    <div className="inline-flex rounded-md border border-border bg-card p-1">
      <button
        type="button"
        className={`min-w-[108px] rounded-sm px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 ${
          activePhase === 'planning'
            ? 'bg-primary text-primary-foreground'
            : 'text-secondary-foreground hover:bg-muted/55 hover:text-foreground'
        }`}
        onClick={() => onChangePhase('planning')}
      >
        Planning
      </button>
      <button
        type="button"
        className={`min-w-[108px] rounded-sm px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 ${
          activePhase === 'execution'
            ? 'bg-primary text-primary-foreground'
            : 'text-secondary-foreground hover:bg-muted/55 hover:text-foreground'
        }`}
        onClick={() => onChangePhase('execution')}
        disabled={!canOpenExecution}
        title={
          canOpenExecution
            ? 'Open execution'
            : 'Save the feature first to open execution'
        }
      >
        Execution
      </button>
    </div>
  );
}
