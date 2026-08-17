"use client";

import { usePWA } from "@/components/pwa/pwa-context";
import { GenericInstallPrompt } from "@/components/pwa/generic-install-prompt";

export function GenericInstallPromptWrapper() {
  const { showGenericPrompt, setShowGenericPrompt } = usePWA();

  return (
    <GenericInstallPrompt
      open={showGenericPrompt}
      onClose={() => setShowGenericPrompt(false)}
    />
  );
}
