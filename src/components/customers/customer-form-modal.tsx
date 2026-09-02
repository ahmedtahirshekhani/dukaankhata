"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_name?: string;
  company_address?: string;
  balance?: number;
  status: "active" | "inactive";
  is_delete?: number;
  type?: string;
  is_default?: boolean;
};

interface CustomerFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerToEdit?: Customer | null;
  allOfflineCustomers: Customer[];
  onSuccess?: () => void;
}

export function CustomerFormModal({
  open,
  onOpenChange,
  customerToEdit,
  allOfflineCustomers,
  onSuccess,
}: CustomerFormModalProps) {
  const t = useTranslations("customers");
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [balance, setBalance] = useState("");
  const [balanceType, setBalanceType] = useState<"receive" | "pay">("receive");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when opened or customerToEdit changes
  useEffect(() => {
    if (open) {
      if (customerToEdit) {
        setName(customerToEdit.name || "");
        setEmail(customerToEdit.email || "");
        setPhone(customerToEdit.phone || "");
        setCompanyName(customerToEdit.company_name || "");
        setCompanyAddress(customerToEdit.company_address || "");
        
        const bal = customerToEdit.balance || 0;
        setBalance(Math.abs(bal).toString());
        setBalanceType(bal < 0 ? "pay" : "receive");
        setStatus(customerToEdit.status || "active");
      } else {
        setName("");
        setEmail("");
        setPhone("");
        setCompanyName("");
        setCompanyAddress("");
        setBalance("");
        setBalanceType("receive");
        setStatus("active");
      }
    }
  }, [open, customerToEdit]);

  const handleSave = async () => {
    if (!name || name.trim() === "") {
      toast.error(t("customerNameRequired") || "Name is required");
      return;
    }

    const trimmedName = name.trim();
    const existingOfflineCustomer = allOfflineCustomers.find(
      (p) => 
        p.name && 
        p.name.toLowerCase() === trimmedName.toLowerCase() && 
        p.is_delete !== 1 && 
        p.id !== customerToEdit?.id
    );

    if (existingOfflineCustomer) {
      toast.error(t("customerNameExists") || "A party with this name already exists");
      return;
    }

    setIsSaving(true);
    try {
      const finalBalance = balance
        ? parseFloat(balance) * (balanceType === "pay" ? -1 : 1)
        : 0;

      if (customerToEdit) {
        // EDIT MODE
        const updatedCustomer = {
          ...customerToEdit,
          name,
          email,
          phone,
          company_name: companyName,
          company_address: companyAddress,
          balance: finalBalance,
          status,
        };

        await db.parties.update(customerToEdit.id, updatedCustomer);
        await SyncEngine.queueOperation("parties", "PUT", `/api/customers/${customerToEdit.id}`, updatedCustomer);
        
        toast.success(t("customerUpdatedSuccess") || "Customer updated successfully!");
      } else {
        // ADD MODE
        const newCustomer = {
          name,
          email,
          phone,
          company_name: companyName,
          company_address: companyAddress,
          balance: finalBalance,
          status,
          created_at: new Date().toISOString(),
        };

        const customerId = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
          
        const finalCustomer = { ...newCustomer, id: customerId, is_delete: 0, type: "customer" };
        
        await db.parties.add(finalCustomer);
        await SyncEngine.queueOperation("parties", "POST", "/api/customers", newCustomer, customerId);
        
        toast.success(t("customerCreatedSuccess") || "Customer created successfully!");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to save customer");
    } finally {
      setIsSaving(false);
    }
  };

  const isEditMode = !!customerToEdit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl sm:text-2xl">
            {!isEditMode ? t("createNewCustomer") : t("editCustomerTitle")}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 sm:gap-6 py-3 sm:py-4">
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">
              {t("contactInformation")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs sm:text-sm font-medium">
                  {t("nameLabel")}<span className="text-red-500 ml-1">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  className="h-9 sm:h-10 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs sm:text-sm font-medium">
                  {t("phoneLabel")}
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 11);
                    setPhone(value);
                  }}
                  maxLength={11}
                  placeholder={t("phonePlaceholder")}
                  className="h-9 sm:h-10 text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs sm:text-sm font-medium">
                {t("emailLabel")}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className="h-9 sm:h-10 text-sm"
              />
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">
              {t("companyInformation")}
            </h3>
            <div className="space-y-2">
              <Label htmlFor="company_name" className="text-xs sm:text-sm font-medium">
                {t("companyNameLabel")}
              </Label>
              <Input
                id="company_name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t("companyNamePlaceholder")}
                className="h-9 sm:h-10 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_address" className="text-xs sm:text-sm font-medium">
                {t("companyAddressLabel")}
              </Label>
              <Input
                id="company_address"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder={t("companyAddressPlaceholder")}
                className="h-9 sm:h-10 text-sm"
              />
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">
              {t("financialInformation")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="balance" className="text-xs sm:text-sm font-medium">
                  {!isEditMode ? t("openingBalance") : t("balanceLabel")}
                </Label>
                <NumericInput
                  id="balance"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder={t("balancePlaceholder")}
                  className="h-9 sm:h-10 text-sm"
                  disabled={isEditMode}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium">{t("balanceType")}</Label>
                <Select
                  disabled={isEditMode}
                  value={balanceType}
                  onValueChange={(val: "receive" | "pay") => setBalanceType(val)}
                >
                  <SelectTrigger className="h-9 sm:h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receive">{t("receive")}</SelectItem>
                    <SelectItem value="pay">{t("pay")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isEditMode ? (
              <p className="text-xs text-amber-600 mt-2 font-medium">
                {t("cannotUpdateBalanceWarning")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">
                {t("openingBalanceHelper")}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-3 pt-3 sm:pt-4 flex-col-reverse sm:flex-row">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="h-9 sm:h-10 w-full sm:w-auto"
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name || name.trim() === "" || isSaving}
            className="h-9 sm:h-10 w-full sm:w-auto sm:min-w-[120px]"
          >
            {isSaving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
            {!isEditMode ? t("createCustomer") : t("updateCustomer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
