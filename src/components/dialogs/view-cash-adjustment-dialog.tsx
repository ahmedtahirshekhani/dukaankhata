"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyString, formatStatementDate } from "@/lib/utils";
import {
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Landmark,
  Tag,
  FileText,
  Hash,
} from "lucide-react";

interface ViewCashAdjustmentDialogProps {
  adjustment: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewCashAdjustmentDialog({
  adjustment,
  open,
  onOpenChange,
}: ViewCashAdjustmentDialogProps) {
  const tBank = useTranslations("bankAccounts");
  const tCommon = useTranslations("common");

  if (!adjustment) return null;

  const isAdd = adjustment.type === "add";
  const amount = Number(adjustment.amount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] p-5">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-lg ${
                  isAdd
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40"
                    : "bg-rose-50 text-rose-600 dark:bg-rose-950/40"
                }`}
              >
                {isAdd ? (
                  <ArrowUpRight className="w-5 h-5" />
                ) : (
                  <ArrowDownLeft className="w-5 h-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  {tBank("viewAdjustment")}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {adjustment.ref_no || "CADJ"}
                </p>
              </div>
            </div>
            <Badge
              className={
                isAdd
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200"
              }
            >
              {isAdd ? tBank("addCash") : tBank("reduceCash")}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Amount Display */}
          <div className="p-4 rounded-xl bg-muted/40 border text-center">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {tBank("amount")}
            </span>
            <div
              className={`text-2xl font-black mt-1 ${
                isAdd
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {isAdd ? "+" : "-"} {formatCurrencyString(amount)}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="p-2.5 rounded-lg border bg-card">
              <span className="text-muted-foreground text-xs flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5" />
                {tBank("account")}
              </span>
              <p className="font-semibold text-foreground mt-1 truncate">
                {adjustment.account_name || "Cash in Hand"}
              </p>
            </div>

            <div className="p-2.5 rounded-lg border bg-card">
              <span className="text-muted-foreground text-xs flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {tBank("dateTime")}
              </span>
              <p className="font-semibold text-foreground mt-1 truncate">
                {formatStatementDate(adjustment.date || adjustment.created_at)}
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg border bg-card space-y-1">
            <span className="text-muted-foreground text-xs flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" />
              {tBank("reason")}
            </span>
            <p className="font-medium text-foreground text-sm">
              {adjustment.reason || "—"}
            </p>
          </div>

          {adjustment.notes && (
            <div className="p-3 rounded-lg border bg-card space-y-1">
              <span className="text-muted-foreground text-xs flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {tBank("notes")}
              </span>
              <p className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap">
                {adjustment.notes}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            {tCommon("close") || "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
