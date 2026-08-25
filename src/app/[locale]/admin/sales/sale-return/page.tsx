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
  XIcon,
  ChevronRight,
} from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { db } from "@/lib/db/offline-db";
import { useOfflineProducts, useOfflineSaleReturns, useOfflineCustomers, useOfflinePaymentMethods } from "@/lib/hooks/useOfflineData";
import { SyncEngine } from "@/lib/sync/sync-engine";
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
import { NumericInput } from "@/components/ui/numeric-input";
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
import { usePermissions } from "@/hooks/use-permissions";

type Customer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

type Product = {
  id: string | number;
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
  const { can } = usePermissions();

  // Customers will be derived from useOfflineCustomers
  const rawProducts = useOfflineProducts() || [];
  const products = useMemo(() => {
    return rawProducts.map(item => ({
      id: String(item.id ?? item._id ?? ""),
      name: String(item.name ?? ""),
      sellPrice: item.sell_price || item.salePrice || item.price || 0,
      sell_price: item.sell_price || item.salePrice || item.price || 0,
      salePrice: item.salePrice || item.sell_price || 0,
      price: item.price || item.sell_price || 0,
      retailPrice: item.retailPrice || 0,
    }));
  }, [rawProducts]);
  // Payment Methods will be derived from useOfflinePaymentMethods
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination & Search states
  const [currentPage, setCurrentPage] = useState(1);
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

  const rawOfflineTransactions = useOfflineSaleReturns(debouncedSearch, filters.paymentMethod, filters.customer);
  const loading = rawOfflineTransactions === undefined;
  const allOfflineTransactions = rawOfflineTransactions || [];
  const totalPages = Math.ceil(allOfflineTransactions.length / pageSize) || 1;
  const transactions = allOfflineTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize) as SaleReturnTransaction[];

  const offlineCustomers = useOfflineCustomers() || [];
  const customers = useMemo(() => {
    return offlineCustomers.filter((c) => c.is_delete !== 1);
  }, [offlineCustomers]);

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

    const uniqueMap = new Map();
    allMethods.forEach(m => uniqueMap.set(m.id, m));
    return Array.from(uniqueMap.values());
  }, [offlinePaymentMethods]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, pageSize, filters]);

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
      const customer = customers.find((c) => c.id === formCustomerId);
      const pm = paymentMethods.find((p) => p.id === formPaymentMethodId);
      const newId = Date.now().toString();

      await db.sale_return_transactions.put({
        ...payload,
        id: newId,
        customerName: customer?.name ?? "",
        paymentMethodName: pm?.name ?? "",
        balanceDue,
        is_delete: 0,
        created_at: new Date().toISOString()
      });

      const { updateOfflinePartyBalance } = await import("@/lib/ledger/offline-ledger");
      const netAmount = paidAmount - totalAmount;
      await updateOfflinePartyBalance(formCustomerId, netAmount);

      const { adjustOfflineStock } = await import('@/lib/db/offline-stock-manager');
      for (const item of payload.items) {
        if (item.productId) await adjustOfflineStock(item.productId, item.quantity);
      }

      await SyncEngine.queueOperation(
        "sale_return_transactions", 
        "POST", 
        `/${locale}/api/sale-return-transactions`, 
        payload, 
        newId
      );
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
      const customer = customers.find((c) => c.id === formCustomerId);
      const pm = paymentMethods.find((p) => p.id === formPaymentMethodId);

      const existing = await db.sale_return_transactions.get(selectedId);
      if (existing) {
        const { adjustOfflineStock } = await import('@/lib/db/offline-stock-manager');
        // Revert old stock
        if (existing.items && Array.isArray(existing.items)) {
          for (const item of existing.items) {
            if (item.productId) await adjustOfflineStock(item.productId, -(item.quantity || 0));
          }
        }
        await db.sale_return_transactions.update(selectedId, {
          ...existing,
          ...payload,
          customerName: customer?.name ?? "",
          paymentMethodName: pm?.name ?? "",
          balanceDue,
          updated_at: new Date().toISOString()
        });
        
        const { updateOfflinePartyBalance } = await import("@/lib/ledger/offline-ledger");
        const oldNetAmount = (existing.paidAmount || 0) - (existing.totalAmount || 0);
        const newNetAmount = paidAmount - totalAmount;
        await updateOfflinePartyBalance(formCustomerId, newNetAmount - oldNetAmount);
        // Apply new stock
        for (const item of payload.items) {
          if (item.productId) await adjustOfflineStock(item.productId, item.quantity);
        }

        await SyncEngine.queueOperation(
          "sale_return_transactions", 
          "PUT", 
          `/${locale}/api/sale-return-transactions/${selectedId}`, 
          payload, 
          selectedId
        );
      }
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
      const existing = await db.sale_return_transactions.get(transactionToDelete.id);
      if (existing) {
        const { adjustOfflineStock } = await import('@/lib/db/offline-stock-manager');
        // Revert stock
        if (existing.items && Array.isArray(existing.items)) {
          for (const item of existing.items) {
            if (item.productId) await adjustOfflineStock(item.productId, -(item.quantity || 0));
          }
        }
        await db.sale_return_transactions.update(transactionToDelete.id, {
          ...existing,
          is_delete: 1,
          updated_at: new Date().toISOString()
        });

        const { updateOfflinePartyBalance } = await import("@/lib/ledger/offline-ledger");
        const oldNetAmount = (existing.paidAmount || 0) - (existing.totalAmount || 0);
        await updateOfflinePartyBalance(existing.customerId, -oldNetAmount);

        await SyncEngine.queueOperation(
          "sale_return_transactions", 
          "DELETE", 
          `/${locale}/api/sale-return-transactions/${transactionToDelete.id}`, 
          {}, 
          transactionToDelete.id
        );
      }
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
    
    // Parse items if they are stored as string (some legacy offline data might be)
    let parsedItems = item.items;
    if (typeof parsedItems === "string") {
      try { parsedItems = JSON.parse(parsedItems); } catch(e) {}
    }
    
    setFormItems(
      parsedItems?.length
        ? parsedItems.map((line: any, index: number) => ({
          id: line.id || `${item.id}-${index}`,
          productId: (line.productId || line.product_id || "").toString(),
          itemName: line.itemName || line.item_name || "",
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <Input
            type="daute"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("party")}</Label>
          <PartyDropdown
            value={formCustomerId}
            onValueChange={(id) => setFormCustomerId(id)}
            placeholder={t("selectCustomer")}
            enableSearch={true}
            searchPlaceholder={tCommon("searchCustomer")}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("paymentMethod")}</Label>
          <PaymentMethodDropdown
            value={formPaymentMethodId}
            onValueChange={(id) => setFormPaymentMethodId(id)}
            placeholder={t("selectPaymentMethod")}
            enableSearch={true}
            searchPlaceholder={tCommon("searchPaymentMethods")}
            noResultsText={t("noPaymentMethodsFound")}
            addButtonPosition="bottom"
            // includeDefaultMethods={true}
          />
        </div>
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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-bold">{t("items")}</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItemRow}>
            <PlusCircle className="w-4 h-4 mr-2" />
            {t("addItems")}
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          {/* Desktop View: Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[180px]">{t("selectProduct")}</TableHead>
                  <TableHead className="min-w-[180px]">{t("itemName")}</TableHead>
                  <TableHead className="w-[110px]">{t("qty")}</TableHead>
                  <TableHead className="w-[130px]">{t("rate")}</TableHead>
                  <TableHead className="w-[120px]">{t("amount")}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formItems.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <ProductDropdown
                        value={item.productId}
                        onValueChange={(value, prod) => handleSelectProduct(String(item.id), value, prod)}
                        placeholder={tCommon("searchProduct")}
                        enableSearch={true}
                        searchPlaceholder={tCommon("searchProduct") || "Search product..."}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.itemName}
                        onChange={(e) => updateFormItem(item.id, "itemName", e.target.value)}
                        placeholder={t("itemNamePlaceholder")}
                      />
                    </TableCell>
                    <TableCell>
                      <NumericInput
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateFormItem(item.id, "quantity", e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <NumericInput
                        min="0"
                        value={item.rate}
                        onChange={(e) => updateFormItem(item.id, "rate", e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap text-primary">Rs. {lineTotals[index]?.toFixed(2)}</TableCell>
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

          {/* Mobile View: Cards */}
          <div className="md:hidden divide-y">
            {formItems.map((item, index) => (
              <div key={item.id} className="p-4 space-y-4 bg-card">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm bg-primary/10 text-primary px-2 py-1 rounded">Item #{index + 1}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="danger"
                    onClick={() => removeItemRow(item.id)}
                    disabled={formItems.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">{t("selectProduct")}</Label>
                    <ProductDropdown
                      value={item.productId}
                      onValueChange={(value, prod) => handleSelectProduct(String(item.id), value, prod)}
                      placeholder={tCommon("searchProduct")}
                      enableSearch={true}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t("itemName")}</Label>
                    <Input
                      value={item.itemName}
                      onChange={(e) => updateFormItem(item.id, "itemName", e.target.value)}
                      placeholder={t("itemNamePlaceholder")}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t("qty")}</Label>
                      <NumericInput
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateFormItem(item.id, "quantity", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t("rate")}</Label>
                      <NumericInput
                        min="0"
                        value={item.rate}
                        onChange={(e) => updateFormItem(item.id, "rate", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t text-sm font-medium">
                    <span className="text-muted-foreground">{t("amount")}:</span>
                    <span className="text-primary font-bold text-base">Rs. {lineTotals[index]?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("totalAmount")}</Label>
          <div className="text-xl font-bold text-primary">Rs. {totalAmount.toFixed(2)}</div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("paidAmount")}</Label>
          <NumericInput
            min="0"
            value={formPaidAmount}
            onChange={(e) => setFormPaidAmount(e.target.value)}
            className="h-10 text-lg font-semibold"
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("balanceDue")}</Label>
          <div className="text-xl font-bold text-orange-600">Rs. {balanceDue.toFixed(2)}</div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("paymentRefNo")}</Label>
          <Input
            value={formPaymentRefNo}
            onChange={(e) => setFormPaymentRefNo(e.target.value)}
            placeholder={t("paymentRefNoPlaceholder")}
            className="h-10"
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
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{t("pageDescription")}</p>
        </div>
        {can("sales", "create_sale_return") && (
          <Button size="sm" onClick={openAddDialog} className="h-9 text-xs px-3 shrink-0">
            <PlusCircle className="w-3.5 h-3.5 mr-1" />
            <span>{t("addSaleReturn")}</span>
          </Button>
        )}
      </div>
      <Card className="flex flex-col gap-6 p-4 sm:p-6 shadow-md overflow-hidden">
        <CardHeader className="p-0">
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="relative flex-1 min-w-0">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("searchPlaceholder") || "Search transactions..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-9 h-9 text-xs sm:text-sm w-full"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <DropdownMenu onOpenChange={(open) => {
              if (open) setFilterCustomerPage(1);
            }}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 h-9 px-2.5 sm:px-3 text-xs shrink-0">
                  <FilterIcon className="h-3.5 w-3.5" />
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
                {displayCustomers.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={filters.customer === c.id}
                    onCheckedChange={(checked) => checked && setFilters(f => ({ ...f, customer: c.id }))}
                  >
                    {c.name}
                  </DropdownMenuCheckboxItem>
                ))}
                {hasMoreFilterCustomers && (
                  <div className="flex justify-center p-2">
                    <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
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
                          {can("sales", "edit_sale_return") && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => openEditDialog(item)}
                            >
                              <FilePenIcon className="h-4 w-4" />
                            </Button>
                          )}

                          {can("sales", "delete_sale_return") && (
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
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-3">
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
                  onEdit={can("sales", "edit_sale_return") ? () => openEditDialog(item) : undefined}
                  onDelete={can("sales", "delete_sale_return") ? () => {
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
              {tCommon("totalCountLabel", { count: allOfflineTransactions.length })}
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

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="w-[95vw] sm:max-w-6xl max-h-[95vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              {t("addSaleReturn")}
            </DialogTitle>
          </DialogHeader>
          {renderForm()}
          <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={isSaving} className="w-full sm:w-auto">
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleAdd} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="w-[95vw] sm:max-w-6xl max-h-[95vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FilePenIcon className="h-5 w-5 text-primary" />
              {t("editRecord")}
            </DialogTitle>
          </DialogHeader>
          {renderForm()}
          <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isSaving} className="w-full sm:w-auto">
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleEdit} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
              {tCommon("save")}
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
  onEdit?: () => void;
  onDelete?: () => void;
  t: (key: string) => string;
  tCommon: (key: string) => string;
}) {
  const tOrders = useTranslations("orders");

  return (
    <div className="bg-card border rounded-lg p-3.5 shadow-sm">
      <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
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
      <div className="space-y-2 text-xs sm:text-sm">
        {/* Row 1: ID number & Date without 'ID:' and 'Date:' text in theme grey */}
        <div className="flex justify-between items-center text-muted-foreground text-xs font-medium">
          <span>{transaction.returnNumber || transaction.id || "-"}</span>
          <span>{transaction.date || "-"}</span>
        </div>

        {/* Row 2: Total & Paid without 'Amount' text */}
        <div className="flex justify-between items-center text-xs">
          <span>
            <span className="text-muted-foreground">{tOrders("total") || "Total"}: </span>
            <span className="font-semibold text-foreground">Rs. {Math.round(transaction.totalAmount || 0)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">{tOrders("paid") || "Paid"}: </span>
            <span className="font-semibold text-foreground">Rs. {Math.round(transaction.paidAmount || 0)}</span>
          </span>
        </div>

        {/* Row 3: Balance & Method without 'Due' text */}
        <div className="flex justify-between items-center text-xs">
          <span>
            <span className="text-muted-foreground">{tOrders("balance") || "Balance"}: </span>
            <span className="font-semibold text-foreground">Rs. {Math.round(transaction.balanceDue || 0)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Method: </span>
            <span className="font-medium text-foreground">{transaction.paymentMethodName || "-"}</span>
          </span>
        </div>

        {transaction.invoiceNo && (
          <div className="flex justify-between items-center text-xs text-muted-foreground pt-0.5">
            <span>{t("invoiceNo")}: {transaction.invoiceNo}</span>
          </div>
        )}
      </div>
    </div>
  );
}