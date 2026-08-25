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
import { NumericInput } from "@/components/ui/numeric-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { PartyDropdown } from "@/components/dropdown/party-dropdown";
import { PaymentMethodDropdown } from "@/components/dropdown/payment-method-dropdown";
import { Pagination } from "@/components/ui/pagination";
import { useOfflineCustomers, useOfflineCustomerTransactions, useOfflinePaymentMethods } from "@/lib/hooks/useOfflineData";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { updateOfflinePartyBalance } from "@/lib/ledger/offline-ledger";
import { usePermissions } from "@/hooks/use-permissions";

type Customer = {
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

type CustomerTransaction = {
  id: string;
  customerId: string;
  customerName: string;
  paymentAmount: number;
  paymentMethodId: string;
  paymentMethodName: string;
  date: string;
};

export default function PaymentInPage() {
  const locale = useLocale();
  const t = useTranslations("paymentIn");
  const tCommon = useTranslations("common");
  const { can } = usePermissions();

  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<CustomerTransaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    paymentMethod: "all",
    customer: "all",
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

  const [formCustomerId, setFormCustomerId] = useState("");
  const [formPaymentAmount, setFormPaymentAmount] = useState("");
  const [formPaymentMethodId, setFormPaymentMethodId] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Replace API fetching with offline hook
  const offlineTransactions = useOfflineCustomerTransactions("payment-in", searchTerm, filters.paymentMethod, filters.customer);
  const loading = offlineTransactions === undefined;
  const allOfflineTransactions = offlineTransactions || [];
  
  const totalCount = allOfflineTransactions.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const filteredTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return allOfflineTransactions.slice(startIndex, startIndex + pageSize);
  }, [allOfflineTransactions, currentPage, pageSize]);

  // Replace API fetching with offline hook for the filter dropdown
  const offlineCustomers = useOfflineCustomers() || [];
  const customers = useMemo(() => {
    return offlineCustomers.filter((c) => c.is_delete !== 1);
  }, [offlineCustomers]);

  // Infinite scroll for Filter Dropdown
  const [filterCustomerPage, setFilterCustomerPage] = useState(1);
  const displayCustomers = useMemo(() => {
    return customers.slice(0, filterCustomerPage * 50);
  }, [customers, filterCustomerPage]);
  const hasMoreFilterCustomers = displayCustomers.length < customers.length;

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
    setFormCustomerId("");
    setFormPaymentAmount("");
    setFormPaymentMethodId("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setSelectedId(null);
  }, []);

  const handleAdd = useCallback(async () => {
    if (!formCustomerId || !formPaymentMethodId) {
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
      const customer = customers.find(c => c.id === formCustomerId || c._id === formCustomerId);
      const paymentMethod = paymentMethods.find(p => p.id === formPaymentMethodId);

      const payload = {
        customerId: formCustomerId,
        paymentAmount: amount,
        paymentMethodId: formPaymentMethodId,
        date: formDate,
        type: "payment-in"
      };

      const transactionId = crypto.randomUUID();
      const localTransaction = {
        id: transactionId,
        ...payload,
        customerName: customer?.name || "",
        paymentMethodName: paymentMethod?.name || formPaymentMethodId,
        created_at: new Date().toISOString()
      };

      await db.party_transactions.add(localTransaction);
      // Payment In reduces receivable balance (amountDelta is negative)
      await updateOfflinePartyBalance(formCustomerId, -amount);
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
  }, [formCustomerId, formPaymentAmount, formPaymentMethodId, formDate, customers, paymentMethods, resetForm, t, tCommon]);

  const handleEdit = useCallback(async () => {
    if (!selectedId) return;
    if (!formCustomerId || !formPaymentMethodId) {
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
        // Revert old balance change: reverse of negative is positive
        await updateOfflinePartyBalance(oldTransaction.customerId, oldTransaction.paymentAmount);
      }

      const customer = customers.find(c => c.id === formCustomerId || c._id === formCustomerId);
      const paymentMethod = paymentMethods.find(p => p.id === formPaymentMethodId);

      const payload = {
        customerId: formCustomerId,
        paymentAmount: amount,
        paymentMethodId: formPaymentMethodId,
        date: formDate,
        type: "payment-in"
      };

      const localTransaction = {
        id: selectedId,
        ...payload,
        customerName: customer?.name || "",
        paymentMethodName: paymentMethod?.name || formPaymentMethodId,
      };

      await db.party_transactions.put(localTransaction);
      // Apply new balance change
      await updateOfflinePartyBalance(formCustomerId, -amount);
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
  }, [selectedId, formCustomerId, formPaymentAmount, formPaymentMethodId, formDate, customers, paymentMethods, resetForm, t, tCommon]);

  const handleDelete = useCallback(async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    try {
      const oldTransaction = await db.party_transactions.get(transactionToDelete.id);
      if (oldTransaction) {
        // Revert balance change
        await updateOfflinePartyBalance(oldTransaction.customerId, oldTransaction.paymentAmount);
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

  const handleFilterCustomer = (value: string) => {
    setFilters((prev) => ({ ...prev, customer: value }));
  };

  const openEditDialog = (item: CustomerTransaction) => {
    setSelectedId(item.id);
    setFormCustomerId(item.customerId);
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
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{t("pageDescription")}</p>
        </div>
        {can("sales", "create_payment_in") && (
          <Button size="sm" onClick={openAddDialog} className="h-9 text-xs px-3 shrink-0">
            <PlusCircle className="w-3.5 h-3.5 mr-1" />
            {t("addRecord")}
          </Button>
        )}
      </div>
      <Card className="flex flex-col gap-6 p-4 sm:p-6 shadow-md">
        <CardHeader className="p-0">
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="relative flex-1 min-w-0">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-9 h-9 text-xs sm:text-sm w-full"
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
            <DropdownMenu onOpenChange={(open) => {
              if (open) setFilterCustomerPage(1);
            }}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-9 px-2.5 sm:px-3 text-xs shrink-0"
                >
                  <FilterIcon className="w-3.5 h-3.5" />
                  <span>{tCommon("filter")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 max-h-80 overflow-y-auto"
                onScroll={(e) => {
                  const target = e.currentTarget;
                  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 20) {
                    if (hasMoreFilterCustomers) {
                      setFilterCustomerPage(prev => prev + 1);
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
                <DropdownMenuLabel>{t("filterByCustomer")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={filters.customer === "all"}
                  onCheckedChange={(checked) =>
                    checked && handleFilterCustomer("all")
                  }
                >
                  {t("allCustomers")}
                </DropdownMenuCheckboxItem>
                {displayCustomers.map((c) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={filters.customer === c.id}
                      onCheckedChange={(checked) =>
                        checked && handleFilterCustomer(c.id)
                      }
                    >
                      {c.name}
                    </DropdownMenuCheckboxItem>
                  );
                })}
                {hasMoreFilterCustomers && (
                  <div className="flex justify-center p-2">
                    <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View - hidden on mobile */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("customer")}</TableHead>
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
                        Rs. {Math.round(item.paymentAmount)}
                      </TableCell>
                      <TableCell>{item.paymentMethodName || "-"}</TableCell>
                      <TableCell>{item.date || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {can("sales", "edit_payment_in") && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditDialog(item)}
                            >
                              <FilePenIcon className="w-4 h-4" />
                              <span className="sr-only">{tCommon("edit")}</span>
                            </Button>
                          )}
                          {can("sales", "delete_payment_in") && (
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
                          )}
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
                <TransactionCard
                  key={item.id}
                  transaction={item}
                  onEdit={can("sales", "edit_payment_in") ? () => openEditDialog(item) : undefined}
                  onDelete={can("sales", "delete_payment_in") ? () => {
                    setTransactionToDelete(item);
                    setShowDeleteDialog(true);
                  } : undefined}
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
              <Label>{t("customer")}</Label>
              <PartyDropdown
                value={formCustomerId}
                onValueChange={(val, party) => setFormCustomerId(val)}
                placeholder={t("selectCustomer")}
                className="w-full"
                filterActiveOnly={true}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("paymentAmount")}</Label>
              <NumericInput
                min="0"
                placeholder="0"
                value={formPaymentAmount}
                onChange={(e) => setFormPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("paymentMethod")}</Label>
              <PaymentMethodDropdown
                value={formPaymentMethodId}
                onValueChange={(id, method) => {
                  setFormPaymentMethodId(id);
                }}
                placeholder={t("paymentMethod")}
                enableSearch={true}
                searchPlaceholder={t("searchPaymentMethods")}
                noResultsText={t("noPaymentMethodsFound")}
                addButtonPosition="bottom"
                // includeDefaultMethods={true}
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
              <Label>{t("customer")}</Label>
              <PartyDropdown
                value={formCustomerId}
                onValueChange={(val, party) => setFormCustomerId(val)}
                placeholder={t("selectCustomer")}
                className="w-full"
                filterActiveOnly={true}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("paymentAmount")}</Label>
              <NumericInput
                min="0"
                placeholder="0"
                value={formPaymentAmount}
                onChange={(e) => setFormPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("paymentMethod")}</Label>
              <PaymentMethodDropdown
                value={formPaymentMethodId}
                onValueChange={(id, method) => {
                  setFormPaymentMethodId(id);
                }}
                placeholder={t("paymentMethod")}
                enableSearch={true}
                searchPlaceholder={tCommon("searchPaymentMethods")}
                noResultsText={tCommon("noPaymentMethodsFound")}
                addButtonPosition="bottom"
                // includeDefaultMethods={true}
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
              customer: transactionToDelete?.customerName ?? "",
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
              variant="destructive"
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

// Mobile Card Component for Transaction Row
function TransactionCard({
  transaction,
  onEdit,
  onDelete,
  t,
  tCommon,
}: {
  transaction: CustomerTransaction;
  onEdit?: () => void;
  onDelete?: () => void;
  t: (key: string) => string;
  tCommon: (key: string) => string;
}) {
  return (
    <div className="bg-card border rounded-lg p-3.5 shadow-sm">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
        <h3 className="font-semibold text-sm sm:text-base text-foreground truncate max-w-[65%]">
          {transaction.customerName || "-"}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onEdit}
              className="h-8 w-8 text-sky-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40"
            >
              <FilePenIcon className="w-4 h-4 text-sky-500" />
              <span className="sr-only">{tCommon("edit")}</span>
            </Button>
          )}
          {onDelete && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              <span className="sr-only">{tCommon("delete")}</span>
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1.5 text-xs sm:text-sm">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">{t("paymentAmount")}:</span>
          <span className="font-semibold text-foreground">Rs. {Math.round(transaction.paymentAmount)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">{t("paymentMethod")}:</span>
          <span className="font-medium text-foreground">{transaction.paymentMethodName || "-"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">{t("date")}:</span>
          <span className="text-muted-foreground">{transaction.date || "-"}</span>
        </div>
      </div>
    </div>
  );
}