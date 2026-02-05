"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message: string;
  isSuccess?: boolean;
}

export function ErrorDialog({
  open,
  onOpenChange,
  title,
  message,
  isSuccess = false,
}: ErrorDialogProps) {
  // Split message by newlines to handle multi-line messages
  const messageLines = message.split("\n").filter((line) => line.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            {title || (isSuccess ? "Success" : "Error")}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="pt-2">
              {messageLines.map((line, index) => (
                <p
                  key={index}
                  className={`text-sm ${
                    index === 0
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  } ${index > 0 ? "mt-2" : ""}`}
                >
                  {line}
                </p>
              ))}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
