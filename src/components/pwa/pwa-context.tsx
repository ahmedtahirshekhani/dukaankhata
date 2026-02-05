"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAContextType {
  showBanner: boolean;
  setShowBanner: (show: boolean) => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void;
  isInstalled: boolean;
  setIsInstalled: (installed: boolean) => void;
  dismissedBanner: boolean;
  setDismissedBanner: (dismissed: boolean) => void;
  triggerInstall: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);
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

    const dismissTime = localStorage.getItem("pwa_banner_dismissed");
    if (dismissTime) {
      setDismissedBanner(true);
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
        setDismissedBanner(true);
        return;
      }

      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
      setDismissedBanner(false);
    };

    // Handle app installed event
    const handleAppInstalled = () => {
      setShowBanner(false);
      setDeferredPrompt(null);
      setIsInstalled(true);
      setDismissedBanner(false);
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

  const triggerInstall = useCallback(async () => {
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
  }, [deferredPrompt]);

  const value: PWAContextType = {
    showBanner,
    setShowBanner,
    deferredPrompt,
    setDeferredPrompt,
    isInstalled,
    setIsInstalled,
    dismissedBanner,
    setDismissedBanner,
    triggerInstall,
  };

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

export function usePWA() {
  const context = useContext(PWAContext);
  if (context === undefined) {
    throw new Error("usePWA must be used within a PWAProvider");
  }
  return context;
}
