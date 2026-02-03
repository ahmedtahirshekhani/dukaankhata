"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyString } from "@/lib/utils";

export type PaymentKind = "full" | "partial";

export interface PaymentDialogResult {
  method: string;
  amount: number;
  date: string;
  type: PaymentKind;
}

/** Translation functions - pass from parent to ensure i18n works inside Dialog portal */
export interface PaymentDialogTranslations {
  t: (key: string) => string;
  tPayments: (key: string) => string;
  tCommon: (key: string) => string;
}

interface PaymentDialogProps {
  open: boolean;
  total: number;
  defaultAmount: number;
  defaultMethod: string;
  defaultDate: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: PaymentDialogResult) => void;
  /** Pass translations from parent for reliable i18n inside Dialog portal */
  translations?: PaymentDialogTranslations;
}

export function PaymentDialog({
  open,
  total,
  defaultAmount,
  defaultMethod,
  defaultDate,
  onOpenChange,
  onConfirm,
  translations: translationsProp,
}: PaymentDialogProps) {
  const tInline = useTranslations("invoice");
  const tPaymentsInline = useTranslations("payments");
  const tCommonInline = useTranslations("common");

  const t = translationsProp?.t ?? tInline;
  const tPayments = translationsProp?.tPayments ?? tPaymentsInline;
  const tCommon = translationsProp?.tCommon ?? tCommonInline;

  const [paymentType, setPaymentType] = useState<PaymentKind>("full");
  const [paymentAmount, setPaymentAmount] = useState<number>(total);
  const [paymentMethod, setPaymentMethod] = useState(defaultMethod);
  const [paymentDate, setPaymentDate] = useState(defaultDate);
  const [paymentErrors, setPaymentErrors] = useState<{
    method?: string;
    amount?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    const nextType: PaymentKind = defaultAmount >= total ? "full" : "partial";
    setPaymentType(nextType);
    setPaymentAmount(
      nextType === "full" ? total : Math.max(0, Math.min(total, defaultAmount))
    );
    setPaymentMethod(defaultMethod);
    setPaymentDate(defaultDate);
    setPaymentErrors({});
  }, [open, defaultAmount, defaultDate, defaultMethod, total]);

  const remainingBalance = useMemo(
    () => Math.max(0, total - paymentAmount),
    [paymentAmount, total]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("makePayment")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">{t("paymentType")}</Label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="payment-type"
                  value="full"
                  checked={paymentType === "full"}
                  onChange={() => {
                    setPaymentType("full");
                    setPaymentAmount(total);
                  }}
                />
                {t("fullPayment")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="payment-type"
                  value="partial"
                  checked={paymentType === "partial"}
                  onChange={() => {
                    setPaymentType("partial");
                    setPaymentAmount((amt) =>
                      Math.max(0, Math.min(total, amt || total))
                    );
                  }}
                />
                {t("partialPayment")}
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="payment-amount">{tPayments("amount")}</Label>
            <Input
              id="payment-amount"
              type="number"
              placeholder="0"
              value={paymentAmount || ""}
              onChange={(e) => {
                const val = Number(e.target.value);
                const clamped = isNaN(val)
                  ? 0
                  : Math.max(0, Math.min(total, val));
                setPaymentAmount(clamped);
                if (paymentErrors.amount) {
                  setPaymentErrors((prev) => ({ ...prev, amount: undefined }));
                }
              }}
              disabled={paymentType === "full"}
              max={Math.floor(total)}
              step={1}
            />
            {paymentErrors.amount && (
              <p className="text-xs text-red-600">{paymentErrors.amount}</p>
            )}
            {paymentType === "full" && (
              <p className="text-xs text-muted-foreground">
                {t("fullAmountLockedHint")}
              </p>
            )}
            {paymentType === "partial" && (
              <div className="flex justify-end">
                <p className="text-xs text-muted-foreground text-right">
                  {t("paymentRemainingBalance")}{" "}
                  {formatCurrencyString(remainingBalance)}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="payment-method">{tPayments("paymentMethod")}</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => {
                setPaymentMethod(value);
                if (paymentErrors.method) {
                  setPaymentErrors((prev) => ({ ...prev, method: undefined }));
                }
              }}
            >
              <SelectTrigger id="payment-method">
                <SelectValue placeholder={t("selectPaymentMethod")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">{tPayments("cash")}</SelectItem>
                <SelectItem value="Bank Transfer">
                  {tPayments("bankTransfer")}
                </SelectItem>
                <SelectItem value="Cheque">{tPayments("cheque")}</SelectItem>
                <SelectItem value="Easypaisa">
                  {tPayments("easypaisa")}
                </SelectItem>
                <SelectItem value="JazzCash">
                  {tPayments("jazzCash")}
                </SelectItem>
                <SelectItem value="Nayapay">{tPayments("nayapay")}</SelectItem>
              </SelectContent>
            </Select>
            {paymentErrors.method && (
              <p className="text-xs text-red-600">{paymentErrors.method}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="payment-date">{t("paymentDate")}</Label>
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={() => {
                const amt = Number(paymentAmount);
                const nextErrors: { method?: string; amount?: string } = {};
                if (!paymentMethod.trim()) {
                  nextErrors.method = t("paymentMethodRequired");
                }
                if (paymentType === "partial") {
                  if (isNaN(amt) || amt <= 0 || amt > total) {
                    nextErrors.amount = t("amountBetweenValidation");
                  }
                }
                setPaymentErrors(nextErrors);
                if (nextErrors.method || nextErrors.amount) {
                  return;
                }
                onConfirm({
                  method: paymentMethod,
                  amount: Math.min(total, amt),
                  date: paymentDate,
                  type: paymentType,
                });
                onOpenChange(false);
              }}
            >
              {t("confirmPayment")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
