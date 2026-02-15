"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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

interface PaymentDialogProps {
  open: boolean;
  total: number;
  defaultAmount: number;
  defaultMethod: string;
  defaultDate: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: PaymentDialogResult) => void;
}

export function PaymentDialog({
  open,
  total,
  defaultAmount,
  defaultMethod,
  defaultDate,
  onOpenChange,
  onConfirm,
}: PaymentDialogProps) {
  const t = useTranslations("invoice");
  const locale = useLocale();
  const normalizePaymentMethodValue = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized === "cash") return "cash";
    if (normalized === "cheque") return "cheque";
    return value.trim();
  };
  const [paymentType, setPaymentType] = useState<PaymentKind>("full");
  const [paymentAmount, setPaymentAmount] = useState<number>(total);
  const [paymentMethod, setPaymentMethod] = useState(
    normalizePaymentMethodValue(defaultMethod),
  );
  const [paymentDate, setPaymentDate] = useState(defaultDate);
  const [dynamicMethods, setDynamicMethods] = useState<
    { id: string; name: string; details: string }[]
  >([]);
  const [methodsError, setMethodsError] = useState<string | null>(null);
  const [paymentErrors, setPaymentErrors] = useState<{
    method?: string;
    amount?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    const nextType: PaymentKind = defaultAmount >= total ? "full" : "partial";
    setPaymentType(nextType);
    setPaymentAmount(
      nextType === "full" ? total : Math.max(0, Math.min(total, defaultAmount)),
    );
    setPaymentMethod(normalizePaymentMethodValue(defaultMethod));
    setPaymentDate(defaultDate);
    setPaymentErrors({});
  }, [open, defaultAmount, defaultDate, defaultMethod, total]);

  useEffect(() => {
    if (!open) return;
    let isActive = true;
    const controller = new AbortController();
    const loadMethods = async () => {
      setMethodsError(null);
      try {
        const res = await fetch(`/${locale}/api/configuration/payment-method`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error("Failed to fetch payment methods");
        }
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
              .map((item) => ({
                id: typeof item?.id === "string" ? item.id.trim() : "",
                name:
                  typeof item?.bankName === "string"
                    ? item.bankName.trim()
                    : "",
                details:
                  typeof item?.bankDetails === "string"
                    ? item.bankDetails.trim()
                    : "",
              }))
              .filter((item) => Boolean(item.id) && Boolean(item.name))
          : [];
        const filtered = list.filter(
          (item) =>
            item.id !== "cash" &&
            item.id !== "cheque" &&
            item.name.toLowerCase() !== "cash" &&
            item.name.toLowerCase() !== "cheque",
        );
        const unique = Array.from(
          new Map(filtered.map((item) => [item.id, item])).values(),
        );
        if (isActive) {
          setDynamicMethods(unique);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (isActive) {
          setDynamicMethods([]);
          setMethodsError(t("failedToFetchPaymentMethods"));
        }
      }
    };

    loadMethods();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [open, locale, t]);

  useEffect(() => {
    if (!open || !paymentMethod) return;

    const normalizedMethod = normalizePaymentMethodValue(paymentMethod);
    if (normalizedMethod !== paymentMethod) {
      setPaymentMethod(normalizedMethod);
      return;
    }

    if (paymentMethod === "cash" || paymentMethod === "cheque") return;

    const hasMatchingId = dynamicMethods.some((item) => item.id === paymentMethod);
    if (hasMatchingId) return;

    const matchedByName = dynamicMethods.find(
      (item) => item.name.toLowerCase() === paymentMethod.toLowerCase(),
    );
    if (matchedByName) {
      setPaymentMethod(matchedByName.id);
    }
  }, [open, paymentMethod, dynamicMethods]);

  const remainingBalance = useMemo(
    () => Math.max(0, total - paymentAmount),
    [paymentAmount, total],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("makePaymentTitle")}</DialogTitle>
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
                      Math.max(0, Math.min(total, amt || total)),
                    );
                  }}
                />
                {t("partialPayment")}
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="payment-amount">{t("amountLabel")}</Label>
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
                {t("fullAmountLockedToTotal")}
              </p>
            )}
            {paymentType === "partial" && (
              <div className="flex justify-end">
                <p className="text-xs text-muted-foreground text-right">
                  {t("remainingBalanceLabel")}{" "}
                  {formatCurrencyString(remainingBalance)}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="payment-method">{t("paymentMethod")}</Label>
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
                <SelectItem value="cash">{t("cash")}</SelectItem>
                <SelectItem value="cheque">{t("cheque")}</SelectItem>
                {dynamicMethods.map((method) => (
                  <SelectItem
                    key={method.id}
                    value={method.id}
                    className="group"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium group-data-[highlighted]:text-accent-foreground">
                        {method.name}
                      </span>

                      {method.details && (
                        <p className="text-xs text-muted-foreground group-data-[highlighted]:text-accent-foreground">
                          {method.details}
                        </p>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {methodsError && (
              <p className="text-xs text-red-600">{methodsError}</p>
            )}
            {paymentErrors.method && (
              <p className="text-xs text-red-600">{paymentErrors.method}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="payment-date">{t("date")}</Label>
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
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
                    nextErrors.amount = t("amountBetweenOneAndTotal");
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
