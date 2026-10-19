// src/components/reports/report-mobile-card.tsx
"use client";

import React from "react";
import { ReportStatusBadge, ReportTransactionStatus } from "./report-status-badge";
import { cn } from "@/lib/utils";

export interface ReportMobileCardProps {
  number?: string;
  partyName: string;
  phone?: string;
  formattedDate?: string;
  status?: ReportTransactionStatus;
  statusLabel?: string;
  badgeText?: string;
  itemsCount?: number;
  itemsLabel?: string;
  totalAmount: string;
  totalAmountLabel: string;
  paidAmount: string;
  paidAmountLabel: string;
  balanceDue: string;
  balanceDueLabel: string;
  onClick?: () => void;
  highlightAmountClass?: string;
}

export function ReportMobileCard({
  number,
  partyName,
  phone,
  formattedDate,
  status,
  statusLabel,
  badgeText,
  itemsCount,
  itemsLabel,
  totalAmount,
  totalAmountLabel,
  paidAmount,
  paidAmountLabel,
  balanceDue,
  balanceDueLabel,
  onClick,
  highlightAmountClass,
}: ReportMobileCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3.5 border rounded-lg bg-card shadow-xs space-y-2.5 text-xs transition-colors",
        onClick ? "cursor-pointer hover:bg-muted/40 hover:border-primary/50" : ""
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          {number && <span className="font-mono font-bold text-foreground">{number}</span>}
          <p className="font-semibold text-foreground text-sm mt-0.5">{partyName}</p>
          {phone && <p className="text-[11px] text-muted-foreground">{phone}</p>}
          {formattedDate && <p className="text-[11px] text-foreground/75">{formattedDate}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {status && (
            <ReportStatusBadge status={status} label={statusLabel || status} isTable={true} />
          )}
          {badgeText && (
            <span className="text-[11px] font-semibold text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
              {badgeText}
            </span>
          )}
          {itemsCount !== undefined && itemsLabel && (
            <span className="text-[11px] text-foreground">
              {itemsCount} {itemsLabel}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-[11px]">
        <div>
          <span className="text-muted-foreground block text-[10px]">{totalAmountLabel}</span>
          <span className={cn("font-bold text-foreground", highlightAmountClass)}>{totalAmount}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px]">{paidAmountLabel}</span>
          <span className="font-semibold text-foreground">{paidAmount}</span>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground block text-[10px]">{balanceDueLabel}</span>
          <span className="font-bold text-rose-600 dark:text-rose-400">{balanceDue}</span>
        </div>
      </div>
    </div>
  );
}
