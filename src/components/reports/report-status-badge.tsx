// src/components/reports/report-status-badge.tsx
"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

export type ReportTransactionStatus = "paid" | "partial" | "unpaid" | string;

export interface ReportStatusBadgeProps {
  status: ReportTransactionStatus;
  label: string;
  isTable?: boolean;
}

export function ReportStatusBadge({ status, label, isTable = false }: ReportStatusBadgeProps) {
  const baseClasses = isTable
    ? "text-[11px] font-semibold px-2 py-0.5 rounded-full border gap-1 inline-flex items-center"
    : "text-xs font-semibold px-2.5 py-0.5 rounded-full border gap-1 inline-flex items-center";

  switch (status) {
    case "paid":
      return (
        <span
          className={`${baseClasses} bg-zinc-100 text-foreground border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700`}
        >
          <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span>{label}</span>
        </span>
      );
    case "partial":
      return (
        <span
          className={`${baseClasses} bg-zinc-100 text-foreground border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700`}
        >
          <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          <span>{label}</span>
        </span>
      );
    case "unpaid":
    default:
      return (
        <span
          className={`${baseClasses} bg-zinc-100 text-foreground border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700`}
        >
          <AlertCircle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
          <span>{label}</span>
        </span>
      );
  }
}
