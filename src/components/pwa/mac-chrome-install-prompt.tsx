"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Check } from "lucide-react";

interface MacChromeInstallPromptProps {
  open: boolean;
  onClose: () => void;
}

export function MacChromeInstallPrompt({ open, onClose }: MacChromeInstallPromptProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Install DukaanKhata</DialogTitle>
          <DialogDescription>
            Install the app directly from Chrome
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              1
            </div>
            <div className="pt-1">
              <p className="font-medium text-foreground">Look for the install icon</p>
              <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
                You'll see a <Download className="h-4 w-4" /> icon in the address bar
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              2
            </div>
            <div className="pt-1">
              <p className="font-medium text-foreground">Click the icon</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A dialog will appear asking to confirm installation
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              3
            </div>
            <div className="pt-1">
              <p className="font-medium text-foreground">Confirm installation</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The app will be installed on your Mac
              </p>
            </div>
          </div>

          {/* Success Message */}
          <div className="flex gap-3 rounded-lg bg-green-50 p-3 dark:bg-green-950">
            <Check className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-900 dark:text-green-200">
              Once installed, you can launch DukaanKhata from your dock!
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
