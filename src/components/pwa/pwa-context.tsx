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
  showIOSPrompt: boolean;
  setShowIOSPrompt: (show: boolean) => void;
  showMacChromePrompt: boolean;
  setShowMacChromePrompt: (show: boolean) => void;
  canInstall: boolean;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showMacChromePrompt, setShowMacChromePrompt] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  // Check if device is iOS
  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  };

  // Check if device is macOS
  const isMacOS = () => {
    return /Mac/.test(navigator.userAgent) && !/iPhone|iPad|iPod/.test(navigator.userAgent);
  };

  // Check if browser is Chrome
  const isChrome = () => {
    return /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  };

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

      // Only show banner on mobile Chrome or Mac Chrome
      if (!isMobileChrome() && !(isMacOS() && isChrome())) {
        return;
      }

      // Don't show if recently dismissed
      if (wasRecentlyDismissed()) {
        setDismissedBanner(true);
        return;
      }

      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
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
    // For Mac Chrome, show instructions to click URL bar icon
    if (isMacOS() && isChrome() && deferredPrompt) {
      setShowMacChromePrompt(true);
      
      // Analytics
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "pwa_mac_chrome_prompt_shown");
      }
      return;
    }

    // Try native prompt for non-Mac or non-Chrome browsers
    if (deferredPrompt) {
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
      return;
    }

    // Fall back to custom prompt for iOS or macOS Safari
    if (isIOS() || isMacOS()) {
      setShowIOSPrompt(true);
      
      // Analytics
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "pwa_ios_install_prompt_shown");
      }
      return;
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
    showIOSPrompt,
    setShowIOSPrompt,
    showMacChromePrompt,
    setShowMacChromePrompt,
    canInstall: canInstall || isIOS() || isMacOS(),
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
