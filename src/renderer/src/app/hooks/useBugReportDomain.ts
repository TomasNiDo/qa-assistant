import { useCallback, useState } from 'react';
import type { GeneratedBugReport } from '@shared/types';
import { formatBugReport, toErrorMessage } from '../utils';

interface UseBugReportDomainArgs {
  onMessage: (message: string) => void;
}

export interface UseBugReportDomainResult {
  bugReport: GeneratedBugReport | null;
  bugReportDraft: string;
  setBugReportDraft: (value: string) => void;
  isGeneratingBugReport: boolean;
  generateBugReport: (selectedRunId: string) => Promise<void>;
  copyBugReport: () => Promise<void>;
  closeBugReportDraft: () => void;
  clearBugReportState: () => void;
}

export function useBugReportDomain({ onMessage }: UseBugReportDomainArgs): UseBugReportDomainResult {
  const [bugReport, setBugReport] = useState<GeneratedBugReport | null>(null);
  const [bugReportDraft, setBugReportDraft] = useState('');
  const [isGeneratingBugReport, setIsGeneratingBugReport] = useState(false);

  const generateBugReport = useCallback(
    async (selectedRunId: string): Promise<void> => {
      if (isGeneratingBugReport) {
        return;
      }

      if (!selectedRunId) {
        onMessage('Select a failed run first.');
        return;
      }

      setIsGeneratingBugReport(true);
      try {
        const result = await window.qaApi.aiGenerateBugReport({ runId: selectedRunId });
        if (!result.ok) {
          onMessage(result.error.message);
          return;
        }

        setBugReport(result.data);
        setBugReportDraft(formatBugReport(result.data));
        onMessage('Bug report generated.');
      } catch (error) {
        onMessage(`Generate bug report failed: ${toErrorMessage(error)}`);
      } finally {
        setIsGeneratingBugReport(false);
      }
    },
    [isGeneratingBugReport, onMessage],
  );

  const copyBugReport = useCallback(async () => {
    await navigator.clipboard.writeText(bugReportDraft);
    onMessage('Bug report copied to clipboard.');
  }, [bugReportDraft, onMessage]);

  const clearBugReportState = useCallback(() => {
    setBugReport(null);
    setBugReportDraft('');
  }, []);

  const closeBugReportDraft = useCallback(() => {
    clearBugReportState();
  }, [clearBugReportState]);

  return {
    bugReport,
    bugReportDraft,
    setBugReportDraft,
    isGeneratingBugReport,
    generateBugReport,
    copyBugReport,
    closeBugReportDraft,
    clearBugReportState,
  };
}
