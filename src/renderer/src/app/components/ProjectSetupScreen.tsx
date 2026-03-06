import {
  helperTextClass,
  pageTitleClass,
  primaryButtonClass,
  sectionTitleClass,
} from '../uiClasses';

interface ProjectSetupScreenProps {
  onBeginCreateProject: () => void;
}

export function ProjectSetupScreen({ onBeginCreateProject }: ProjectSetupScreenProps): JSX.Element {
  return (
    <section className="flex h-full items-center justify-center px-8 py-8">
      <div className="w-full max-w-[620px] space-y-4">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-12 w-12 rounded-md border border-border bg-card" />
          <h2 className={pageTitleClass}>Welcome to QA Assistant</h2>
          <p className={helperTextClass}>
            Create your first project to start writing and running automated test cases.
          </p>
          <button type="button" className={primaryButtonClass} onClick={onBeginCreateProject}>
            Create first project
          </button>
        </div>

        <div className="rounded-md border border-border bg-card px-4 py-3 text-xs">
          <p className={sectionTitleClass}>Tip: Add your staging URL when creating a project.</p>
          <p className="mt-1 text-muted-foreground">Next: Add test cases, choose browser, then run.</p>
        </div>
      </div>
    </section>
  );
}
