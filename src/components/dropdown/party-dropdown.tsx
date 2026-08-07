// components/dropdown/party-dropdown.tsx
"use client";

import React, { useState, useEffect, useCallback, forwardRef, useRef, useMemo } from "react";
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
import { PlusCircle, Loader2Icon, SearchIcon, X, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { useOfflineCustomers } from "@/lib/hooks/useOfflineData";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { db } from "@/lib/db/offline-db";
import { cn } from "@/lib/utils";

type Party = {
  id: string | number;
  _id?: string | number;
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

    const [showAddDialog, setShowAddDialog] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Reduced debounce to 100ms for instant local search feel
    const debouncedSearchTerm = useDebounce(searchTerm, 100);
    const [isOpen, setIsOpen] = useState(false);

    const [page, setPage] = useState(1);
    const observerTarget = useRef<HTMLDivElement>(null);

    const [newPartyName, setNewPartyName] = useState("");
    const [newPartyEmail, setNewPartyEmail] = useState("");
    const [newPartyPhone, setNewPartyPhone] = useState("");
    const [newPartyCompanyName, setNewPartyCompanyName] = useState("");
    const [newPartyCompanyAddress, setNewPartyCompanyAddress] = useState("");
    const [newPartyOpeningBalance, setNewPartyOpeningBalance] = useState("");
    const [newPartyOpeningBalanceType, setNewPartyOpeningBalanceType] = useState<"receive" | "pay">("receive");
    const [errorDialog, setErrorDialog] = useState<{
      open: boolean;
      title?: string;
      message: string;
      isSuccess?: boolean;
    }>({ open: false, message: "" });

    // Offline data hook
    const allOfflineCustomers = useOfflineCustomers(debouncedSearchTerm) || [];

    // Filter active only if needed
    const filteredCustomers = useMemo(() => {
      let filtered = allOfflineCustomers;
      if (filterActiveOnly) {
        filtered = filtered.filter(p => p.status !== "inactive");
      }
      return filtered;
    }, [allOfflineCustomers, filterActiveOnly]);

    const getPartyId = (p: Party) => String(p.id || p._id);



    // Pagination
    const parties = useMemo(() => {
      let paginated = filteredCustomers.slice(0, page * 20);

      if (value && value !== "all") {
        const isSelectedInPaginated = paginated.some(p => getPartyId(p) === value);
        if (!isSelectedInPaginated) {
          const selectedParty = filteredCustomers.find(p => getPartyId(p) === value);
          if (selectedParty) {
            paginated = [selectedParty, ...paginated];
          }
        }
      }

      return paginated;
    }, [filteredCustomers, page, value]);

    const hasMore = parties.length < filteredCustomers.length;
    const loading = false; // Local DB is fast
    const loadingMore = false;

    // Reset page when search or dropdown open state changes
    useEffect(() => {
      if (isOpen) {
        setPage(1);
      }
    }, [debouncedSearchTerm, isOpen]);

    // Infinite scroll pagination
    useEffect(() => {
      if (!hasMore || loading || loadingMore || !isOpen) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setPage(prev => prev + 1);
          }
        },
        { threshold: 0.1 }
      );

      if (observerTarget.current) {
        observer.observe(observerTarget.current);
      }

      return () => observer.disconnect();
    }, [hasMore, loading, loadingMore, isOpen]);

    const resetForm = () => {
      setNewPartyName("");
      setNewPartyEmail("");
      setNewPartyPhone("");
      setNewPartyCompanyName("");
      setNewPartyCompanyAddress("");
      setNewPartyOpeningBalance("");
      setNewPartyOpeningBalanceType("receive");
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

      const trimmedName = newPartyName.trim();
      const existingOfflineParty = allOfflineCustomers.find(
        (p) => p.name.toLowerCase() === trimmedName.toLowerCase() && p.is_delete !== 1
      );

      if (existingOfflineParty) {
        setErrorDialog({
          open: true,
          title: t("error"),
          message: "A party with this name already exists",
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
          balance: newPartyOpeningBalance
            ? parseFloat(newPartyOpeningBalance) * (newPartyOpeningBalanceType === "pay" ? -1 : 1)
            : 0,
          status: "active" as const,
        };

        const customerId = crypto.randomUUID();
        const finalCustomer = { ...newParty, id: customerId, is_delete: 0, type: "customer" };

        await db.parties.add(finalCustomer);
        await SyncEngine.queueOperation("parties", "POST", "/api/customers", newParty, customerId);

        onValueChange(customerId, finalCustomer);
        if (onPartyAdded) onPartyAdded(finalCustomer);

        setShowAddDialog(false);
        resetForm();
        setSearchTerm("");

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
      const selectedParty = allOfflineCustomers.find((p) => getPartyId(p) === newValue);
      onValueChange(newValue, selectedParty);
      setIsOpen(false);
      setSearchTerm("");
    };

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (!open) setSearchTerm("");
    };

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
            <SelectTrigger className={cn("w-full [&>span]:flex-1 [&>span]:flex [&>span]:items-center [&>span]:justify-between gap-2", className)} ref={ref}>
              <SelectValue placeholder={loading ? "Loading..." : placeholder} />
            </SelectTrigger>
            <SelectContent
              position="popper"
              sideOffset={5}
              className="min-w-[280px] max-w-[90vw] p-0 overflow-hidden"
              collisionPadding={10}
            >
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

              <div className="max-h-[min(300px,var(--radix-select-content-available-height)-100px)] overflow-y-auto custom-scrollbar">
                <div className="flex flex-col sticky top-0 z-[5] bg-popover border-b">
                  {/* Dropdown Legend */}
                  <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/50 text-[10px]">
                    <span className="font-semibold text-muted-foreground uppercase tracking-wider">{t("legend")}:</span>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>{t("receive")}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span>{t("pay")}</span>
                    </div>
                  </div>
                  {/* Column Headers */}
                  <div className="flex items-center justify-between px-3 py-1 bg-muted/20 text-[9px] font-bold uppercase tracking-wider text-muted-foreground border-t">
                    <span>{t("nameLabel")}</span>
                    <span>{t("balance")}</span>
                  </div>
                </div>
                {includeAllOption && (
                  <SelectItem value="all" className="font-medium">
                    {allOptionLabel}
                  </SelectItem>
                )}

                {parties.length === 0 && !loading && (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    {searchTerm ? noResultsText : "No parties found"}
                  </div>
                )}

                {parties.map((party) => {
                  const partyId = getPartyId(party);
                  const balance = party.balance || 0;
                  return (
                    <SelectItem
                      key={partyId}
                      value={partyId}
                      className={cn(
                        "w-full [&>span]:w-full [&>span]:flex [&>span]:items-center",
                        balance < 0 && "bg-red-100/50 focus:bg-red-200/50 focus:text-black data-[state=checked]:bg-red-200/70",
                        balance > 0 && "bg-green-100/50 focus:bg-green-200/50 focus:text-black data-[state=checked]:bg-green-200/70"
                      )}
                    >
                      <div className="flex w-full items-center justify-between gap-4 py-0.5">
                        <div className="flex flex-col items-start gap-0.5 max-w-[200px]">
                          <span className="font-medium truncate w-full">{party.name}</span>
                          {/* {party.company_name && (
                            <span className="text-[10px] opacity-70 truncate w-full">
                              🏢 {party.company_name}
                            </span>
                          )} */}
                          {/* {party.company_address && (
                            <span className="text-[9px] opacity-60 truncate w-full italic">
                              📍 {party.company_address}
                            </span>
                          )} */}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-semibold">
                            {Math.abs(balance).toLocaleString()}
                          </span>
                          {balance < 0 ? (
                            <div className="p-0.5 bg-red-500 rounded text-white">
                              <ArrowUpRight className="w-3 h-3" />
                            </div>
                          ) : balance > 0 ? (
                            <div className="p-0.5 bg-green-500 rounded text-white">
                              <ArrowDownLeft className="w-3 h-3" />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}

                {/* Intersection Observer Target */}
                <div ref={observerTarget} className="flex flex-col items-center justify-center p-4 gap-2 min-h-[50px]">
                  {loadingMore ? (
                    <>
                      <Loader2Icon className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground animate-pulse">Loading more...</span>
                    </>
                  ) : hasMore ? (
                    <div className="h-1 w-1" />
                  ) : parties.length > 0 ? (
                    <span className="text-[10px] text-muted-foreground/50">End of list</span>
                  ) : null}
                </div>
              </div>

              <div className="border-t mt-0 pt-1 sticky bottom-0 bg-popover" onClick={(e) => e.stopPropagation()}>
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

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl">{t("createNewCustomer")}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:gap-6 py-3 sm:py-4">
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">{t("contactInformation")}</h3>
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
                    <Label htmlFor="party-phone" className="text-xs sm:text-sm font-medium">{t("phoneLabel")}</Label>
                    <Input
                      id="party-phone"
                      value={newPartyPhone}
                      onChange={(e) => setNewPartyPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                      maxLength={11}
                      placeholder={t("phonePlaceholder")}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="party-email" className="text-xs sm:text-sm font-medium">{t("emailLabel")}</Label>
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

              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">{t("companyInformation")}</h3>
                <div className="space-y-2">
                  <Label htmlFor="party-company" className="text-xs sm:text-sm font-medium">{t("companyNameLabel")}</Label>
                  <Input
                    id="party-company"
                    value={newPartyCompanyName}
                    onChange={(e) => setNewPartyCompanyName(e.target.value)}
                    placeholder={t("companyNamePlaceholder")}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="party-address" className="text-xs sm:text-sm font-medium">{t("companyAddressLabel")}</Label>
                  <Input
                    id="party-address"
                    value={newPartyCompanyAddress}
                    onChange={(e) => setNewPartyCompanyAddress(e.target.value)}
                    placeholder={t("companyAddressPlaceholder")}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">{t("financialInformation")}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="party-balance" className="text-xs sm:text-sm font-medium">{t("openingBalance")}</Label>
                    <Input
                      id="party-balance"
                      type="number"
                      value={newPartyOpeningBalance}
                      onChange={(e) => setNewPartyOpeningBalance(e.target.value)}
                      placeholder={t("balancePlaceholder")}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm font-medium">{t("balanceType")}</Label>
                    <Select value={newPartyOpeningBalanceType} onValueChange={(val: "receive" | "pay") => setNewPartyOpeningBalanceType(val)}>
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
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-3 pt-3 sm:pt-4 flex-col-reverse sm:flex-row">
              <Button variant="secondary" onClick={() => { setShowAddDialog(false); resetForm(); }} className="h-9 sm:h-10 w-full sm:w-auto">
                {tCommon("cancel")}
              </Button>
              <Button onClick={handleAddParty} disabled={!newPartyName || newPartyName.trim() === "" || isSaving} className="h-9 sm:h-10 w-full sm:w-auto sm:min-w-[120px]">
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


