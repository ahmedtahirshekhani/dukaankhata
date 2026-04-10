
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
import { PartyDropdown } from "@/components/dropdown/party-dropdown";

type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

type Product = {
  id: string;
  name: string;
  sellPrice?: number;
  sell_price?: number;
  salePrice?: number;
  price?: number;
  retailPrice?: number;
};

type PaymentMethod = {
  id: string;
  name: string;
  bankDetails?: string;
};

type ReturnItem = {
  id: string;
  productId: string;
  itemName: string;
  quantity: string;
  rate: string;
};

type SaleReturnTransaction = {
  id: string;
  returnNumber: string;
  customerId: string;
  customerName: string;
  items: Array<{
    id: string;
    productId?: string;
    itemName: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  paymentMethodId: string;
  paymentMethodName: string;
  paymentRefNo: string;
  invoiceNo: string;
  invoiceDate: string;
  date: string;
};

function generateReturnNumber() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `CRN-${timestamp}-${random}`;
}

function createItem(): ReturnItem {
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    productId: "",
    itemName: "",
    quantity: "1",
    rate: "",
  };
}

function parseNumericInput(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getLineAmount(item: ReturnItem): number {
  return Number(
    (parseNumericInput(item.quantity) * parseNumericInput(item.rate)).toFixed(2),
  );
}

export default function SaleReturnPage() {
  const locale = useLocale();
  const t = useTranslations("saleReturn");
  const tCommon = useTranslations("common");

  const [transactions, setTransactions] = useState<SaleReturnTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transactionToDelete, setTransactionToDelete] =
    useState<SaleReturnTransaction | null>(null);
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

  const [formReturnNumber, setFormReturnNumber] = useState(generateReturnNumber());
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formDate, setFormDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [formInvoiceDate, setFormInvoiceDate] = useState("");
  const [formInvoiceNo, setFormInvoiceNo] = useState("");
  const [formItems, setFormItems] = useState<ReturnItem[]>([createItem()]);
  const [formPaidAmount, setFormPaidAmount] = useState("0");
  const [formPaymentMethodId, setFormPaymentMethodId] = useState("");
  const [formPaymentRefNo, setFormPaymentRefNo] = useState("");

  const lineTotals = useMemo(() => formItems.map((item) => getLineAmount(item)), [formItems]);

  const totalAmount = useMemo(
    () => Number(lineTotals.reduce((sum, amount) => sum + amount, 0).toFixed(2)),
    [lineTotals],
  );

  const paidAmount = useMemo(() => {
    const numeric = parseNumericInput(formPaidAmount);
    return Number(numeric.toFixed(2));
  }, [formPaidAmount]);

  const balanceDue = useMemo(
    () => Number((totalAmount - paidAmount).toFixed(2)),
    [totalAmount, paidAmount],
  );

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch(`/${locale}/api/sale-return-transactions`);
      if (!res.ok) throw new Error(t("failedToFetch"));
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
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
        data.filter((c: Customer & { is_delete?: number }) => c.is_delete !== 1),
      );
    } catch {
      setCustomers([]);
    }
  }, [locale]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`/${locale}/api/products`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data)
        ? data.map((item: Record<string, unknown>) => ({
            id: String(item.id ?? ""),
            name: String(
              item.name ?? item.productName ?? item.itemName ?? item.title ?? "",
            ),
            sellPrice:
              typeof item.sell_price === "number"
                ? item.sell_price
                : Number(item.sell_price ?? 0),
            sell_price:
              typeof item.sell_price === "number"
                ? item.sell_price
                : Number(item.sell_price ?? 0),
            salePrice:
              typeof item.salePrice === "number"
                ? item.salePrice
                : Number(item.salePrice ?? 0),
            price:
              typeof item.price === "number" ? item.price : Number(item.price ?? 0),
            retailPrice:
              typeof item.retailPrice === "number"
                ? item.retailPrice
                : Number(item.retailPrice ?? 0),
          }))
        : [];
      setProducts(list.filter((product: Product) => product.id && product.name));
    } catch {
      setProducts([]);
    }
  }, [locale]);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const res = await fetch(`/${locale}/api/configuration/payment-method`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
            .map(
              (item: {
                id?: string;
                bankName?: string;
                bankDetails?: string;
              }) => ({
                id: item.id ?? "",
                name: item.bankName ?? "",
                bankDetails: item.bankDetails ?? "",
              }),
            )
            .filter((item) => item.id && item.name)
        : [];
      setPaymentMethods([
        { id: "cash", name: "Cash" },
        { id: "cheque", name: "Cheque" },
        ...list,
      ]);
    } catch {
      setPaymentMethods([]);
    }
  }, [locale]);

  useEffect(() => {
    fetchTransactions();
    fetchCustomers();
    fetchProducts();
    fetchPaymentMethods();
  }, [fetchTransactions, fetchCustomers, fetchProducts, fetchPaymentMethods]);

  const resetForm = useCallback(() => {
    setFormReturnNumber(generateReturnNumber());
    setFormCustomerId("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormInvoiceDate("");
    setFormInvoiceNo("");
    setFormItems([createItem()]);
    setFormPaidAmount("0");
    setFormPaymentMethodId("");
    setFormPaymentRefNo("");
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
          item.returnNumber?.toLowerCase().includes(term) ||
          item.invoiceNo?.toLowerCase().includes(term) ||
          item.paymentMethodName?.toLowerCase().includes(term) ||
          item.totalAmount?.toString().includes(term) ||
          item.date?.includes(term),
      );
    }
    return result;
  }, [transactions, searchTerm, filters]);

  const updateFormItem = <K extends keyof ReturnItem>(
    id: string,
    key: K,
    value: ReturnItem[K],
  ) => {
    setFormItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    );
  };

  const handleSelectProduct = (lineId: string, productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    const resolvedRate =
      product.sellPrice ||
      product.sell_price ||
      product.salePrice ||
      product.retailPrice ||
      product.price ||
      0;

    setFormItems((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              productId,
              itemName: product.name,
              rate: resolvedRate > 0 ? resolvedRate.toString() : line.rate,
            }
          : line,
      ),
    );
  };

  const addItemRow = () => {
    setFormItems((prev) => [...prev, createItem()]);
  };

  const removeItemRow = (id: string) => {
    setFormItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  };

  const validateForm = () => {
    if (!formReturnNumber.trim() || !formCustomerId || !formPaymentMethodId) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("allFieldsRequired"),
      });
      return false;
    }

    const hasInvalidItem = formItems.some((item) => {
      const quantity = parseNumericInput(item.quantity);
      const rate = parseNumericInput(item.rate);
      return !item.itemName.trim() || quantity <= 0 || rate < 0 || quantity * rate <= 0;
    });

    if (hasInvalidItem) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("itemValidationError"),
      });
      return false;
    }

    if (totalAmount <= 0) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("amountRequired"),
      });
      return false;
    }

    if (paidAmount < 0 || paidAmount > totalAmount) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("paidAmountValidationError"),
      });
      return false;
    }

    return true;
  };

  const buildPayload = () => ({
    returnNumber: formReturnNumber.trim(),
    customerId: formCustomerId,
    date: formDate,
    invoiceDate: formInvoiceDate || undefined,
    invoiceNo: formInvoiceNo.trim(),
    items: formItems.map((item) => ({
      id: item.id,
      productId: item.productId || undefined,
      itemName: item.itemName.trim(),
      quantity: Number(parseNumericInput(item.quantity).toFixed(2)),
      rate: Number(parseNumericInput(item.rate).toFixed(2)),
      amount: Number(getLineAmount(item).toFixed(2)),
    })),
    totalAmount,
    paidAmount,
    paymentMethodId: formPaymentMethodId,
    paymentRefNo: formPaymentRefNo.trim(),
  });

  const handleAdd = useCallback(async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const payload = buildPayload();
      const res = await fetch(`/${locale}/api/sale-return-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("failedToCreate"));

      const customer = customers.find((c) => c.id === formCustomerId);
      const pm = paymentMethods.find((p) => p.id === formPaymentMethodId);
      setTransactions((prev) => [
        {
          id: data.id,
          returnNumber: payload.returnNumber,
          customerId: payload.customerId,
          customerName: customer?.name ?? "",
          items: payload.items,
          totalAmount: payload.totalAmount,
          paidAmount: payload.paidAmount,
          balanceDue,
          paymentMethodId: payload.paymentMethodId,
          paymentMethodName: pm?.name ?? "",
          paymentRefNo: payload.paymentRefNo,
          invoiceNo: payload.invoiceNo,
          invoiceDate: payload.invoiceDate ?? "",
          date: payload.date,
        },
        ...prev,
      ]);
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
    formPaymentMethodId,
    customers,
    paymentMethods,
    resetForm,
    t,
    tCommon,
    balanceDue,
    totalAmount,
    paidAmount,
    formDate,
    formInvoiceDate,
    formInvoiceNo,
    formItems,
    formPaymentRefNo,
    formReturnNumber,
  ]);

  const handleEdit = useCallback(async () => {
    if (!selectedId) return;
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const payload = buildPayload();
      const res = await fetch(`/${locale}/api/sale-return-transactions/${selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
                returnNumber: payload.returnNumber,
                customerId: payload.customerId,
                customerName: customer?.name ?? "",
                items: payload.items,
                totalAmount: payload.totalAmount,
                paidAmount: payload.paidAmount,
                balanceDue,
                paymentMethodId: payload.paymentMethodId,
                paymentMethodName: pm?.name ?? "",
                paymentRefNo: payload.paymentRefNo,
                invoiceNo: payload.invoiceNo,
                invoiceDate: payload.invoiceDate ?? "",
                date: payload.date,
              }
            : item,
        ),
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
    formPaymentMethodId,
    customers,
    paymentMethods,
    resetForm,
    t,
    tCommon,
    balanceDue,
    totalAmount,
    paidAmount,
    formDate,
    formInvoiceDate,
    formInvoiceNo,
    formItems,
    formPaymentRefNo,
    formReturnNumber,
  ]);

  const handleDelete = useCallback(async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/${locale}/api/sale-return-transactions/${transactionToDelete.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || t("failedToDelete"));
      }
      setTransactions((prev) =>
        prev.filter((item) => item.id !== transactionToDelete.id),
      );
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
    setFormReturnNumber(item.returnNumber || generateReturnNumber());
    setFormCustomerId(item.customerId);
    setFormDate(item.date || new Date().toISOString().split("T")[0]);
    setFormInvoiceDate(item.invoiceDate || "");
    setFormInvoiceNo(item.invoiceNo || "");
    setFormItems(
      item.items?.length
        ? item.items.map((line, index) => ({
            id: line.id || `${item.id}-${index}`,
            productId: line.productId || "",
            itemName: line.itemName || "",
            quantity: String(line.quantity ?? 1),
            rate: String(line.rate ?? 0),
          }))
        : [createItem()],
    );
    setFormPaidAmount(String(item.paidAmount ?? 0));
    setFormPaymentMethodId(item.paymentMethodId);
    setFormPaymentRefNo(item.paymentRefNo || "");
    setShowEditDialog(true);
  };

  const renderForm = () => (
    <div className="space-y-5 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("creditNote")}</Label>
          <Input
            value={formReturnNumber}
            onChange={(e) => setFormReturnNumber(e.target.value)}
            placeholder={t("returnNumberPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("date")}</Label>
          <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("customer")}</Label>
          <PartyDropdown
            value={formCustomerId}
            onValueChange={(val) => setFormCustomerId(val)}
            placeholder={t("selectCustomer")}
            className="w-full"
            filterActiveOnly={true}
            enableSearch={true}
            searchPlaceholder={t("searchCustomer") || "Search customer..."}
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("invoiceDate")}</Label>
          <Input
            type="date"
            value={formInvoiceDate}
            onChange={(e) => setFormInvoiceDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("invoiceNo")}</Label>
          <Input
            value={formInvoiceNo}
            onChange={(e) => setFormInvoiceNo(e.target.value)}
            placeholder={t("invoiceNoPlaceholder")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t("items")}</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItemRow}>
            <PlusCircle className="w-4 h-4 mr-2" />
            {t("addItems")}
          </Button>
        </div>

        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("selectProduct")}</TableHead>
                <TableHead>{t("itemName")}</TableHead>
                <TableHead>{t("qty")}</TableHead>
                <TableHead>{t("rate")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{tCommon("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formItems.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell className="min-w-[180px]">
                    <Select
                      value={item.productId || undefined}
                      onValueChange={(value) => handleSelectProduct(item.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectItem")} />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                              {product.name}
                              {(() => {
                                const rate =
                                  product.sellPrice ||
                                  product.sell_price ||
                                  product.salePrice ||
                                  product.retailPrice ||
                                  product.price ||
                                  0;
                                return rate > 0 ? ` (Rs. ${rate})` : "";
                              })()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="min-w-[180px]">
                    <Input
                      value={item.itemName}
                      onChange={(e) => updateFormItem(item.id, "itemName", e.target.value)}
                      placeholder={t("itemNamePlaceholder")}
                    />
                  </TableCell>
                  <TableCell className="w-[110px]">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateFormItem(item.id, "quantity", e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="w-[130px]">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => updateFormItem(item.id, "rate", e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">Rs. {lineTotals[index]?.toFixed(2)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeItemRow(item.id)}
                      disabled={formItems.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("totalAmount")}</Label>
          <Input value={totalAmount.toFixed(2)} readOnly />
        </div>
        <div className="space-y-2">
          <Label>{t("paidAmount")}</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formPaidAmount}
            onChange={(e) => setFormPaidAmount(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("balanceDue")}</Label>
          <Input value={balanceDue.toFixed(2)} readOnly />
        </div>
        <div className="space-y-2">
          <Label>{t("paymentRefNo")}</Label>
          <Input
            value={formPaymentRefNo}
            onChange={(e) => setFormPaymentRefNo(e.target.value)}
            placeholder={t("paymentRefNoPlaceholder")}
          />
        </div>
      </div>
    </div>
  );

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
              {t("addSaleReturn")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View - hidden on mobile */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("creditNote")}</TableHead>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("totalAmount")}</TableHead>
                  <TableHead>{t("paidAmount")}</TableHead>
                  <TableHead>{t("balanceDue")}</TableHead>
                  <TableHead>{t("paymentMethod")}</TableHead>
                  <TableHead>{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {t("noRecords")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.returnNumber || "-"}</TableCell>
                      <TableCell>{item.customerName || "-"}</TableCell>
                      <TableCell>{item.date || "-"}</TableCell>
                      <TableCell>Rs. {item.totalAmount?.toFixed(2)}</TableCell>
                      <TableCell>Rs. {item.paidAmount?.toFixed(2)}</TableCell>
                      <TableCell>Rs. {item.balanceDue?.toFixed(2)}</TableCell>
                      <TableCell>{item.paymentMethodName || "-"}</TableCell>
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

          {/* Mobile Cards View - visible only on mobile */}
          <div className="block md:hidden space-y-3">
            {filteredTransactions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {t("noRecords")}
              </div>
            ) : (
              filteredTransactions.map((item) => (
                <SaleReturnCard
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

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("creditNote")}</DialogTitle>
          </DialogHeader>
          {renderForm()}
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("creditNote")}</DialogTitle>
          </DialogHeader>
          {renderForm()}
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
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
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

// Mobile Card Component for Sale Return Transaction
function SaleReturnCard({
  transaction,
  onEdit,
  onDelete,
  t,
  tCommon,
}: {
  transaction: SaleReturnTransaction;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string) => string;
  tCommon: (key: string) => string;
}) {
  return (
    <div className="bg-card border rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-base truncate max-w-[60%]">
          {transaction.returnNumber || "-"}
        </h3>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit} className="h-8 w-8">
            <FilePenIcon className="w-4 h-4" />
            <span className="sr-only">{tCommon("edit")}</span>
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8">
            <Trash2 className="w-4 h-4" />
            <span className="sr-only">{tCommon("delete")}</span>
          </Button>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("customer")}:</span>
          <span>{transaction.customerName || "-"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("date")}:</span>
          <span>{transaction.date || "-"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("totalAmount")}:</span>
          <span className="font-medium">Rs. {transaction.totalAmount?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("paidAmount")}:</span>
          <span>Rs. {transaction.paidAmount?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("balanceDue")}:</span>
          <span>Rs. {transaction.balanceDue?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("paymentMethod")}:</span>
          <span>{transaction.paymentMethodName || "-"}</span>
        </div>
        {transaction.invoiceNo && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("invoiceNo")}:</span>
            <span>{transaction.invoiceNo}</span>
          </div>
        )}
      </div>
    </div>
  );
}