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
      includeDefaultMethods = true,
    },
    ref
  ) => {
    const t = useTranslations("configurationPage");
    const tCommon = useTranslations("common");

    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [bankName, setBankName] = useState("");
    const [bankDetails, setBankDetails] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [errorDialog, setErrorDialog] = useState<{
      open: boolean;
      title?: string;
      message: string;
      isSuccess?: boolean;
    }>({ open: false, message: "" });

    const fetchMethods = useCallback(async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/configuration/payment-method");
        let apiMethods: PaymentMethod[] = [];
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            apiMethods = data.map((item: any) => ({
              id: item.id,
              name: item.bankName || item.name,
              bankDetails: item.bankDetails,
            }));
          }
        }
        // Combine default methods + API methods (avoid duplicates by id)
        let allMethods = includeDefaultMethods ? [...DEFAULT_METHODS] : [];
        for (const m of apiMethods) {
          if (!allMethods.some(ex => ex.id === m.id)) {
            allMethods.push(m);
          }
        }
        setMethods(allMethods);
      } catch (error) {
        console.error(error);
        setErrorDialog({
          open: true,
          title: tCommon("error"),
          message: "Failed to load payment methods",
        });
      } finally {
        setLoading(false);
      }
    }, [includeDefaultMethods, tCommon]);

    useEffect(() => {
      fetchMethods();
    }, [fetchMethods]);

    const filteredMethods = React.useMemo(() => {
      if (!searchTerm.trim()) return methods;
      const term = searchTerm.toLowerCase();
      return methods.filter(
        (m) =>
          m.name?.toLowerCase().includes(term) ||
          m.bankDetails?.toLowerCase().includes(term)
      );
    }, [methods, searchTerm]);

    const resetForm = () => {
      setBankName("");
      setBankDetails("");
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
        const url = editingId
          ? `/api/configuration/payment-method/${editingId}`
          : "/api/configuration/payment-method";
        const method = editingId ? "PUT" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bankName: name,
            bankDetails: bankDetails.trim(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            res.status === 409
              ? t("paymentMethodBankNameDuplicate")
              : data?.error || "Failed to save"
          );
        }

        // Refresh list
        await fetchMethods();
        // Auto-select newly added/edited method
        const newId = data.id || editingId;
        const newMethod = { id: newId, name: data.bankName || name, bankDetails: data.bankDetails || bankDetails.trim() };
        onValueChange(newId, newMethod);

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
          {t("paymentMethodSave") || "Add Payment Method"}
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
            disabled={disabled || loading}
            open={isOpen}
            onOpenChange={handleOpenChange}
          >
            <SelectTrigger className={className} ref={ref}>
              <SelectValue placeholder={loading ? "Loading..." : placeholder} />
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
                {filteredMethods.length === 0 && !loading && (
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

          {loading && (
            <div className="absolute right-8 top-1/2 -translate-y-1/2">
              <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleAddMethod} disabled={isSaving || !bankName.trim()}>
                {isSaving ? tCommon("loading") : tCommon("save")}
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