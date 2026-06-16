'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showIndicator, setShowIndicator] = useState(false);
  const tCommon = useTranslations("common");

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);
    
    let timeoutId: NodeJS.Timeout;

    const handleOnline = () => {
      setIsOnline(true);
      setShowIndicator(true);
      
      if (timeoutId) clearTimeout(timeoutId);
      
      // Hide the indicator after 3 seconds
      timeoutId = setTimeout(() => {
        setShowIndicator(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
      if (timeoutId) clearTimeout(timeoutId);
    };

    const handleCustomStatus = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.isOnline) {
        if (!isOnline) handleOnline();
      } else {
        if (isOnline) handleOffline();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('appNetworkStatus', handleCustomStatus);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('appNetworkStatus', handleCustomStatus);
    };
  }, [isOnline]);

  if (!showIndicator) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 shadow-lg transition-all duration-300 ${
        isOnline
          ? 'bg-green-500 text-white'
          : 'bg-yellow-500 text-gray-900'
      }`}
      role="alert"
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          <>
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">{tCommon("backOnline")}</span>
          </>
        ) : (
          <>
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">{tCommon("youAreOffline")}</span>
          </>
        )}
      </div>
    </div>
  );
}
