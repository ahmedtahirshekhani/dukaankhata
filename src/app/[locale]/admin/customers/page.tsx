"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Loader2Icon,
  SearchIcon,
  PlusCircle,
  FileDown,
  Upload,
  MoreVertical,
  Receipt,
  Eye,
  MessageCircle,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { exportCustomersToExcel, exportCustomersTemplate } from "@/lib/excel";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { useOfflineCustomers } from "@/lib/hooks/useOfflineData";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { db } from "@/lib/db/offline-db";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { sendWhatsAppReminder } from "@/lib/whatsapp";

// New Reusable Components
import { DataTable } from "@/components/ui/data-table";
import { useCustomerTableLayout } from "./customer-table-layout";
import { TableRowActions } from "@/components/ui/table-row-actions";
import { useTableState } from "@/lib/hooks/use-table-state";
import { CustomerFormModal, type Customer } from "@/components/customers/customer-form-modal";
import { CustomerViewModal } from "@/components/customers/customer-view-modal";
import { PageHeader } from "@/components/layout/page-header";

export default function PartiesPage() {
  const t = useTranslations("customers");
  const tCommon = useTranslations("common");
  const tDash = useTranslations("dashboard");
  const tInvoice = useTranslations("invoice");
  const locale = useLocale();
  const router = useRouter();

  const { can } = usePermissions();
  const canView = can("customers", "view");
  const canCreate = can("customers", "create");
  const canEdit = can("customers", "edit");
  const canDelete = can("customers", "delete");

  // State Management
  const [balanceFilter, setBalanceFilter] = useState<"all" | "receive" | "pay">("all");
  const [balanceSort, setBalanceSort] = useState<"asc" | "desc" | null>(null);

  // Modals State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [customerToView, setCustomerToView] = useState<Customer | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Import / Export State
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title?: string; message: string; }>({ open: false, message: "" });

  // Data Fetching
  const searchFields = useMemo<Array<keyof Customer>>(() => ["name", "phone", "company_name"], []);
  const tableState = useTableState<Customer>({
    defaultPageSize: 10,
    searchFields
  });

  const offlineCustomersData = useOfflineCustomers(tableState.debouncedSearchTerm);
  const isDexieLoading = offlineCustomersData === undefined;
  const allOfflineCustomers = useMemo(() => offlineCustomersData || [], [offlineCustomersData]);

  const processedCustomers = useMemo(() => {
    let list = [...allOfflineCustomers];
    if (balanceFilter === "receive") list = list.filter(c => (c.balance ?? 0) > 0);
    else if (balanceFilter === "pay") list = list.filter(c => (c.balance ?? 0) < 0);

    if (balanceSort === "asc") list.sort((a, b) => (a.balance ?? 0) - (b.balance ?? 0));
    else if (balanceSort === "desc") list.sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));

    return list;
  }, [allOfflineCustomers, balanceFilter, balanceSort]);

  const selectedRowIds = useMemo(
    () => tableState.selectedRowIds.map(String),
    [tableState.selectedRowIds]
  );

  // Feed processed data to useTableState for pagination
  useEffect(() => {
    tableState.setRawData(processedCustomers);
  }, [processedCustomers, tableState]);

  // Sync state initialization
  const [isSyncReady, setIsSyncReady] = useState(() => typeof window !== 'undefined' && !!localStorage.getItem('last_sync_timestamp'));
  useEffect(() => {
    const handleSyncComplete = () => setIsSyncReady(true);
    window.addEventListener('initialSyncComplete', handleSyncComplete);
    return () => window.removeEventListener('initialSyncComplete', handleSyncComplete);
  }, []);

  // Actions
  const handleWhatsAppClick = (customer: Customer) => {
    sendWhatsAppReminder(customer, {
      locale,
      currencySymbol: t("currencySymbol") || "Rs.",
      customMessage: t("whatsappReminder", {
        name: customer.name,
        currency: t("currencySymbol") || "Rs.",
        balance: Math.round(customer.balance || 0),
      }),
    });
  };

  const handleBulkWhatsApp = async () => {
    const selectedIds = tableState.selectedRowIds;
    if (selectedIds.length === 0) return;

    let sentCount = 0;
    let missingPhoneCount = 0;

    for (let i = 0; i < selectedIds.length; i++) {
      const idStr = selectedIds[i];
      const id = String(idStr);
      const customer = tableState.rawData.find(c => c.id === id);
      if (!customer) continue;

      const cleanPhone = (customer.phone || "").replace(/\D/g, "");
      if (!cleanPhone || cleanPhone.length < 5) {
        missingPhoneCount++;
        continue;
      }

      let whatsappPhone = cleanPhone;
      if (cleanPhone.startsWith("0")) whatsappPhone = `92${cleanPhone.slice(1)}`;
      else if (cleanPhone.length === 10) whatsappPhone = `92${cleanPhone}`;

      const currency = t("currencySymbol") || "Rs.";
      const roundedBalance = Math.round(customer.balance || 0);

      const message = t("whatsappReminder", { name: customer.name, currency, balance: roundedBalance });
      const url = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
      
      // Delay opening to prevent popup blocking for too many at once
      setTimeout(() => {
        window.open(url, "_blank", "noopener,noreferrer");
      }, sentCount * 800);

      sentCount++;
    }

    if (sentCount > 0) {
      toast.success(tInvoice("sendOnWhatsApp") || `Opening WhatsApp for ${sentCount} parties...`);
    }
    if (missingPhoneCount > 0) {
      toast.error(`${missingPhoneCount} parties skipped due to missing phone numbers.`);
    }
  };

  const handleBulkDelete = async () => {
    const selectedIds = tableState.selectedRowIds;
    if (selectedIds.length === 0) return;

    setIsBulkDeleting(true);
    try {
      let deletedCount = 0;
      let skippedCount = 0;

      for (const idStr of selectedIds) {
        const id = String(idStr);
        const customer = tableState.rawData.find(c => c.id === id) || await db.parties.get(id);
        if (!customer) continue;

        if (customer.is_default || customer.type === "cash" || customer.name.toLowerCase() === "cash sale" || (customer.balance !== 0 && customer.balance !== undefined && customer.balance !== null)) {
          skippedCount++;
          continue;
        }

        await db.parties.delete(id);
        await SyncEngine.queueOperation("parties", "DELETE", `/api/customers/${id}`, {});
        deletedCount++;
      }

      setIsBulkDeleteDialogOpen(false);
      tableState.clearSelection();
      
      if (deletedCount > 0) {
        toast.success(t("customerDeletedSuccess") || `Successfully deleted ${deletedCount} parties.`);
      }
      if (skippedCount > 0) {
        toast.error(`${skippedCount} parties were skipped (non-zero balance or default cash party).`);
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to perform bulk delete");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkExport = async () => {
    try {
      setIsDownloading(true);
      const allData = await db.parties.toArray();
      const selectedData = allData.filter(c => tableState.selectedRowIds.includes(c.id));
      if (selectedData.length === 0) {
        toast.error("No customers selected for export");
        return;
      }
      exportCustomersToExcel(selectedData, 'selected_customers.xlsx');
      toast.success("Bulk export successful");
    } catch (error) {
      console.error("Error downloading Excel:", error);
      toast.error(t("downloadError") || "Download error");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;

    const isDefaultParty = Boolean(
      customerToDelete.is_default ||
      customerToDelete.type === "cash" ||
      customerToDelete.name?.toLowerCase() === "cash sale" ||
      customerToDelete.name?.toLowerCase() === "cash party"
    );

    if (isDefaultParty) {
      setErrorDialog({
        open: true,
        title: t("cannotDelete") || "Cannot Delete",
        message: t("cannotDeleteDefaultParty") || "This is a default Cash Sale party and cannot be deleted.",
      });
      setIsDeleteDialogOpen(false);
      return;
    }

    if (customerToDelete.balance !== 0 && customerToDelete.balance !== undefined && customerToDelete.balance !== null) {
      toast.error(`${t("cannotDeleteMessage")} ${Math.round(customerToDelete.balance)}`);
      setIsDeleteDialogOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      await db.parties.delete(customerToDelete.id);
      await SyncEngine.queueOperation("parties", "DELETE", `/api/customers/${customerToDelete.id}`, {});

      setIsDeleteDialogOpen(false);
      setCustomerToDelete(null);
      toast.success(t("customerDeletedSuccess") || "Customer deleted successfully");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to delete customer");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setIsDownloading(true);
      const allData = await db.parties.toArray();
      exportCustomersToExcel(allData, `customers.xlsx`);
      toast.success("Export successful");
    } catch (error) {
      console.error("Error downloading Excel:", error);
      toast.error(t("downloadError") || "Download error");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadTemplate = () => {
    exportCustomersTemplate("customers-template.xlsx");
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls") && !file.type.includes("spreadsheet")) {
      toast.error(t("importValidationError") || "Please upload a valid Excel file");
      return;
    }

    try {
      setIsImporting(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/customers/import", { method: "POST", body: formData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t("importError"));
      }

      const result = await response.json();
      if (result.errorCount === 0) {
        toast.success(`${result.successCount} customer(s) imported successfully.`);
      } else {
        toast.warning(`${result.successCount} imported, ${result.errorCount} errors.`);
      }

      await SyncEngine.pullInitialData();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Error importing Excel:", error);
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const { columns, renderMobileCard } = useCustomerTableLayout({
    t, tCommon, tDash, tInvoice, locale, router,
    canView, canEdit, canDelete,
    setCustomerToView, setIsViewModalOpen,
    setCustomerToEdit, setIsFormModalOpen,
    setCustomerToDelete, setIsDeleteDialogOpen,
    handleWhatsAppClick,
    setErrorDialog
  });

  return (
    <div className="flex-1 space-y-4 w-full mx-auto animate-in fade-in duration-300">
      <PageHeader
        title={t("title")}
        description={t("pageDescription")}
        mobileActionsRows={1}
        actions={
          <>
              {canCreate && (
                <Button onClick={() => { setCustomerToEdit(null); setIsFormModalOpen(true); }} className="flex items-center gap-2 w-full sm:w-auto">
                  <PlusCircle className="h-4 w-4" />
                  <span className="whitespace-nowrap">{t("addCustomer")}</span>
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Import / Export</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDownloadExcel} disabled={isDownloading}>
                    {isDownloading ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                    {t("downloadExcel")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadTemplate}>
                    <FileDown className="mr-2 h-4 w-4" />
                    {t("downloadTemplate")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                    {isImporting ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    {t("import")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileSelect} />
          </>
        }
      />

      <div className="w-full flex flex-col">
        <DataTable
          isLoading={isDexieLoading && !isSyncReady}
          sortConfig={tableState.sortConfig}
          onSort={tableState.onSort}
          enableRowSelection={true}
          selectedRowIds={tableState.selectedRowIds}
          onSelectRow={tableState.onSelectRow}
          onSelectAll={tableState.onSelectAll}
          bulkActions={
            <div className="flex items-center gap-2 flex-wrap">
              {/* <Button variant="outline" size="sm" onClick={handleBulkWhatsApp}>
                <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
                {tInvoice("sendOnWhatsApp")}
              </Button> */}
              <Button variant="outline" size="sm" onClick={handleBulkExport} disabled={isDownloading}>
                <FileDown className="mr-2 h-4 w-4" />
                {tCommon("export")}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteDialogOpen(true)} disabled={!canDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                {tCommon("bulkDelete")}
              </Button>
            </div>
          }
          columns={columns}
          data={tableState.paginatedData}
          keyExtractor={(row) => row.id}
          currentPage={tableState.currentPage}
          onPageChange={tableState.setCurrentPage}
          pageSize={tableState.pageSize}
          onPageSizeChange={tableState.setPageSize}
          totalCount={tableState.totalCount}
          emptyMessage={t("noCustomers")}
          searchTerm={tableState.searchTerm}
          onSearchChange={tableState.setSearchTerm}
          searchPlaceholder={t("searchPlaceholder")}
          rowClassName={(row) => cn(
            row.balance && row.balance < 0 ? "bg-red-100/70 dark:bg-red-950/50 hover:bg-red-200/70 dark:hover:bg-red-900/50" : "",
            row.balance && row.balance > 0 ? "bg-green-100/70 dark:bg-green-950/50 hover:bg-green-200/70 dark:hover:bg-green-900/50" : ""
          )}
          toolbarActions={
            <div className="flex items-center rounded-md border overflow-x-auto text-xs font-medium h-9 w-full scrollbar-none">
              {(["all", "receive", "pay"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setBalanceFilter(f)}
                  className={cn(
                    "px-3 h-full transition-colors flex-1 whitespace-nowrap flex items-center justify-center gap-1.5",
                    balanceFilter === f
                      ? f === "receive"
                        ? "bg-green-500 text-white"
                        : f === "pay"
                          ? "bg-red-500 text-white"
                          : "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  {f === "receive" && (
                    <div className={cn(
                      "w-2 h-2 rounded-full shrink-0 border",
                      balanceFilter === f ? "bg-white border-white" : "bg-green-500 border-green-600"
                    )} />
                  )}
                  {f === "pay" && (
                    <div className={cn(
                      "w-2 h-2 rounded-full shrink-0 border",
                      balanceFilter === f ? "bg-white border-white" : "bg-red-500 border-red-600"
                    )} />
                  )}
                  <span>
                    {f === "all" ? "All" : f === "receive" ? "Receive" : "Pay"}
                  </span>
                </button>
              ))}
            </div>
          }
          renderMobileCard={renderMobileCard}
        />
      </div>

      {/* Modals */}
      <CustomerFormModal
        open={isFormModalOpen}
        onOpenChange={setIsFormModalOpen}
        customerToEdit={customerToEdit}
        allOfflineCustomers={allOfflineCustomers}
        onSuccess={() => tableState.setCurrentPage(1)}
      />

      <CustomerViewModal
        open={isViewModalOpen}
        onOpenChange={setIsViewModalOpen}
        customer={customerToView}
      />

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={t("confirmDeletion")}
        description={t("confirmDeleteMessage")}
        onConfirm={handleDeleteCustomer}
        isLoading={isDeleting}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
      />

      <ConfirmDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
        title={tCommon("bulkDelete") || "Bulk Delete"}
        description={`${t("confirmDeleteMessage")} (${tableState.selectedRowIds.length} selected)`}
        onConfirm={handleBulkDelete}
        isLoading={isBulkDeleting}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        variant="destructive"
      />

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog(prev => ({ ...prev, open }))}
        title={errorDialog.title}
        message={errorDialog.message}
      />
    </div>
  );
}



