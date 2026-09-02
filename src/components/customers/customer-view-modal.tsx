"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import type { Customer } from "./customer-form-modal";

interface CustomerViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

export function CustomerViewModal({ open, onOpenChange, customer }: CustomerViewModalProps) {
  const t = useTranslations("customers");

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl sm:text-2xl">
            {t("customerDetails")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:gap-6 py-3 sm:py-4">
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">
              {t("contactInformation")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("nameLabel")}</span>
                <div className="text-sm sm:text-base font-medium">
                  {customer.name || "-"}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">{t("phoneLabel")}</span>
                <div className="text-sm sm:text-base font-medium">
                  {customer.phone || "-"}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">{t("emailLabel")}</span>
              <div className="text-sm sm:text-base font-medium">
                {customer.email || "-"}
              </div>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">
              {t("companyInformation")}
            </h3>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                {t("companyNameLabel")}
              </span>
              <div className="text-sm sm:text-base font-medium">
                {customer.company_name || "-"}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">
                {t("companyAddressLabel")}
              </span>
              <div className="text-sm sm:text-base font-medium">
                {customer.company_address || "-"}
              </div>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">
              {t("financialInformation")}
            </h3>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">{t("balanceLabel")}</span>
              <div className="text-sm sm:text-base font-medium">
                {t("currencySymbol")}{" "}
                {customer.balance ? Math.round(customer.balance) : "0"}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-3 pt-3 sm:pt-4 flex-col-reverse sm:flex-row">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="h-9 sm:h-10 w-full sm:w-auto"
          >
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
