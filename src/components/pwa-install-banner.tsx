"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia(
        "(display-mode: standalone)",
      ).matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;

      if (isStandalone || isIOSStandalone) {
        setIsInstalled(true);
        return true;
      }
      return false;
    };

    // Check if previously dismissed
    const wasRecentlyDismissed = () => {
      const dismissTime = localStorage.getItem("pwa_banner_dismissed");
      if (!dismissTime) return false;

      const daysSinceDismissal =
        (Date.now() - parseInt(dismissTime)) / (1000 * 60 * 60 * 24);
      // Show banner again after 7 days
      return daysSinceDismissal < 7;
    };

    // Check if device is mobile and Chrome
    const isMobileChrome = () => {
      const ua = navigator.userAgent;
      const isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
      const isMobile = /Mobile/.test(ua);
      const isAndroid = /Android/.test(ua);
      return isMobile && isChrome && isAndroid;
    };

    if (checkInstalled()) {
      return;
    }

    // Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();

      // Only show banner on mobile Chrome
      if (!isMobileChrome()) {
        return;
      }

      // Don't show if recently dismissed
      if (wasRecentlyDismissed()) {
        return;
      }

      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    // Handle app installed event
    const handleAppInstalled = () => {
      setShowBanner(false);
      setDeferredPrompt(null);
      setIsInstalled(true);
      localStorage.removeItem("pwa_banner_dismissed");

      // Analytics
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "pwa_installed");
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;

      if (choiceResult.outcome === "accepted") {
        // Analytics
        if (typeof window !== "undefined" && (window as any).gtag) {
          (window as any).gtag("event", "pwa_install_accepted");
        }
      } else {
        // Analytics
        if (typeof window !== "undefined" && (window as any).gtag) {
          (window as any).gtag("event", "pwa_install_dismissed");
        }
      }

      setDeferredPrompt(null);
      setShowBanner(false);
    } catch (error) {
      console.error("PWA installation failed:", error);
    } finally {
      setIsInstalling(false);
    }
  };

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
              onClick={handleInstall}
              disabled={isInstalling}
              className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3"
            >
              {isInstalling ? "Installing..." : "Install"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
