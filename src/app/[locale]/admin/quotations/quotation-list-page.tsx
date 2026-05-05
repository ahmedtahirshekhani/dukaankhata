"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Download, Trash2, EyeIcon, Loader2, SearchIcon, X, Edit } from "lucide-react";
import { formatCurrencyString } from "@/lib/utils";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { Pagination } from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export default function QuotationListPage() {
  const t = useTranslations();
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const tInv = useTranslations("invoice");
  const locale = useLocale();
  const router = useRouter();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConverting, setIsConverting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [quotationToConvert, setQuotationToConvert] = useState<string | null>(null);
  const [quotationToDelete, setQuotationToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    isSuccess?: boolean;
  }>({
    open: false,
    title: "",
    message: "",
  });
  
  // Pagination & Search States
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [isPageLoading, setIsPageLoading] = useState(false);

  const handleConvertClick = (quotationId: string) => {
    setQuotationToConvert(quotationId);
    setConvertDialogOpen(true);
  };

  const handleConvert = async () => {
    if (!quotationToConvert) return;
    const quotationId = quotationToConvert;
    setIsConverting(quotationId);
    setConvertDialogOpen(false);
    try {
      const res = await fetch(`/${locale}/api/quotations/${quotationId}/convert`, {
        method: "POST",
      });
      
      if (res.ok) {
        const data = await res.json();
        setErrorDialog({
          open: true,
          title: tCommon("success"),
          message: tInv("quotation_converted_success", { invoiceNo: data.invoiceNo }),
          isSuccess: true,
        });
        fetchQuotations(); // Refresh list
      } else {
        const errorData = await res.json();
        throw new Error(errorData?.error || tInv("failed_to_convert"));
      }
    } catch (error) {
      setErrorDialog({
        open: true,
        title: tCommon("error"),
        message: error instanceof Error ? error.message : tInv("error_converting"),
      });
    } finally {
      setIsConverting(null);
      setQuotationToConvert(null);
    }
  };

  const fetchQuotations = async (page = currentPage, limit = pageSize, search = debouncedSearch) => {
    // Only show full-screen loader on the very first load
    if (quotations.length === 0 && !search && page === 1) {
      setLoading(true);
    }
    setIsPageLoading(true);
    setError(null);
    try {
      const url = new URL(`/${locale}/api/quotations`, window.location.origin);
      url.searchParams.append("page", page.toString());
      url.searchParams.append("limit", limit.toString());
      if (search) url.searchParams.append("search", search);
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.quotations) {
        setQuotations(data.quotations);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setQuotations(Array.isArray(data) ? data : []);
        setTotalPages(1);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      let message = "Unknown error";
      if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
        message = (error as any).message;
      } else if (typeof error === "string") {
        message = error;
      }
      setError(message);
      setQuotations([]);
    } finally {
      setLoading(false);
      setIsPageLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations(1, pageSize, debouncedSearch);
    setCurrentPage(1);
  }, [debouncedSearch, locale, pageSize]);

  useEffect(() => {
    fetchQuotations(currentPage, pageSize, debouncedSearch);
  }, [currentPage]);

  const handleDeleteClick = (quotation: any) => {
    setQuotationToDelete(quotation);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!quotationToDelete) return;
    const id = quotationToDelete._id || quotationToDelete.id;
    setIsDeleting(true);
    try {
      const res = await fetch(`/${locale}/api/quotations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setQuotations(quotations.filter((q) => (q._id || q.id) !== id));
        setErrorDialog({
          open: true,
          title: tCommon("success"),
          message: tInv("quotation_deleted_success"),
          isSuccess: true,
        });
      } else {
        const errorData = await res.json();
        throw new Error(errorData?.error || tInv("failed_to_delete"));
      }
    } catch (error) {
      setErrorDialog({
        open: true,
        title: tCommon("error"),
        message: error instanceof Error ? error.message : tInv("error_deleting"),
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setQuotationToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-6">
        <div className="flex justify-center items-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <h3 className="font-semibold">{tInv("loading_quotations_error")}</h3>
          <p className="text-sm">{error}</p>
          <Button onClick={() => fetchQuotations()} className="mt-2" variant="outline">
            {tCommon("confirm")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-4 px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{tNav("quotations")}</h1>
          <p className="text-sm text-muted-foreground">{tNav("quotationsDescription")}</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href={`/${locale}/admin/quotations/new`}>{t("common.add")}</Link>
        </Button>
      </div>

      <Card className="shadow-md">
        <CardHeader className="p-4 border-b bg-muted/50">
          <div className="relative w-full sm:max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search") || "Search quotations..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {quotations.length === 0 && !loading ? (
            <div className="text-center py-20 text-muted-foreground bg-muted/5">
              <div className="flex flex-col items-center gap-2">
                <SearchIcon className="h-10 w-10 opacity-20" />
                <p className="font-medium">{searchTerm ? (t("common.noResults") || tCommon("noResults")) : tInv("no_quotations_found")}</p>
                {searchTerm && <Button variant="link" onClick={() => setSearchTerm("")}>{t("common.clearSearch") || "Clear search"}</Button>}
              </div>
            </div>
          ) : (
            <div className="relative min-h-[300px]">
              {isPageLoading && (
                <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px] text-center">#</TableHead>
                      <TableHead>{tInv("quotation_number")}</TableHead>
                      <TableHead>{tInv("party")}</TableHead>
                      <TableHead>{tCommon("total")}</TableHead>
                      <TableHead>{tInv("status")}</TableHead>
                      <TableHead>{tInv("validity")}</TableHead>
                      <TableHead>{tInv("date")}</TableHead>
                      <TableHead className="text-right">{tCommon("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotations.map((q, i) => {
                      const quotId = q._id || q.id;
                      return (
                        <TableRow key={quotId}>
                          <TableCell className="text-center font-medium">{(currentPage - 1) * pageSize + i + 1}</TableCell>
                          <TableCell className="font-medium text-primary">{q.quotation_no || "-"}</TableCell>
                          <TableCell>{q.party_name || "-"}</TableCell>
                          <TableCell className="font-semibold">{formatCurrencyString(q.total_amount || 0)}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              q.status === "converted" ? "bg-green-100 text-green-700" :
                              q.status === "expired" ? "bg-red-100 text-red-700" :
                              q.status === "cancelled" ? "bg-gray-100 text-gray-700" :
                              "bg-blue-50 text-blue-700"
                            }`}>
                              {q.status || "open"}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {q.validity_date ? new Date(q.validity_date).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {q.created_at ? new Date(q.created_at).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" asChild title="View">
                                <Link href={`/${locale}/admin/quotations/${quotId}/view`}>
                                  <EyeIcon className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button size="icon" variant="ghost" asChild title="Edit">
                                <Link href={`/${locale}/admin/quotations/${quotId}/edit`}>
                                  <Edit className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                className="h-8 text-xs font-medium border-primary/20 text-white hover:opacity-90 transition-opacity"
                                onClick={() => handleConvertClick(quotId)}
                                disabled={isConverting === quotId || q.status === "converted"}
                              >
                                {isConverting === quotId ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : null}
                                {tNav("convertToSale")}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteClick(q)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards View */}
              <div className="block md:hidden p-4 space-y-4">
                {quotations.map((q, i) => {
                  const quotId = q._id || q.id;
                  return (
                    <QuotationCard
                      key={quotId}
                      quotation={q}
                      index={(currentPage - 1) * pageSize + i}
                      onDelete={() => handleDeleteClick(q)}
                      onConvert={() => handleConvertClick(quotId)}
                      isConverting={isConverting === quotId}
                      t={t}
                      tNav={tNav}
                      tInv={tInv}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
        
        <div className="border-t p-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {t("common.rowsPerPage") || "Rows per page"}:
              </span>
              <Select
                value={pageSize.toString()}
                onValueChange={(v) => {
                  setPageSize(parseInt(v));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize.toString()} />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((size) => (
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

      {/* Confirm Convert Dialog */}
      <ConfirmDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        title={tInv("convert_to_sale_title")}
        description={tInv("convert_to_sale_description")}
        confirmLabel={isConverting ? tInv("converting") : tInv("convert")}
        cancelLabel={tCommon("cancel")}
        onConfirm={handleConvert}
        variant="default"
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={tInv("delete_quotation_title")}
        description={tInv("delete_quotation_description", { party: quotationToDelete?.party_name || tInv("party") })}
        confirmLabel={isDeleting ? tInv("deleting") : tCommon("delete")}
        cancelLabel={tCommon("cancel")}
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />

      {/* Error/Success Dialog */}
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

// Mobile Card Component
function QuotationCard({
  quotation,
  index,
  onDelete,
  onConvert,
  isConverting,
  t,
  tNav,
  tInv,
}: {
  quotation: any;
  index: number;
  onDelete: () => void;
  onConvert: () => void;
  isConverting: boolean;
  t: (key: string) => string;
  tNav: (key: string) => string;
  tInv: (key: string) => string;
}) {
  const locale = useLocale();
  const quotId = quotation._id || quotation.id;
  
  return (
    <div className="bg-card border rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-base">
            {quotation.quotation_no || `#${index + 1}`} • {quotation.party_name || "-"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {quotation.created_at ? new Date(quotation.created_at).toLocaleDateString() : "-"}
          </p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          quotation.status === "converted" ? "bg-green-100 text-green-700" :
          quotation.status === "expired" ? "bg-red-100 text-red-700" :
          quotation.status === "cancelled" ? "bg-gray-100 text-gray-700" :
          "bg-yellow-100 text-yellow-700"
        }`}>
          {quotation.status || "open"}
        </span>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("common.total") || "Total"}:</span>
          <span className="font-medium">{formatCurrencyString(quotation.total_amount || 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{tInv("validity")}:</span>
          <span>{quotation.validity_date ? new Date(quotation.validity_date).toLocaleDateString() : "-"}</span>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 mt-4 pt-3 border-t">
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" asChild title="View" className="h-9 px-3">
            <Link href={`/${locale}/admin/quotations/${quotId}/view`}>
              <EyeIcon className="h-4 w-4 mr-1.5" />
              {t("common.view") || "View"}
            </Link>
          </Button>
          <Button size="sm" variant="ghost" asChild title="Edit" className="h-9 px-3">
            <Link href={`/${locale}/admin/quotations/${quotId}/edit`}>
              <Edit className="h-4 w-4 mr-1.5" />
              {t("common.edit") || "Edit"}
            </Link>
          </Button>
        </div>
        
        <div className="flex gap-1">
          <Button 
            size="sm" 
            variant="default" 
            className="h-9 px-4 text-white shadow-sm"
            onClick={onConvert}
            disabled={isConverting || quotation.status === "converted"}
          >
             {isConverting ? (
               <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
             ) : null}
             {tNav("convertToSale")}
           </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} className="h-9 w-9 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}