
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
import { PlusCircle, Loader2Icon, SearchIcon, X } from "lucide-react";
import { ErrorDialog } from "@/components/dialogs/error-dialog";

type Party = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  company_address?: string;
  balance?: number;
  status?: "active" | "inactive";
  is_delete?: number;
};

interface PartyDropdownProps {
  value?: string;
  onValueChange: (value: string, party?: Party) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  filterActiveOnly?: boolean;
  onPartyAdded?: (party: Party) => void;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  noResultsText?: string;
}

export const PartyDropdown = forwardRef<HTMLButtonElement, PartyDropdownProps>(
  (
    {
      value,
      onValueChange,
      placeholder = "Select Party",
      disabled = false,
      className = "",
      includeAllOption = false,
      allOptionLabel = "All Parties",
      filterActiveOnly = true,
      onPartyAdded,
      enableSearch = true,
      searchPlaceholder = "Search party...",
      noResultsText = "No parties found",
    },
    ref
  ) => {
    const t = useTranslations("customers");
    const tCommon = useTranslations("common");

    const [parties, setParties] = useState<Party[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [newPartyName, setNewPartyName] = useState("");
    const [newPartyEmail, setNewPartyEmail] = useState("");
    const [newPartyPhone, setNewPartyPhone] = useState("");
    const [newPartyCompanyName, setNewPartyCompanyName] = useState("");
    const [newPartyCompanyAddress, setNewPartyCompanyAddress] = useState("");
    const [newPartyOpeningBalance, setNewPartyOpeningBalance] = useState("");
    const [errorDialog, setErrorDialog] = useState<{
      open: boolean;
      title?: string;
      message: string;
      isSuccess?: boolean;
    }>({ open: false, message: "" });

    const fetchParties = useCallback(async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/customers");
        if (!response.ok) {
          throw new Error("Failed to fetch parties");
        }
        const data = await response.json();
        let filteredData = data;
        if (filterActiveOnly) {
          filteredData = data.filter(
            (party: Party) => party.is_delete !== 1 && party.status === "active"
          );
        } else {
          filteredData = data.filter((party: Party) => party.is_delete !== 1);
        }
        setParties(filteredData);
      } catch (error) {
        console.error("Error fetching parties:", error);
        setErrorDialog({
          open: true,
          title: t("error"),
          message: error instanceof Error ? error.message : t("failedToFetch"),
        });
      } finally {
        setLoading(false);
      }
    }, [filterActiveOnly, t]);

    useEffect(() => {
      fetchParties();
    }, [fetchParties]);

    // Filter parties based on search term
    const filteredParties = React.useMemo(() => {
      if (!searchTerm.trim()) return parties;
      
      const term = searchTerm.toLowerCase().trim();
      return parties.filter((party) => 
        party.name?.toLowerCase().includes(term) ||
        party.email?.toLowerCase().includes(term) ||
        party.phone?.toLowerCase().includes(term) ||
        party.company_name?.toLowerCase().includes(term)
      );
    }, [parties, searchTerm]);

    const resetForm = () => {
      setNewPartyName("");
      setNewPartyEmail("");
      setNewPartyPhone("");
      setNewPartyCompanyName("");
      setNewPartyCompanyAddress("");
      setNewPartyOpeningBalance("");
    };

    const resetSearch = () => {
      setSearchTerm("");
    };

    const handleAddParty = async () => {
      if (!newPartyName || newPartyName.trim() === "") {
        setErrorDialog({
          open: true,
          title: t("validationError"),
          message: t("customerNameRequired"),
        });
        return;
      }

      setIsSaving(true);
      try {
        const newParty = {
          name: newPartyName.trim(),
          email: newPartyEmail,
          phone: newPartyPhone,
          company_name: newPartyCompanyName,
          company_address: newPartyCompanyAddress,
          balance: newPartyOpeningBalance ? parseFloat(newPartyOpeningBalance) : 0,
          status: "active" as const,
        };

        const response = await fetch("/api/customers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(newParty),
        });

        const text = await response.text();
        let createdParty;
        try {
          createdParty = JSON.parse(text);
        } catch (e) {
          throw new Error(`Server response error: ${text || response.statusText}`);
        }

        if (!response.ok) {
          throw new Error(createdParty.error || "Error creating party");
        }

        // Add the new party to the list
        setParties((prev) => [createdParty, ...prev]);
        
        // Auto-select the newly created party
        onValueChange(createdParty.id, createdParty);
        
        // Call the callback if provided
        if (onPartyAdded) {
          onPartyAdded(createdParty);
        }

        setShowAddDialog(false);
        resetForm();
        resetSearch();

        setErrorDialog({
          open: true,
          title: t("success"),
          message: t("customerCreatedSuccess"),
          isSuccess: true,
        });
      } catch (error) {
        console.error(error);
        setErrorDialog({
          open: true,
          title: t("error"),
          message: error instanceof Error ? error.message : t("failedToCreateCustomer"),
        });
      } finally {
        setIsSaving(false);
      }
    };

    const handleValueChange = (newValue: string) => {
      const selectedParty = parties.find((p) => p.id === newValue);
      onValueChange(newValue, selectedParty);
      setIsOpen(false);
      resetSearch();
    };

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        // Reset search when dropdown closes
        resetSearch();
      }
    };

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
              {/* Search Input */}
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
                          resetSearch();
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
                {includeAllOption && (
                  <SelectItem value="all" className="font-medium">
                    {allOptionLabel}
                  </SelectItem>
                )}
                
                {filteredParties.length === 0 && !loading && (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    {searchTerm ? noResultsText : "No parties found"}
                  </div>
                )}
                
                {filteredParties.map((party) => (
                  <SelectItem key={party.id} value={party.id}>
                    <div className="flex flex-col items-start gap-0.5 py-0.5">
                      <span className="font-medium">{party.name}</span>
                      {/* {(party.phone || party.email) && (
                        <span className="text-xs text-muted-foreground">
                          {party.phone || party.email}
                        </span>
                      )} */}
                      {party.company_name && searchTerm && (
                        <span className="text-xs text-muted-foreground">
                          {party.company_name}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </div>
              
              {/* Add Party Button at bottom */}
              <div
                className="border-t mt-0 pt-1 sticky bottom-0 bg-popover"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="ghost"
                  className="flex w-full items-center gap-2 px-2 py-2 rounded-none hover:bg-accent"
                  onClick={() => {
                    setIsOpen(false);
                    setShowAddDialog(true);
                  }}
                >
                  <PlusCircle className="h-4 w-4" />
                  Add New Party
                </Button>
              </div>
            </SelectContent>
          </Select>
          
          {loading && (
            <div className="absolute right-8 top-1/2 -translate-y-1/2">
              <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Add Party Modal */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl">
                {t("createNewCustomer")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:gap-6 py-3 sm:py-4">
              {/* Contact Information Section */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("contactInformation")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="party-name" className="text-xs sm:text-sm font-medium">
                      {t("nameLabel")}<span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Input
                      id="party-name"
                      value={newPartyName}
                      onChange={(e) => setNewPartyName(e.target.value)}
                      placeholder={t("namePlaceholder")}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="party-phone" className="text-xs sm:text-sm font-medium">
                      {t("phoneLabel")}
                    </Label>
                    <Input
                      id="party-phone"
                      value={newPartyPhone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 11);
                        setNewPartyPhone(value);
                      }}
                      maxLength={11}
                      placeholder={t("phonePlaceholder")}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="party-email" className="text-xs sm:text-sm font-medium">
                    {t("emailLabel")}
                  </Label>
                  <Input
                    id="party-email"
                    type="email"
                    value={newPartyEmail}
                    onChange={(e) => setNewPartyEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>

              {/* Company Information Section */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("companyInformation")}
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="party-company" className="text-xs sm:text-sm font-medium">
                    {t("companyNameLabel")}
                  </Label>
                  <Input
                    id="party-company"
                    value={newPartyCompanyName}
                    onChange={(e) => setNewPartyCompanyName(e.target.value)}
                    placeholder={t("companyNamePlaceholder")}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="party-address" className="text-xs sm:text-sm font-medium">
                    {t("companyAddressLabel")}
                  </Label>
                  <Input
                    id="party-address"
                    value={newPartyCompanyAddress}
                    onChange={(e) => setNewPartyCompanyAddress(e.target.value)}
                    placeholder={t("companyAddressPlaceholder")}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>

              {/* Financial Information Section */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("financialInformation")}
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="party-balance" className="text-xs sm:text-sm font-medium">
                    {t("openingBalance")}
                  </Label>
                  <Input
                    id="party-balance"
                    type="number"
                    value={newPartyOpeningBalance}
                    onChange={(e) => setNewPartyOpeningBalance(e.target.value)}
                    placeholder={t("balancePlaceholder")}
                    className="h-9 sm:h-10 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("openingBalanceHelper")}
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-3 pt-3 sm:pt-4 flex-col-reverse sm:flex-row">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAddDialog(false);
                  resetForm();
                }}
                className="h-9 sm:h-10 w-full sm:w-auto"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={handleAddParty}
                disabled={!newPartyName || newPartyName.trim() === "" || isSaving}
                className="h-9 sm:h-10 w-full sm:w-auto sm:min-w-[120px]"
              >
                {isSaving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                {t("createCustomer")}
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

PartyDropdown.displayName = "PartyDropdown";