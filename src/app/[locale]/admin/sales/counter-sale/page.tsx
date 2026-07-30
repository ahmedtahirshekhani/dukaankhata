"use client";
import React from "react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { useOfflineProducts, useOfflineCounterSales } from "@/lib/hooks/useOfflineData";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { db } from "@/lib/db/offline-db";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { Combobox } from "@/components/ui/combobox";
import { ProductDropdown } from "@/components/dropdown/product-dropdown";
import {
  Loader2Icon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileDown,
  Upload,
  Edit2Icon,
  DownloadIcon,
  Trash2Icon,
  SearchIcon,
  FilterIcon,
  ChevronDownIcon,
  XIcon,
  MoreVertical,
  CalendarIcon,
  PlusCircle,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { formatDate, getYearsFromDates } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import {
  exportTransactionsToExcel,
  exportTransactionsTemplate,
} from "@/lib/excel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { ImportPreviewModal } from "@/components/dialogs/import-preview-modal";
import * as XLSX from "xlsx";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UNITS_OF_MEASUREMENT } from "@/components/dialogs/product-dialog";

type TransactionType = "income" | "expense";

interface Product {
  id: number;
  name: string;
  sell_price?: number;
  unit_of_measurement?: string;
  description?: string;
}

interface Transaction {
  id: number;
  productId?: number | string;
  productName?: string;
  productDescription?: string;
  type: TransactionType;
  created_at: string;
  amount: number;
  customerName?: string;
  customerNumber?: string;
  unitPrice?: number;
  uom?: string;
  quantity?: number;
}

