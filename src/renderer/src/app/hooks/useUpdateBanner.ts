import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UpdateStatusEvent } from '@shared/types';

interface UseUpdateBannerInput {
  onMessage: (message: string) => void;
}

interface UseUpdateBannerResult {
  bannerEvent: UpdateStatusEvent | null;
  isVisible: boolean;
  canInstallNow: boolean;
  isInstalling: boolean;
  dismiss: () => void;
  installNow: () => Promise<void>;
}

export function useUpdateBanner({ onMessage }: UseUpdateBannerInput): UseUpdateBannerResult {
  const [bannerEvent, setBannerEvent] = useState<UpdateStatusEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const unsubscribe = window.qaApi.onUpdateStatus((event) => {
      setBannerEvent(event);
    });

    return unsubscribe;
  }, []);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
  }, []);

  const installNow = useCallback(async (): Promise<void> => {
    if (isInstalling) {
      return;
    }

    setIsInstalling(true);
    try {
      const result = await window.qaApi.installUpdateNow();
      if (!result.ok) {
        onMessage(`Unable to install update now: ${result.error.message}`);
        return;
      }

      onMessage('Restarting to install update...');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      onMessage(`Unable to install update now: ${message}`);
    } finally {
      setIsInstalling(false);
    }
  }, [isInstalling, onMessage]);

  const canInstallNow = bannerEvent?.phase === 'downloaded';
  const isVisible = useMemo(() => !isDismissed && bannerEvent !== null, [bannerEvent, isDismissed]);

  return {
    bannerEvent,
    isVisible,
    canInstallNow,
    isInstalling,
    dismiss,
    installNow,
  };
}
