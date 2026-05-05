// components/dropdown/party-dropdown.tsx
"use client";

import React, { useState, useEffect, useCallback, forwardRef, useRef } from "react";
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
import { useDebounce } from "@/hooks/use-debounce";

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

const ITEMS_PER_PAGE = 20;

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
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [isOpen, setIsOpen] = useState(false);
    
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const observerTarget = useRef<HTMLDivElement>(null);
    const [initialPartyLoaded, setInitialPartyLoaded] = useState(false);

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

    const getPartyId = (p: Party) => String(p.id || p._id);

    const fetchParties = useCallback(async (pageNum: number, search: string, append = false) => {
      try {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);

        const url = new URL("/api/customers", window.location.origin);
        url.searchParams.append("page", pageNum.toString());
        url.searchParams.append("limit", ITEMS_PER_PAGE.toString());
        if (search) url.searchParams.append("search", search);
        if (filterActiveOnly) url.searchParams.append("status", "active");

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error("Failed to fetch parties");
        const data = await response.json();
        
        const customers = data.customers || [];
        const filteredData = customers.filter((party: Party) => party.is_delete !== 1);
        
        setParties(prev => append ? [...prev, ...filteredData] : filteredData);
        setHasMore(customers.length === ITEMS_PER_PAGE);
      } catch (error) {
        console.error("Error fetching parties:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    }, [filterActiveOnly]);

    const fetchSelectedParty = useCallback(async (partyId: string) => {
      if (!partyId || partyId === "all") return;
      try {
        const res = await fetch(`/api/customers/${partyId}`);
        if (res.ok) {
          const party = await res.json();
          setParties(prev => {
            const exists = prev.find(p => getPartyId(p) === partyId);
            if (exists) return prev;
            return [party, ...prev];
          });
        }
      } catch (error) {
        console.error("Error fetching selected party:", error);
      }
    }, []);

    useEffect(() => {
      setPage(1);
      fetchParties(1, debouncedSearchTerm, false);
    }, [debouncedSearchTerm, fetchParties]);

    useEffect(() => {
      if (value && value !== "all" && !initialPartyLoaded) {
        const exists = parties.find(p => getPartyId(p) === value);
        if (!exists) {
          fetchSelectedParty(value);
        }
        setInitialPartyLoaded(true);
      }
    }, [value, parties, initialPartyLoaded, fetchSelectedParty]);

    useEffect(() => {
      if (!hasMore || loading || loadingMore || !isOpen) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchParties(nextPage, debouncedSearchTerm, true);
          }
        },
        { threshold: 0.1 }
      );

      if (observerTarget.current) {
        observer.observe(observerTarget.current);
      }

      return () => observer.disconnect();
    }, [hasMore, loading, loadingMore, page, debouncedSearchTerm, fetchParties, isOpen]);

    const resetForm = () => {
      setNewPartyName("");
      setNewPartyEmail("");
      setNewPartyPhone("");
      setNewPartyCompanyName("");
      setNewPartyCompanyAddress("");
      setNewPartyOpeningBalance("");
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newParty),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Error creating party");

        setParties((prev) => [data, ...prev]);
        onValueChange(String(data.id || data._id), data);
        if (onPartyAdded) onPartyAdded(data);

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
      const selectedParty = parties.find((p) => getPartyId(p) === newValue);
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
            <SelectTrigger className={className} ref={ref}>
              <SelectValue placeholder={loading && page === 1 ? "Loading..." : placeholder} />
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
                  return (
                    <SelectItem key={partyId} value={partyId}>
                      <div className="flex flex-col items-start gap-0.5 py-0.5">
                        <span className="font-medium">{party.name}</span>
                        {party.company_name && (
                          <span className="text-xs text-muted-foreground">
                            {party.company_name}
                          </span>
                        )}
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
          
          {loading && page === 1 && (
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


