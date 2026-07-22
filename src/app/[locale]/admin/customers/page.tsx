"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import {
  Loader2Icon,
  PlusCircle,
  Trash2,
  SearchIcon,
  FilePenIcon,
  FileDown,
  Upload,
  MoreVertical,
  Eye,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Receipt,
  X,
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
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { useDebounce } from "../../../../hooks/use-debounce";
import { exportCustomersToExcel, exportCustomersTemplate } from "@/lib/excel";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { useOfflineCustomers } from "@/lib/hooks/useOfflineData";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { db } from "@/lib/db/offline-db";
import { usePermissions } from "@/hooks/use-permissions";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company_name?: string;
  company_address?: string;
  balance?: number;
  status: "active" | "inactive";
  is_delete?: number;
};

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    width="1em"
    height="1em"
    {...props}
  >
    <path d="M12.004 2C6.48 2 2 6.48 2 12c0 2.17.7 4.19 1.89 5.86L2.5 22.5l4.81-1.35c1.42.75 3.01 1.18 4.69 1.18 5.52 0 10-4.48 10-10S17.52 2 12.004 2zm5.72 13.91c-.24.67-1.19 1.25-1.92 1.34-.5.06-1.15.09-3.32-.82-2.77-1.17-4.52-4.06-4.66-4.25-.14-.19-1.12-1.49-1.12-2.84 0-1.35.7-2.01.95-2.29.25-.28.55-.35.74-.35.19 0 .38.01.55.02.18.01.42-.07.65.48.24.58.82 2.01.89 2.15.07.14.12.31.02.5-.1.19-.15.31-.31.5-.16.19-.34.42-.48.56-.16.16-.33.33-.14.65.19.32.85 1.4 1.83 2.27.84.75 1.55.98 1.87 1.12.32.14.51.12.7-.1.19-.22.82-.95 1.04-1.28.22-.33.44-.28.74-.17.3.11 1.91.9 2.23 1.06.32.16.53.24.61.38.08.14.08.8-.16 1.47z" />
  </svg>
);

