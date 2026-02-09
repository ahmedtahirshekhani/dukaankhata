"use client";

import { usePWA } from "@/components/pwa/pwa-context";
import { MacChromeInstallPrompt } from "@/components/pwa/mac-chrome-install-prompt";

export function MacChromeInstallPromptWrapper() {
  const { showMacChromePrompt, setShowMacChromePrompt } = usePWA();

  return (
    <MacChromeInstallPrompt
      open={showMacChromePrompt}
      onClose={() => setShowMacChromePrompt(false)}
    />
  );
}
