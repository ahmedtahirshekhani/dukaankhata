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
import { useEffect, useMemo, useState } from "react";
import { Download, Trash2, EyeIcon, Loader2, SearchIcon, X, Edit, PlusCircle, FilterIcon, ArrowUpDown } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { useOfflineQuotations } from "@/lib/hooks/useOfflineData";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { usePermissions } from "@/hooks/use-permissions";

export default function QuotationListPage() {
  const t = useTranslations();
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const tInv = useTranslations("invoice");
  const tOrders = useTranslations("orders");
  const locale = useLocale();
  const router = useRouter();

  const { can } = usePermissions();
  const canView = can("sales", "view_quotations");
  const canCreate = can("sales", "create_quotations");
  const canEdit = can("sales", "edit_quotations");
  const canDelete = can("sales", "delete_quotations");
  const canConvert = can("sales", "create_invoice");
  
  // Pagination & Search & Filters States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 500);

  const rawQuotations = useOfflineQuotations(debouncedSearch);
  
  const filteredQuotations = useMemo(() => {
    if (!rawQuotations) return [];
    let filtered = [...rawQuotations];
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(q => (q.status || "open") === statusFilter);
    }
    
    if (sortBy === "totalHighToLow") {
      filtered.sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
    } else if (sortBy === "totalLowToHigh") {
      filtered.sort((a, b) => (a.total_amount || 0) - (b.total_amount || 0));
    }
    
    return filtered;
  }, [rawQuotations, statusFilter, sortBy]);

  const quotations = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredQuotations.slice(startIndex, startIndex + pageSize);
  }, [filteredQuotations, currentPage, pageSize]);
  
  const totalPages = Math.ceil(filteredQuotations.length / pageSize) || 1;
  const loading = rawQuotations === undefined;

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
  const isPageLoading = false;

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
      // Update local DB
      const quotation = await db.quotations.get(quotationId);
      if (quotation) {
        quotation.status = "converted";
        await db.quotations.put(quotation);
        
        // Create offline order
        const invoiceNo = `INV-${quotation.quotation_no || quotationId.slice(-6)}`.toUpperCase();
        
        const orderItems = (quotation.items || []).map((item: any) => ({
          product_id: item.product_id || item.productId || item.id,
          name: item.product_name || item.name,
          description: item.product_description || item.description || "",
          quantity: Number(item.quantity || 0),
          quantityType: "prime",
          price: Number(item.unit_price || item.sell_price || item.price || 0),
          discount: Number(item.discount || 0),
          discountType: item.discount_type || "fixed",
          unit_of_measurement: item.uom || item.unit_of_measurement || "",
        }));

        const now = new Date().toISOString();
        const orderId = crypto.randomUUID();
        
        const orderDoc: any = {
          id: orderId,
          customer_id: quotation.party_id,
          party_name: quotation.party_name,
          total_amount: Number(quotation.total_amount || 0),
          subtotal: Number(quotation.total_amount || 0),
          invoice_no: invoiceNo,
          sale_date: now,
          due_date: null,
          charges: [],
          overallDiscount: Number(quotation.discount || 0),
          discountType: quotation.discount_type || "fixed",
          tax: Number(quotation.tax || 0),
          taxType: quotation.tax_type || "fixed",
          shippingCharges: 0,
          items: orderItems,
          payment: {
            method: "cash",
            paid_amount: 0,
            paid_date: null,
            no_payment_at_all: true,
          },
          status: "completed",
          created_at: now,
          updated_at: now,
          quotation_id: quotationId,
          notes: quotation.notes || `Converted from Quotation ${quotation.quotation_no || quotationId}`,
        };
        await db.orders.put(orderDoc);

        // Deduct stock offline
        const { adjustOfflineStock } = await import('@/lib/db/offline-stock-manager');
        if (quotation.items && Array.isArray(quotation.items)) {
          for (const item of quotation.items) {
             const productId = item.product_id || item.productId || item.id;
             if (productId) {
               await adjustOfflineStock(productId.toString(), -(Number(item.quantity) || 0));
             }
          }
        }
        
        // Update customer ledger
        const { updateOfflinePartyBalance } = await import('@/lib/ledger/offline-ledger');
        await updateOfflinePartyBalance(quotation.party_id, Number(quotation.total_amount || 0));
      }
      
      // Queue offline sync
      await SyncEngine.queueOperation(
        "quotations",
        "POST",
        `/${locale}/api/quotations/${quotationId}/convert`,
        {},
        quotationId
      );
      
      setErrorDialog({
        open: true,
        title: tCommon("success"),
        message: tInv("quotation_converted_success", { invoiceNo: "Pending Sync" }),
        isSuccess: true,
      });
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



  const handleDeleteClick = (quotation: any) => {
    setQuotationToDelete(quotation);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!quotationToDelete) return;
    const id = quotationToDelete._id || quotationToDelete.id;
    setIsDeleting(true);
    try {
      // Offline Delete
      await db.quotations.delete(id);
      await SyncEngine.queueOperation("quotations", "DELETE", `/${locale}/api/quotations/${id}`, {}, id);
      
      setErrorDialog({
        open: true,
        title: tCommon("success"),
        message: tInv("quotation_deleted_success"),
        isSuccess: true,
      });
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
          <Button onClick={() => window.location.reload()} className="mt-2" variant="outline">
            {tCommon("confirm") || "Retry"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header Section */}
      <div className="flex flex-col gap-1 w-full mb-4 sm:mb-6">
        {/* Row 1: Heading and Add Button */}
        <div className="flex flex-row items-center justify-between w-full gap-2">
          <h1 className="text-2xl font-bold truncate">{tNav("quotations")}</h1>
          {canCreate && (
            <Button asChild size="sm" className="h-9 text-xs px-2.5 sm:px-3 flex-shrink-0 whitespace-nowrap">
              <Link href={`/${locale}/admin/sales/quotations/new`}>
                <PlusCircle className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Create Quotation</span>
                <span className="inline sm:hidden">Create</span>
              </Link>
            </Button>
          )}
        </div>
        {/* Row 2: Description */}
        <p className="text-sm text-muted-foreground break-words">{tNav("quotationsDescription")}</p>
      </div>

      <Card className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 shadow-md">
        <CardHeader className="p-0">
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="relative flex-1 min-w-0">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("common.search") || "Search quotations..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-9 h-9 text-xs sm:text-sm w-full"
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

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 h-9 px-2.5 sm:px-3 text-xs">
                    <FilterIcon className="w-3.5 h-3.5" />
                    <span>{tOrders("filters") || "Filters"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>{tOrders("filterByStatus") || "Filter by Status"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={statusFilter === "all"}
                    onCheckedChange={() => { setStatusFilter("all"); setCurrentPage(1); }}
                  >
                    {tOrders("allStatuses") || "All Statuses"}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilter === "open"}
                    onCheckedChange={() => { setStatusFilter("open"); setCurrentPage(1); }}
                  >
                    {tInv("statusOpen") || "Open"}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilter === "converted"}
                    onCheckedChange={() => { setStatusFilter("converted"); setCurrentPage(1); }}
                  >
                    {tInv("statusConverted") || "Converted"}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilter === "expired"}
                    onCheckedChange={() => { setStatusFilter("expired"); setCurrentPage(1); }}
                  >
                    {tInv("statusExpired") || "Expired"}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilter === "cancelled"}
                    onCheckedChange={() => { setStatusFilter("cancelled"); setCurrentPage(1); }}
                  >
                    {tInv("statusCancelled") || "Cancelled"}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 h-9 px-2.5 sm:px-3 text-xs">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>{tOrders("sort") || "Sort"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>{tOrders("sortBy") || "Sort By"}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={sortBy === "default"}
                    onCheckedChange={() => { setSortBy("default"); setCurrentPage(1); }}
                  >
                    {tOrders("default") || "Default"}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortBy === "totalHighToLow"}
                    onCheckedChange={() => { setSortBy("totalHighToLow"); setCurrentPage(1); }}
                  >
                    {tOrders("totalHighToLow") || "Total (High to Low)"}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortBy === "totalLowToHigh"}
                    onCheckedChange={() => { setSortBy("totalLowToHigh"); setCurrentPage(1); }}
                  >
                    {tOrders("totalLowToHigh") === "totalLowToHigh" ? "Total (Low to High)" : tOrders("totalLowToHigh")}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 relative">
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
              <div className="hidden md:block overflow-x-auto">
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
                      <TableHead className="w-[1%] whitespace-nowrap">{tCommon("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotations.map((q, i) => {
                      const quotId = q._id || q.id;
                      return (
                        <TableRow key={quotId}>
                          <TableCell className="text-center font-medium">{(currentPage - 1) * pageSize + i + 1}</TableCell>
                          <TableCell className="font-medium">{q.quotation_no || "-"}</TableCell>
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
                          <TableCell className="w-[1%] whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {q.status !== "converted" && canConvert && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs font-medium"
                                  onClick={() => handleConvertClick(quotId)}
                                  disabled={isConverting === quotId}
                                >
                                  {isConverting === quotId ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : null}
                                  {tNav("convertToSale")}
                                </Button>
                              )}
                              {canView && (
                                <Button size="icon" variant="ghost" asChild>
                                  <Link href={`/${locale}/admin/sales/quotations/${quotId}/view`}>
                                    <EyeIcon className="h-4 w-4" />
                                    <span className="sr-only">{tCommon("view") || "View"}</span>
                                  </Link>
                                </Button>
                              )}
                              {canEdit && (
                                <Button size="icon" variant="ghost" asChild>
                                  <Link href={`/${locale}/admin/sales/quotations/${quotId}/edit`}>
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">{tCommon("edit") || "Edit"}</span>
                                  </Link>
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  size="icon"
                                  variant="danger"
                                  className="h-8 w-8"
                                  onClick={() => handleDeleteClick(q)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">{tCommon("delete") || "Delete"}</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards View */}
              <div className="block md:hidden space-y-4">
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
                      canView={canView}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      canConvert={canConvert}
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
        
        <CardFooter className="flex flex-col md:flex-row justify-between items-center px-6 py-4 border-t gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 w-full md:w-auto">
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {tCommon("totalCountLabel", { count: filteredQuotations.length })}
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
                  {[10, 20, 50, 100].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            isLoading={isPageLoading}
          />
        </CardFooter>
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
        variant="danger"
      />

      {/* Error/Success Dialog */}
      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
        title={errorDialog.title}
        message={errorDialog.message}
        isSuccess={errorDialog.isSuccess}
      />
    </>
  );
}

// Mobile Card Component
function QuotationCard({
  quotation,
  index,
  onDelete,
  onConvert,
  isConverting,
  canView,
  canEdit,
  canDelete,
  canConvert,
  t,
  tNav,
  tInv,
}: {
  quotation: any;
  index: number;
  onDelete: () => void;
  onConvert: () => void;
  isConverting: boolean;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canConvert: boolean;
  t: (key: string) => string;
  tNav: (key: string) => string;
  tInv: (key: string) => string;
}) {
  const locale = useLocale();
  const quotId = quotation._id || quotation.id;
  
  return (
    <div className="bg-card border rounded-lg p-4 shadow-sm w-full">
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

      <div className="flex justify-between items-center text-sm">
        <div>
          <span className="text-muted-foreground mr-1.5">{t("common.total") || "Total"}:</span>
          <span className="font-semibold text-foreground">{formatCurrencyString(quotation.total_amount || 0)}</span>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground mr-1.5">{tInv("validity")}:</span>
          <span className="font-medium text-foreground">{quotation.validity_date ? new Date(quotation.validity_date).toLocaleDateString() : "-"}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t">
        {/* Left: Convert to Sale */}
        {canConvert ? (
          <Button 
            size="sm" 
            variant="default" 
            className="h-8 px-2.5 text-white shadow-sm text-[11px]"
            onClick={onConvert}
            disabled={isConverting || quotation.status === "converted"}
          >
            {isConverting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : null}
            {tNav("convertToSale")}
          </Button>
        ) : <div />}

        {/* Right: Icon actions */}
        <div className="flex items-center gap-1">
          {canView && (
            <Button size="icon" variant="ghost" asChild title="View" className="h-8 w-8">
              <Link href={`/${locale}/admin/sales/quotations/${quotId}/view`}>
                <EyeIcon className="h-4 w-4" />
                <span className="sr-only">{t("common.view") || "View"}</span>
              </Link>
            </Button>
          )}
          {canEdit && (
            <Button size="icon" variant="ghost" asChild title="Edit" className="h-8 w-8">
              <Link href={`/${locale}/admin/sales/quotations/${quotId}/edit`}>
                <Edit className="h-4 w-4" />
                <span className="sr-only">{t("common.edit") || "Edit"}</span>
              </Link>
            </Button>
          )}
          {canDelete && (
            <Button
              size="icon"
              variant="danger"
              onClick={onDelete}
              className="h-8 w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}