interface PaginatedResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function formatDateDMY(dateInput?: Date | string) {
  if (!dateInput) return "-";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export default function CounterSale() {
  const t = useTranslations("counterSale");
  const tCommon = useTranslations("common");
  const { can } = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const rawProducts = useOfflineProducts();
  const products = useMemo(() => {
    const productsData = (rawProducts || []).map(item => ({
      id: String(item.id ?? item._id ?? ""),
      name: String(item.name ?? ""),
      sellPrice: item.sell_price || item.salePrice || item.price || 0,
      description: item.description || "",
    }));
    return [
      ...productsData,
      {
        id: "0",
        name: t("others"),
        description: t("addCustomItemTitle"),
      } as unknown as Product,
    ];
  }, [rawProducts, t]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);
  const [transactionToDelete, setTransactionToDelete] =
    useState<Transaction | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 0 });
  const [sortColumn, setSortColumn] = useState<keyof Transaction>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [allYears, setAllYears] = useState<number[]>([]);
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    type: "income",
    amount: 0,
    quantity: 1,
    created_at: new Date().toISOString(),
  });
  const [editFormData, setEditFormData] = useState<Partial<Transaction>>({});

  // Filter states
  const [filters, setFilters] = useState({
    type: "all",
  });
  const [amountRange, setAmountRange] = useState({
    min: "",
    max: "",
  });

  const rawOfflineTransactions = useOfflineCounterSales(searchTerm, filters.type, selectedYear);
  const loading = rawOfflineTransactions === undefined;
  const offlineTransactions = useMemo(() => rawOfflineTransactions || [], [rawOfflineTransactions]);

  const [isDateRangeDialogOpen, setIsDateRangeDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState({
    fromDate: "",
    toDate: "",
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importData, setImportData] = useState<Record<string, any>[]>([]);
  const [importColumns, setImportColumns] = useState<string[]>([]);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title?: string;
    message: string;
    isSuccess?: boolean;
  }>({
    open: false,
    message: "",
  });

  // Helper function to convert ISO date string to YYYY-MM-DD format for date input
  const isoToDateInput = (isoString: string | undefined): string => {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Helper function to convert YYYY-MM-DD date input to ISO string
  const dateInputToIso = (dateString: string): string => {
    if (!dateString) return new Date().toISOString();
    // Create date at midnight local time and convert to ISO
    const date = new Date(dateString + "T00:00:00");
    return date.toISOString();
  };

  // Helper to truncate a description to a maximum number of words
  const truncateWords = (text?: string, maxWords = 3) => {
    if (!text) return "";
    const words = text.trim().split(/\s+/);
    return words.length <= maxWords
      ? text
      : `${words.slice(0, maxWords).join(" ")}...`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "created_at") {
      setNewTransaction((prev) => ({ ...prev, [name]: dateInputToIso(value) }));
    } else if (name === "unitPrice" || name === "quantity") {
      const numValue = parseFloat(value) || 0;
      setNewTransaction((prev) => {
        const updated = { ...prev, [name]: numValue };
        // Auto-calculate amount
        const price = name === "unitPrice" ? numValue : prev.unitPrice || 0;
        const qty = name === "quantity" ? numValue : prev.quantity || 0;
        updated.amount = price * qty;
        return updated;
      });
    } else {
      setNewTransaction((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleUOMChange = (value: string, isEdit: boolean) => {
    if (isEdit) {
      setEditFormData((prev) => ({ ...prev, uom: value }));
    } else {
      setNewTransaction((prev) => ({ ...prev, uom: value }));
    }
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "created_at") {
      setEditFormData((prev) => ({ ...prev, [name]: dateInputToIso(value) }));
    } else if (name === "unitPrice" || name === "quantity") {
      const numValue = parseFloat(value) || 0;
      setEditFormData((prev) => {
        const updated = { ...prev, [name]: numValue };
        // Auto-calculate amount
        const price = name === "unitPrice" ? numValue : prev.unitPrice || 0;
        const qty = name === "quantity" ? numValue : prev.quantity || 0;
        updated.amount = price * qty;
        return updated;
      });
    } else {
      setEditFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const isAddFormValid = () => {
    return (
      newTransaction.productId &&
      newTransaction.amount &&
      newTransaction.amount > 0 &&
      newTransaction.unitPrice !== undefined &&
      newTransaction.uom &&
      newTransaction.quantity &&
      newTransaction.quantity > 0
    );
  };

  const handleOpenEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditFormData({
      productId: transaction.productId,
      productName: transaction.productName,
      type: transaction.type,
      created_at: transaction.created_at,
      amount: transaction.amount,
      customerName: transaction.customerName,
      customerNumber: transaction.customerNumber,
      unitPrice: transaction.unitPrice,
      uom: transaction.uom,
      quantity: transaction.quantity,
    });
  };

  const handleSort = (column: keyof Transaction) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to descending so latest entries stay on top
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const getSortedTransactions = () => {
    // Filter transactions by selected year
    return transactions.filter((transaction) => {
      const transactionYear = new Date(transaction.created_at).getFullYear();
      return transactionYear === selectedYear;
    });
  };

  const filteredTransactions = useMemo(() => {
    // Filter transactions by selected year, type, amount range, and item name
    return transactions.filter((transaction) => {
      const transactionYear = new Date(transaction.created_at).getFullYear();

      // Year filter
      if (transactionYear !== selectedYear) {
        return false;
      }

      // Type filter
      if (filters.type !== "all" && transaction.type !== filters.type) {
        return false;
      }

      // Amount range filter
      if (amountRange.min && transaction.amount < Number(amountRange.min)) {
        return false;
      }
      if (amountRange.max && transaction.amount > Number(amountRange.max)) {
        return false;
      }

      // Item name search filter
      if (
        searchTerm &&
        !transaction.productName
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }, [transactions, selectedYear, filters, amountRange, searchTerm]);

  const getSortIcon = (column: keyof Transaction) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-1 h-4 w-4 inline opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-4 w-4 inline" />
    ) : (
      <ArrowDown className="ml-1 h-4 w-4 inline" />
    );
  };

  const handleUpdateTransaction = async (id: number) => {
    // Validate required fields
    if (!editFormData.productId) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("productRequired"),
      });
      return;
    }
    if (!editFormData.amount || editFormData.amount <= 0) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("amountGreaterThanZero"),
      });
      return;
    }

    try {
      const transactionToUpdate = { ...editFormData };
      await db.transactions.update(String(id), transactionToUpdate);
      await SyncEngine.queueOperation(
        "transactions",
        "PUT",
        `/api/transactions/${id}`,
        transactionToUpdate
      );

      // Close edit mode
      setEditingId(null);
      setEditFormData({});
    } catch (error) {
      alert("Error updating transaction");
      console.error("Error updating transaction:", error);
    }
  };

  const handleAddTransaction = async () => {
    // Validate required fields
    if (!newTransaction.productId) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("productRequired"),
      });
      return false;
    }
    if (
      newTransaction.unitPrice === undefined ||
      newTransaction.unitPrice === null
    ) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("priceRequired"),
      });
      return false;
    }
    if (!newTransaction.uom) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("uomRequired"),
      });
      return false;
    }
    if (!newTransaction.quantity || newTransaction.quantity <= 0) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("quantityGreaterThanZero"),
      });
      return false;
    }
    if (!newTransaction.amount || newTransaction.amount <= 0) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("amountGreaterThanZero"),
      });
      return false;
    }

    try {
      // Generate a 24-character hex string valid for MongoDB ObjectId
      const generateObjectId = () => {
        const timestamp = Math.floor(Date.now() / 1000).toString(16);
        const random = [...Array(16)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");
        return timestamp + random;
      };
      const tempId = generateObjectId();
      const transactionToAdd = {
        ...newTransaction,
        id: tempId,
      };

      await db.transactions.add(transactionToAdd);
      await SyncEngine.queueOperation(
        "transactions",
        "POST",
        "/api/transactions",
        transactionToAdd,
        tempId
      );

      setCurrentPage(1);
      setNewTransaction({
        type: "income",
        amount: 0,
        created_at: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error("Error adding transaction:", error);
      return false;
    }
  };

  const handleDownloadExcel = useCallback(async () => {
    try {
      setIsDownloading(true);

      // Filter transactions for selected year from local state
      const yearTransactions = transactions.filter((t) => {
        const transactionYear = new Date(t.created_at).getFullYear();
        return transactionYear === selectedYear;
      });

      if (!yearTransactions || yearTransactions.length === 0) {
        throw new Error(`No transactions found for year ${selectedYear}`);
      }

      // Generate filename with year
      const filename = `counter-sale-transactions-${selectedYear}.xlsx`;

      // Export to Excel
      exportTransactionsToExcel(yearTransactions, filename);
    } catch (error) {
      console.error("Error downloading Excel:", error);
      setErrorDialog({
        open: true,
        title: t("downloadError"),
        message: error instanceof Error ? error.message : t("downloadError"),
      });
    } finally {
      setIsDownloading(false);
    }
  }, [transactions, selectedYear, t]);

  const handleDownloadDateRange = useCallback(async () => {
    if (!dateRange.fromDate || !dateRange.toDate) {
      setErrorDialog({
        open: true,
        title: t("invalidDateRange"),
        message: t("invalidDateRange"),
      });
      return;
    }

    if (new Date(dateRange.fromDate) > new Date(dateRange.toDate)) {
      setErrorDialog({
        open: true,
        title: t("invalidDateRange"),
        message: t("invalidDateRange"),
      });
      return;
    }

    try {
      setIsDownloading(true);

      // Filter transactions for date range from local state
      const fromDate = new Date(dateRange.fromDate);
      const toDate = new Date(dateRange.toDate);
      toDate.setHours(23, 59, 59, 999); // Include entire end day

      const dateRangeTransactions = transactions.filter((t) => {
        const tDate = new Date(t.created_at);
        return tDate >= fromDate && tDate <= toDate;
      });

      if (!dateRangeTransactions || dateRangeTransactions.length === 0) {
        throw new Error("No transactions found for selected date range");
      }

      // Generate filename with date range
      const fromDateStr = dateRange.fromDate.replace(/-/g, "");
      const toDateStr = dateRange.toDate.replace(/-/g, "");
      const filename = `counter-sale-transactions-${fromDateStr}-${toDateStr}.xlsx`;

      // Export to Excel
      exportTransactionsToExcel(dateRangeTransactions, filename);

      // Close dialog and reset date range
      setIsDateRangeDialogOpen(false);
      setDateRange({ fromDate: "", toDate: "" });
    } catch (error) {
      console.error("Error downloading Excel:", error);
      setErrorDialog({
        open: true,
        title: t("downloadError"),
        message: error instanceof Error ? error.message : t("downloadError"),
      });
    } finally {
      setIsDownloading(false);
    }
  }, [transactions, dateRange, t]);

  const handleDownloadTemplate = useCallback(() => {
    exportTransactionsTemplate("counter-sale-template.xlsx");
  }, []);

  const handleDownloadSampleData = useCallback(() => {
    // Create sample transactions data
    const sampleTransactions: Transaction[] = [
      {
        id: 1,
        productId: "69688cfff3fc6042dbafdf1f",
        productName: "Laptop",
        productDescription: "Description",
        type: "income",
        unitPrice: 234534,
        quantity: 1,
        amount: 234534,
        uom: "kg",
        customerName: "testing",
        customerNumber: "03203138038",
        created_at: "2026-04-29T20:31:26.547+00:00",
      },
    ];

    // Export sample data
    exportTransactionsToExcel(
      sampleTransactions,
      "counter-sale-sample-data.xlsx",
    );
  }, []);

  const handleImportConfirm = useCallback(
    async (editedData: Record<string, any>[]) => {
      try {
        setIsImporting(true);

        const worksheet = XLSX.utils.json_to_sheet(editedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

        const excelBuffer = XLSX.write(workbook, {
          bookType: "xlsx",
          type: "array",
        });
        const blob = new Blob([excelBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const file = new File([blob], "edited_import.xlsx", {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/transactions/import", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t("importError"));
        }

        const result = await response.json();
        const message = `${t("importSuccess")}: ${result.successCount
          } transaction(s) imported.${result.errorCount > 0
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

        setIsImportPreviewOpen(false);

        // Refresh transactions by resetting to page 1
        setCurrentPage(1);

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        console.error("Error uploading imported data:", error);
        setErrorDialog({
          open: true,
          title: t("importError"),
          message: error instanceof Error ? error.message : t("importError"),
        });
      } finally {
        setIsImporting(false);
      }
    },
    [
      t,
      currentPage,
      sortColumn,
      sortDirection,
      selectedYear,
      setTransactions,
      setPageInfo,
    ],
  );

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
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
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<
              string,
              any
            >[];

            if (jsonData.length > 0) {
              const columns = Object.keys(jsonData[0]);
              setImportData(jsonData);
              setImportColumns(columns);
              setIsImportPreviewOpen(true);
            } else {
              throw new Error("No data found in the file");
            }
          } catch (err) {
            console.error("Error parsing Excel:", err);
            setErrorDialog({
              open: true,
              title: t("importError"),
              message: err instanceof Error ? err.message : t("importError"),
            });
          } finally {
            setIsImporting(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error("Error reading file:", error);
        setIsImporting(false);
      }
    },
    [t],
  );

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDeleteTransaction = useCallback(async () => {
    if (!transactionToDelete) return;
    const idToDelete = transactionToDelete.id;

    // Optimistic update: remove item from UI immediately and adjust totals
    const previousTransactions = transactions;
    const previousPageInfo = pageInfo;
    setTransactions((prev) => prev.filter((t) => t.id !== idToDelete));
    setPageInfo((prev) => ({ ...prev, total: Math.max(prev.total - 1, 0) }));
    setIsDeleteConfirmationOpen(false);
    setTransactionToDelete(null);

    try {
      await db.transactions.delete(String(idToDelete));
      await SyncEngine.queueOperation(
        "transactions",
        "DELETE",
        `/api/transactions/${idToDelete}`,
        null
      );
    } catch (error) {
      // Rollback on error
      setTransactions(previousTransactions);
      setPageInfo(previousPageInfo);
      console.error("Error deleting transaction:", error);
    }
  }, [transactionToDelete, transactions, pageInfo]);

  const handleFilterChange = (type: "type", value: string) => {
    setFilters((prev) => ({
      ...prev,
      [type]: value,
    }));
    setCurrentPage(1);
  };

  const handleAmountRangeChange = (field: "min" | "max", value: string) => {
    setAmountRange((prev) => ({
      ...prev,
      [field]: value,
    }));
    setCurrentPage(1);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setSearchTerm("");
    setFilters({
      type: "all",
    });
    setAmountRange({
      min: "",
      max: "",
    });
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchTerm !== "" ||
    filters.type !== "all" ||
    amountRange.min !== "" ||
    amountRange.max !== "";

  const handleDownloadPDF = (transaction: Transaction) => {
    // Import html2pdf dynamically to avoid SSR issues
    const html2pdf = require("html2pdf.js");

    // Format date as "12 January, 2026"
    const date = new Date(transaction.created_at);
    const formattedDate = date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Format time based on locale
    const transactionTime = date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Create professional receipt HTML
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Courier New', monospace;
              background-color: #fff;
              color: #333;
            }
            
            .receipt-container {
              max-width: 400px;
              margin: 0 auto;
              padding: 20px;
              background: white;
            }
            
            .receipt-header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
              margin-bottom: 20px;
            }
            
            .receipt-title {
              font-size: 18px;
              font-weight: bold;
              letter-spacing: 2px;
              margin-bottom: 8px;
            }
            
            .receipt-subtitle {
              font-size: 11px;
              color: #666;
              letter-spacing: 1px;
            }
            
            .receipt-section {
              margin-bottom: 20px;
            }
            
            .section-title {
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 10px;
              padding-bottom: 8px;
              border-bottom: 1px dashed #999;
            }
            
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              font-size: 12px;
            }
            
            .detail-label {
              font-weight: bold;
              color: #555;
              flex: 0 0 auto;
            }
            
            .detail-value {
              text-align: right;
              flex: 1;
              margin-left: 10px;
              word-break: break-word;
            }
            
            .item-name {
              font-size: 13px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            
            .item-description {
              font-size: 11px;
              color: #777;
              font-style: italic;
              margin-bottom: 8px;
            }
            
            .amount-box {
              background-color: #f5f5f5;
              border: 1px solid #ddd;
              padding: 12px;
              text-align: center;
              margin: 15px 0;
              border-radius: 4px;
            }
            
            .amount-label {
              font-size: 11px;
              color: #777;
              margin-bottom: 5px;
            }
            
            .amount-value {
              font-size: 24px;
              font-weight: bold;
              color: ${transaction.type === "income" ? "#10b981" : "#ef4444"};
            }
            
            .type-badge {
              display: inline-block;
              background-color: ${transaction.type === "income" ? "#d1fae5" : "#fee2e2"
      };
              color: ${transaction.type === "income" ? "#065f46" : "#991b1b"};
              padding: 4px 8px;
              border-radius: 3px;
              font-size: 11px;
              font-weight: bold;
              text-transform: uppercase;
            }
            
            .receipt-footer {
              text-align: center;
              border-top: 2px solid #333;
              padding-top: 15px;
              margin-top: 20px;
              font-size: 10px;
              color: #666;
            }
            
            .footer-text {
              margin-bottom: 4px;
              line-height: 1.4;
            }
            
            .footer-timestamp {
              font-size: 10px;
              color: #999;
              margin-top: 8px;
            }
            
            .divider {
              border: none;
              border-bottom: 1px dashed #999;
              margin: 12px 0;
            }
            
            .customer-section {
              background-color: #fafafa;
              padding: 10px;
              border-radius: 4px;
              margin-bottom: 15px;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <!-- Receipt Header -->
            <div class="receipt-header">
              <div class="receipt-title">${t("receipt")}</div>
              <div class="receipt-subtitle">${t("transactionRecord")}</div>
            </div>
            
            <!-- Transaction Details -->
            <div class="receipt-section">
              <div class="section-title">${t("transactionId")}</div>
              <div class="detail-row">
                <span class="detail-label">${t("receiptId")}:</span>
                <span class="detail-value">#${transaction.id}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">${t("date")}:</span>
                <span class="detail-value">${formattedDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">${t("time")}:</span>
                <span class="detail-value">${transactionTime}</span>
              </div>
            </div>
            
            <hr class="divider">
            
            <!-- Item Details -->
            <div class="receipt-section">
              <div class="section-title">${t("itemDetails")}</div>
              <div class="item-name">${transaction.productName || "N/A"}</div>
              ${transaction.productDescription
        ? `<div class="item-description">${transaction.productDescription}</div>`
        : ""
      }
              <div class="detail-row">
                <span class="detail-label">${t("unitPrice")}:</span>
                <span class="detail-value">Rs. ${transaction.unitPrice || 0}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">${t("uom")}:</span>
                <span class="detail-value">${transaction.uom || "N/A"}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">${t("quantity")}:</span>
                <span class="detail-value">${transaction.quantity || 1}</span>
              </div>
            </div>
            
            ${transaction.customerName || transaction.customerNumber
        ? `
            <hr class="divider">
            
            <!-- Customer Details -->
            <div class="receipt-section">
              <div class="section-title">${t("customerName")}</div>
              ${transaction.customerName
          ? `
              <div class="detail-row">
                <span class="detail-label">${t("name")}:</span>
                <span class="detail-value">${transaction.customerName}</span>
              </div>
              `
          : ""
        }
              ${transaction.customerNumber
          ? `
              <div class="detail-row">
                <span class="detail-label">${t("number")}:</span>
                <span class="detail-value">${transaction.customerNumber}</span>
              </div>
              `
          : ""
        }
            </div>
            `
        : ""
      }
            
            <hr class="divider">
            
            <!-- Amount Section -->
            <div class="amount-box">
              <div class="amount-label">${t("amount")}</div>
              <div class="amount-value">Rs. ${Math.floor(
        transaction.amount,
      )}</div>
            </div>
            
            <!-- Type Badge -->
            <div style="text-align: center; margin-bottom: 15px;">
              <span class="type-badge">${transaction.type}</span>
            </div>
            
            <!-- Footer -->
            <div class="receipt-footer">
              <div class="footer-text">${t("thankyou")}</div>
              <hr class="divider" style="margin: 8px 0;">
              <div class="footer-timestamp">
                ${t("generated")}: ${new Date().toLocaleString()}
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // PDF options for receipt-style formatting
    const options = {
      margin: 5,
      filename: `receipt-${transaction.id}-${new Date().getTime()}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
    };

    // Generate and download PDF
    html2pdf().set(options).from(htmlContent).save();
  };


  useEffect(() => {
    let processed = [...offlineTransactions];

    // sorting
    processed.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    const total = processed.length;
    const computedTotalPages = Math.max(1, Math.ceil(total / pageSize));
    setPageInfo({ total, totalPages: computedTotalPages });

    // Extract all years from transactions
    const years = getYearsFromDates(processed.map((t) => t.created_at));
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set([currentYear, ...years]);
    setAllYears(Array.from(yearsSet).sort((a, b) => b - a));

    // Pagination
    const paginated = processed.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    setTransactions(paginated);
  }, [offlineTransactions, currentPage, pageSize, sortColumn, sortDirection]);

  // Reset to first page when search or filters change or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters.type, pageSize]);

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2Icon className="mx-auto h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">
              {t("title").replace(/ transactions/gi, "").replace(/ transactions/gi, "")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{t("pageDescription")}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              className="h-9"
              onClick={() => setIsAddFormOpen((prev) => !prev)}
            >
              {isAddFormOpen ? (
                <>
                  <XIcon className="w-4 h-4 mr-1.5" />
                  {t("close")}
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4 mr-1.5" />
                  {t("add")}
                </>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0"
                  disabled={isDownloading || isImporting}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
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
                  onClick={() => setIsDateRangeDialogOpen(true)}
                  disabled={isDownloading || isImporting}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  {t("downloadDateRange")}
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
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
          </div>
        </div>

        <Card className="flex flex-col gap-6 p-3.5 sm:p-6 shadow-md overflow-hidden">
          <CardHeader className="p-0">
            <div className="flex items-center gap-2 w-full">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search"
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-9 pr-8 h-9 text-sm w-full"
                />
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setCurrentPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 shrink-0 h-9"
                  >
                    <FilterIcon className="w-4 h-4" />
                    <span>{tCommon("filter")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-2 max-h-96 overflow-y-auto">
                  <DropdownMenuLabel>{t("typeFilter")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={filters.type === "all"}
                    onCheckedChange={() => handleFilterChange("type", "all")}
                  >
                    {t("all")}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filters.type === "income"}
                    onCheckedChange={() => handleFilterChange("type", "income")}
                  >
                    {t("income")}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filters.type === "expense"}
                    onCheckedChange={() => handleFilterChange("type", "expense")}
                  >
                    {t("expense")}
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuSeparator className="my-2" />
                  <DropdownMenuLabel>{t("amountRange")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="p-2 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder={t("min")}
                        value={amountRange.min}
                        onChange={(e) =>
                          handleAmountRangeChange("min", e.target.value)
                        }
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        placeholder={t("max")}
                        value={amountRange.max}
                        onChange={(e) =>
                          handleAmountRangeChange("max", e.target.value)
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllFilters}
                  className="h-9 gap-1 shrink-0 px-2"
                >
                  <XIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("clear")}</span>
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0 relative">

            {/* Desktop Table View */}
            <div className="hidden md:block">
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-48 whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4">
                            {t("item")}
                          </TableHead>
                          <TableHead className="w-28 whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4">
                            {t("unitPrice")}
                          </TableHead>
                          <TableHead className="w-24 whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4">
                            {t("uom")}
                          </TableHead>
                          <TableHead className="w-20 whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4">
                            {t("qty")}
                          </TableHead>
                          <TableHead
                            className="w-32 cursor-pointer select-none whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4"
                            onClick={() => handleSort("amount")}
                          >
                            {t("amount")} {getSortIcon("amount")}
                          </TableHead>
                          <TableHead
                            className="w-28 cursor-pointer select-none whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4"
                            onClick={() => handleSort("type")}
                          >
                            {t("type")} {getSortIcon("type")}
                          </TableHead>
                          <TableHead
                            className="w-36 cursor-pointer select-none whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4"
                            onClick={() => handleSort("created_at")}
                          >
                            {t("date")} {getSortIcon("created_at")}
                          </TableHead>
                          <TableHead className="w-36 whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4">
                            {t("customerName")}
                          </TableHead>
                          <TableHead className="w-36 whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4">
                            {t("customerNumber")}
                          </TableHead>
                          <TableHead className="w-20 px-2 sm:px-4"></TableHead>
                          <TableHead className="w-20 px-2 sm:px-4">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                        <TableRow>
                          <TableCell className="w-40 px-2 sm:px-4 overflow-hidden">
                            <ProductDropdown
                              value={
                                newTransaction.productId
                                  ? String(newTransaction.productId)
                                  : ""
                              }
                              onValueChange={(value, product) => {
                                if (product) {
                                  setNewTransaction((prev) => ({
                                    ...prev,
                                    productId: (product._id
                                      ? String(product._id)
                                      : String(product.id)) as any,
                                    productName: product.name,
                                    productDescription: product.description,
                                    unitPrice: parseFloat(product.sell_price_str || "") || product.sell_price || product.price || 0,
                                    uom: product.unit_of_measurement || "unit",
                                    quantity: 1,
                                    amount: (parseFloat(product.sell_price_str || "") || product.sell_price || product.price || 0) * 1,
                                  }));
                                }
                              }}
                              placeholder={t("selectItem")}
                              className="w-32 truncate text-xs"
                            />
                          </TableCell>
                          <TableCell className="w-24 px-2 sm:px-4 overflow-hidden">
                            <Input
                              name="unitPrice"
                              type="number"
                              value={newTransaction.unitPrice || ""}
                              onChange={handleInputChange}
                              placeholder={t("price")}
                              className="text-xs sm:text-sm h-8 sm:h-10 w-24"
                              required
                            />
                          </TableCell>
                          <TableCell className="w-20 px-2 sm:px-4 overflow-hidden">
                            <Select
                              value={newTransaction.uom}
                              onValueChange={(value) =>
                                handleUOMChange(value, false)
                              }
                            >
                              <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-10 w-20">
                                <SelectValue placeholder="UOM" />
                              </SelectTrigger>
                              <SelectContent>
                                {UNITS_OF_MEASUREMENT.map((unit) => (
                                  <SelectItem key={unit.value} value={unit.value}>
                                    {unit.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="w-16 px-2 sm:px-4 overflow-hidden">
                            <Input
                              name="quantity"
                              type="number"
                              value={newTransaction.quantity || ""}
                              onChange={handleInputChange}
                              placeholder={t("qty")}
                              className="text-xs sm:text-sm h-8 sm:h-10 w-16"
                              required
                            />
                          </TableCell>
                          <TableCell className="w-24 px-2 sm:px-4 overflow-hidden">
                            <Input
                              name="amount"
                              type="number"
                              value={newTransaction.amount}
                              onChange={handleInputChange}
                              placeholder={t("amount")}
                              required
                              className="text-xs sm:text-sm h-8 sm:h-10 w-24"
                              readOnly
                            />
                          </TableCell>
                          <TableCell className="w-24 px-2 sm:px-4 overflow-hidden">
                            <div className="w-full overflow-hidden">
                              <Select
                                defaultValue={newTransaction.type}
                                onValueChange={(value) =>
                                  setNewTransaction({
                                    ...newTransaction,
                                    type: value as TransactionType,
                                  })
                                }
                              >
                                <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-10 w-24">
                                  <SelectValue placeholder={t("type")} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="income">Income</SelectItem>
                                  <SelectItem value="expense">Expense</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                          <TableCell className="w-32 px-2 sm:px-4 overflow-hidden">
                            <div className="relative w-32">
                              <Input
                                name="created_at"
                                type="date"
                                value={isoToDateInput(newTransaction.created_at)}
                                onChange={handleInputChange}
                                required
                                className="text-xs sm:text-sm h-8 sm:h-10 w-full pr-8 [&::-webkit-calendar-picker-indicator]:opacity-0 cursor-pointer"
                              />
                              <CalendarIcon
                                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer"
                                onClick={(e) => {
                                  (
                                    e.currentTarget
                                      .previousElementSibling as HTMLInputElement
                                  )?.showPicker?.();
                                }}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="w-32 px-2 sm:px-4 overflow-hidden">
                            <Input
                              name="customerName"
                              value={newTransaction.customerName || ""}
                              onChange={handleInputChange}
                              placeholder={t("name")}
                              className="text-xs sm:text-sm h-8 sm:h-10 w-32"
                            />
                          </TableCell>
                          <TableCell className="w-32 px-2 sm:px-4 overflow-hidden">
                            <Input
                              name="customerNumber"
                              value={newTransaction.customerNumber || ""}
                              onChange={handleInputChange}
                              placeholder={t("number")}
                              className="text-xs sm:text-sm h-8 sm:h-10 w-32"
                            />
                          </TableCell>
                          <TableCell className="w-20 px-2 sm:px-4">
                            {can("sales", "create_counter_sale") && (
                              <Button
                                onClick={handleAddTransaction}
                                disabled={isImporting}
                                size="sm"
                                className="text-xs sm:text-sm h-8 sm:h-10"
                              >
                                {t("add")}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransactions.map((transaction) => (
                          <React.Fragment key={transaction.id}>
                            {/* Desktop Edit Row */}
                            {editingId === transaction.id ? (
                              <TableRow className="hidden md:table-row">
                                <TableCell className="w-40 px-2 sm:px-4 overflow-hidden">
                                  <ProductDropdown
                                    value={
                                      editFormData.productId
                                        ? String(editFormData.productId)
                                        : ""
                                    }
                                    onValueChange={(value, product) => {
                                      if (product) {
                                        setEditFormData((prev) => ({
                                          ...prev,
                                          productId: (product._id
                                            ? String(product._id)
                                            : String(product.id)) as any,
                                          productName: product.name,
                                          productDescription: product.description,
                                          unitPrice: parseFloat(product.sell_price_str || "") || product.sell_price || product.price || 0,
                                          uom:
                                            product.unit_of_measurement || "unit",
                                          quantity: 1,
                                          amount: (parseFloat(product.sell_price_str || "") || product.sell_price || product.price || 0) * 1,
                                        }));
                                      }
                                    }}
                                    placeholder={t("selectItem")}
                                    className="w-32 truncate text-xs"
                                  />
                                </TableCell>
                                <TableCell className="w-24 px-2 sm:px-4 overflow-hidden">
                                  <Input
                                    name="unitPrice"
                                    type="number"
                                    value={editFormData.unitPrice || ""}
                                    onChange={handleEditInputChange}
                                    placeholder={t("price")}
                                    className="text-xs sm:text-sm h-8 sm:h-10 w-24"
                                    required
                                  />
                                </TableCell>
                                <TableCell className="w-20 px-2 sm:px-4 overflow-hidden">
                                  <Select
                                    value={editFormData.uom}
                                    onValueChange={(value) =>
                                      handleUOMChange(value, true)
                                    }
                                  >
                                    <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-10 w-20">
                                      <SelectValue placeholder="UOM" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {UNITS_OF_MEASUREMENT.map((unit) => (
                                        <SelectItem
                                          key={unit.value}
                                          value={unit.value}
                                        >
                                          {unit.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="w-16 px-2 sm:px-4 overflow-hidden">
                                  <Input
                                    name="quantity"
                                    type="number"
                                    value={editFormData.quantity || ""}
                                    onChange={handleEditInputChange}
                                    placeholder={t("qty")}
                                    className="text-xs sm:text-sm h-8 sm:h-10 w-16"
                                    required
                                  />
                                </TableCell>
                                <TableCell className="w-28 px-2 sm:px-4 overflow-hidden">
                                  <Input
                                    name="amount"
                                    type="number"
                                    value={editFormData.amount || ""}
                                    onChange={handleEditInputChange}
                                    placeholder="Amount"
                                    className="text-xs sm:text-sm h-8 sm:h-10 w-28"
                                    readOnly
                                  />
                                </TableCell>
                                <TableCell className="w-24 px-2 sm:px-4 overflow-hidden">
                                  <div className="w-full overflow-hidden">
                                    <Select
                                      value={editFormData.type || "income"}
                                      onValueChange={(value) =>
                                        setEditFormData({
                                          ...editFormData,
                                          type: value as TransactionType,
                                        })
                                      }
                                    >
                                      <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-10 w-24">
                                        <SelectValue placeholder="Type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="income">
                                          Income
                                        </SelectItem>
                                        <SelectItem value="expense">
                                          Expense
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </TableCell>
                                <TableCell className="w-32 px-2 sm:px-4 overflow-hidden">
                                  <div className="relative w-32">
                                    <Input
                                      name="created_at"
                                      type="date"
                                      value={isoToDateInput(
                                        editFormData.created_at ||
                                        transaction.created_at,
                                      )}
                                      onChange={handleEditInputChange}
                                      className="text-xs sm:text-sm h-8 sm:h-10 w-full pr-8 [&::-webkit-calendar-picker-indicator]:opacity-0 cursor-pointer"
                                    />
                                    <CalendarIcon
                                      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer"
                                      onClick={(e) => {
                                        (
                                          e.currentTarget
                                            .previousElementSibling as HTMLInputElement
                                        )?.showPicker?.();
                                      }}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="w-32 px-2 sm:px-4 overflow-hidden">
                                  <Input
                                    name="customerName"
                                    value={editFormData.customerName || ""}
                                    onChange={handleEditInputChange}
                                    placeholder={t("name")}
                                    className="text-xs sm:text-sm h-8 sm:h-10 w-32"
                                  />
                                </TableCell>
                                <TableCell className="w-32 px-2 sm:px-4 overflow-hidden">
                                  <Input
                                    name="customerNumber"
                                    value={editFormData.customerNumber || ""}
                                    onChange={handleEditInputChange}
                                    placeholder={t("number")}
                                    className="text-xs sm:text-sm h-8 sm:h-10 w-32"
                                  />
                                </TableCell>
                                <TableCell className="w-20 px-2 sm:px-4">
                                  <div className="flex gap-1 sm:gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleUpdateTransaction(transaction.id)
                                      }
                                      className="text-xs sm:text-sm h-8 px-2 sm:px-3"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingId(null);
                                        setEditFormData({});
                                      }}
                                      className="text-xs sm:text-sm h-8 px-2 sm:px-3"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : (
                              <>
                                {/* Desktop View */}
                                <TableRow className="hidden md:table-row">
                                  <TableCell className="w-40 px-2 sm:px-4 overflow-hidden">
                                    <div className="flex flex-col items-start py-1">
                                      <span className="text-xs sm:text-sm font-medium leading-tight">
                                        {transaction.productName || "-"}
                                      </span>
                                      {transaction.productDescription && (
                                        <span className="text-xs text-muted-foreground leading-snug">
                                          {truncateWords(
                                            transaction.productDescription,
                                            3,
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="w-24 text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">
                                    Rs. {transaction.unitPrice}
                                  </TableCell>
                                  <TableCell className="w-20 text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">
                                    {transaction.uom}
                                  </TableCell>
                                  <TableCell className="w-16 text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">
                                    {transaction.quantity}
                                  </TableCell>
                                  <TableCell className="w-28 text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">
                                    Rs. {Math.floor(transaction.amount)}
                                  </TableCell>
                                  <TableCell className="w-24 px-2 sm:px-4 overflow-hidden">
                                    <Badge
                                      variant={transaction.type}
                                      className="text-xs truncate"
                                    >
                                      {transaction.type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="w-32 text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">
                                    {formatDate(transaction.created_at, false, {
                                      year: "numeric",
                                      month: "short",
                                      day: "2-digit",
                                    })}
                                  </TableCell>
                                  <TableCell
                                    className="w-32 text-xs sm:text-sm px-2 sm:px-4 overflow-hidden truncate"
                                    title={transaction.customerName || "-"}
                                  >
                                    {transaction.customerName || "-"}
                                  </TableCell>
                                  <TableCell
                                    className="w-32 text-xs sm:text-sm px-2 sm:px-4 overflow-hidden truncate"
                                    title={transaction.customerNumber || "-"}
                                  >
                                    {transaction.customerNumber || "-"}
                                  </TableCell>
                                  <TableCell className="w-20 px-2 sm:px-4 overflow-hidden">
                                    <div className="flex gap-1">
                                      {can("sales", "edit_counter_sale") && (
                                        <Button
                                          aria-haspopup="true"
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={() =>
                                            handleOpenEdit(transaction)
                                          }
                                          title="Edit"
                                        >
                                          <Edit2Icon className="h-4 w-4" />
                                          <span className="sr-only">Edit</span>
                                        </Button>
                                      )}
                                      <Button
                                        aria-haspopup="true"
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        onClick={() =>
                                          handleDownloadPDF(transaction)
                                        }
                                        title="Download"
                                      >
                                        <DownloadIcon className="h-4 w-4" />
                                        <span className="sr-only">Download</span>
                                      </Button>
                                      {can("sales", "delete_counter_sale") && (
                                        <Button
                                          aria-haspopup="true"
                                          size="icon"
                                          variant="danger"
                                          className="h-8 w-8"
                                          onClick={() => {
                                            setTransactionToDelete(transaction);
                                            setIsDeleteConfirmationOpen(true);
                                          }}
                                          title="Delete"
                                        >
                                          <Trash2Icon className="h-4 w-4" />
                                          <span className="sr-only">Delete</span>
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </>
                            )}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile View - Cards */}
            <div className="block md:hidden space-y-3">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2Icon className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p>{tCommon("loading")}</p>
                </div>
              ) : filteredTransactions.length === 0 ? (
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
                filteredTransactions.map((transaction) => (
                  <div key={transaction.id}>
                    {editingId === transaction.id ? (
                      // Mobile Edit Card
                      <div className="bg-card border rounded-lg p-3.5 sm:p-4 shadow-sm space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b">
                          <h4 className="font-semibold text-sm sm:text-base text-foreground">
                            Edit Transaction
                          </h4>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null);
                              setEditFormData({});
                            }}
                            className="h-7 w-7"
                          >
                            <XIcon className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">{t("item")}</Label>
                          <ProductDropdown
                            value={
                              editFormData.productId
                                ? String(editFormData.productId)
                                : ""
                            }
                            onValueChange={(value, product) => {
                              if (product) {
                                setEditFormData((prev) => ({
                                  ...prev,
                                  productId: (product._id
                                    ? String(product._id)
                                    : String(product.id)) as any,
                                  productName: product.name,
                                  productDescription: product.description,
                                  unitPrice: parseFloat(product.sell_price_str || "") || product.sell_price || product.price || 0,
                                  uom: product.unit_of_measurement || "unit",
                                  quantity: 1,
                                  amount: (parseFloat(product.sell_price_str || "") || product.sell_price || product.price || 0) * 1,
                                }));
                              }
                            }}
                            placeholder={t("selectItem")}
                            className="w-full truncate text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t("type")}</Label>
                            <Select
                              value={editFormData.type || "income"}
                              onValueChange={(value) =>
                                setEditFormData({
                                  ...editFormData,
                                  type: value as TransactionType,
                                })
                              }
                            >
                              <SelectTrigger className="text-sm h-9">
                                <SelectValue placeholder={t("type")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="income">Income</SelectItem>
                                <SelectItem value="expense">Expense</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t("date")}</Label>
                            <div className="relative">
                              <Input
                                name="created_at"
                                type="date"
                                value={isoToDateInput(
                                  editFormData.created_at || transaction.created_at,
                                )}
                                onChange={handleEditInputChange}
                                className="text-sm h-9 w-full pr-8 [&::-webkit-calendar-picker-indicator]:opacity-0 cursor-pointer"
                              />
                              <CalendarIcon
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer"
                                onClick={(e) => {
                                  (
                                    e.currentTarget
                                      .previousElementSibling as HTMLInputElement
                                  )?.showPicker?.();
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t("unitPrice")}</Label>
                            <Input
                              name="unitPrice"
                              type="number"
                              value={editFormData.unitPrice || ""}
                              onChange={handleEditInputChange}
                              placeholder={t("price")}
                              className="text-sm h-9"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t("uom")}</Label>
                            <Select
                              value={editFormData.uom}
                              onValueChange={(value) =>
                                handleUOMChange(value, true)
                              }
                            >
                              <SelectTrigger className="text-sm h-9">
                                <SelectValue placeholder="UOM" />
                              </SelectTrigger>
                              <SelectContent>
                                {UNITS_OF_MEASUREMENT.map((unit) => (
                                  <SelectItem key={unit.value} value={unit.value}>
                                    {unit.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t("qty")}</Label>
                            <Input
                              name="quantity"
                              type="number"
                              value={editFormData.quantity || ""}
                              onChange={handleEditInputChange}
                              placeholder={t("qty")}
                              className="text-sm h-9"
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t("amount")}</Label>
                            <Input
                              name="amount"
                              type="number"
                              value={editFormData.amount || ""}
                              onChange={handleEditInputChange}
                              placeholder={t("amount")}
                              className="text-sm h-9"
                              readOnly
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t("customerName")}</Label>
                            <Input
                              name="customerName"
                              value={editFormData.customerName || ""}
                              onChange={handleEditInputChange}
                              placeholder={t("name")}
                              className="text-sm h-9"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t("customerNumber")}</Label>
                            <Input
                              name="customerNumber"
                              value={editFormData.customerNumber || ""}
                              onChange={handleEditInputChange}
                              placeholder={t("number")}
                              className="text-sm h-9"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            onClick={() => handleUpdateTransaction(transaction.id)}
                            className="flex-1 text-sm h-9"
                          >
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              setEditFormData({});
                            }}
                            className="flex-1 text-sm h-9"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Mobile Transaction Card
                      <div className="bg-card border rounded-lg p-3.5 shadow-sm space-y-2.5">
                        {/* Header Row: Item Name & 3-Dots Action Menu */}
                        <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
                          <h3 className="font-semibold text-sm sm:text-base text-foreground truncate max-w-[75%]">
                            {transaction.productName || "-"}
                          </h3>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-7 w-7 p-0">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              {can("sales", "edit_counter_sale") && (
                                <DropdownMenuItem onClick={() => handleOpenEdit(transaction)}>
                                  <Edit2Icon className="mr-2 h-4 w-4 text-sky-500" />
                                  <span>{tCommon("edit")}</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleDownloadPDF(transaction)}>
                                <DownloadIcon className="mr-2 h-4 w-4 text-indigo-500" />
                                <span>Download</span>
                              </DropdownMenuItem>
                              {can("sales", "delete_counter_sale") && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setTransactionToDelete(transaction);
                                    setIsDeleteConfirmationOpen(true);
                                  }}
                                  className="text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40"
                                >
                                  <Trash2Icon className="mr-2 h-4 w-4 text-red-500" />
                                  <span>{tCommon("delete")}</span>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="space-y-2 text-xs sm:text-sm">
                          {/* Row 1: Date (DD-MM-YYYY) & Type Badge */}
                          <div className="flex justify-between items-center text-muted-foreground text-xs font-medium">
                            <span>
                              {formatDateDMY(transaction.created_at)}
                            </span>
                            <Badge
                              variant={transaction.type}
                              className="text-[10px] px-2 py-0.5 capitalize"
                            >
                              {transaction.type}
                            </Badge>
                          </div>

                          {/* Row 2: Price & Qty */}
                          <div className="flex justify-between items-center text-xs">
                            <span>
                              <span className="text-muted-foreground">{t("price")}: </span>
                              <span className="font-medium text-foreground">
                                Rs. {transaction.unitPrice ?? 0}
                                {transaction.uom ? ` / ${transaction.uom}` : ""}
                              </span>
                            </span>
                            <span>
                              <span className="text-muted-foreground">{t("qty")}: </span>
                              <span className="font-medium text-foreground">{transaction.quantity ?? 0}</span>
                            </span>
                          </div>

                          {/* Row 3: Total Amount */}
                          <div className="flex justify-between items-center text-xs pt-1.5 border-t border-zinc-100 dark:border-zinc-800/40">
                            <span className="text-muted-foreground font-medium">{t("amount")}:</span>
                            <span className="font-semibold text-foreground text-sm">
                              Rs. {Math.floor(transaction.amount)}
                            </span>
                          </div>

                          {/* Row 4: Customer Details if available */}
                          {(transaction.customerName || transaction.customerNumber) && (
                            <div className="flex justify-between items-center text-xs text-muted-foreground pt-1 border-t border-zinc-100 dark:border-zinc-800/20">
                              <span>
                                {transaction.customerName && (
                                  <span className="font-medium text-foreground">{transaction.customerName}</span>
                                )}
                              </span>
                              <span>
                                {transaction.customerNumber && (
                                  <span>{transaction.customerNumber}</span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            <div className="mt-4 sm:mt-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 w-full md:w-auto">
                <div className="text-sm text-muted-foreground whitespace-nowrap">
                  {tCommon("totalCountLabel", { count: pageInfo.total })}
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
                      {[10, 25, 50, 100].map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {pageInfo.totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={pageInfo.totalPages}
                  onPageChange={setCurrentPage}
                  isLoading={loading}
                />
              )}
            </div>
          </CardContent>
          {/* Remove card footer */}
        </Card>
      </div>
      <Dialog
        open={isDeleteConfirmationOpen}
        onOpenChange={setIsDeleteConfirmationOpen}
      >
        <DialogContent className="sm:max-w-[425px] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-sm">
              Are you sure you want to delete this transaction? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmationOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteTransaction}
              className="w-full sm:w-auto"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Item Dialog */}
      {/* Add Transaction Dialog (Mobile) */}
      <Dialog open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
        <DialogContent className="sm:max-w-[500px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {t("addTransaction")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs sm:text-sm font-medium">
                {t("item")}
              </label>
              <ProductDropdown
                value={
                  newTransaction.productId
                    ? String(newTransaction.productId)
                    : ""
                }
                onValueChange={(value, product) => {
                  if (product) {
                    setNewTransaction((prev) => ({
                      ...prev,
                      productId: (product._id
                        ? String(product._id)
                        : String(product.id)) as any,
                      productName: product.name,
                      productDescription: product.description,
                      unitPrice: product.sell_price || 0,
                      uom: product.unit_of_measurement || "unit",
                      quantity: 1,
                      amount: (product.sell_price || 0) * 1,
                    }));
                  }
                }}
                placeholder={t("selectItem")}
                className="w-full truncate text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium">
                  {t("unitPrice")}
                </label>
                <Input
                  name="unitPrice"
                  type="number"
                  value={newTransaction.unitPrice || ""}
                  onChange={handleInputChange}
                  placeholder={t("price")}
                  className="text-sm h-9"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium">
                  {t("uom")}
                </label>
                <Select
                  value={newTransaction.uom}
                  onValueChange={(value) => handleUOMChange(value, false)}
                >
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue placeholder="UOM" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS_OF_MEASUREMENT.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium">
                  {t("quantity")}
                </label>
                <Input
                  name="quantity"
                  type="number"
                  value={newTransaction.quantity || ""}
                  onChange={handleInputChange}
                  placeholder={t("qty")}
                  className="text-sm h-9"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium">
                  {t("amount")}
                </label>
                <Input
                  name="amount"
                  type="number"
                  value={newTransaction.amount}
                  onChange={handleInputChange}
                  placeholder={t("amount")}
                  required
                  className="text-sm h-9"
                  readOnly
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs sm:text-sm font-medium">
                {t("type")}
              </label>
              <Select
                defaultValue={newTransaction.type}
                onValueChange={(value) =>
                  setNewTransaction({
                    ...newTransaction,
                    type: value as TransactionType,
                  })
                }
              >
                <SelectTrigger className="text-sm h-9">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium">Date</label>
                <div className="relative">
                  <Input
                    name="created_at"
                    type="date"
                    value={isoToDateInput(newTransaction.created_at)}
                    onChange={handleInputChange}
                    required
                    className="text-sm h-9 w-full pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 cursor-pointer"
                  />
                  <CalendarIcon
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer"
                    onClick={(e) => {
                      (
                        e.currentTarget
                          .previousElementSibling as HTMLInputElement
                      )?.showPicker?.();
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium">
                  Customer Name
                </label>
                <Input
                  name="customerName"
                  value={newTransaction.customerName || ""}
                  onChange={handleInputChange}
                  placeholder="Name (Optional)"
                  className="text-sm h-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs sm:text-sm font-medium">
                {t("customerNumber")}
              </label>
              <Input
                name="customerNumber"
                value={newTransaction.customerNumber || ""}
                onChange={handleInputChange}
                placeholder={t("numberOptional")}
                className="text-sm h-9"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsAddFormOpen(false)}
              className="w-full sm:w-auto"
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={async () => {
                const success = await handleAddTransaction();
                if (success) {
                  setIsAddFormOpen(false);
                }
              }}
              disabled={isImporting}
              className="w-full sm:w-auto"
            >
              {t("addTransaction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Date Range Download Dialog */}
      <Dialog
        open={isDateRangeDialogOpen}
        onOpenChange={setIsDateRangeDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {t("selectDateRange")}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {t("downloadDateRange")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("fromDate")}</label>
              <Input
                type="date"
                value={dateRange.fromDate}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    fromDate: e.target.value,
                  }))
                }
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("toDate")}</label>
              <Input
                type="date"
                value={dateRange.toDate}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    toDate: e.target.value,
                  }))
                }
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setIsDateRangeDialogOpen(false);
                setDateRange({ fromDate: "", toDate: "" });
              }}
              className="w-full sm:w-auto"
              disabled={isDownloading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDownloadDateRange}
              disabled={
                isDownloading || !dateRange.fromDate || !dateRange.toDate
              }
              className="w-full sm:w-auto"
            >
              {isDownloading ? t("downloading") : t("download")}
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
      <ImportPreviewModal
        open={isImportPreviewOpen}
        onOpenChange={setIsImportPreviewOpen}
        data={importData}
        columns={importColumns}
        isLoading={isImporting}
        onConfirm={handleImportConfirm}
        title={t("importPreview") || "Import Preview"}
        description={
          t("editImportData") ||
          "Edit the data below before confirming the import"
        }
      />
    </>
  );
}
