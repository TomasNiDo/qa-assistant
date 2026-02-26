import { fieldClass, mutedButtonClass, primaryButtonClass } from '../uiClasses';
import { ModalShell } from './ModalShell';

interface BugReportModalProps {
  draft: string;
  setDraft: (value: string) => void;
  onClose: () => void;
  onCopy: () => void;
}

export function BugReportModal({ draft, setDraft, onClose, onCopy }: BugReportModalProps): JSX.Element {
  return (
    <ModalShell title="Bug Report Draft" onClose={onClose} maxWidthClass="max-w-[760px]">
      <div className="space-y-3">
        <textarea
          className={`${fieldClass} min-h-[320px] resize-y text-xs`}
          rows={16}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button type="button" className={mutedButtonClass} onClick={onClose}>
            Close
          </button>
          <button type="button" className={primaryButtonClass} onClick={onCopy}>
            Copy to Clipboard
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

