// src/components/reports/report-mobile-card.tsx
"use client";

import React from "react";
import { ReportStatusBadge, ReportTransactionStatus } from "./report-status-badge";

export interface ReportMobileCardProps {
  number: string;
  partyName: string;
  formattedDate: string;
  status: ReportTransactionStatus;
  statusLabel: string;
  itemsCount: number;
  itemsLabel: string;
  totalAmount: string;
  totalAmountLabel: string;
  paidAmount: string;
  paidAmountLabel: string;
  balanceDue: string;
  balanceDueLabel: string;
  onClick?: () => void;
}

export function ReportMobileCard({
  number,
  partyName,
  formattedDate,
  status,
  statusLabel,
  itemsCount,
  itemsLabel,
  totalAmount,
  totalAmountLabel,
  paidAmount,
  paidAmountLabel,
  balanceDue,
  balanceDueLabel,
  onClick,
}: ReportMobileCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-3.5 border rounded-lg bg-card shadow-xs space-y-2.5 text-xs transition-colors ${
        onClick ? "cursor-pointer hover:bg-muted/40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-mono font-bold text-foreground">{number}</span>
          <p className="font-semibold text-foreground text-sm mt-0.5">{partyName}</p>
          <p className="text-[11px] text-foreground/75">{formattedDate}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ReportStatusBadge status={status} label={statusLabel} isTable={true} />
          <span className="text-[11px] text-foreground">
            {itemsCount} {itemsLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-[11px]">
        <div>
          <span className="text-muted-foreground block text-[10px]">{totalAmountLabel}</span>
          <span className="font-bold text-foreground">{totalAmount}</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px]">{paidAmountLabel}</span>
          <span className="font-semibold text-foreground">{paidAmount}</span>
        </div>
        <div className="text-right">
          <span className="text-muted-foreground block text-[10px]">{balanceDueLabel}</span>
          <span className="font-bold text-foreground">{balanceDue}</span>
        </div>
      </div>
    </div>
  );
}
