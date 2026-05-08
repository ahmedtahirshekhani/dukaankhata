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
  X,
  ChevronRight,
} from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { useDebounce } from "@/hooks/use-debounce";
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
import { ProductDropdown } from "@/components/dropdown/product-dropdown";
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
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination & Search states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transactionToDelete, setTransactionToDelete] =
    useState<SaleReturnTransaction | null>(null);
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

  const fetchTransactions = useCallback(async (page = currentPage, limit = pageSize, search = debouncedSearch, currentFilters = filters) => {
    // Only show full-screen loader on the very first load
    if (transactions.length === 0 && !search && page === 1 && currentFilters.customer === "all" && currentFilters.paymentMethod === "all") {
      setLoading(true);
    }
    setIsPageLoading(true);
    setError(null);
    try {
      const url = new URL(`/${locale}/api/sale-return-transactions`, window.location.origin);
      url.searchParams.append("page", page.toString());
      url.searchParams.append("limit", limit.toString());
      if (search) url.searchParams.append("search", search);
      if (currentFilters.customer !== "all") url.searchParams.append("customerId", currentFilters.customer);
      if (currentFilters.paymentMethod !== "all") url.searchParams.append("paymentMethod", currentFilters.paymentMethod);
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(t("failedToFetch"));
      const data = await res.json();
      
      if (data.transactions) {
        setTransactions(data.transactions);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setTransactions(Array.isArray(data) ? data : []);
        setTotalPages(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedToFetch"));
    } finally {
      setLoading(false);
      setIsPageLoading(false);
    }
  }, [locale, t, transactions.length, currentPage, pageSize, debouncedSearch, filters]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`/${locale}/api/customers?limit=-1`);
      if (!res.ok) return;
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch {
      setCustomers([]);
    }
  }, [locale]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`/${locale}/api/products?limit=-1`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data.products)
        ? data.products.map((item: Record<string, unknown>) => ({
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
    fetchTransactions(1, pageSize, debouncedSearch, filters);
    setCurrentPage(1);
  }, [debouncedSearch, locale, pageSize, filters]);

  useEffect(() => {
    fetchTransactions(currentPage, pageSize, debouncedSearch, filters);
  }, [currentPage, locale]);

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
    fetchPaymentMethods();
  }, [fetchCustomers, fetchProducts, fetchPaymentMethods]);

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


  const updateFormItem = <K extends keyof ReturnItem>(
    id: string,
    key: K,
    value: ReturnItem[K],
  ) => {
    setFormItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
    );
  };

  const handleSelectProduct = (lineId: string, productId: string, selectedProd?: Product) => {
    const product = selectedProd || products.find((item) => item.id === productId);
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
          productId: (line.productId || (line as any).product_id || "").toString(),
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
        {/* <div className="space-y-2">
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
      </div> */}
        <div className="space-y-2">
          <Label>{t("paymentMethod")}</Label>
          <PaymentMethodDropdown
            value={formPaymentMethodId}
            onValueChange={(id) => setFormPaymentMethodId(id)}
            placeholder={t("selectPaymentMethod")}
            enableSearch={true}
            searchPlaceholder={tCommon("searchPaymentMethods") || "Search payment methods..."}
            noResultsText={t("noPaymentMethodsFound") || "No payment methods found"}
            addButtonPosition="bottom"
            includeDefaultMethods={true}
          />
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
                    <ProductDropdown
                      value={item.productId}
                      onValueChange={(value, prod) => handleSelectProduct(item.id, value, prod)}
                      placeholder={tCommon("searchProduct")}
                      enableSearch={true}
                      searchPlaceholder={tCommon("searchProduct") || "Search product..."}
                    />
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
                      variant="danger"
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
    <div className="max-w-6xl mx-auto py-6 space-y-4 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder") || "Search transactions..."}
            className="pl-9 pr-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <FilterIcon className="h-4 w-4" />
                {tCommon("filter")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 max-h-[70vh] overflow-y-auto">
              <DropdownMenuLabel>{t("filterByPaymentMethod")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filters.paymentMethod === "all"}
                onCheckedChange={(checked) => checked && setFilters(f => ({ ...f, paymentMethod: "all" }))}
              >
                {t("allPaymentMethods")}
              </DropdownMenuCheckboxItem>
              {paymentMethods.map((pm) => (
                <DropdownMenuCheckboxItem
                  key={pm.id}
                  checked={filters.paymentMethod === pm.id}
                  onCheckedChange={(checked) => checked && setFilters(f => ({ ...f, paymentMethod: pm.id }))}
                >
                  {pm.name}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t("filterByCustomer")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filters.customer === "all"}
                onCheckedChange={(checked) => checked && setFilters(f => ({ ...f, customer: "all" }))}
              >
                {t("allCustomers")}
              </DropdownMenuCheckboxItem>
              {customers.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={filters.customer === c.id}
                  onCheckedChange={(checked) => checked && setFilters(f => ({ ...f, customer: c.id }))}
                >
                  {c.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={openAddDialog}
            className="gap-2 shrink-0"
          >
            <PlusCircle className="h-4 w-4" />
            <span>{t("addSaleReturn")}</span>
          </Button>
        </div>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0 relative">
          {isPageLoading && (
            <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center">
              <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
          {/* Desktop Table View */}
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
                  <TableHead className="text-right pr-6">{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-20">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <SearchIcon className="h-10 w-10 opacity-20" />
                        <p>{searchTerm ? tCommon("noResults") : t("noRecords")}</p>
                        {searchTerm && (
                          <Button 
                            variant="link" 
                            onClick={() => setSearchTerm("")}
                          >
                            {tCommon("clearSearch")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.returnNumber || "-"}
                      </TableCell>
                      <TableCell>{item.customerName || "-"}</TableCell>
                      <TableCell>{item.date || "-"}</TableCell>
                      <TableCell>Rs. {item.totalAmount?.toFixed(2)}</TableCell>
                      <TableCell>Rs. {item.paidAmount?.toFixed(2)}</TableCell>
                      <TableCell>Rs. {item.balanceDue?.toFixed(2)}</TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => openEditDialog(item)}
                          >
                            <FilePenIcon className="h-4 w-4" />
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
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-3 p-4">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <SearchIcon className="h-10 w-10 opacity-20" />
                <p>{searchTerm ? tCommon("noResults") : t("noRecords")}</p>
                {searchTerm && (
                   <Button variant="link" onClick={() => setSearchTerm("")}>
                     {tCommon("clearSearch")}
                   </Button>
                )}
              </div>
            ) : (
              transactions.map((item) => (
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

        {transactions.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground order-2 sm:order-1">
              <span>{tCommon("rowsPerPage")}:</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 50].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="order-1 sm:order-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                isLoading={isPageLoading}
              />
            </div>
          </div>
        )}
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
             <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
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
           <Button size="icon" variant="danger" onClick={onDelete} className="h-8 w-8">
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
          <span>Rs. {transaction.totalAmount?.toFixed(2)}</span>
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