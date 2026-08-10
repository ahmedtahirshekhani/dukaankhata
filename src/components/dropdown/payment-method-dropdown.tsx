// components/dropdown/payment-method-dropdown.tsx
"use client";

import React, { useState, useEffect, useCallback, forwardRef } from "react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Loader2Icon, SearchIcon, X } from "lucide-react";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { cn } from "@/lib/utils";
import { useOfflinePaymentMethods } from "@/lib/hooks/useOfflineData";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";

interface PaymentMethod {
  id: string;
  name: string;
  bankDetails?: string;
}

interface PaymentMethodDropdownProps {
  value?: string;
  onValueChange: (value: string, method?: PaymentMethod) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  noResultsText?: string;
  addButtonPosition?: "top" | "bottom";
  includeDefaultMethods?: boolean; // include Cash & Cheque
  defaultToCash?: boolean; // auto-select cash method if available
}

const DEFAULT_METHODS: PaymentMethod[] = [
  { id: "cash", name: "Cash", bankDetails: "" },
  { id: "cheque", name: "Cheque", bankDetails: "" },
];

export const PaymentMethodDropdown = forwardRef<HTMLButtonElement, PaymentMethodDropdownProps>(
  (
    {
      value,
      onValueChange,
      placeholder = "Select Payment Method",
      disabled = false,
      className = "",
      enableSearch = true,
      searchPlaceholder = "Search payment method...",
      noResultsText = "No payment methods found",
      addButtonPosition = "bottom",
      includeDefaultMethods = false,
      defaultToCash = false,
    },
    ref
  ) => {
    const t = useTranslations("configurationPage");
    const tCommon = useTranslations("common");
    const tBank = useTranslations("bankAccounts");

    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [bankName, setBankName] = useState("");
    const [bankDetails, setBankDetails] = useState("");
    const [openingBalance, setOpeningBalance] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [errorDialog, setErrorDialog] = useState<{
      open: boolean;
      title?: string;
      message: string;
      isSuccess?: boolean;
    }>({ open: false, message: "" });

    const offlineMethods = useOfflinePaymentMethods() || [];
    
    const methods = React.useMemo(() => {
      let allMethods = includeDefaultMethods ? [...DEFAULT_METHODS] : [];
      
      const apiMethods = offlineMethods.map((item: any) => ({
        id: item.id || item._id,
        name: item.bankName || item.name || item.bank_name,
        bankDetails: item.bankDetails || item.bank_details,
      }));

      for (const m of apiMethods) {
        if (!allMethods.some(ex => ex.id === m.id)) {
          allMethods.push(m);
        }
      }
      return allMethods;
    }, [offlineMethods, includeDefaultMethods]);

    const filteredMethods = React.useMemo(() => {
      if (!searchTerm.trim()) return methods;
      const term = searchTerm.toLowerCase();
      return methods.filter(
        (m) =>
          m.name?.toLowerCase().includes(term) ||
          m.bankDetails?.toLowerCase().includes(term)
      );
    }, [methods, searchTerm]);

    React.useEffect(() => {
      if (defaultToCash && !value && methods.length > 0) {
        const cashMethod = methods.find((m) => m.name?.toLowerCase().includes("cash"));
        if (cashMethod) {
          onValueChange(cashMethod.id, cashMethod);
        }
      }
    }, [methods, value, defaultToCash, onValueChange]);

    const resetForm = () => {
      setBankName("");
      setBankDetails("");
      setOpeningBalance("");
      setEditingId(null);
    };

    const handleAddMethod = async () => {
      const name = bankName.trim();
      if (!name) {
        setErrorDialog({
          open: true,
          title: tCommon("error"),
          message: t("paymentMethodBankNameRequired"),
        });
        return;
      }

      setIsSaving(true);
      try {
        const payload = {
          bankName: name,
          bankDetails: bankDetails.trim(),
          openingBalance: parseFloat(openingBalance) || 0,
        };

        const methodId = editingId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `temp_${Date.now()}`);
        
        const localMethod = {
          id: methodId,
          ...payload
        };

        if (editingId) {
          await db.payment_methods.put(localMethod);
          await SyncEngine.queueOperation("payment_methods", "PUT", `/api/configuration/payment-method/${editingId}`, payload);
        } else {
          // Check for local duplicate
          const existing = methods.find(m => m.name.toLowerCase() === name.toLowerCase());
          if (existing) {
            throw new Error(t("paymentMethodBankNameDuplicate"));
          }

          await db.payment_methods.add(localMethod);
          await SyncEngine.queueOperation("payment_methods", "POST", "/api/configuration/payment-method", payload, methodId);
        }

        // Auto-select newly added/edited method
        const newMethod = { id: methodId, name: payload.bankName, bankDetails: payload.bankDetails };
        onValueChange(methodId, newMethod);

        setShowAddDialog(false);
        resetForm();
        setErrorDialog({
          open: true,
          title: tCommon("success"),
          message: editingId ? t("paymentMethodUpdated") : t("paymentMethodSaved"),
          isSuccess: true,
        });
      } catch (err) {
        setErrorDialog({
          open: true,
          title: tCommon("error"),
          message: err instanceof Error ? err.message : "Failed to save",
        });
      } finally {
        setIsSaving(false);
      }
    };

    const handleValueChange = (newValue: string) => {
      const selected = methods.find((m) => m.id === newValue);
      onValueChange(newValue, selected);
      setIsOpen(false);
      setSearchTerm("");
    };

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (!open) setSearchTerm("");
    };

    const openAddDialog = () => {
      resetForm();
      setShowAddDialog(true);
      setIsOpen(false);
    };

    const truncateDetails = (details?: string) => {
      if (!details) return "";
      return details.length > 60 ? details.substring(0, 57) + "..." : details;
    };

    // Add Button UI
    const AddButton = () => (
      <div
        className="border-t mt-0 pt-1 sticky bottom-0 bg-popover"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          className="flex w-full items-center gap-2 px-2 py-2 rounded-none hover:bg-accent"
          onClick={openAddDialog}
        >
          <PlusCircle className="h-4 w-4" />
          {tCommon("addPaymentMethod") || "Add Payment Method"}
        </Button>
      </div>
    );

    const AddButtonTop = () => (
      <div
        className="sticky top-0 bg-popover z-10 border-b"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          className="flex w-full items-center gap-2 px-2 py-2 rounded-none hover:bg-accent"
          onClick={openAddDialog}
        >
          <PlusCircle className="h-4 w-4" />
          {t("paymentMethodSave") || "Add Payment Method"}
        </Button>
      </div>
    );

    return (
      <>
        <div className="relative">
          <Select
            value={value}
            onValueChange={handleValueChange}
            disabled={disabled}
            open={isOpen}
            onOpenChange={handleOpenChange}
          >
            <SelectTrigger className={className} ref={ref}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="min-w-[280px] max-w-[90vw] p-0">
              {addButtonPosition === "top" && <AddButtonTop />}

              {enableSearch && (
                <div className="sticky top-0 bg-popover z-10 border-b p-2">
                  <div className="relative">
                    <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={searchPlaceholder}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="pl-8 pr-8 h-8 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchTerm("");
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      >
                        <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="max-h-[300px] overflow-y-auto">
                {filteredMethods.length === 0 && (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    {searchTerm ? noResultsText : "No payment methods available"}
                  </div>
                )}
                {filteredMethods.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    <div className="flex flex-col items-start gap-0.5 py-0.5">
                      <span className="font-medium">{method.name}</span>
                      {method.bankDetails && (
                        <span className="text-xs text-muted-foreground truncate max-w-[280px]">
                          {truncateDetails(method.bankDetails)}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </div>

              {addButtonPosition === "bottom" && <AddButton />}
            </SelectContent>
          </Select>
        </div>

        {/* Add/Edit Payment Method Modal */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? tCommon("edit") : t("paymentMethodSave")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bank-name" className="required">
                  {t("paymentMethodBankName")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="bank-name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder={t("paymentMethodBankNamePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-details">{t("paymentMethodBankDetails")}</Label>
                <Textarea
                  id="bank-details"
                  value={bankDetails}
                  onChange={(e) => setBankDetails(e.target.value)}
                  placeholder={t("paymentMethodBankDetailsPlaceholder")}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opening-balance">{tBank("openingBalance")}</Label>
                <Input
                  id="opening-balance"
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleAddMethod} disabled={isSaving || !bankName.trim()}>
                {isSaving ? tCommon("loading") : tCommon("addPaymentMethod")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ErrorDialog
          open={errorDialog.open}
          onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
          title={errorDialog.title}
          message={errorDialog.message}
          isSuccess={errorDialog.isSuccess}
        />
      </>
    );
  }
);

PaymentMethodDropdown.displayName = "PaymentMethodDropdown";