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
import { Trash2, Plus, Loader2, Edit2, SearchIcon, X, Edit } from "lucide-react";
import { formatCurrencyString } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import React from "react";

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

  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(false);
  
  // Pagination & Search states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);

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

  const fetchBills = useCallback(async (page = currentPage, limit = pageSize, search = debouncedSearch) => {
    if (bills.length === 0 && !search && page === 1) {
      setLoading(true);
    }
    setIsPageLoading(true);
    try {
      const url = new URL(`/${locale}/api/purchase-bills`, window.location.origin);
      url.searchParams.append("page", page.toString());
      url.searchParams.append("limit", limit.toString());
      if (search) url.searchParams.append("search", search);

      const billsRes = await fetch(url.toString());
      if (billsRes.ok) {
        const data = await billsRes.json();
        if (data.bills) {
          setBills(data.bills);
          setTotalPages(data.pagination?.totalPages || 1);
        } else {
          setBills(Array.isArray(data) ? data : []);
          setTotalPages(1);
        }
      }
    } catch (error) {
      console.error("Error fetching bills:", error);
      setErrorDialog({
        open: true,
        title: t("error"),
        message: t("failedToLoadData"),
      });
    } finally {
      setLoading(false);
      setIsPageLoading(false);
    }
  }, [locale, t, bills.length, currentPage, pageSize, debouncedSearch]);

  useEffect(() => {
    fetchBills(1, pageSize, debouncedSearch);
    setCurrentPage(1);
  }, [debouncedSearch, locale, pageSize]);

  useEffect(() => {
    fetchBills(currentPage, pageSize, debouncedSearch);
  }, [currentPage, locale]);

  const handleDeleteBill = useCallback(async (billId: string) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/${locale}/api/purchase-bills?id=${billId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(t("failedToDeleteBill"));
      }

      setErrorDialog({
        open: true,
        title: t("success"),
        message: t("deleteSuccess"),
        isSuccess: true,
      });

      // Refresh bills list
      const billsRes = await fetch(`/${locale}/api/purchase-bills`);
      if (billsRes.ok) {
        const data = await billsRes.json();
        setBills(Array.isArray(data) ? data : []);
      }

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

  if (loading) {
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

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder") || "Search purchase bills..."}
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
        <Button
          onClick={() => router.push(`/${locale}/admin/purchase/purchase-bill/new`)}
          className="gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          {t("addBills") || "Add Purchase Bill"}
        </Button>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0 relative">
          {isPageLoading && (
            <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          
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

        {bills.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground order-2 sm:order-1">
              <span>{tCommon("rowsPerPage") || "Rows per page"}:</span>
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

