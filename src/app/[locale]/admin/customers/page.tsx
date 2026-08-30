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
  Eye
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

// New Reusable Components
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { TableRowActions } from "@/components/ui/table-row-actions";
import { useTableState } from "@/lib/hooks/use-table-state";
import { CustomerFormModal, type Customer } from "@/components/customers/customer-form-modal";
import { CustomerViewModal } from "@/components/customers/customer-view-modal";
import { PageHeader } from "@/components/layout/page-header";

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" {...props}>
    <path d="M12.004 2C6.48 2 2 6.48 2 12c0 2.17.7 4.19 1.89 5.86L2.5 22.5l4.81-1.35c1.42.75 3.01 1.18 4.69 1.18 5.52 0 10-4.48 10-10S17.52 2 12.004 2zm5.72 13.91c-.24.67-1.19 1.25-1.92 1.34-.5.06-1.15.09-3.32-.82-2.77-1.17-4.52-4.06-4.66-4.25-.14-.19-1.12-1.49-1.12-2.84 0-1.35.7-2.01.95-2.29.25-.28.55-.35.74-.35.19 0 .38.01.55.02.18.01.42-.07.65.48.24.58.82 2.01.89 2.15.07.14.12.31.02.5-.1.19-.15.31-.31.5-.16.19-.34.42-.48.56-.16.16-.33.33-.14.65.19.32.85 1.4 1.83 2.27.84.75 1.55.98 1.87 1.12.32.14.51.12.7-.1.19-.22.82-.95 1.04-1.28.22-.33.44-.28.74-.17.3.11 1.91.9 2.23 1.06.32.16.53.24.61.38.08.14.08.8-.16 1.47z" />
  </svg>
);

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
    const cleanPhone = (customer.phone || "").replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 5) {
      const baseMsg = tInvoice("whatsappNumberUnavailable") || "No WhatsApp number available for this customer.";
      const instructMsg = locale === "ur"
        ? "\n\nÃƒËœÃ‚Â¨ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§Ãƒâ€ºÃ‚Â ÃƒÅ¡Ã‚Â©ÃƒËœÃ‚Â±Ãƒâ„¢Ã¢â‚¬Â¦ ÃƒËœÃ‚Â§ÃƒËœÃ‚Â³ ÃƒÅ¡Ã‚Â¯ÃƒËœÃ‚Â§Ãƒâ€ºÃ‚ÂÃƒÅ¡Ã‚Â© ÃƒÅ¡Ã‚Â©ÃƒËœÃ‚Â§ Ãƒâ„¢Ã‚ÂÃƒâ„¢Ã‹â€ Ãƒâ„¢Ã¢â‚¬Â  Ãƒâ„¢Ã¢â‚¬Â Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â± ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â±ÃƒËœÃ‚Â¬ ÃƒÅ¡Ã‚Â©ÃƒËœÃ‚Â±Ãƒâ€ºÃ…â€™ÃƒÅ¡Ã‚ÂºÃƒâ€ºÃ¢â‚¬Â ÃƒËœÃ‚Â¢Ãƒâ„¢Ã‚Â¾ 'ÃƒËœÃ‚ÂªÃƒËœÃ‚Â¨ÃƒËœÃ‚Â¯Ãƒâ€ºÃ…â€™Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒÅ¡Ã‚Â©ÃƒËœÃ‚Â±Ãƒâ€ºÃ…â€™ÃƒÅ¡Ã‚Âº' (Edit) ÃƒËœÃ‚Â¨Ãƒâ„¢Ã‚Â¹Ãƒâ„¢Ã¢â‚¬Â  Ãƒâ„¢Ã‚Â¾ÃƒËœÃ‚Â± ÃƒÅ¡Ã‚Â©Ãƒâ„¢Ã¢â‚¬Å¾ÃƒÅ¡Ã‚Â© ÃƒÅ¡Ã‚Â©ÃƒËœÃ‚Â± ÃƒÅ¡Ã‚Â©Ãƒâ€ºÃ¢â‚¬â„¢ Ãƒâ„¢Ã¢â‚¬Â Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â± ÃƒËœÃ‚Â´ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒÅ¡Ã‚Â©ÃƒËœÃ‚Â± ÃƒËœÃ‚Â³ÃƒÅ¡Ã‚Â©ÃƒËœÃ‚ÂªÃƒâ€ºÃ¢â‚¬â„¢ Ãƒâ€ºÃ‚ÂÃƒâ€ºÃ…â€™ÃƒÅ¡Ã‚ÂºÃƒâ€ºÃ¢â‚¬Â"
        : locale === "ru"
          ? "\n\nIs customer ka phone number add karain. Aap Edit button par click kar ke number add kar sakte hain."
          : "\n\nPlease add a phone number for this customer. You can click the Edit button to add their number.";

      toast.error(baseMsg + instructMsg, { duration: 5000 });
      return;
    }

    let whatsappPhone = cleanPhone;
    if (cleanPhone.startsWith("0")) whatsappPhone = `92${cleanPhone.slice(1)}`;
    else if (cleanPhone.length === 10) whatsappPhone = `92${cleanPhone}`;

    const currency = t("currencySymbol") || "Rs.";
    const roundedBalance = Math.round(customer.balance || 0);

    let message = "";
    if (locale === "ur") message = `ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â³Ãƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ ÃƒËœÃ‚Â¹Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ€ºÃ…â€™ÃƒÅ¡Ã‚Â©Ãƒâ„¢Ã¢â‚¬Â¦ ${customer.name}ÃƒËœÃ…â€™\n\nÃƒËœÃ‚Â¨ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§Ãƒâ€ºÃ‚Â ÃƒÅ¡Ã‚Â©ÃƒËœÃ‚Â±Ãƒâ„¢Ã¢â‚¬Â¦ ÃƒËœÃ‚Â§Ãƒâ„¢Ã‚Â¾Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚Â§ ÃƒËœÃ‚Â¨Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â§Ãƒâ€ºÃ…â€™ÃƒËœÃ‚Â§ ÃƒËœÃ‚Â¨Ãƒâ€ºÃ…â€™Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚Â³ ${currency} ${roundedBalance} ÃƒËœÃ‚Â¨ÃƒÅ¡Ã‚Â¾Ãƒâ€ºÃ…â€™ÃƒËœÃ‚Â¬ ÃƒËœÃ‚Â¯Ãƒâ€ºÃ…â€™ÃƒÅ¡Ã‚ÂºÃƒâ€ºÃ¢â‚¬Â\n\nÃƒËœÃ‚Â´ÃƒÅ¡Ã‚Â©ÃƒËœÃ‚Â±Ãƒâ€ºÃ…â€™Ãƒâ€ºÃ‚Â!`;
    else if (locale === "ru") message = `Assalam o Alaikum ${customer.name},\n\nFriendly reminder: Please clear your outstanding balance of ${currency} ${roundedBalance}.\n\nShukriya!`;
    else message = `Dear ${customer.name},\n\nThis is a friendly reminder to please clear your outstanding balance of ${currency} ${roundedBalance}.\n\nThank you!`;

    window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;

    if (customerToDelete.is_default || customerToDelete.type === "cash" || customerToDelete.name.toLowerCase() === "cash sale") {
      toast.error(t("cannotDeleteDefaultParty") || "Cannot delete default party");
      setIsDeleteDialogOpen(false);
      return;
    }

    if (customerToDelete.balance !== 0 && customerToDelete.balance !== undefined && customerToDelete.balance !== null) {
      toast.error(`${t("cannotDeleteMessage") || "Cannot delete customer with non-zero balance: Rs."} ${Math.round(customerToDelete.balance)}`);
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

  // Table Columns Setup
  const columns: ColumnDef<Customer>[] = [
    {
      id: "name",
      header: t("nameLabel"),
      accessorKey: "name",
    },
    {
      id: "phone",
      header: t("phoneLabel"),
      cell: (row) => row.phone || "-",
    },
    {
      id: "company",
      header: t("companyName"),
      cell: (row) => row.company_name || "-",
    },
    {
      id: "balance",
      header: t("balance"),
      cell: (row) => (
        <span className={row.balance && row.balance < 0 ? "text-red-600 font-medium" : row.balance && row.balance > 0 ? "text-green-600 font-medium" : ""}>
          Rs. {row.balance ? Math.round(row.balance) : "0"}
        </span>
      ),
    },
    {
      id: "actions",
      header: <div className="text-right">{tCommon("actions") || "Actions"}</div>,
      className: "text-right",
      cell: (row) => {
        const extraActions = [];

        if (canView) {
          extraActions.push({
            label: tDash("viewTransactions") || "View Transactions",
            icon: <Receipt className="w-4 h-4" />,
            onClick: () => router.push(`/${locale}/admin/customer-transactions/${row.id}`)
          });
          extraActions.push({
            label: t("view") || "View Details",
            icon: <Eye className="w-4 h-4" />,
            onClick: () => {
              setCustomerToView(row);
              setIsViewModalOpen(true);
            }
          });
        }
        if (row.balance !== undefined && row.balance > 0) {
          extraActions.push({
            label: tInvoice("sendOnWhatsApp") || "Send Message",
            icon: <WhatsAppIcon className="w-4 h-4 text-green-600" />,
            onClick: () => handleWhatsAppClick(row)
          });
        }

        return (
          <TableRowActions
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={() => {
              setCustomerToEdit(row);
              setIsFormModalOpen(true);
            }}
            onDelete={() => {
              setCustomerToDelete(row);
              setIsDeleteDialogOpen(true);
            }}
            extraActions={extraActions}
          />
        );
      }
    }
  ];

  if (isDexieLoading && !isSyncReady) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2Icon className="mx-auto h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

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
          columns={columns}
          data={tableState.paginatedData}
          keyExtractor={(row) => row.id}
          currentPage={tableState.currentPage}
          totalPages={tableState.totalPages}
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
          renderMobileCard={(customer) => (
            <Card
              className={cn(
                "py-4 px-2 border shadow-sm",
                customer.balance !== undefined && customer.balance < 0 ? "bg-red-100/70 dark:bg-red-950/50 border-red-200 dark:border-red-800" :
                  customer.balance !== undefined && customer.balance > 0 ? "bg-green-100/70 dark:bg-green-950/50 border-green-200 dark:border-green-800" :
                    "bg-card border-border"
              )}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{customer.phone || "-"}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 bg-background/50 rounded-md">
                    {columns.find(c => c.id === "actions")?.cell?.(customer, 0)}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground">{t("companyName")}</p>
                    <p className="font-medium">{customer.company_name || "-"}</p>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <p className="text-muted-foreground">{t("balance")}</p>
                    <p className={cn(
                      "font-semibold",
                      customer.balance && customer.balance < 0 ? "text-red-600 dark:text-red-400" :
                        customer.balance && customer.balance > 0 ? "text-green-600 dark:text-green-400" :
                          ""
                    )}>
                      {t("currencySymbol") || "Rs."} {customer.balance ? Math.round(customer.balance) : "0"}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}
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

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog(prev => ({ ...prev, open }))}
        title={errorDialog.title}
        message={errorDialog.message}
      />
    </div>
  );
}



