"use client";

import { usePWA } from "@/components/pwa/pwa-context";
import { IOSInstallPrompt } from "@/components/pwa/ios-install-prompt";

export function IOSInstallPromptWrapper() {
  const { showIOSPrompt, setShowIOSPrompt } = usePWA();

  return (
    <IOSInstallPrompt
      open={showIOSPrompt}
      onClose={() => setShowIOSPrompt(false)}
    />
  );
}