export default function PartiesPage() {
  const t = useTranslations("customers");
  const tCommon = useTranslations("common");
  const tDash = useTranslations("dashboard");
  const tInvoice = useTranslations("invoice");
  const locale = useLocale();
  const { can } = usePermissions();
  const canView = can("customers", "view");
  const canCreate = can("customers", "create");
  const canEdit = can("customers", "edit");
  const canDelete = can("customers", "delete");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerCompanyName, setNewCustomerCompanyName] = useState("");
  const [newCustomerCompanyAddress, setNewCustomerCompanyAddress] =
    useState("");
  const [newCustomerOpeningBalance, setNewCustomerOpeningBalance] =
    useState("");
  const [newCustomerStatus, setNewCustomerStatus] = useState<
    "active" | "inactive"
  >("active");
  const [newCustomerOpeningBalanceType, setNewCustomerOpeningBalanceType] = useState<"receive" | "pay">("receive");
  const [isEditCustomerDialogOpen, setIsEditCustomerDialogOpen] =
    useState(false);
  const [isViewCustomerDialogOpen, setIsViewCustomerDialogOpen] =
    useState(false);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [isPageLoading, setIsPageLoading] = useState(false);

  const [balanceFilter, setBalanceFilter] = useState<"all" | "receive" | "pay">("all");
  const [balanceSort, setBalanceSort] = useState<"asc" | "desc" | null>(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title?: string;
    message: string;
    isSuccess?: boolean;
  }>({
    open: false,
    message: "",
  });

  const offlineCustomersData = useOfflineCustomers(debouncedSearchTerm);
  const isDexieLoading = offlineCustomersData === undefined;
  const allOfflineCustomers = useMemo(() => offlineCustomersData || [], [offlineCustomersData]);

  const [isSyncReady, setIsSyncReady] = useState(() =>
    typeof window !== 'undefined' && !!localStorage.getItem('last_sync_timestamp')
  );

  useEffect(() => {
    const handleSyncComplete = () => setIsSyncReady(true);
    window.addEventListener('initialSyncComplete', handleSyncComplete);
    return () => window.removeEventListener('initialSyncComplete', handleSyncComplete);
  }, []);

  const processedCustomers = useMemo(() => {
    let list = [...allOfflineCustomers];
    if (balanceFilter === "receive") list = list.filter(c => (c.balance ?? 0) > 0);
    else if (balanceFilter === "pay") list = list.filter(c => (c.balance ?? 0) < 0);
    if (balanceSort === "asc") list.sort((a, b) => (a.balance ?? 0) - (b.balance ?? 0));
    else if (balanceSort === "desc") list.sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
    return list;
  }, [allOfflineCustomers, balanceFilter, balanceSort]);

  useEffect(() => {
    setTotalCount(processedCustomers.length);
    setTotalPages(Math.ceil(processedCustomers.length / pageSize) || 1);
    if (!isDexieLoading && (allOfflineCustomers.length > 0 || isSyncReady)) {
      setLoading(false);
    }
  }, [processedCustomers.length, pageSize, allOfflineCustomers.length, isSyncReady, isDexieLoading]);

  const filteredCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedCustomers.slice(startIndex, startIndex + pageSize);
  }, [processedCustomers, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize, balanceFilter, balanceSort]);

  const resetSelectedCustomer = () => {
    setSelectedCustomerId(null);
    setNewCustomerName("");
    setNewCustomerEmail("");
    setNewCustomerPhone("");
    setNewCustomerCompanyName("");
    setNewCustomerCompanyAddress("");
    setNewCustomerOpeningBalance("");
    setNewCustomerStatus("active");
    setNewCustomerOpeningBalanceType("receive");
  };

  const handleAddCustomer = useCallback(async () => {
    // Validate required fields
    if (!newCustomerName || newCustomerName.trim() === "") {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("customerNameRequired"),
      });
      return;
    }

    const trimmedName = newCustomerName.trim();
    const existingOfflineCustomer = allOfflineCustomers.find(
      (p) => p.name.toLowerCase() === trimmedName.toLowerCase() && p.is_delete !== 1
    );

    if (existingOfflineCustomer) {
      setErrorDialog({
        open: true,
        title: t("error"),
        message: "A party with this name already exists",
      });
      return;
    }

    setIsSaving(true);
    try {
      const newCustomer = {
        name: newCustomerName,
        email: newCustomerEmail,
        phone: newCustomerPhone,
        company_name: newCustomerCompanyName,
        company_address: newCustomerCompanyAddress,
        balance: newCustomerOpeningBalance
          ? parseFloat(newCustomerOpeningBalance) * (newCustomerOpeningBalanceType === "pay" ? -1 : 1)
          : 0,
        status: newCustomerStatus,
        created_at: new Date().toISOString(),
      };

      const customerId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const finalCustomer = { ...newCustomer, id: customerId, is_delete: 0, type: "customer" };
      await db.parties.add(finalCustomer);
      await SyncEngine.queueOperation("parties", "POST", "/api/customers", newCustomer, customerId);

      setShowNewCustomerDialog(false);
      resetSelectedCustomer();

      setErrorDialog({
        open: true,
        title: t("success"),
        message: t("customerCreatedSuccess"),
        isSuccess: true,
      });
    } catch (error) {
      console.error(error);
      setErrorDialog({
        open: true,
        title: t("error"),
        message:
          error instanceof Error ? error.message : t("failedToCreateCustomer"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    newCustomerName,
    newCustomerEmail,
    newCustomerPhone,
    newCustomerCompanyName,
    newCustomerCompanyAddress,
    newCustomerOpeningBalance,
    newCustomerOpeningBalanceType,
    newCustomerStatus,
    allOfflineCustomers,
    t,
    resetSelectedCustomer,
  ]);

  const handleEditCustomer = useCallback(async () => {
    if (!selectedCustomerId) return;

    if (!newCustomerName || newCustomerName.trim() === "") {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("customerNameRequired"),
      });
      return;
    }

    const trimmedName = newCustomerName.trim();
    const existingOfflineCustomer = allOfflineCustomers.find(
      (p) => p.name.toLowerCase() === trimmedName.toLowerCase() && p.is_delete !== 1 && p.id !== selectedCustomerId
    );

    if (existingOfflineCustomer) {
      setErrorDialog({
        open: true,
        title: t("error"),
        message: "A party with this name already exists",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updatedCustomer = {
        id: selectedCustomerId,
        name: newCustomerName,
        email: newCustomerEmail,
        phone: newCustomerPhone,
        company_name: newCustomerCompanyName,
        company_address: newCustomerCompanyAddress,
        balance: newCustomerOpeningBalance
          ? parseFloat(newCustomerOpeningBalance) * (newCustomerOpeningBalanceType === "pay" ? -1 : 1)
          : 0,
        status: newCustomerStatus,
      };

      await db.parties.update(selectedCustomerId, updatedCustomer);
      await SyncEngine.queueOperation("parties", "PUT", `/api/customers/${selectedCustomerId}`, updatedCustomer);

      setIsEditCustomerDialogOpen(false);
      resetSelectedCustomer();

      setErrorDialog({
        open: true,
        title: t("success"),
        message: t("customerUpdatedSuccess"),
        isSuccess: true,
      });
    } catch (error) {
      console.error(error);
      setErrorDialog({
        open: true,
        title: t("error"),
        message:
          error instanceof Error ? error.message : t("failedToUpdateCustomer"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedCustomerId,
    newCustomerName,
    newCustomerEmail,
    newCustomerPhone,
    newCustomerCompanyName,
    newCustomerCompanyAddress,
    newCustomerOpeningBalance,
    newCustomerOpeningBalanceType,
    newCustomerStatus,
    newCustomerStatus,
    currentPage,
    debouncedSearchTerm,
    resetSelectedCustomer,
    t,
  ]);

  const handleDeleteCustomer = useCallback(async () => {
    if (!customerToDelete) return;

    if (
      customerToDelete.balance !== 0 &&
      customerToDelete.balance !== undefined &&
      customerToDelete.balance !== null
    ) {
      setErrorDialog({
        open: true,
        title: t("cannotDelete"),
        message:
          t("cannotDeleteMessage") +
          Math.round(customerToDelete.balance || 0),
      });
      setIsDeleteConfirmationOpen(false);
      return;
    }

    setIsDeleting(true);
    try {
      await db.parties.delete(customerToDelete.id);
      await SyncEngine.queueOperation("parties", "DELETE", `/api/customers/${customerToDelete.id}`, {});

      setIsDeleteConfirmationOpen(false);
      setCustomerToDelete(null);

      setErrorDialog({
        open: true,
        title: t("success"),
        message: t("customerDeletedSuccess"),
        isSuccess: true,
      });
    } catch (error) {
      console.error(error);
      setErrorDialog({
        open: true,
        title: t("error"),
        message:
          error instanceof Error ? error.message : t("failedToDeleteCustomer"),
      });
    } finally {
      setIsDeleting(false);
    }
  }, [customerToDelete, t]);

  const handleWhatsAppClick = (customer: Customer) => {
    const cleanPhone = (customer.phone || "").replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 5) {
      const baseMsg = tInvoice("whatsappNumberUnavailable") || "No WhatsApp number available for this customer.";
      const instructMsg = locale === "ur" 
        ? "\n\nبراہ کرم اس گاہک کا فون نمبر درج کریں۔ آپ 'تبدیل کریں' (Edit) بٹن پر کلک کر کے نمبر شامل کر سکتے ہیں۔"
        : locale === "ru"
        ? "\n\nIs customer ka phone number add karain. Aap Edit button par click kar ke number add kar sakte hain."
        : "\n\nPlease add a phone number for this customer. You can click the Edit button to add their number.";
      
      setErrorDialog({
        open: true,
        title: locale === "ur" ? "فون نمبر شامل کریں" : "Add Phone Number",
        message: baseMsg + instructMsg,
      });
      return;
    }

    let whatsappPhone = "";
    if (cleanPhone.startsWith("0")) {
      whatsappPhone = `92${cleanPhone.slice(1)}`;
    } else if (cleanPhone.startsWith("92")) {
      whatsappPhone = cleanPhone;
    } else if (cleanPhone.length === 10) {
      whatsappPhone = `92${cleanPhone}`;
    } else {
      whatsappPhone = cleanPhone;
    }

    const currency = t("currencySymbol") || "Rs.";
    const roundedBalance = Math.round(customer.balance || 0);
    
    // Select translation message based on current locale
    let message = "";
    if (locale === "ur") {
      message = `السلام علیکم ${customer.name}،\n\nبراہ کرم اپنا بقایا بیلنس ${currency} ${roundedBalance} بھیج دیں۔\n\nشکریہ!`;
    } else if (locale === "ru") {
      message = `Assalam o Alaikum ${customer.name},\n\nFriendly reminder: Please clear your outstanding balance of ${currency} ${roundedBalance}.\n\nShukriya!`;
    } else {
      message = `Dear ${customer.name},\n\nThis is a friendly reminder to please clear your outstanding balance of ${currency} ${roundedBalance}.\n\nThank you!`;
    }

    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleDownloadExcel = useCallback(async () => {
    try {
      setIsDownloading(true);
      const allCustomers = await db.parties.toArray();

      const filename = `customers.xlsx`;

      exportCustomersToExcel(allCustomers, filename);
    } catch (error) {
      console.error("Error downloading Excel:", error);
      setErrorDialog({
        open: true,
        title: t("downloadError"),
        message: t("downloadError"),
      });
    } finally {
      setIsDownloading(false);
    }
  }, [t]);

  const handleDownloadTemplate = useCallback(() => {
    exportCustomersTemplate("customers-template.xlsx");
  }, []);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (
        !file.name.endsWith(".xlsx") &&
        !file.name.endsWith(".xls") &&
        !file.type.includes("spreadsheet")
      ) {
        setErrorDialog({
          open: true,
          title: t("importValidationError"),
          message: t("importValidationError"),
        });
        return;
      }

      try {
        setIsImporting(true);
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/customers/import", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t("importError"));
        }

        const result = await response.json();
        const message = `${t("importSuccess")}: ${result.successCount
          } customer(s) imported.${result.errorCount > 0
            ? `\n\n${result.errorCount} error(s) occurred.`
            : ""
          }${result.errors && result.errors.length > 0
            ? `\n\nFirst few errors:\n${result.errors.slice(0, 3).join("\n")}`
            : ""
          }`;

        setErrorDialog({
          open: true,
          title: t("importSuccess"),
          message: message,
          isSuccess: result.errorCount === 0,
        });

        // After import, pull updates to refresh IndexedDB
        await SyncEngine.pullInitialData();

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        console.error("Error importing Excel:", error);
        setErrorDialog({
          open: true,
          title: t("importError"),
          message: error instanceof Error ? error.message : t("importError"),
        });
      } finally {
        setIsImporting(false);
      }
    },
    [t],
  );

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2Icon className="mx-auto h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">{t("title")}</h1>
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
      {/* Header Section */}
      <div className="flex flex-col gap-1 w-full">
        {/* Row 1: Heading and Actions */}
        <div className="flex flex-row items-center justify-between w-full gap-2">
          <h1 className="text-2xl font-bold truncate">{t("title")}</h1>
          
          <div className="flex items-center gap-1.5 shrink-0">
            {canCreate && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0 flex-shrink-0"
                    disabled={isDownloading || isImporting}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>{t("actions")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDownloadExcel}
                    disabled={isDownloading || isImporting}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    {isDownloading ? t("downloading") : t("downloadExcel")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDownloadTemplate}
                    disabled={isDownloading || isImporting}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    {t("downloadTemplate")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleImportClick}
                    disabled={isDownloading || isImporting}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {isImporting ? t("importing") : t("import")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />

            {canCreate && (
              <Button size="sm" onClick={() => setShowNewCustomerDialog(true)} className="h-9 text-xs px-2.5 sm:px-3 flex-shrink-0 whitespace-nowrap">
                <PlusCircle className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">{t("addCustomer")}</span>
                <span className="inline sm:hidden">Add</span>
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Description */}
        <p className="text-sm text-muted-foreground break-words">{t("pageDescription")}</p>
      </div>

      <Card className="flex flex-col gap-6 p-4 sm:p-6 shadow-md">
        <CardHeader className="p-0">
          {/* Desktop Search & Filter */}
          <div className="hidden sm:flex flex-row items-center gap-3 w-full">
            <div className="relative sm:w-56 md:w-64 flex-shrink-0">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchTerm}
                onChange={handleSearch}
                className="pl-9 pr-9 h-9 text-sm w-full"
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
            <div className="flex items-center rounded-md border overflow-x-auto text-xs font-medium h-9 w-full sm:w-auto flex-shrink-0 scrollbar-none">
              {(["all", "receive", "pay"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setBalanceFilter(f)}
                  className={cn(
                    "px-3 h-full transition-colors flex-1 sm:flex-none whitespace-nowrap flex items-center justify-center gap-1.5",
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
                    {f === "all" ? t("filterAll") || "All" : f === "receive" ? t("legendReceive") : t("legendPay")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Search Button & Filter */}
          <div className="flex sm:hidden flex-col gap-2 w-full">
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex-1 overflow-hidden">
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
                        {f === "all" ? t("filterAll") || "All" : f === "receive" ? t("legendReceive") : t("legendPay")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                className="h-9 w-9 p-0 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white shrink-0 shadow-sm"
                onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                title={t("searchPlaceholder") || "Search"}
              >
                <SearchIcon className="h-4 w-4" />
              </Button>
            </div>

            {isMobileSearchOpen && (
              <div className="relative w-full">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-9 pr-9 h-9 text-sm w-full"
                  autoFocus
                />
                {searchTerm ? (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setIsMobileSearchOpen(false)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 relative">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("phoneLabel")}</TableHead>
                    <TableHead>{t("companyName")}</TableHead>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={() => setBalanceSort(s => s === "desc" ? "asc" : s === "asc" ? null : "desc")}
                      >
                        {t("balance")}
                        {balanceSort === "desc" ? <ArrowDown className="w-3.5 h-3.5" /> : balanceSort === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
                      </button>
                    </TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="relative">
                  {isPageLoading && customers.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 backdrop-blur-[1px]">
                          <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                        {loading ? <Loader2Icon className="h-8 w-8 animate-spin mx-auto text-primary" /> : t("noCustomers")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <TableRow
                        key={customer.id}
                        className={cn(
                          customer.balance !== undefined && customer.balance < 0 && "bg-red-100/70 dark:bg-red-950/50 hover:bg-red-200/70 dark:hover:bg-red-900/50",
                          customer.balance !== undefined && customer.balance > 0 && "bg-green-100/70 dark:bg-green-950/50 hover:bg-green-200/70 dark:hover:bg-green-900/50"
                        )}
                      >
                        <TableCell>{customer.name}</TableCell>
                        <TableCell>{customer.phone}</TableCell>
                        <TableCell>{customer.company_name || "-"}</TableCell>
                        <TableCell>
                          Rs.{" "}
                          {customer.balance ? Math.round(customer.balance) : "0"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {canView && (
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/${locale}/admin/customer-transactions/${customer.id}`}>
                                  {tDash("viewTransactions") || "View Transactions"}
                                </Link>
                              </Button>
                            )}
                            {canView && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setViewCustomer(customer);
                                  setIsViewCustomerDialogOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                                <span className="sr-only">{t("view")}</span>
                              </Button>
                            )}
                            {customer.balance !== undefined && customer.balance > 0 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/30"
                                onClick={() => handleWhatsAppClick(customer)}
                              >
                                <WhatsAppIcon className="w-4.5 h-4.5" />
                                <span className="sr-only">{tInvoice("sendOnWhatsApp") || "Send on WhatsApp"}</span>
                              </Button>
                            )}
                            {canEdit && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  const balance = customer.balance || 0;
                                  setSelectedCustomerId(customer.id);
                                  setNewCustomerName(customer.name);
                                  setNewCustomerEmail(customer.email);
                                  setNewCustomerPhone(customer.phone);
                                  setNewCustomerCompanyName(
                                    customer.company_name || "",
                                  );
                                  setNewCustomerCompanyAddress(
                                    customer.company_address || "",
                                  );
                                  setNewCustomerOpeningBalance(
                                    Math.abs(balance).toString(),
                                  );
                                  setNewCustomerOpeningBalanceType(balance < 0 ? "pay" : "receive");
                                  setNewCustomerStatus(customer.status);
                                  setIsEditCustomerDialogOpen(true);
                                }}
                              >
                                <FilePenIcon className="w-4 h-4" />
                                <span className="sr-only">{t("edit")}</span>
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                size="icon"
                                variant="danger"
                                className="h-8 w-8"
                                onClick={() => {
                                  setCustomerToDelete(customer);
                                  setIsDeleteConfirmationOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="sr-only">{t("deleteAction")}</span>
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
          </div>

          {/* Mobile View - Cards */}
          <div className="md:hidden space-y-3">
            {filteredCustomers.map((customer) => (
              <Card
                key={customer.id}
                className={cn(
                  "p-4 border shadow-sm",
                  customer.balance !== undefined && customer.balance < 0 ? "bg-red-100/70 dark:bg-red-950/50 border-red-200 dark:border-red-800" :
                    customer.balance !== undefined && customer.balance > 0 ? "bg-green-100/70 dark:bg-green-950/50 border-green-200 dark:border-green-800" :
                      "bg-card border-border"
                )}
              >
                <div className="space-y-3">
                  {/* Header with Name and Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {customer.phone || "-"}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-md flex-shrink-0"
                          >
                            <MoreVertical className="h-4 w-4 text-foreground" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-1.5 space-y-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg">
                          {canView && (
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/${locale}/admin/customer-transactions/${customer.id}`}
                                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-850 cursor-pointer transition-colors text-xs font-semibold text-foreground w-full"
                              >
                                <Receipt className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <span>{tDash("viewTransactions") || "View Transaction"}</span>
                              </Link>
                            </DropdownMenuItem>
                          )}

                          {canView && (
                            <DropdownMenuItem
                              onClick={() => {
                                setViewCustomer(customer);
                                setIsViewCustomerDialogOpen(true);
                              }}
                              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-850 cursor-pointer transition-colors text-xs font-semibold text-foreground w-full"
                            >
                              <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span>{t("view") || "View Details"}</span>
                            </DropdownMenuItem>
                          )}

                          {customer.balance !== undefined && customer.balance > 0 && (
                            <DropdownMenuItem
                              onClick={() => handleWhatsAppClick(customer)}
                              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-850 cursor-pointer transition-colors text-xs font-semibold text-foreground w-full"
                            >
                              <WhatsAppIcon className="w-4.5 h-4.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                              <span>{tInvoice("sendOnWhatsApp") || "Send Message"}</span>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            onClick={() => {
                              const balance = customer.balance || 0;
                              setSelectedCustomerId(customer.id);
                              setNewCustomerName(customer.name);
                              setNewCustomerEmail(customer.email);
                              setNewCustomerPhone(customer.phone);
                              setNewCustomerCompanyName(
                                customer.company_name || "",
                              );
                              setNewCustomerCompanyAddress(
                                customer.company_address || "",
                              );
                              setNewCustomerOpeningBalance(
                                Math.abs(balance).toString(),
                              );
                              setNewCustomerOpeningBalanceType(balance < 0 ? "pay" : "receive");
                              setNewCustomerStatus(customer.status);
                              setIsEditCustomerDialogOpen(true);
                            }}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-850 cursor-pointer transition-colors text-xs font-semibold text-foreground w-full"
                          >
                            <FilePenIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span>{t("edit") || "Edit"}</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => {
                              setCustomerToDelete(customer);
                              setIsDeleteConfirmationOpen(true);
                            }}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-red-100/50 dark:border-red-950/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 cursor-pointer transition-colors text-xs font-semibold w-full"
                          >
                            <Trash2 className="w-4 h-4 flex-shrink-0" />
                            <span>{t("deleteAction") || "Delete"}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Company and Balance */}
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {t("companyName")}
                      </p>
                      <p className="font-semibold text-sm">
                        {customer.company_name || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {t("balance")}
                      </p>
                      <p className="font-semibold text-sm">
                        {t("currencySymbol")}{" "}
                        {customer.balance ? Math.round(customer.balance) : "0"}
                      </p>
                    </div>
                  </div>

                  {/* Email */}
                  {customer.email && (
                    <div className="w-full">
                      <p className="text-xs text-muted-foreground mb-1">
                        Email
                      </p>
                      <p className="text-xs text-foreground break-all">
                        {customer.email}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            ))}
            {filteredCustomers.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                {loading ? <Loader2Icon className="h-8 w-8 animate-spin mx-auto text-primary" /> : t("noCustomers")}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col md:flex-row justify-between items-center px-6 py-4 border-t gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 w-full md:w-auto">
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {tCommon("totalCountLabel", { count: totalCount })}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {tCommon("rowsPerPage")}
              </span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => setPageSize(parseInt(value))}
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

        <Dialog
          open={showNewCustomerDialog || isEditCustomerDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setShowNewCustomerDialog(false);
              setIsEditCustomerDialogOpen(false);
              resetSelectedCustomer();
            }
          }}
        >
          <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl sm:text-2xl">
                {showNewCustomerDialog
                  ? t("createNewCustomer")
                  : t("editCustomerTitle")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:gap-6 py-3 sm:py-4">
              {/* Contact Information Section */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("contactInformation")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="name"
                      className="text-xs sm:text-sm font-medium"
                    >
                      {t("nameLabel")}<span className="text-red-500 ml-1">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder={t("namePlaceholder")}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="phone"
                      className="text-xs sm:text-sm font-medium"
                    >
                      {t("phoneLabel")}
                    </Label>
                    <Input
                      id="phone"
                      value={newCustomerPhone}
                      onChange={(e) => {
                        const value = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 11);
                        setNewCustomerPhone(value);
                      }}
                      maxLength={11}
                      placeholder={t("phonePlaceholder")}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-xs sm:text-sm font-medium"
                  >
                    {t("emailLabel")}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>

              {/* Company Information Section */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("companyInformation")}
                </h3>
                <div className="space-y-2">
                  <Label
                    htmlFor="company_name"
                    className="text-xs sm:text-sm font-medium"
                  >
                    {t("companyNameLabel")}
                  </Label>
                  <Input
                    id="company_name"
                    value={newCustomerCompanyName}
                    onChange={(e) => setNewCustomerCompanyName(e.target.value)}
                    placeholder={t("companyNamePlaceholder")}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="company_address"
                    className="text-xs sm:text-sm font-medium"
                  >
                    {t("companyAddressLabel")}
                  </Label>
                  <Input
                    id="company_address"
                    value={newCustomerCompanyAddress}
                    onChange={(e) =>
                      setNewCustomerCompanyAddress(e.target.value)
                    }
                    placeholder={t("companyAddressPlaceholder")}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
              </div>

              {/* Financial Information Section */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("financialInformation")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="balance"
                      className="text-xs sm:text-sm font-medium"
                    >
                      {showNewCustomerDialog ? t("openingBalance") : t("balanceLabel")}
                    </Label>
                    <Input
                      id="balance"
                      type="number"
                      value={newCustomerOpeningBalance}
                      onChange={(e) =>
                        setNewCustomerOpeningBalance(e.target.value)
                      }
                      placeholder={t("balancePlaceholder")}
                      className="h-9 sm:h-10 text-sm"
                      disabled={!showNewCustomerDialog}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm font-medium">{t("balanceType")}</Label>
                    <Select disabled={!showNewCustomerDialog} value={newCustomerOpeningBalanceType} onValueChange={(val: "receive" | "pay") => setNewCustomerOpeningBalanceType(val)}>
                      <SelectTrigger className="h-9 sm:h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receive">{t("receive")}</SelectItem>
                        <SelectItem value="pay">{t("pay")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {!showNewCustomerDialog ? (
                  <p className="text-xs text-amber-600 mt-2 font-medium">
                    {t("cannotUpdateBalanceWarning")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("openingBalanceHelper")}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-3 pt-3 sm:pt-4 flex-col-reverse sm:flex-row">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowNewCustomerDialog(false);
                  setIsEditCustomerDialogOpen(false);
                  resetSelectedCustomer();
                }}
                className="h-9 sm:h-10 w-full sm:w-auto"
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={
                  showNewCustomerDialog ? handleAddCustomer : handleEditCustomer
                }
                disabled={
                  !newCustomerName || newCustomerName.trim() === "" || isSaving
                }
                className="h-9 sm:h-10 w-full sm:w-auto sm:min-w-[120px]"
              >
                {isSaving && (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                )}
                {showNewCustomerDialog ? t("createCustomer") : t("updateCustomer")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isViewCustomerDialogOpen}
          onOpenChange={setIsViewCustomerDialogOpen}
        >
          <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl sm:text-2xl">
                {t("customerDetails")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:gap-6 py-3 sm:py-4">
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("contactInformation")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t("nameLabel")}</span>
                    <div className="text-sm sm:text-base font-medium">
                      {viewCustomer?.name || "-"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t("phoneLabel")}</span>
                    <div className="text-sm sm:text-base font-medium">
                      {viewCustomer?.phone || "-"}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{t("emailLabel")}</span>
                  <div className="text-sm sm:text-base font-medium">
                    {viewCustomer?.email || "-"}
                  </div>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("companyInformation")}
                </h3>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    {t("companyNameLabel")}
                  </span>
                  <div className="text-sm sm:text-base font-medium">
                    {viewCustomer?.company_name || "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    {t("companyAddressLabel")}
                  </span>
                  <div className="text-sm sm:text-base font-medium">
                    {viewCustomer?.company_address || "-"}
                  </div>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  {t("financialInformation")}
                </h3>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">{t("balanceLabel")}</span>
                  <div className="text-sm sm:text-base font-medium">
                    {t("currencySymbol")}{" "}
                    {viewCustomer?.balance
                      ? Math.round(viewCustomer.balance)
                      : "0"}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-3 pt-3 sm:pt-4 flex-col-reverse sm:flex-row">
              <Button
                variant="secondary"
                onClick={() => setIsViewCustomerDialogOpen(false)}
                className="h-9 sm:h-10 w-full sm:w-auto"
              >
                {t("close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isDeleteConfirmationOpen}
          onOpenChange={setIsDeleteConfirmationOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("confirmDeletion")}</DialogTitle>
            </DialogHeader>
            {t("confirmDeleteMessage")}
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setIsDeleteConfirmationOpen(false)}
                disabled={isDeleting}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteCustomer}
                disabled={isDeleting}
              >
                {isDeleting && (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("delete")}
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
      </Card>
    </div>
  );
}
