import { primaryButtonClass } from '../uiClasses';

interface ProjectSetupScreenProps {
  onBeginCreateProject: () => void;
}

export function ProjectSetupScreen({ onBeginCreateProject }: ProjectSetupScreenProps): JSX.Element {
  return (
    <section className="flex h-full items-center justify-center px-8 py-8">
      <div className="w-full max-w-[620px] space-y-4">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-[#112436]" />
          <h2 className="text-2xl font-semibold text-[#e8eff9]">Welcome to QA Assistant</h2>
          <p className="text-sm text-[#8fa0b8]">
            Create your first project to start writing and running automated test cases.
          </p>
          <button type="button" className={primaryButtonClass} onClick={onBeginCreateProject}>
            Create first project
          </button>
        </div>

        <div className="rounded-[10px] bg-[#0f1622]/80 px-4 py-3 text-xs">
          <p className="text-[#9db0c7]">Tip: Add your staging URL when creating a project.</p>
          <p className="mt-1 text-[#7f92aa]">Next: Add test cases, choose browser, then run.</p>
        </div>
      </div>
    </section>
  );
}

