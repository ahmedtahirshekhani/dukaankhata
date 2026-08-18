"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Home, Check, MoreVertical } from "lucide-react";

interface GenericInstallPromptProps {
  open: boolean;
  onClose: () => void;
}

export function GenericInstallPrompt({ open, onClose }: GenericInstallPromptProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Install DukaanKhata</DialogTitle>
          <DialogDescription>
            Add DukaanKhata to your home screen for quick access
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              1
            </div>
            <div className="pt-1">
              <p className="font-medium text-foreground">Tap the browser menu</p>
              <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
                Look for the <MoreVertical className="h-4 w-4" /> icon or options menu
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              2
            </div>
            <div className="pt-1">
              <p className="font-medium text-foreground">Select Install App</p>
              <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
                Or tap <Home className="h-4 w-4" /> Add to Home screen
              </p>
            </div>
          </div>

          {/* Success Message */}
          <div className="flex gap-3 rounded-lg bg-green-50 p-3 dark:bg-green-950 mt-4">
            <Check className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-900 dark:text-green-200">
              You can now launch DukaanKhata directly from your home screen!
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
