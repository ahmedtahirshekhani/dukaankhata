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
    <div className="max-w-6xl mx-auto py-6 space-y-4 px-4 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("purchaseBilldescription")}</p>
      </div>

      <Card className="flex flex-col gap-6 p-6">
        <CardHeader className="p-0">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("searchPlaceholder") || "Search purchase bills..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-9 h-9 text-sm w-full"
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

              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-1 shrink-0">
                      Year
                      <ChevronDownIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[150px]">
                    <DropdownMenuLabel>Select Year</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={selectedYear === null}
                      onCheckedChange={() => setSelectedYear(null)}
                    >
                      All Years
                    </DropdownMenuCheckboxItem>
                    {availableYears.map((year) => (
                      <DropdownMenuCheckboxItem
                        key={year}
                        checked={selectedYear === year}
                        onCheckedChange={() => setSelectedYear(year)}
                      >
                        {year}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-1 shrink-0">
                      <FilterIcon className="h-4 w-4" />
                      Filters
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[200px]">
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
            </div>
            <Button
              size="sm"
              onClick={() => router.push(`/${locale}/admin/purchase/purchase-bill/new`)}
              className="h-9 text-xs px-3 flex-shrink-0 w-full md:w-auto"
            >
              <PlusCircle className="w-3 h-3 mr-1" />
              {t("addBills") || "Add Purchase Bill"}
            </Button>
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
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => router.push(`/${locale}/admin/purchase/purchase-bill/new?id=${bill.id}`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden p-4 space-y-4">
                {bills.map((bill) => (
                  <PurchaseBillCard
                    key={bill.id}
                    bill={bill}
                    onEdit={() => router.push(`/${locale}/admin/purchase/purchase-bill/new?id=${bill.id}`)}
                    onDelete={() => setDeleteConfirmDialog({ open: true, billId: bill.id })}
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
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string) => string;
  tCommon: (key: string) => string;
  locale: string;
}) {
  return (
    <div className="bg-card border rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-base truncate max-w-[70%]">
          {bill.party_name}
        </h3>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            className="h-8 w-8"
          >
            <Edit className="h-4 w-4" />
            <span className="sr-only">{tCommon("edit")}</span>
          </Button>
          <Button
            size="icon"
            variant="danger"
            onClick={onDelete}
            className="h-8 w-8"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">{tCommon("delete")}</span>
          </Button>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("totalAmount") || "Total"}:</span>
          <span className="font-medium">{formatCurrencyString(bill.total_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("paidAmount") || "Paid"}:</span>
          <span>{formatCurrencyString(bill.paid_amount || 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("balanceDue") || "Balance"}:</span>
          <span className={(bill.balance_due || 0) > 0 ? "text-destructive font-medium" : "text-green-600"}>
            {formatCurrencyString(bill.balance_due || 0)}
          </span>
        </div>
        <div className="flex justify-between items-center pt-1">
          <span className="text-muted-foreground">{t("status") || "Status"}:</span>
          <Badge variant={bill.is_paid ? "default" : "secondary"}>
            {bill.is_paid ? t("paid") || "Paid" : t("pending") || "Pending"}
          </Badge>
        </div>
        <div className="flex justify-between pt-1 text-xs text-muted-foreground border-t">
          <span>{bill.created_at ? new Date(bill.created_at).toLocaleDateString(locale) : "-"}</span>
        </div>
      </div>
    </div>
  );
}

