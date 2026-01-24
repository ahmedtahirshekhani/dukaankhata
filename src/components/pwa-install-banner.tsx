"use client";

import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWA } from "@/components/pwa-context";

export function PWAInstallBanner() {
  const {
    showBanner,
    setShowBanner,
    deferredPrompt,
    isInstalled,
    triggerInstall,
  } = usePWA();

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa_banner_dismissed", Date.now().toString());

    // Analytics
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "pwa_banner_dismissed");
    }
  };

  if (!showBanner || isInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg animate-in slide-in-from-bottom duration-300">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <Download className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                Install App
              </p>
              <p className="text-xs text-gray-600 truncate">
                Get quick access from your home screen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-8 w-8 p-0"
              aria-label="Dismiss install banner"
            >
              <X className="h-4 w-4" />
            </Button>

            <Button
              size="sm"
              onClick={triggerInstall}
              disabled={!deferredPrompt}
              className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3"
            >
              Install
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
