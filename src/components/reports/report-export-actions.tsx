// src/components/reports/report-export-actions.tsx
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Printer, Loader2 } from "lucide-react";

export interface ReportExportActionsProps {
  onExportExcel: () => void;
  onExportPdf: () => void;
  isExportingExcel: boolean;
  isExportingPdf: boolean;
  excelLabel: string;
  pdfLabel: string;
  disabled?: boolean;
}

export function ReportExportActions({
  onExportExcel,
  onExportPdf,
  isExportingExcel,
  isExportingPdf,
  excelLabel,
  pdfLabel,
  disabled = false,
}: ReportExportActionsProps) {
  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <Button
        variant="outline"
        size="sm"
        onClick={onExportExcel}
        disabled={isExportingExcel || disabled}
        className="h-8 text-xs px-2.5 gap-1.5 flex-1 sm:flex-initial"
      >
        {isExportingExcel ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
        )}
        <span>{excelLabel}</span>
      </Button>

      <Button
        variant="default"
        size="sm"
        onClick={onExportPdf}
        disabled={isExportingPdf || disabled}
        className="h-8 text-xs px-2.5 gap-1.5 flex-1 sm:flex-initial bg-sky-600 hover:bg-sky-700 text-white"
      >
        {isExportingPdf ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Printer className="h-3.5 w-3.5" />
        )}
        <span>{pdfLabel}</span>
      </Button>
    </div>
  );
}
