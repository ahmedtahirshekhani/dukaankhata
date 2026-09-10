// src/components/reports/report-pdf-modal.tsx

"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Loader2 } from "lucide-react";

export interface ReportPdfModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  reportRef: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
  width?: string;
  isPortrait?: boolean;
}

export function ReportPdfModal({
  isOpen,
  onOpenChange,
  title = "PDF Report Preview",
  description = "Preparing & downloading your PDF report...",
  reportRef,
  children,
  width = "1123px",
  isPortrait = false,
}: ReportPdfModalProps) {
  const paperWidth = isPortrait ? "794px" : width;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full p-4 max-h-[90vh] flex flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-900 border border-border">
        <DialogHeader className="pb-2 border-b border-border flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Printer className="h-4 w-4 text-indigo-500" />
              <span>{title}</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
              <span>{description}</span>
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-auto p-2 sm:p-4 bg-zinc-200/50 dark:bg-zinc-950/50 rounded-lg my-2 hide-scrollbar">
          <div
            ref={reportRef}
            className="bg-white mx-auto text-slate-900 font-sans shadow-sm"
            style={{
              width: paperWidth,
              padding: "20px",
              boxSizing: "border-box",
              borderRadius: "4px",
            }}
          >
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
