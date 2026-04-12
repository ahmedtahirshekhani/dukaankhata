"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  const [parties, setParties] = useState<Party[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
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

  const [formPartyId, setFormPartyId] = useState("");
  const [formPaymentAmount, setFormPaymentAmount] = useState("");
  const [formPaymentMethodId, setFormPaymentMethodId] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Fetch vendors (not customers for payment out)
  const fetchParties = useCallback(async () => {
    try {
      const res = await fetch(`/${locale}/api/customers`);
      if (!res.ok) return;
      const data = await res.json();
      setParties(data.filter((p: Party & { is_delete?: number }) => p.is_delete !== 1));
    } catch {
      // ignore
    }
  }, [locale]);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch(`/${locale}/api/customer-transactions?type=payment-out`);
      if (!res.ok) throw new Error(t("failedToFetch"));
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToFetch"));
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const res = await fetch(`/${locale}/api/configuration/payment-method`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data)
        ? data.map((item: { id?: string; bankName?: string; bankDetails?: string }) => ({
            id: item.id ?? "",
            name: item.bankName ?? "",
            bankDetails: item.bankDetails ?? "",
          })).filter((item) => item.id && item.name)
        : [];
      setPaymentMethods([
        { id: "cash", name: "Cash" },
        { id: "cheque", name: "Cheque" },
        ...list,
      ]);
    } catch {
      // ignore
    }
  }, [locale]);

  useEffect(() => {
    fetchParties(); // Fetch parties first
    fetchPaymentMethods();
    fetchTransactions();
  }, [fetchParties, fetchPaymentMethods, fetchTransactions]);

  const resetForm = useCallback(() => {
    setFormPartyId("");
    setFormPaymentAmount("");
    setFormPaymentMethodId("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setSelectedId(null);
  }, []);

  const filteredTransactions = useMemo(() => {
    let result = transactions;
    if (filters.paymentMethod !== "all") {
      result = result.filter((item) => item.paymentMethodId === filters.paymentMethod);
    }
    if (filters.party !== "all") {
      result = result.filter((item) => item.customerId === filters.party);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.customerName?.toLowerCase().includes(term) ||
          item.paymentMethodName?.toLowerCase().includes(term) ||
          item.paymentAmount?.toString().includes(term) ||
          item.date?.includes(term)
      );
    }
    return result;
  }, [transactions, searchTerm, filters]);

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
      const res = await fetch(`/${locale}/api/customer-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formPartyId,
          paymentAmount: amount,
          paymentMethodId: formPaymentMethodId,
          date: formDate,
          type: "payment-out",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("failedToCreate"));

      // Refresh transactions after add
      await fetchTransactions();
      
      setShowAddDialog(false);
      resetForm();
      setErrorDialog({ open: true, title: tCommon("success"), message: t("createdSuccess"), isSuccess: true });
    } catch (err) {
      setErrorDialog({ open: true, title: t("error"), message: err instanceof Error ? err.message : t("failedToCreate") });
    } finally {
      setIsSaving(false);
    }
  }, [locale, formPartyId, formPaymentAmount, formPaymentMethodId, formDate, fetchTransactions, resetForm, t, tCommon]);

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
      const res = await fetch(`/${locale}/api/customer-transactions/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formPartyId,
          paymentAmount: amount,
          paymentMethodId: formPaymentMethodId,
          date: formDate,
          type: "payment-out",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("failedToUpdate"));

      // Refresh transactions after edit
      await fetchTransactions();
      
      setShowEditDialog(false);
      resetForm();
      setErrorDialog({ open: true, title: tCommon("success"), message: t("updatedSuccess"), isSuccess: true });
    } catch (err) {
      setErrorDialog({ open: true, title: t("error"), message: err instanceof Error ? err.message : t("failedToUpdate") });
    } finally {
      setIsSaving(false);
    }
  }, [locale, selectedId, formPartyId, formPaymentAmount, formPaymentMethodId, formDate, fetchTransactions, resetForm, t, tCommon]);

  const handleDelete = useCallback(async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/${locale}/api/customer-transactions/${transactionToDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || t("failedToDelete"));
      }
      
      // Refresh transactions after delete
      await fetchTransactions();
      
      setShowDeleteDialog(false);
      setTransactionToDelete(null);
      setErrorDialog({ open: true, title: tCommon("success"), message: t("deletedSuccess"), isSuccess: true });
    } catch (err) {
      setErrorDialog({ open: true, title: t("error"), message: err instanceof Error ? err.message : t("failedToDelete") });
    } finally {
      setIsDeleting(false);
    }
  }, [locale, transactionToDelete, fetchTransactions, t, tCommon]);

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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1">
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <Input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-8"
                />
                <SearchIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 shrink-0"
                  >
                    <FilterIcon className="w-4 h-4" />
                    <span>{tCommon("filter")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-56 max-h-[70vh] overflow-y-auto"
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
                  {parties.map((p) => (
                    <DropdownMenuCheckboxItem
                      key={p.id}
                      checked={filters.party === p.id}
                      onCheckedChange={(checked) =>
                        checked && handleFilterParty(p.id)
                      }
                    >
                      {p.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button size="sm" onClick={openAddDialog} className="shrink-0">
              <PlusCircle className="w-4 h-4 mr-2" />
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
                {filteredTransactions.length === 0 ? (
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
                            variant="ghost"
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
            {filteredTransactions.length === 0 ? (
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
              <Label>{t("paymentMethod")}</Label>
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
              </Select>
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
              <Label>{t("paymentMethod")}</Label>
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
              </Select>
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
            variant="ghost"
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