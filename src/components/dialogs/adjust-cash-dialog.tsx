"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Minus,
  Coins,
  AlertTriangle,
  Loader2,
  Calendar,
  FileText,
  Landmark,
  DollarSign,
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { toHTMLDateString, toSafeISOString } from "@/lib/date-utils";
import { formatCurrencyString } from "@/lib/utils";
import {
  recordCashAdjustmentOffline,
  updateCashAdjustmentOffline,
} from "@/lib/db/offline-cash-manager";
import { PaymentMethodDropdown } from "@/components/dropdown/payment-method-dropdown";
import type { BankAccountItem } from "@/app/[locale]/admin/bank-accounts/bank-accounts-client";

interface AdjustCashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: BankAccountItem[];
  defaultAccountId?: string;
  adjustmentToEdit?: any | null;
  onSuccess?: (adjustment: any) => void;
}

export function AdjustCashDialog({
  open,
  onOpenChange,
  accounts = [],
  defaultAccountId,
  adjustmentToEdit,
  onSuccess,
}: AdjustCashDialogProps) {
  const tBank = useTranslations("bankAccounts");
  const tCommon = useTranslations("common");

  const isEditMode = Boolean(adjustmentToEdit);

  // Determine initial selected account (defaults to empty so placeholder shows)
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedAccountName, setSelectedAccountName] = useState<string>("");
  const [actionType, setActionType] = useState<"add" | "reduce">("add");
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [adjustmentDate, setAdjustmentDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state whenever dialog opens
  useEffect(() => {
    if (open) {
      if (adjustmentToEdit) {
        // Edit Mode: Prefill existing values
        const editPmId = String(
          adjustmentToEdit.payment_method_id ||
          adjustmentToEdit.paymentMethodId ||
          adjustmentToEdit.account_id ||
          adjustmentToEdit.accountId ||
          ""
        ).trim();
        const editAccName = String(
          adjustmentToEdit.account_name ||
          adjustmentToEdit.accountName ||
          ""
        ).trim();

        // Match in accounts list
        let matched = accounts.find((a) =>
          (editPmId && editPmId !== "cash" && String(a.id).toLowerCase() === editPmId.toLowerCase()) ||
          (editAccName && a.bankName.toLowerCase() === editAccName.toLowerCase())
        );

        if (!matched && (editPmId === "cash" || editAccName.toLowerCase().includes("cash"))) {
          matched = accounts.find((a) =>
            String(a.id).toLowerCase() === "cash" ||
            a.bankName.toLowerCase().includes("cash")
          );
        }

        const resolvedId = matched ? String(matched.id) : (editPmId || "cash");
        const resolvedName = matched ? matched.bankName : (editAccName || "Cash in Hand");

        setSelectedAccountId(resolvedId);
        setSelectedAccountName(resolvedName);
        setActionType(adjustmentToEdit.type || "add");
        setAmount(adjustmentToEdit.amount?.toString() || "");

        // Map reason back to key if matched, or keep as is
        const rawReason = adjustmentToEdit.reason || "";
        const revReasonMap: Record<string, string> = {
          [tBank("reasonPhysicalDiscrepancy")]: "physical_discrepancy",
          [tBank("reasonOwnerDrawing")]: "owner_drawing",
          [tBank("reasonOwnerCapital")]: "owner_capital",
          [tBank("reasonPettyExpense")]: "petty_expense",
          [tBank("reasonRoundingAudit")]: "rounding_audit",
          [tBank("reasonOther")]: "other",
        };
        const foundKey = revReasonMap[rawReason] || rawReason;
        setReason(foundKey);

        setAdjustmentDate(toHTMLDateString(adjustmentToEdit.date || adjustmentToEdit.created_at || new Date()));
        setNotes(adjustmentToEdit.notes || "");
        setErrorMsg(null);
      } else {
        // Create Mode
        const defaultAcc = defaultAccountId
          ? accounts.find((a) => a.id === defaultAccountId)
          : null;

        const initialId = defaultAcc ? defaultAcc.id : "";
        setSelectedAccountId(initialId);
        setSelectedAccountName(defaultAcc?.bankName || "");
        setActionType("add");
        setAmount("");
        setReason("");
        setAdjustmentDate(toHTMLDateString(new Date()));
        setNotes("");
        setErrorMsg(null);
      }
    }
  }, [open, defaultAccountId, accounts, adjustmentToEdit, tBank]);

  const selectedAccount = useMemo(() => {
    if (!selectedAccountId && !selectedAccountName) return null;
    const found =
      accounts.find(
        (a) =>
          (selectedAccountId && (a.id === selectedAccountId || a.id?.toString() === selectedAccountId?.toString())) ||
          (selectedAccountName && a.bankName.toLowerCase() === selectedAccountName.toLowerCase())
      ) ||
      (selectedAccountId === "cash" || selectedAccountName?.toLowerCase().includes("cash")
        ? accounts.find(
            (a) =>
              a.bankName.toLowerCase().includes("cash") ||
              a.id === "cash" ||
              (a as any).is_default
          )
        : null);
    if (found) return found;
    if (selectedAccountName) {
      return {
        id: selectedAccountId || "cash",
        bankName: selectedAccountName,
        bankDetails: "",
        openingBalance: 0,
        currentBalance: 0,
      } as BankAccountItem;
    }
    return null;
  }, [accounts, selectedAccountId, selectedAccountName]);

  const currentBalance = useMemo(() => {
    if (!selectedAccount) return 0;
    return selectedAccount.currentBalance !== undefined
      ? selectedAccount.currentBalance
      : selectedAccount.openingBalance || 0;
  }, [selectedAccount]);

  const baselineBalance = useMemo(() => {
    let bal = currentBalance;
    if (isEditMode && adjustmentToEdit) {
      const origAmount = Number(adjustmentToEdit.amount) || 0;
      if (adjustmentToEdit.type === "add") {
        bal -= origAmount;
      } else if (adjustmentToEdit.type === "reduce") {
        bal += origAmount;
      }
    }
    return bal;
  }, [currentBalance, isEditMode, adjustmentToEdit]);

  const numAmount = useMemo(() => {
    const val = parseFloat(amount);
    return isNaN(val) ? 0 : Math.abs(val);
  }, [amount]);

  const newBalance = useMemo(() => {
    if (actionType === "add") {
      return baselineBalance + numAmount;
    }
    return baselineBalance - numAmount;
  }, [baselineBalance, numAmount, actionType]);

  const isCashAccount = useMemo(() => {
    if (!selectedAccount) return true;
    return (
      selectedAccount.id === "cash" ||
      selectedAccount.bankName.toLowerCase().includes("cash")
    );
  }, [selectedAccount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) {
      setErrorMsg(tBank("accountRequired"));
      return;
    }
    if (!reason) {
      setErrorMsg(tBank("reasonRequired"));
      return;
    }
    if (numAmount <= 0) {
      setErrorMsg(tBank("amountRequired"));
      return;
    }
    if (actionType === "reduce") {
      if (baselineBalance <= 0) {
        setErrorMsg(tBank("cashCannotReduceBelowZero"));
        return;
      }
      if (numAmount > baselineBalance) {
        setErrorMsg(tBank("reduceCashExceedsAvailable"));
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Map reason code to human readable text
      const reasonMap: Record<string, string> = {
        physical_discrepancy: tBank("reasonPhysicalDiscrepancy"),
        owner_drawing: tBank("reasonOwnerDrawing"),
        owner_capital: tBank("reasonOwnerCapital"),
        petty_expense: tBank("reasonPettyExpense"),
        rounding_audit: tBank("reasonRoundingAudit"),
        other: tBank("reasonOther"),
      };
      const resolvedReason = reasonMap[reason] || reason;

      const accountName =
        selectedAccount?.bankName || selectedAccountName || "Cash in Hand";
      const paymentMethodId =
        selectedAccount?.id || selectedAccountId || "cash";

      let record: any;
      if (isEditMode && adjustmentToEdit) {
        const editId = adjustmentToEdit.id || adjustmentToEdit._id;
        record = await updateCashAdjustmentOffline(editId, {
          paymentMethodId,
          accountName,
          type: actionType,
          amount: numAmount,
          reason: resolvedReason,
          notes: notes.trim(),
          date: toSafeISOString(adjustmentDate),
        });
      } else {
        record = await recordCashAdjustmentOffline({
          paymentMethodId,
          accountName,
          type: actionType,
          amount: numAmount,
          reason: resolvedReason,
          notes: notes.trim(),
          date: toSafeISOString(adjustmentDate),
        });
      }

      if (onSuccess) {
        onSuccess(record);
      }

      onOpenChange(false);
    } catch (err: any) {
      console.error("Failed to record cash adjustment:", err);
      setErrorMsg(err?.message || tCommon("failedToSave"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] p-4 sm:p-6 overflow-y-auto max-h-[90vh]">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                {isEditMode ? tBank("editAdjustment") : tBank("adjustCash")}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {isEditMode
                  ? `${adjustmentToEdit?.ref_no || "CADJ"} — ${tBank("editAdjustmentDescription")}`
                  : tBank("adjustCashDescription")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 text-xs sm:text-sm text-rose-700 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Account Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              {tBank("selectAccount")} <span className="text-red-500">*</span>
            </Label>
            <PaymentMethodDropdown
              value={selectedAccountId}
              onValueChange={(val, method) => {
                setSelectedAccountId(val || "");
                if (method?.name) {
                  setSelectedAccountName(method.name);
                }
                setErrorMsg(null);
              }}
              customMethods={accounts.map((a) => ({
                id: String(a.id),
                name: a.bankName,
                bankDetails: a.bankDetails,
                is_default: Boolean((a as any).is_default || a.bankName.toLowerCase().includes("cash")),
              }))}
              includeDefaultMethods={false}
              defaultToCash={false}
              showAddButton={false}
              placeholder={tBank("selectAccount")}
              className="min-h-10 h-auto py-1.5 text-xs sm:text-sm"
            />
          </div>

          {/* Action Type Toggle (Add Cash vs Reduce Cash) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              {tBank("adjustmentType")}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className={`h-10 sm:h-11 text-xs sm:text-sm font-semibold gap-1.5 transition-all cursor-pointer ${
                  actionType === "add"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs"
                    : "border-border/80 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 dark:hover:border-emerald-800"
                }`}
                onClick={() => setActionType("add")}
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="truncate">{tBank("addCash")}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className={`h-10 sm:h-11 text-xs sm:text-sm font-semibold gap-1.5 transition-all cursor-pointer ${
                  actionType === "reduce"
                    ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-xs"
                    : "border-border/80 text-muted-foreground hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 dark:hover:border-rose-800"
                }`}
                onClick={() => setActionType("reduce")}
              >
                <Minus className="w-4 h-4 shrink-0" />
                <span className="truncate">{tBank("reduceCash")}</span>
              </Button>
            </div>
          </div>

          {/* Amount & Live Balance Calculation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="adjustCashAmount" className="text-xs font-semibold">
                {tBank("amount")} (Rs.) <span className="text-red-500">*</span>
              </Label>
              <NumericInput
                id="adjustCashAmount"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrorMsg(null);
                }}
                min="0"
                step="any"
                placeholder="0.00"
                className="h-10 text-xs sm:text-sm font-semibold text-foreground"
                autoFocus
              />
            </div>

            {/* Live New Balance Preview Card */}
            <div
              className={`p-2.5 rounded-lg border flex flex-col justify-center h-10 sm:h-10 transition-colors ${
                actionType === "add"
                  ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900"
                  : "bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                <span>{tBank("currentBalance")}:</span>
                <span className="font-semibold text-foreground">
                  {formatCurrencyString(currentBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold pt-0.5">
                <span>{tBank("newBalance")}:</span>
                <span
                  className={
                    actionType === "add"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-rose-700 dark:text-rose-400"
                  }
                >
                  {formatCurrencyString(newBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* Error message if reducing below zero or exceeding balance */}
          {actionType === "reduce" && (
            <>
              {currentBalance <= 0 && (
                <div className="flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{tBank("cashCannotReduceBelowZero")}</span>
                </div>
              )}
              {currentBalance > 0 && numAmount > currentBalance && (
                <div className="flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{tBank("reduceCashExceedsAvailable")}</span>
                </div>
              )}
            </>
          )}

          {/* Reason & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {tBank("reason")} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={reason || undefined}
                onValueChange={(val) => {
                  setReason(val);
                  setErrorMsg(null);
                }}
              >
                <SelectTrigger className="h-10 text-xs sm:text-sm">
                  <SelectValue placeholder={tBank("selectReason")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="physical_discrepancy">
                    {tBank("reasonPhysicalDiscrepancy")}
                  </SelectItem>
                  <SelectItem value="owner_drawing">
                    {tBank("reasonOwnerDrawing")}
                  </SelectItem>
                  <SelectItem value="owner_capital">
                    {tBank("reasonOwnerCapital")}
                  </SelectItem>
                  <SelectItem value="petty_expense">
                    {tBank("reasonPettyExpense")}
                  </SelectItem>
                  <SelectItem value="rounding_audit">
                    {tBank("reasonRoundingAudit")}
                  </SelectItem>
                  <SelectItem value="other">
                    {tBank("reasonOther")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adjustCashDate" className="text-xs font-semibold">
                {tBank("adjustmentDate")}
              </Label>
              <DatePicker
                id="adjustCashDate"
                value={adjustmentDate}
                onChange={(dateStr) => setAdjustmentDate(dateStr)}
                className="h-10 text-xs sm:text-sm"
                placeholder="DD-MM-YYYY"
              />
            </div>
          </div>

          {/* Notes / Description */}
          <div className="space-y-1.5">
            <Label htmlFor="adjustCashNotes" className="text-xs font-semibold">
              {tBank("notes")}
            </Label>
            <Input
              id="adjustCashNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tBank("notesPlaceholder")}
              className="h-10 text-xs sm:text-sm"
            />
          </div>

          <DialogFooter className="pt-3 border-t flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              className={
                actionType === "add"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
                  : "bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1.5"
              }
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{tCommon("saving")}</span>
                </>
              ) : (
                <span>
                  {isEditMode ? tCommon("save") : (actionType === "add" ? tBank("addCash") : tBank("reduceCash"))}
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
