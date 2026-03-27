"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

type SaleReturnTransaction = {
  id: string;
  customerId: string;
  customerName: string;
  paymentAmount: number;
  paymentMethodId: string;
  paymentMethodName: string;
  date: string;
};

export default function SaleReturnPage() {
  const locale = useLocale();
  const t = useTranslations("saleReturn");
  const tCommon = useTranslations("common");

  const [transactions, setTransactions] = useState<SaleReturnTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<SaleReturnTransaction | null>(null);
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

  const [formCustomerId, setFormCustomerId] = useState("");
  const [formPaymentAmount, setFormPaymentAmount] = useState("");
  const [formPaymentMethodId, setFormPaymentMethodId] = useState("");
  const [formDate, setFormDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch(`/${locale}/api/sale-return-transactions`);
      if (!res.ok) throw new Error(t("failedToFetch"));
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToFetch"));
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`/${locale}/api/customers`);
      if (!res.ok) return;
      const data = await res.json();
      setCustomers(
        data.filter((c: Customer & { is_delete?: number }) => c.is_delete !== 1)
      );
    } catch {
      // ignore
    }
  }, [locale]);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const res = await fetch(`/${locale}/api/configuration/payment-method`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
            .map((item: { id?: string; bankName?: string; bankDetails?: string }) => ({
              id: item.id ?? "",
              name: item.bankName ?? "",
              bankDetails: item.bankDetails ?? "",
            }))
            .filter((item) => item.id && item.name)
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
    fetchTransactions();
    fetchCustomers();
    fetchPaymentMethods();
  }, [fetchTransactions, fetchCustomers, fetchPaymentMethods]);

  const resetForm = useCallback(() => {
    setFormCustomerId("");
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
    if (filters.customer !== "all") {
      result = result.filter((item) => item.customerId === filters.customer);
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
    if (!formCustomerId || !formPaymentMethodId) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("allFieldsRequired"),
      });
      return;
    }
    const amount = parseFloat(formPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("amountRequired"),
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/${locale}/api/sale-return-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formCustomerId,
          paymentAmount: amount,
          paymentMethodId: formPaymentMethodId,
          date: formDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("failedToCreate"));

      setTransactions((prev) => {
        const customer = customers.find((c) => c.id === formCustomerId);
        const pm = paymentMethods.find((p) => p.id === formPaymentMethodId);
        return [
          {
            id: data.id,
            customerId: formCustomerId,
            customerName: customer?.name ?? "",
            paymentAmount: amount,
            paymentMethodId: formPaymentMethodId,
            paymentMethodName: pm?.name ?? "",
            date: formDate,
          },
          ...prev,
        ];
      });
      setShowAddDialog(false);
      resetForm();
      setErrorDialog({
        open: true,
        title: tCommon("success"),
        message: t("createdSuccess"),
        isSuccess: true,
      });
    } catch (err) {
      setErrorDialog({
        open: true,
        title: t("error"),
        message: err instanceof Error ? err.message : t("failedToCreate"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    locale,
    formCustomerId,
    formPaymentAmount,
    formPaymentMethodId,
    formDate,
    customers,
    paymentMethods,
    resetForm,
    t,
    tCommon,
  ]);

  const handleEdit = useCallback(async () => {
    if (!selectedId) return;
    if (!formCustomerId || !formPaymentMethodId) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("allFieldsRequired"),
      });
      return;
    }
    const amount = parseFloat(formPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("amountRequired"),
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/${locale}/api/sale-return-transactions/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formCustomerId,
          paymentAmount: amount,
          paymentMethodId: formPaymentMethodId,
          date: formDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("failedToUpdate"));

      const customer = customers.find((c) => c.id === formCustomerId);
      const pm = paymentMethods.find((p) => p.id === formPaymentMethodId);
      setTransactions((prev) =>
        prev.map((item) =>
          item.id === selectedId
            ? {
                ...item,
                customerId: formCustomerId,
                customerName: customer?.name ?? "",
                paymentAmount: amount,
                paymentMethodId: formPaymentMethodId,
                paymentMethodName: pm?.name ?? "",
                date: formDate,
              }
            : item
        )
      );
      setShowEditDialog(false);
      resetForm();
      setErrorDialog({
        open: true,
        title: tCommon("success"),
        message: t("updatedSuccess"),
        isSuccess: true,
      });
    } catch (err) {
      setErrorDialog({
        open: true,
        title: t("error"),
        message: err instanceof Error ? err.message : t("failedToUpdate"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    locale,
    selectedId,
    formCustomerId,
    formPaymentAmount,
    formPaymentMethodId,
    formDate,
    customers,
    paymentMethods,
    resetForm,
    t,
    tCommon,
  ]);

  const handleDelete = useCallback(async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/${locale}/api/sale-return-transactions/${transactionToDelete.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || t("failedToDelete"));
      }
      setTransactions((prev) => prev.filter((item) => item.id !== transactionToDelete.id));
      setShowDeleteDialog(false);
      setTransactionToDelete(null);
      setErrorDialog({
        open: true,
        title: tCommon("success"),
        message: t("deletedSuccess"),
        isSuccess: true,
      });
    } catch (err) {
      setErrorDialog({
        open: true,
        title: t("error"),
        message: err instanceof Error ? err.message : t("failedToDelete"),
      });
    } finally {
      setIsDeleting(false);
    }
  }, [locale, transactionToDelete, t, tCommon]);

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

  const openEditDialog = (item: SaleReturnTransaction) => {
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
                  <Button variant="outline" size="sm" className="gap-1 shrink-0">
                    <FilterIcon className="w-4 h-4" />
                    <span>{tCommon("filter")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 max-h-[70vh] overflow-y-auto">
                  <DropdownMenuLabel>{t("filterByPaymentMethod")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={filters.paymentMethod === "all"}
                    onCheckedChange={(checked) => checked && handleFilterPaymentMethod("all")}
                  >
                    {t("allPaymentMethods")}
                  </DropdownMenuCheckboxItem>
                  {paymentMethods.map((pm) => (
                    <DropdownMenuCheckboxItem
                      key={pm.id}
                      checked={filters.paymentMethod === pm.id}
                      onCheckedChange={(checked) => checked && handleFilterPaymentMethod(pm.id)}
                    >
                      {pm.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t("filterByCustomer")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={filters.customer === "all"}
                    onCheckedChange={(checked) => checked && handleFilterCustomer("all")}
                  >
                    {t("allCustomers")}
                  </DropdownMenuCheckboxItem>
                  {customers.map((customer) => (
                    <DropdownMenuCheckboxItem
                      key={customer.id}
                      checked={filters.customer === customer.id}
                      onCheckedChange={(checked) => checked && handleFilterCustomer(customer.id)}
                    >
                      {customer.name}
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("returnAmount")}</TableHead>
                  <TableHead>{t("paymentMethod")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {t("noRecords")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.customerName || "-"}</TableCell>
                      <TableCell>Rs. {Math.round(item.paymentAmount)}</TableCell>
                      <TableCell>{item.paymentMethodName || "-"}</TableCell>
                      <TableCell>{item.date || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="ghost" onClick={() => openEditDialog(item)}>
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
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("addRecord")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("customer")}</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCustomer")} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("returnAmount")}</Label>
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
              <Select value={formPaymentMethodId} onValueChange={setFormPaymentMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectPaymentMethod")} />
                </SelectTrigger>
                <SelectContent className="min-w-[20rem] max-w-[90vw]">
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id} className="text-left group">
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
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={isSaving}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleAdd} disabled={isSaving}>
              {isSaving ? tCommon("loading") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editRecord")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("customer")}</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCustomer")} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("returnAmount")}</Label>
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
              <Select value={formPaymentMethodId} onValueChange={setFormPaymentMethodId}>
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
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isSaving}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleEdit} disabled={isSaving}>
              {isSaving ? tCommon("loading") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
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
