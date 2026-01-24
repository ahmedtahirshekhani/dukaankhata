"use client";

import { useEffect } from "react";
import { captureEvent } from "@/lib/posthog-client";

export function PWAInstallPrompt() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Register service worker
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("Service Worker registered:", registration);

            // Check for updates periodically
            setInterval(
              () => {
                registration.update();
              },
              60 * 60 * 1000,
            ); // Check every hour
          })
          .catch((error) => {
            console.error("Service Worker registration failed:", error);
          });
      });

      // Listen for service worker updates
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("New service worker activated");
        // Optionally reload the page or notify the user
      });

      // Handle install prompt
      let deferredPrompt: any;

      window.addEventListener("beforeinstallprompt", (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;

        // Optionally show your own install button
        console.log("PWA install prompt available");

        // You can show a custom install button here
        // For now, we'll log it. In production, you might want to:
        // - Show a banner
        // - Store in state and show a button
        // - Show a toast notification
      });

      // Handle successful installation
      window.addEventListener("appinstalled", () => {
        console.log("PWA installed successfully");
        deferredPrompt = null;

        captureEvent("pwa_installed", {
          event_category: "PWA",
          event_label: "Installation",
        });
      });

      // Detect if app is running as PWA
      const isStandalone = window.matchMedia(
        "(display-mode: standalone)",
      ).matches;
      if (isStandalone) {
        console.log("Running as PWA");
        // You can add PWA-specific behavior here
      }
    }
  }, []);

  return null; // This component doesn't render anything
}
