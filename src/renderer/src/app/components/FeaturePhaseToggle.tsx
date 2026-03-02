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
    <div className="inline-flex rounded-full border border-[#223247]/70 bg-[#101826]/80 p-1">
      <button
        type="button"
        className={`min-w-[112px] rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
          activePhase === 'planning'
            ? 'bg-[#1a2b40] text-[#dce8f8]'
            : 'text-[#92a8c2] hover:bg-[#152335]/80 hover:text-[#c7d7ec]'
        }`}
        onClick={() => onChangePhase('planning')}
      >
        Planning
      </button>
      <button
        type="button"
        className={`min-w-[112px] rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
          activePhase === 'execution'
            ? 'bg-primary/95 text-primary-foreground'
            : 'text-[#92a8c2] hover:bg-[#152335]/80 hover:text-[#c7d7ec]'
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
