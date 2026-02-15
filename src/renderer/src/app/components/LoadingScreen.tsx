import { panelClass } from '../uiClasses';

export function LoadingScreen(): JSX.Element {
  return (
    <section className="mx-auto w-full max-w-2xl">
      <div className={panelClass}>
        <h2 className="text-lg font-bold text-foreground">Loading workspace</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Checking local browser runtime status...</p>
      </div>
    </section>
  );
}
