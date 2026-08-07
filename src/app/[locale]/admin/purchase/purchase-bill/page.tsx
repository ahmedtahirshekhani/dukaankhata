"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Loader2, Edit2, SearchIcon, X, Edit, PlusCircle, FilterIcon, ChevronDownIcon } from "lucide-react";
import { formatCurrencyString } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { useOfflinePurchaseBills } from "@/lib/hooks/useOfflineData";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { db } from "@/lib/db/offline-db";
import { updateOfflinePartyBalance } from "@/lib/ledger/offline-ledger";
import React, { useMemo } from "react";
import { getYearsFromDates } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

interface PurchaseBillItem {
  id: string;
  product_id: string;
  product_name: string;
  product_description?: string;
  quantity: number;
  cost_price: number;
  amount: number;
}

interface PurchaseBill {
  id?: string;
  party_id: string;
  party_name: string;
  items: PurchaseBillItem[];
  discount: number;
  discount_type: "percentage" | "fixed";
  tax: number;
  tax_type: "percentage" | "fixed";
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  is_paid: boolean;
  payment_method_id?: string;
  payment_method_name?: string;
  description?: string;
  created_at?: string;
}

export default function PurchaseBillPage() {
  const t = useTranslations("purchaseBill");
  const tCommon = useTranslations("common");

  const locale = useLocale();
  const router = useRouter();
  const { can } = usePermissions();


  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");

  // New UI filter states
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending">("all");
  const [amountRange, setAmountRange] = useState({ min: "", max: "" });

  const debouncedSearch = useDebounce(searchTerm, 500);

  const rawOfflineBills = useOfflinePurchaseBills(debouncedSearch);

  // Extract unique years for the filter
  const availableYears = useMemo(() => {
    return getYearsFromDates(rawOfflineBills?.map((b) => b.created_at) || []);
  }, [rawOfflineBills]);

  // Apply client-side filters (year, status, amount range)
  const filteredBills = useMemo(() => {
    let result = rawOfflineBills || [];

    if (selectedYear) {
      result = result.filter(bill => {
        if (!bill.created_at) return false;
        return new Date(bill.created_at).getFullYear() === selectedYear;
      });
    }

    if (statusFilter !== "all") {
      result = result.filter(bill => bill.is_paid === (statusFilter === "paid"));
    }

    if (amountRange.min !== "" || amountRange.max !== "") {
      result = result.filter(bill => {
        const amount = bill.total_amount || 0;
        const min = amountRange.min === "" ? 0 : parseFloat(amountRange.min);
        const max = amountRange.max === "" ? Infinity : parseFloat(amountRange.max);
        return amount >= min && amount <= max;
      });
    }

    return result;
  }, [rawOfflineBills, selectedYear, statusFilter, amountRange]);

  const totalPages = Math.ceil(filteredBills.length / pageSize) || 1;

  // Pagination slicing
  const bills = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredBills.slice(startIndex, startIndex + pageSize);
  }, [filteredBills, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedYear, statusFilter, amountRange.min, amountRange.max, pageSize]);

  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title?: string;
    message: string;
    isSuccess?: boolean;
  }>({
    open: false,
    message: "",
  });

  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    billId?: string;
  }>({ open: false });

  const [isSaving, setIsSaving] = useState(false);

  const handleDeleteBill = useCallback(async (billId: string) => {
    setIsSaving(true);
    try {
      const billToDelete = await db.purchase_bills.get(billId);
      if (billToDelete && billToDelete.balance_due !== undefined) {
        await updateOfflinePartyBalance(billToDelete.party_id, -billToDelete.balance_due);
      }
      if (billToDelete && billToDelete.items) {
        const { adjustOfflineStock } = await import('@/lib/db/offline-stock-manager');
        for (const item of billToDelete.items) {
          if (item.product_id) await adjustOfflineStock(item.product_id, -(Number(item.quantity) || 0));
        }
      }
      
      await db.purchase_bills.delete(billId);

      await SyncEngine.queueOperation(
        "purchase_bills",
        "DELETE",
        `/${locale}/api/purchase-bills?id=${billId}`,
        { id: billId }
      );

      setErrorDialog({
        open: true,
        title: t("success"),
        message: t("deleteSuccess"),
        isSuccess: true,
      });

      setDeleteConfirmDialog({ open: false });
    } catch (error) {
      setErrorDialog({
        open: true,
        title: t("error"),
        message: error instanceof Error ? error.message : t("failedToDeleteBill"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [locale, t]);

  if (rawOfflineBills === undefined) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{t("purchaseBilldescription")}</p>
        </div>
        <Button
          size="sm"
          onClick={() => router.push(`/${locale}/admin/purchase/purchase-bill/new`)}
          className="h-9 text-xs px-3 shrink-0"
        >
          <PlusCircle className="w-3.5 h-3.5 mr-1" />
          <span>Add Bill</span>
        </Button>
      </div>

      <Card className="flex flex-col gap-6 p-4 sm:p-6 shadow-md">
        <CardHeader className="p-0">
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="relative flex-1 min-w-0">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("searchPlaceholder") || "Search purchase bills..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-9 h-9 text-xs sm:text-sm w-full"
              />
              {searchTerm && (
                <button
                  onClick={() => { setSearchTerm(""); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1 px-2.5 sm:px-3 text-xs shrink-0">
                  <FilterIcon className="h-3.5 w-3.5" />
                  <span>{tCommon("filter") || "Filters"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={statusFilter === "all"}
                  onCheckedChange={() => setStatusFilter("all")}
                >
                  All
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter === "paid"}
                  onCheckedChange={() => setStatusFilter("paid")}
                >
                  Paid
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilter === "pending"}
                  onCheckedChange={() => setStatusFilter("pending")}
                >
                  Pending
                </DropdownMenuCheckboxItem>

                <DropdownMenuSeparator />
                <div className="p-3">
                  <Label className="text-xs font-semibold mb-2 block">Amount Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={amountRange.min}
                      onChange={(e) => setAmountRange({ ...amountRange, min: e.target.value })}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={amountRange.max}
                      onChange={(e) => setAmountRange({ ...amountRange, max: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-0 relative">


          {bills.length === 0 ? (
            <div className="text-center text-muted-foreground py-20 flex flex-col items-center justify-center gap-2">
              <SearchIcon className="h-10 w-10 opacity-20" />
              <p>{searchTerm ? t("common.noResults") || "No results found" : t("noBills") || "No purchase bills found"}</p>
              {searchTerm && <Button variant="link" onClick={() => setSearchTerm("")}>{t("common.clearSearch") || "Clear search"}</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("partyName") || "Party"}</TableHead>
                      <TableHead className="text-right">{t("totalAmount") || "Total"}</TableHead>
                      <TableHead className="text-right">{t("paidAmount") || "Paid"}</TableHead>
                      <TableHead className="text-right">{t("balanceDue") || "Balance"}</TableHead>
                      <TableHead>{t("status") || "Status"}</TableHead>
                      <TableHead>{t("date") || "Date"}</TableHead>
                      <TableHead className="text-left pr-6">{t("actions") || "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-medium">
                          {bill.party_name}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrencyString(bill.total_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrencyString(bill.paid_amount || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrencyString(bill.balance_due || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={bill.is_paid ? "default" : "secondary"}
                          >
                            {bill.is_paid ? t("paid") || "Paid" : t("pending") || "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {bill.created_at
                            ? new Date(bill.created_at).toLocaleDateString(locale)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-2">
                            {can("purchase", "edit_purchase_bill") && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => router.push(`/${locale}/admin/purchase/purchase-bill/new?id=${bill.id}`)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {can("purchase", "delete_purchase_bill") && (
                              <Button
                                size="icon"
                                variant="danger"
                                className="h-8 w-8"
                                onClick={() => {
                                  setDeleteConfirmDialog({ open: true, billId: bill.id });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {bills.map((bill) => (
                  <PurchaseBillCard
                    key={bill.id}
                    bill={bill}
                    onEdit={can("purchase", "edit_purchase_bill") ? () => router.push(`/${locale}/admin/purchase/purchase-bill/new?id=${bill.id}`) : undefined}
                    onDelete={can("purchase", "delete_purchase_bill") ? () => setDeleteConfirmDialog({ open: true, billId: bill.id }) : undefined}
                    t={t}
                    tCommon={tCommon}
                    locale={locale}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>

        <div className="border-t p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 w-full md:w-auto">
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {tCommon("totalCountLabel", { count: filteredBills.length }) || `Total ${filteredBills.length} records`}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {tCommon("rowsPerPage") || "Rows per page"}
              </span>
              <Select
                value={pageSize.toString()}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize.toString()} />
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
          </div>
          
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              isLoading={false}
            />
          )}
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmDialog.open}
        onOpenChange={(open) => setDeleteConfirmDialog({ ...deleteConfirmDialog, open })}
        title={t("deleteBill") || "Delete Bill"}
        description={t("confirmDelete") || "Are you sure?"}
        onConfirm={() => {
          if (deleteConfirmDialog.billId) {
            handleDeleteBill(deleteConfirmDialog.billId);
          }
        }}
        variant="danger"
      />

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) =>
          setErrorDialog((prev) => ({ ...prev, open }))
        }
        title={errorDialog.title}
        message={errorDialog.message}
        isSuccess={errorDialog.isSuccess}
      />
    </div>
  );
}

// Helper function to format date as date-month-year (DD-MM-YYYY)
function formatDateDMY(dateStr?: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Mobile Card Component for Purchase Bill
function PurchaseBillCard({
  bill,
  onEdit,
  onDelete,
  t,
  tCommon,
  locale,
}: {
  bill: PurchaseBill;
  onEdit?: () => void;
  onDelete?: () => void;
  t: (key: string) => string;
  tCommon: (key: string) => string;
  locale: string;
}) {
  const tOrders = useTranslations("orders");

  return (
    <div className="bg-card border rounded-lg p-3.5 shadow-sm">
      <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
        <h3 className="font-semibold text-sm sm:text-base text-foreground truncate max-w-[65%]">
          {bill.party_name || "-"}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onEdit}
              className="h-8 w-8 text-sky-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40"
            >
              <Edit className="w-4 h-4 text-sky-500" />
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
        {/* Row 1: Date (date-month-year) on Left & Light Sky Blue Status Box on Right */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-xs font-medium">
            {formatDateDMY(bill.created_at)}
          </span>
          <Badge
            variant="outline"
            className={
              bill.is_paid
                ? "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800 text-[10px] px-2 py-0.5 font-medium"
                : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800 text-[10px] px-2 py-0.5 font-medium"
            }
          >
            {bill.is_paid ? t("paid") || "Paid" : t("pending") || "Pending"}
          </Badge>
        </div>

        {/* Row 2: Total Amount */}
        <div className="flex justify-between items-center text-xs">
          <span>
            <span className="text-muted-foreground">{tOrders("total") || "Total"}: </span>
            <span className="font-semibold text-foreground">Rs. {Math.round(bill.total_amount || 0)}</span>
          </span>
        </div>

        {/* Row 3: Paid on Left & Balance on Right */}
        <div className="flex justify-between items-center text-xs">
          <span>
            <span className="text-muted-foreground">{tOrders("paid") || "Paid"}: </span>
            <span className="font-semibold text-foreground">Rs. {Math.round(bill.paid_amount || 0)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">{tOrders("balance") || "Balance"}: </span>
            <span className="font-semibold text-foreground">Rs. {Math.round(bill.balance_due || 0)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

