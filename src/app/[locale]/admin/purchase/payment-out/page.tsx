"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Loader2Icon,
  PlusCircle,
  Trash2,
  SearchIcon,
  FilePenIcon,
  FilterIcon,
  XIcon,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PartyDropdown } from "@/components/dropdown/party-dropdown";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { PaymentMethodDropdown } from "@/components/dropdown/payment-method-dropdown";
import { Pagination } from "@/components/ui/pagination";
import { useOfflineCustomers, useOfflineCustomerTransactions, useOfflinePaymentMethods } from "@/lib/hooks/useOfflineData";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { updateOfflinePartyBalance } from "@/lib/ledger/offline-ledger";

type Party = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

type PaymentMethod = {
  id: string;
  name: string;
  bankDetails?: string;
};

type PartyTransaction = {
  id: string;
  customerId: string;
  customerName: string;
  paymentAmount: number;
  paymentMethodId: string;
  paymentMethodName: string;
  date: string;
  type: string;
};

export default function PaymentOutPage() {
  const locale = useLocale();
  const t = useTranslations("paymentOut");
  const tCommon = useTranslations("common");

  const [transactions, setTransactions] = useState<PartyTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<PartyTransaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    paymentMethod: "all",
    party: "all",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title?: string;
    message: string;
    isSuccess?: boolean;
  }>({ open: false, message: "" });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isPageLoading, setIsPageLoading] = useState(false);

  const [formPartyId, setFormPartyId] = useState("");
  const [formPaymentAmount, setFormPaymentAmount] = useState("");
  const [formPaymentMethodId, setFormPaymentMethodId] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Replace API fetching with offline hook for the filter dropdown
  const offlineParties = useOfflineCustomers() || [];
  const parties = useMemo(() => {
    return offlineParties.filter((p) => p.is_delete !== 1);
  }, [offlineParties]);

  // Infinite scroll for Filter Dropdown
  const [filterPartyPage, setFilterPartyPage] = useState(1);
  const displayParties = useMemo(() => {
    return parties.slice(0, filterPartyPage * 50);
  }, [parties, filterPartyPage]);
  const hasMoreFilterParties = displayParties.length < parties.length;

  // Replace API fetching with offline hook
  const offlineTransactions = useOfflineCustomerTransactions("payment-out", searchTerm, filters.paymentMethod, filters.party);
  const loading = offlineTransactions === undefined;
  const allOfflineTransactions = offlineTransactions || [];
  
  const totalCount = allOfflineTransactions.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const filteredTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return allOfflineTransactions.slice(startIndex, startIndex + pageSize);
  }, [allOfflineTransactions, currentPage, pageSize]);

  const offlinePaymentMethods = useOfflinePaymentMethods() || [];
  
  const paymentMethods = useMemo(() => {
    const list = offlinePaymentMethods.map((item: any) => ({
      id: item.id || item._id,
      name: item.bankName || item.name || item.bank_name,
      bankDetails: item.bankDetails || item.bank_details,
    })).filter((item) => item.id && item.name);

    const allMethods = [
      { id: "cash", name: "Cash" },
      { id: "cheque", name: "Cheque" },
      ...list,
    ];

    // Remove duplicates
    const uniqueMap = new Map();
    allMethods.forEach(m => uniqueMap.set(m.id, m));
    return Array.from(uniqueMap.values());
  }, [offlinePaymentMethods]);

  const resetForm = useCallback(() => {
    setFormPartyId("");
    setFormPaymentAmount("");
    setFormPaymentMethodId("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setSelectedId(null);
  }, []);

  const handleAdd = useCallback(async () => {
    if (!formPartyId || !formPaymentMethodId) {
      setErrorDialog({ open: true, title: t("validationError"), message: t("allFieldsRequired") });
      return;
    }
    const amount = parseFloat(formPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorDialog({ open: true, title: t("validationError"), message: t("amountRequired") });
      return;
    }

    setIsSaving(true);
    try {
      const party = parties.find(c => c.id === formPartyId || c._id === formPartyId);
      const paymentMethod = paymentMethods.find(p => p.id === formPaymentMethodId);

      const payload = {
        customerId: formPartyId,
        paymentAmount: amount,
        paymentMethodId: formPaymentMethodId,
        date: formDate,
        type: "payment-out"
      };

      const transactionId = crypto.randomUUID();
      const localTransaction = {
        id: transactionId,
        ...payload,
        customerName: party?.name || "",
        paymentMethodName: paymentMethod?.name || formPaymentMethodId,
        created_at: new Date().toISOString()
      };

      await db.party_transactions.add(localTransaction);
      // Payment Out increases payable balance (amountDelta is positive)
      await updateOfflinePartyBalance(formPartyId, amount);
      await SyncEngine.queueOperation("party_transactions", "POST", "/api/customer-transactions", payload, transactionId);

      setShowAddDialog(false);
      resetForm();
      setErrorDialog({ open: true, title: tCommon("success"), message: t("createdSuccess"), isSuccess: true });
    } catch (err) {
      console.error(err);
      setErrorDialog({ open: true, title: t("error"), message: err instanceof Error ? err.message : t("failedToCreate") });
    } finally {
      setIsSaving(false);
    }
  }, [formPartyId, formPaymentAmount, formPaymentMethodId, formDate, parties, paymentMethods, resetForm, t, tCommon]);

  const handleEdit = useCallback(async () => {
    if (!selectedId) return;
    if (!formPartyId || !formPaymentMethodId) {
      setErrorDialog({ open: true, title: t("validationError"), message: t("allFieldsRequired") });
      return;
    }
    const amount = parseFloat(formPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorDialog({ open: true, title: t("validationError"), message: t("amountRequired") });
      return;
    }

    setIsSaving(true);
    try {
      const oldTransaction = await db.party_transactions.get(selectedId);
      if (oldTransaction) {
        // Revert old balance change
        await updateOfflinePartyBalance(oldTransaction.customerId, -oldTransaction.paymentAmount);
      }

      const party = parties.find(c => c.id === formPartyId || c._id === formPartyId);
      const paymentMethod = paymentMethods.find(p => p.id === formPaymentMethodId);

      const payload = {
        customerId: formPartyId,
        paymentAmount: amount,
        paymentMethodId: formPaymentMethodId,
        date: formDate,
        type: "payment-out"
      };

      const localTransaction = {
        id: selectedId,
        ...payload,
        customerName: party?.name || "",
        paymentMethodName: paymentMethod?.name || formPaymentMethodId,
      };

      await db.party_transactions.put(localTransaction);
      // Apply new balance change
      await updateOfflinePartyBalance(formPartyId, amount);
      await SyncEngine.queueOperation("party_transactions", "PUT", `/api/customer-transactions/${selectedId}`, payload);

      setShowEditDialog(false);
      resetForm();
      setErrorDialog({ open: true, title: tCommon("success"), message: t("updatedSuccess"), isSuccess: true });
    } catch (err) {
      console.error(err);
      setErrorDialog({ open: true, title: t("error"), message: err instanceof Error ? err.message : t("failedToUpdate") });
    } finally {
      setIsSaving(false);
    }
  }, [selectedId, formPartyId, formPaymentAmount, formPaymentMethodId, formDate, parties, paymentMethods, resetForm, t, tCommon]);

  const handleDelete = useCallback(async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    try {
      const oldTransaction = await db.party_transactions.get(transactionToDelete.id);
      if (oldTransaction) {
        // Revert balance change
        await updateOfflinePartyBalance(oldTransaction.customerId, -oldTransaction.paymentAmount);
      }
      
      await db.party_transactions.delete(transactionToDelete.id);
      await SyncEngine.queueOperation("party_transactions", "DELETE", `/api/customer-transactions/${transactionToDelete.id}`, null);

      setShowDeleteDialog(false);
      setTransactionToDelete(null);
      setErrorDialog({ open: true, title: tCommon("success"), message: t("deletedSuccess"), isSuccess: true });
    } catch (err) {
      console.error(err);
      setErrorDialog({ open: true, title: t("error"), message: err instanceof Error ? err.message : t("failedToDelete") });
    } finally {
      setIsDeleting(false);
    }
  }, [transactionToDelete, t, tCommon]);

  const openAddDialog = () => {
    resetForm();
    setFormDate(new Date().toISOString().split("T")[0]);
    setShowAddDialog(true);
  };

  const handleFilterPaymentMethod = (value: string) => {
    setFilters((prev) => ({ ...prev, paymentMethod: value }));
  };

  const handleFilterParty = (value: string) => {
    setFilters((prev) => ({ ...prev, party: value }));
  };

  const openEditDialog = (item: PartyTransaction) => {
    setSelectedId(item.id);
    setFormPartyId(item.customerId);
    setFormPaymentAmount(item.paymentAmount.toString());
    setFormPaymentMethodId(item.paymentMethodId);
    setFormDate(item.date || new Date().toISOString().split("T")[0]);
    setShowEditDialog(true);
  };

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2Icon className="mx-auto h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Card>
          <CardContent>
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("pageDescription")}</p>
      </div>
      <Card className="flex flex-col gap-6 p-6">
        <CardHeader className="p-0">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-9 h-9 text-sm w-full"
                />
                {searchTerm && (
                  <button
                    onClick={() => { setSearchTerm(""); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu onOpenChange={(open) => {
                  if (open) setFilterPartyPage(1);
                }}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 h-9"
                    >
                      <FilterIcon className="w-4 h-4" />
                      <span>{tCommon("filter")}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-56 max-h-80 overflow-y-auto"
                    onScroll={(e) => {
                      const target = e.currentTarget;
                      if (target.scrollHeight - target.scrollTop <= target.clientHeight + 20) {
                        if (hasMoreFilterParties) {
                          setFilterPartyPage(prev => prev + 1);
                        }
                      }
                    }}
                  >
                    <DropdownMenuLabel>
                      {t("filterByPaymentMethod")}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={filters.paymentMethod === "all"}
                      onCheckedChange={(checked) =>
                        checked && handleFilterPaymentMethod("all")
                      }
                    >
                      {t("allPaymentMethods")}
                    </DropdownMenuCheckboxItem>
                    {paymentMethods.map((pm) => (
                      <DropdownMenuCheckboxItem
                        key={pm.id}
                        checked={filters.paymentMethod === pm.id}
                        onCheckedChange={(checked) =>
                          checked && handleFilterPaymentMethod(pm.id)
                        }
                      >
                        {pm.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>{t("filterByParty")}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={filters.party === "all"}
                      onCheckedChange={(checked) =>
                        checked && handleFilterParty("all")
                      }
                    >
                      {t("allParties")}
                    </DropdownMenuCheckboxItem>
                    {displayParties.map((p) => {
                      return (
                        <DropdownMenuCheckboxItem
                          key={p.id}
                          checked={filters.party === p.id}
                          onCheckedChange={(checked) =>
                            checked && handleFilterParty(p.id)
                          }
                        >
                          {p.name}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                    {hasMoreFilterParties && (
                      <div className="flex justify-center p-2">
                        <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <Button size="sm" onClick={openAddDialog} className="h-9 text-xs px-3 flex-shrink-0 w-full md:w-auto">
              <PlusCircle className="w-3 h-3 mr-1" />
              {t("addRecord")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View - hidden on mobile */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("party")}</TableHead>
                  <TableHead>{t("paymentAmount")}</TableHead>
                  <TableHead>{t("paymentMethod")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8"
                    >
                      <Loader2Icon className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      {t("noRecords")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.customerName || "-"}</TableCell>
                      <TableCell>
                        Rs. {Math.round(item.paymentAmount).toLocaleString()}
                      </TableCell>
                      <TableCell>{item.paymentMethodName || "-"}</TableCell>
                      <TableCell>{item.date || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditDialog(item)}
                          >
                            <FilePenIcon className="w-4 h-4" />
                            <span className="sr-only">{tCommon("edit")}</span>
                          </Button>
                          <Button
                            size="icon"
                            variant="danger"
                            className="h-8 w-8"
                            onClick={() => {
                              setTransactionToDelete(item);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="sr-only">{tCommon("delete")}</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View - visible only on mobile */}
          <div className="block md:hidden space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {t("noRecords")}
              </div>
            ) : (
              filteredTransactions.map((item) => (
                <PaymentOutCard
                  key={item.id}
                  transaction={item}
                  onEdit={() => openEditDialog(item)}
                  onDelete={() => {
                    setTransactionToDelete(item);
                    setShowDeleteDialog(true);
                  }}
                  t={t}
                  tCommon={tCommon}
                />
              ))
            )}
          </div>
        </CardContent>
        <div className="border-t p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 w-full md:w-auto">
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {tCommon("totalCountLabel", { count: totalCount })}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {tCommon("rowsPerPage")}
              </span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize.toString()} />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              isLoading={isPageLoading}
            />
          )}
        </div>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("addRecord")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("party")}</Label>
              <PartyDropdown
                value={formPartyId}
                onValueChange={(val, party) => setFormPartyId(val)}
                placeholder={t("selectParty")}
                className="w-full"
                filterActiveOnly={true}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("paymentAmount")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={formPaymentAmount}
                onChange={(e) => setFormPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              {/* <Label>{t("paymentMethod")}</Label>
              <Select
                value={formPaymentMethodId}
                onValueChange={setFormPaymentMethodId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectPaymentMethod")} />
                </SelectTrigger>

                <SelectContent className="min-w-[20rem] max-w-[90vw]">
                  {paymentMethods.map((pm) => (
                    <SelectItem
                      key={pm.id}
                      value={pm.id}
                      className="text-left group"
                    >
                      <div className="flex flex-col items-start text-left gap-0.5 py-0.5 w-full">
                        <span className="font-medium w-full">{pm.name}</span>

                        {pm.bankDetails && (
                          <span className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap w-full group-data-[highlighted]:text-white">
                            {pm.bankDetails}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select> */}
              <Label>{t("paymentMethod")}</Label>
              <PaymentMethodDropdown
                value={formPaymentMethodId}
                onValueChange={(id) => setFormPaymentMethodId(id)}
                placeholder={t("selectPaymentMethod")}
                enableSearch={true}
                searchPlaceholder={tCommon("searchPaymentMethods") || "Search payment methods..."}
                noResultsText={tCommon("noPaymentMethodsFound") || "No payment methods found"}
                addButtonPosition="bottom"
                includeDefaultMethods={true}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("date")}</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              disabled={isSaving}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleAdd} disabled={isSaving}>
              {isSaving ? tCommon("loading") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editRecord")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("party")}</Label>
              <PartyDropdown
                value={formPartyId}
                onValueChange={(val, party) => setFormPartyId(val)}
                placeholder={t("selectParty")}
                className="w-full"
                filterActiveOnly={true}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("paymentAmount")}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={formPaymentAmount}
                onChange={(e) => setFormPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              {/* <Label>{t("paymentMethod")}</Label>
              <Select
                value={formPaymentMethodId}
                onValueChange={setFormPaymentMethodId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectPaymentMethod")} />
                </SelectTrigger>
                <SelectContent className="min-w-[20rem] max-w-[90vw]">
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>
                      <div className="flex flex-col gap-0.5 py-0.5">
                        <span className="font-medium">{pm.name}</span>
                        {pm.bankDetails && (
                          <span className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                            {pm.bankDetails}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select> */}
              <Label>{t("paymentMethod")}</Label>
              <PaymentMethodDropdown
                value={formPaymentMethodId}
                onValueChange={(id) => setFormPaymentMethodId(id)}
                placeholder={t("selectPaymentMethod")}
                enableSearch={true}
                searchPlaceholder={tCommon("searchPaymentMethods") || "Search payment methods..."}
                noResultsText={tCommon("noPaymentMethodsFound") || "No payment methods found"}
                addButtonPosition="bottom"
                includeDefaultMethods={true}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("date")}</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={isSaving}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleEdit} disabled={isSaving}>
              {isSaving ? tCommon("loading") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("confirmDelete")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("confirmDeleteMessage", {
              party: transactionToDelete?.customerName ?? "",
            })}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? tCommon("loading") : tCommon("delete")}
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
    </div>
  );
}

// Mobile Card Component for Payment Out Transaction
function PaymentOutCard({
  transaction,
  onEdit,
  onDelete,
  t,
  tCommon,
}: {
  transaction: PartyTransaction;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string) => string;
  tCommon: (key: string) => string;
}) {
  return (
    <div className="bg-card border rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-base truncate max-w-[70%]">
          {transaction.customerName || "-"}
        </h3>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            className="h-8 w-8"
          >
            <FilePenIcon className="w-4 h-4" />
            <span className="sr-only">{tCommon("edit")}</span>
          </Button>
          <Button
            size="icon"
            variant="danger"
            onClick={onDelete}
            className="h-8 w-8"
          >
            <Trash2 className="w-4 h-4" />
            <span className="sr-only">{tCommon("delete")}</span>
          </Button>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("paymentAmount")}:</span>
          <span className="font-medium">Rs. {Math.round(transaction.paymentAmount).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("paymentMethod")}:</span>
          <span>{transaction.paymentMethodName || "-"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("date")}:</span>
          <span>{transaction.date || "-"}</span>
        </div>
      </div>
    </div>
  );
}