import type { Dispatch, SetStateAction } from 'react';
import type { FeatureFormState, ProjectFormMode } from '../types';
import {
  fieldClass,
  fieldLabelClass,
  mutedButtonClass,
  primaryButtonClass,
} from '../uiClasses';
import { ModalShell } from './ModalShell';

interface FeatureModalProps {
  featureForm: FeatureFormState;
  setFeatureForm: Dispatch<SetStateAction<FeatureFormState>>;
  featureFormMode: ProjectFormMode;
  featureTitleError: string | null;
  featureAcceptanceCriteriaError: string | null;
  canSaveFeature: boolean;
  onClose: () => void;
  onCreateFeature: () => void;
  onUpdateFeature: () => void;
}

export function FeatureModal({
  featureForm,
  setFeatureForm,
  featureFormMode,
  featureTitleError,
  featureAcceptanceCriteriaError,
  canSaveFeature,
  onClose,
  onCreateFeature,
  onUpdateFeature,
}: FeatureModalProps): JSX.Element {
  const isCreate = featureFormMode === 'create';

  return (
    <ModalShell title={isCreate ? 'Add Feature' : 'Edit Feature'} onClose={onClose}>
      <div className="space-y-3">
        <label className={`${fieldLabelClass} space-y-1`}>
          Feature Title
          <input
            className={fieldClass}
            value={featureForm.title}
            onChange={(event) =>
              setFeatureForm((previous) => ({ ...previous, title: event.target.value }))
            }
          />
          {featureTitleError ? (
            <span className="text-[11px] text-danger">{featureTitleError}</span>
          ) : null}
        </label>

        <label className={`${fieldLabelClass} space-y-1`}>
          Acceptance Criteria
          <textarea
            className={`${fieldClass} min-h-24 resize-y py-2`}
            value={featureForm.acceptanceCriteria}
            onChange={(event) =>
              setFeatureForm((previous) => ({
                ...previous,
                acceptanceCriteria: event.target.value,
              }))
            }
          />
          {featureAcceptanceCriteriaError ? (
            <span className="text-[11px] text-danger">{featureAcceptanceCriteriaError}</span>
          ) : null}
        </label>

        <label className={`${fieldLabelClass} space-y-1`}>
          Requirements (Optional)
          <textarea
            className={`${fieldClass} min-h-16 resize-y py-2`}
            value={featureForm.requirements}
            onChange={(event) =>
              setFeatureForm((previous) => ({ ...previous, requirements: event.target.value }))
            }
          />
        </label>

        <label className={`${fieldLabelClass} space-y-1`}>
          Notes (Optional)
          <textarea
            className={`${fieldClass} min-h-16 resize-y py-2`}
            value={featureForm.notes}
            onChange={(event) =>
              setFeatureForm((previous) => ({ ...previous, notes: event.target.value }))
            }
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={mutedButtonClass} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={isCreate ? onCreateFeature : onUpdateFeature}
            disabled={!canSaveFeature}
          >
            {isCreate ? 'Create Feature' : 'Save Feature'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
