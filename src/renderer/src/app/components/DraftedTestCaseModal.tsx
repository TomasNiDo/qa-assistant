import type { Dispatch, SetStateAction } from 'react';
import type { TestPriority, TestType } from '@shared/types';
import { fieldClass, mutedButtonClass, primaryButtonClass } from '../uiClasses';
import { ModalShell } from './ModalShell';

export interface DraftedTestCaseFormState {
  id: string;
  title: string;
  testType: TestType;
  priority: TestPriority;
}

interface DraftedTestCaseModalProps {
  mode: 'create' | 'edit';
  form: DraftedTestCaseFormState;
  setForm: Dispatch<SetStateAction<DraftedTestCaseFormState>>;
  titleError: string | null;
  onClose: () => void;
  onSubmit: () => void;
}

export function DraftedTestCaseModal({
  mode,
  form,
  setForm,
  titleError,
  onClose,
  onSubmit,
}: DraftedTestCaseModalProps): JSX.Element {
  return (
    <ModalShell title={mode === 'create' ? 'Add Test Case' : 'Edit Test Case'} onClose={onClose}>
      <div className="space-y-3">
        <label className="block space-y-1 text-xs font-semibold text-[#a9b9d1]">
          Title
          <input
            className={fieldClass}
            value={form.title}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, title: event.target.value }))
            }
            placeholder="Checkout applies promo and captures payment"
          />
          {titleError ? <span className="text-[11px] text-danger">{titleError}</span> : null}
        </label>

        <label className="block space-y-1 text-xs font-semibold text-[#a9b9d1]">
          Priority
          <select
            className={fieldClass}
            value={form.priority}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                priority: event.target.value as TestPriority,
              }))
            }
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label className="block space-y-1 text-xs font-semibold text-[#a9b9d1]">
          Test Type
          <select
            className={fieldClass}
            value={form.testType}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                testType: event.target.value as TestType,
              }))
            }
          >
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="edge">Edge</option>
          </select>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={mutedButtonClass} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButtonClass} onClick={onSubmit}>
            {mode === 'create' ? 'Create Test Case' : 'Save Test Case'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
