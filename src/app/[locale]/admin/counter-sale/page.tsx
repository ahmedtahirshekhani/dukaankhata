"use client";
import React from "react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Combobox } from "@/components/ui/combobox";
import {
  EllipsisVerticalIcon,
  Loader2Icon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileDown,
  Upload,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { formatDate, getYearsFromDates } from "@/lib/utils";
import {
  exportTransactionsToExcel,
  exportTransactionsTemplate,
} from "@/lib/excel-utils";
import { Input } from "@/components/ui/input";
import { ErrorDialog } from "@/components/error-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TransactionType = "income" | "expense";

interface Product {
  id: number;
  name: string;
  sell_price?: number;
  unit_of_measurement?: string;
  description?: string;
}

const ITEMS_PER_PAGE = 25;

interface Transaction {
  id: number;
  productId?: number;
  productName?: string;
  productDescription?: string;
  type: TransactionType;
  created_at: string;
  amount: number;
  customerName?: string;
  customerNumber?: string;
}

interface PaginatedResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function CounterSale() {
  const t = useTranslations("counterSale");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);
  const [transactionToDelete, setTransactionToDelete] =
    useState<Transaction | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ total: 0, totalPages: 0 });
  const [sortColumn, setSortColumn] = useState<keyof Transaction>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [allYears, setAllYears] = useState<number[]>([]);
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    type: "income",
    amount: 0,
    created_at: new Date().toISOString(),
  });
  const [editFormData, setEditFormData] = useState<Partial<Transaction>>({});
  const [isCustomItemDialogOpen, setIsCustomItemDialogOpen] = useState(false);
  const [customItemData, setCustomItemData] = useState({
    name: "",
    description: "",
  });
  const [selectedComboboxContext, setSelectedComboboxContext] = useState<
    "add" | "edit"
  >("add");
  const [isDateRangeDialogOpen, setIsDateRangeDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState({
    fromDate: "",
    toDate: "",
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "created_at") {
      setNewTransaction((prev) => ({ ...prev, [name]: dateInputToIso(value) }));
    } else {
      setNewTransaction((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "created_at") {
      setEditFormData((prev) => ({ ...prev, [name]: dateInputToIso(value) }));
    } else {
      setEditFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const isAddFormValid = () => {
    return (
      newTransaction.productId &&
      newTransaction.amount &&
      newTransaction.amount > 0
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

  const handleAddCustomItem = () => {
    if (!customItemData.name.trim()) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        message: "Item name is required",
      });
      return;
    }

    // Create a temporary product object with a negative ID for custom items
    const customProduct: Product = {
      id: -Date.now(), // Use negative timestamp as unique ID
      name: customItemData.name,
      description: customItemData.description || undefined,
    };

    if (selectedComboboxContext === "add") {
      setNewTransaction((prev) => ({
        ...prev,
        productId: customProduct.id as number,
        productName: customProduct.name,
        productDescription: customProduct.description,
      }));
    } else {
      setEditFormData((prev) => ({
        ...prev,
        productId: customProduct.id as number,
        productName: customProduct.name,
        productDescription: customProduct.description,
      }));
    }

    setIsCustomItemDialogOpen(false);
    setCustomItemData({ name: "", description: "" });
  };

  const handleUpdateTransaction = async (id: number) => {
    // Validate required fields
    if (!editFormData.productId) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        message: "Product is required",
      });
      return;
    }
    if (!editFormData.amount || editFormData.amount <= 0) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        message: "Amount must be greater than 0",
      });
      return;
    }

    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editFormData),
      });

      if (response.ok) {
        const updatedTransaction = await response.json();
        // Refresh current page after update
        setCurrentPage(1);
        setEditingId(null);
        setEditFormData({});
      } else {
        console.error("Failed to update transaction");
      }
    } catch (error) {
      console.error("Error updating transaction:", error);
    }
  };

  const handleAddTransaction = async () => {
    // Validate required fields
    if (!newTransaction.productId) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        message: "Product is required",
      });
      return;
    }
    if (!newTransaction.amount || newTransaction.amount <= 0) {
      setErrorDialog({
        open: true,
        title: "Validation Error",
        message: "Amount must be greater than 0",
      });
      return;
    }

    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newTransaction),
      });

      if (response.ok) {
        const addedTransaction = await response.json();
        // Put the newly added transaction at the top of the table immediately
        setTransactions((prev) => [addedTransaction, ...prev]);
        // Also reset to first page in case pagination is active
        setCurrentPage(1);
        setNewTransaction({
          type: "income",
          amount: 0,
          created_at: new Date().toISOString(),
        });
      } else {
        console.error("Failed to add transaction");
      }
    } catch (error) {
      console.error("Error adding transaction:", error);
    }
  };

  const handleDownloadExcel = useCallback(async () => {
    try {
      setIsDownloading(true);
      // Fetch all transactions for the selected year (without pagination)
      const response = await fetch(
        `/api/transactions?year=${selectedYear}&all=true&sortColumn=${sortColumn}&sortDirection=${sortDirection}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }
      const result: PaginatedResponse = await response.json();

      // Generate filename with year
      const filename = `counter-sale-transactions-${selectedYear}.xlsx`;

      // Export to Excel
      exportTransactionsToExcel(result.data, filename);
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
  }, [selectedYear, sortColumn, sortDirection, t]);

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
      // Fetch all transactions for the date range (without pagination)
      const response = await fetch(
        `/api/transactions?fromDate=${dateRange.fromDate}&toDate=${dateRange.toDate}&all=true&sortColumn=${sortColumn}&sortDirection=${sortDirection}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }
      const result: PaginatedResponse = await response.json();

      // Generate filename with date range
      const fromDateStr = dateRange.fromDate.replace(/-/g, "");
      const toDateStr = dateRange.toDate.replace(/-/g, "");
      const filename = `counter-sale-transactions-${fromDateStr}-${toDateStr}.xlsx`;

      // Export to Excel
      exportTransactionsToExcel(result.data, filename);

      // Close dialog and reset date range
      setIsDateRangeDialogOpen(false);
      setDateRange({ fromDate: "", toDate: "" });
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
  }, [dateRange, sortColumn, sortDirection, t]);

  const handleDownloadTemplate = useCallback(() => {
    exportTransactionsTemplate("counter-sale-template.xlsx");
  }, []);

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
        const message = `${t("importSuccess")}: ${
          result.successCount
        } transaction(s) imported.${
          result.errorCount > 0
            ? `\n\n${result.errorCount} error(s) occurred.`
            : ""
        }${
          result.errors && result.errors.length > 0
            ? `\n\nFirst few errors:\n${result.errors.slice(0, 3).join("\n")}`
            : ""
        }`;
        
        setErrorDialog({
          open: true,
          title: t("importSuccess"),
          message: message,
          isSuccess: result.errorCount === 0,
        });

        // Refresh transactions by resetting to page 1 and triggering refetch
        const wasOnPage1 = currentPage === 1;
        setCurrentPage(1);

        // Force refetch if already on page 1
        if (wasOnPage1) {
          try {
            const refreshResponse = await fetch(
              `/api/transactions?page=1&limit=${ITEMS_PER_PAGE}&sortColumn=${sortColumn}&sortDirection=${sortDirection}&year=${selectedYear}`
            );
            if (refreshResponse.ok) {
              const refreshResult: PaginatedResponse =
                await refreshResponse.json();
              setTransactions(refreshResult.data);
              const computedTotalPages = Math.max(
                1,
                Math.ceil(refreshResult.total / ITEMS_PER_PAGE)
              );
              setPageInfo({
                total: refreshResult.total,
                totalPages: computedTotalPages,
              });
              const years = getYearsFromDates(
                refreshResult.data.map((t) => t.created_at)
              );
              const currentYear = new Date().getFullYear();
              const yearsSet = new Set([currentYear, ...years]);
              setAllYears(Array.from(yearsSet).sort((a, b) => b - a));
            }
          } catch (refreshError) {
            console.error("Error refreshing transactions:", refreshError);
          }
        }

        // Reset file input
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
    [t, currentPage, sortColumn, sortDirection, selectedYear]
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
      const response = await fetch(`/api/transactions/${idToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // Rollback on failure
        setTransactions(previousTransactions);
        setPageInfo(previousPageInfo);
        console.error("Failed to delete transaction");
      }
    } catch (error) {
      // Rollback on error
      setTransactions(previousTransactions);
      setPageInfo(previousPageInfo);
      console.error("Error deleting transaction:", error);
    }
  }, [transactionToDelete, transactions, pageInfo]);

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();
      // Add "Others" option at the end
      const productsWithOthers: Product[] = [
        ...data,
        {
          id: 0, // Special ID for "Others"
          name: "Others",
          description: "Add a custom item",
        },
      ];
      setProducts(productsWithOthers);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/transactions?page=${currentPage}&limit=${ITEMS_PER_PAGE}&sortColumn=${sortColumn}&sortDirection=${sortDirection}&year=${selectedYear}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch transactions");
        }
        const result: PaginatedResponse = await response.json();
        setTransactions(result.data);
        const computedTotalPages = Math.max(
          1,
          Math.ceil(result.total / ITEMS_PER_PAGE)
        );
        console.log("Computed Total Pages:", result.total);
        setPageInfo({
          total: result.total,
          totalPages: computedTotalPages,
        });
        // Extract all years from transactions
        const years = getYearsFromDates(result.data.map((t) => t.created_at));
        // Always include the current year
        const currentYear = new Date().getFullYear();
        const yearsSet = new Set([currentYear, ...years]);
        setAllYears(Array.from(yearsSet).sort((a, b) => b - a)); // Sort descending
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
    fetchProducts();
  }, [currentPage, sortColumn, sortDirection, selectedYear]);

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2Icon className="mx-auto h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg md:text-2xl">{t("title")}</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              {t("pageDescription")}
            </CardDescription>
          </div>

          {/* Desktop controls */}
          <div className="hidden md:flex flex-col items-end gap-2 md:ml-auto">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">
                Year:
              </label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className="w-[150px] text-sm h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleDownloadExcel}
                disabled={isDownloading || isImporting}
                variant="outline"
                size="sm"
                className="h-10 text-sm whitespace-nowrap"
              >
                <FileDown className="mr-2 h-4 w-4" />
                {isDownloading ? t("downloading") : t("downloadExcel")}
              </Button>
              <Button
                onClick={handleDownloadTemplate}
                disabled={isDownloading || isImporting}
                variant="outline"
                size="sm"
                className="h-10 text-sm whitespace-nowrap"
              >
                <FileDown className="mr-2 h-4 w-4" />
                {t("downloadTemplate")}
              </Button>
              <Button
                onClick={handleImportClick}
                disabled={isDownloading || isImporting}
                variant="outline"
                size="sm"
                className="h-10 text-sm whitespace-nowrap"
              >
                <Upload className="mr-2 h-4 w-4" />
                {isImporting ? t("importing") : t("import")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
              <Button
                onClick={() => setIsDateRangeDialogOpen(true)}
                disabled={isDownloading || isImporting}
                variant="outline"
                size="sm"
                className="h-10 text-sm whitespace-nowrap"
              >
                <FileDown className="mr-2 h-4 w-4" />
                {t("downloadDateRange")}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              Total: {pageInfo.total.toLocaleString()}
            </div>
          </div>

          {/* Mobile controls */}
          <div className="md:hidden w-full">
            <div className="flex items-center gap-2 justify-between mb-2">
              <div className="flex items-center gap-1">
                <label className="text-xs font-medium whitespace-nowrap">
                  Year:
                </label>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => setSelectedYear(parseInt(value))}
                >
                  <SelectTrigger className="w-[90px] text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                Total: {pageInfo.total.toLocaleString()}
              </span>
              <Button
                size="sm"
                className="h-8 text-xs whitespace-nowrap"
                onClick={() => setIsAddFormOpen((prev) => !prev)}
              >
                {isAddFormOpen ? "Close" : "Add"}
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleDownloadExcel}
                disabled={isDownloading || isImporting}
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 min-w-[100px]"
              >
                <FileDown className="mr-1 h-3 w-3" />
                {isDownloading ? t("downloading") : t("downloadExcel")}
              </Button>
              <Button
                onClick={handleDownloadTemplate}
                disabled={isDownloading || isImporting}
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 min-w-[100px]"
              >
                <FileDown className="mr-1 h-3 w-3" />
                {t("downloadTemplate")}
              </Button>
              <Button
                onClick={handleImportClick}
                disabled={isDownloading || isImporting}
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 min-w-[100px]"
              >
                <Upload className="mr-1 h-3 w-3" />
                {isImporting ? t("importing") : t("import")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
              <Button
                onClick={() => setIsDateRangeDialogOpen(true)}
                disabled={isDownloading || isImporting}
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 min-w-[100px]"
              >
                <FileDown className="mr-1 h-3 w-3" />
                {t("downloadDateRange")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-56 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4">
                          Item
                        </TableHead>
                        <TableHead
                          className="w-32 cursor-pointer select-none whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4"
                          onClick={() => handleSort("type")}
                        >
                          Type {getSortIcon("type")}
                        </TableHead>
                        <TableHead
                          className="w-40 cursor-pointer select-none whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4"
                          onClick={() => handleSort("created_at")}
                        >
                          Date {getSortIcon("created_at")}
                        </TableHead>
                        <TableHead
                          className="w-28 cursor-pointer select-none whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4"
                          onClick={() => handleSort("amount")}
                        >
                          Amount {getSortIcon("amount")}
                        </TableHead>
                        <TableHead className="w-40 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4">
                          Customer Name
                        </TableHead>
                        <TableHead className="w-40 whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4">
                          Customer Number
                        </TableHead>
                        <TableHead className="w-20 px-2 sm:px-4"></TableHead>
                        <TableHead className="w-20 px-2 sm:px-4">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                      <TableRow>
                        <TableCell className="w-56 px-2 sm:px-4 overflow-hidden">
                          <Combobox
                            items={products}
                            placeholder="Select Item"
                            className="w-56 truncate"
                            value={newTransaction.productName}
                            onSelect={(productId) => {
                              if (productId === 0) {
                                // "Others" option selected
                                setSelectedComboboxContext("add");
                                setIsCustomItemDialogOpen(true);
                              } else {
                                setNewTransaction((prev) => ({
                                  ...prev,
                                  productId: productId as number,
                                  productName: products.find(
                                    (p) => p.id === productId
                                  )?.name,
                                  productDescription: products.find(
                                    (p) => p.id === productId
                                  )?.description,
                                }));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="w-32 px-2 sm:px-4 overflow-hidden">
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
                              <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-10 w-32">
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="income">Income</SelectItem>
                                <SelectItem value="expense">Expense</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="w-40 px-2 sm:px-4 overflow-hidden">
                          <Input
                            name="created_at"
                            type="date"
                            value={isoToDateInput(newTransaction.created_at)}
                            onChange={handleInputChange}
                            required
                            className="text-xs sm:text-sm h-8 sm:h-10 w-40"
                          />
                        </TableCell>
                        <TableCell className="w-28 px-2 sm:px-4 overflow-hidden">
                          <Input
                            name="amount"
                            type="number"
                            value={newTransaction.amount}
                            onChange={handleInputChange}
                            placeholder="Amount"
                            required
                            className="text-xs sm:text-sm h-8 sm:h-10 w-28"
                          />
                        </TableCell>
                        <TableCell className="w-40 px-2 sm:px-4 overflow-hidden">
                          <Input
                            name="customerName"
                            value={newTransaction.customerName || ""}
                            onChange={handleInputChange}
                            placeholder="Name"
                            className="text-xs sm:text-sm h-8 sm:h-10 w-40"
                          />
                        </TableCell>
                        <TableCell className="w-40 px-2 sm:px-4 overflow-hidden">
                          <Input
                            name="customerNumber"
                            value={newTransaction.customerNumber || ""}
                            onChange={handleInputChange}
                            placeholder="Number"
                            className="text-xs sm:text-sm h-8 sm:h-10 w-40"
                          />
                        </TableCell>
                        <TableCell className="w-20 px-2 sm:px-4">
                          <Button
                            onClick={handleAddTransaction}
                            disabled={!isAddFormValid()}
                            size="sm"
                            className="text-xs sm:text-sm h-8 sm:h-10"
                          >
                            Add
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getSortedTransactions().map((transaction) => (
                        <React.Fragment key={transaction.id}>
                          {/* Desktop Edit Row */}
                          {editingId === transaction.id ? (
                            <TableRow className="hidden md:table-row">
                              <TableCell className="w-56 px-2 sm:px-4 overflow-hidden">
                                <Combobox
                                  items={products}
                                  placeholder="Select Item"
                                  className="w-56 truncate"
                                  value={editFormData.productName}
                                  onSelect={(productId) => {
                                    if (productId === 0) {
                                      // "Others" option selected
                                      setSelectedComboboxContext("edit");
                                      setIsCustomItemDialogOpen(true);
                                    } else {
                                      setEditFormData((prev) => ({
                                        ...prev,
                                        productId: productId as number,
                                        productName: products.find(
                                          (p) => p.id === productId
                                        )?.name,
                                        productDescription: products.find(
                                          (p) => p.id === productId
                                        )?.description,
                                      }));
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="w-32 px-2 sm:px-4 overflow-hidden">
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
                                    <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-10 w-32">
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
                              <TableCell className="w-40 px-2 sm:px-4 overflow-hidden">
                                <Input
                                  name="created_at"
                                  type="date"
                                  value={isoToDateInput(
                                    editFormData.created_at ||
                                      transaction.created_at
                                  )}
                                  onChange={handleEditInputChange}
                                  className="text-xs sm:text-sm h-8 sm:h-10 w-40"
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
                                />
                              </TableCell>
                              <TableCell className="w-40 px-2 sm:px-4 overflow-hidden">
                                <Input
                                  name="customerName"
                                  value={editFormData.customerName || ""}
                                  onChange={handleEditInputChange}
                                  placeholder="Name"
                                  className="text-xs sm:text-sm h-8 sm:h-10 w-40"
                                />
                              </TableCell>
                              <TableCell className="w-40 px-2 sm:px-4 overflow-hidden">
                                <Input
                                  name="customerNumber"
                                  value={editFormData.customerNumber || ""}
                                  onChange={handleEditInputChange}
                                  placeholder="Number"
                                  className="text-xs sm:text-sm h-8 sm:h-10 w-40"
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
                                <TableCell className="w-56 px-2 sm:px-4 overflow-hidden">
                                  <div className="flex flex-col items-start py-1">
                                    <span className="text-xs sm:text-sm font-medium leading-tight">
                                      {transaction.productName || "-"}
                                    </span>
                                    {transaction.productDescription && (
                                      <span className="text-xs text-muted-foreground leading-snug">
                                        {transaction.productDescription}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="w-32 px-2 sm:px-4 overflow-hidden">
                                  <Badge
                                    variant={transaction.type}
                                    className="text-xs truncate"
                                  >
                                    {transaction.type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="w-40 text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">
                                  {formatDate(transaction.created_at, false, {
                                    year: "numeric",
                                    month: "short",
                                    day: "2-digit",
                                  })}
                                </TableCell>
                                <TableCell className="w-28 text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">
                                  Rs. {Math.floor(transaction.amount)}
                                </TableCell>
                                <TableCell
                                  className="w-40 text-xs sm:text-sm px-2 sm:px-4 overflow-hidden truncate"
                                  title={transaction.customerName || "-"}
                                >
                                  {transaction.customerName || "-"}
                                </TableCell>
                                <TableCell
                                  className="w-40 text-xs sm:text-sm px-2 sm:px-4 overflow-hidden truncate"
                                  title={transaction.customerNumber || "-"}
                                >
                                  {transaction.customerNumber || "-"}
                                </TableCell>
                                <TableCell className="w-20 px-2 sm:px-4 overflow-hidden">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        aria-haspopup="true"
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                      >
                                        <EllipsisVerticalIcon className="h-4 w-4" />
                                        <span className="sr-only">
                                          Toggle menu
                                        </span>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() =>
                                          handleOpenEdit(transaction)
                                        }
                                      >
                                        Edit
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setTransactionToDelete(transaction);
                                          setIsDeleteConfirmationOpen(true);
                                        }}
                                      >
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
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
          <div className="md:hidden space-y-3">
            {isAddFormOpen && (
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg space-y-3 border">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Item</label>
                  <Combobox
                    items={products}
                    placeholder="Select Item"
                    value={newTransaction.productName}
                    onSelect={(productId) => {
                      if (productId === 0) {
                        setSelectedComboboxContext("add");
                        setIsCustomItemDialogOpen(true);
                      } else {
                        setNewTransaction((prev) => ({
                          ...prev,
                          productId: productId as number,
                          productName: products.find((p) => p.id === productId)
                            ?.name,
                          productDescription: products.find(
                            (p) => p.id === productId
                          )?.description,
                        }));
                      }
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Amount</label>
                    <Input
                      name="amount"
                      type="number"
                      value={newTransaction.amount}
                      onChange={handleInputChange}
                      placeholder="Amount"
                      required
                      className="text-sm h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Type</label>
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
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Date</label>
                    <Input
                      name="created_at"
                      type="date"
                      value={isoToDateInput(newTransaction.created_at)}
                      onChange={handleInputChange}
                      required
                      className="text-sm h-9 w-full px-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Customer Name</label>
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
                  <label className="text-xs font-medium">Customer Number</label>
                  <Input
                    name="customerNumber"
                    value={newTransaction.customerNumber || ""}
                    onChange={handleInputChange}
                    placeholder="Number (Optional)"
                    className="text-sm h-9"
                  />
                </div>
                <Button
                  onClick={handleAddTransaction}
                  disabled={!isAddFormValid()}
                  className="w-full text-sm"
                >
                  Add Transaction
                </Button>
              </div>
            )}

            {/* Transaction Cards */}
            {getSortedTransactions().map((transaction) => (
              <div key={transaction.id}>
                {editingId === transaction.id ? (
                  // Mobile Edit Card
                  <div className="bg-white dark:bg-slate-900 border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="font-semibold text-sm">
                        Edit Transaction
                      </h4>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditFormData({});
                        }}
                        className="h-6 w-6"
                      >
                        ✕
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Item</label>
                      <Combobox
                        items={products}
                        placeholder="Select Item"
                        value={editFormData.productName}
                        onSelect={(productId) => {
                          if (productId === 0) {
                            setSelectedComboboxContext("edit");
                            setIsCustomItemDialogOpen(true);
                          } else {
                            setEditFormData((prev) => ({
                              ...prev,
                              productId: productId as number,
                              productName: products.find(
                                (p) => p.id === productId
                              )?.name,
                              productDescription: products.find(
                                (p) => p.id === productId
                              )?.description,
                            }));
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Type</label>
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
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="expense">Expense</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Date</label>
                      <Input
                        name="created_at"
                        type="date"
                        value={isoToDateInput(
                          editFormData.created_at || transaction.created_at
                        )}
                        onChange={handleEditInputChange}
                        className="text-sm h-9 w-full px-1"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Amount</label>
                      <Input
                        name="amount"
                        type="number"
                        value={editFormData.amount || ""}
                        onChange={handleEditInputChange}
                        placeholder="Amount"
                        className="text-sm h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">
                        Customer Name
                      </label>
                      <Input
                        name="customerName"
                        value={editFormData.customerName || ""}
                        onChange={handleEditInputChange}
                        placeholder="Name (Optional)"
                        className="text-sm h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">
                        Customer Number
                      </label>
                      <Input
                        name="customerNumber"
                        value={editFormData.customerNumber || ""}
                        onChange={handleEditInputChange}
                        placeholder="Number (Optional)"
                        className="text-sm h-9"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleUpdateTransaction(transaction.id)}
                        className="flex-1 text-sm"
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditFormData({});
                        }}
                        className="flex-1 text-sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Mobile Transaction Card
                  <div className="bg-white dark:bg-slate-900 border rounded-lg p-3 space-y-2">
                    <div className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded space-y-1">
                      <div className="font-medium">
                        {transaction.productName || "-"}
                      </div>
                      {transaction.productDescription && (
                        <div className="text-muted-foreground text-xs">
                          {transaction.productDescription}
                        </div>
                      )}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            aria-haspopup="true"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                          >
                            <EllipsisVerticalIcon className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleOpenEdit(transaction)}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setTransactionToDelete(transaction);
                              setIsDeleteConfirmationOpen(true);
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {(transaction.customerName ||
                      transaction.customerNumber) && (
                      <div className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded">
                        {transaction.customerName && (
                          <p className="font-medium text-gray-900 dark:text-white">
                            {transaction.customerName}
                          </p>
                        )}
                        {transaction.customerNumber && (
                          <p className="text-muted-foreground">
                            {transaction.customerNumber}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span>
                        {formatDate(transaction.created_at, false, {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        })}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        Rs. {Math.floor(transaction.amount)}
                      </span>
                      <span className="text-gray-400">|</span>
                      <Badge
                        variant={transaction.type}
                        className="text-[10px] px-2 py-0.5 capitalize"
                      >
                        {transaction.type}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pageInfo.total > ITEMS_PER_PAGE && pageInfo.totalPages > 1 && (
            <div className="mt-4 sm:mt-6">
              <Pagination>
                <PaginationContent className="flex-wrap gap-1">
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage((prev) => Math.max(prev - 1, 1));
                      }}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50 h-8 sm:h-10 text-xs sm:text-sm"
                          : "cursor-pointer h-8 sm:h-10 text-xs sm:text-sm"
                      }
                    />
                  </PaginationItem>

                  {Array.from({ length: pageInfo.totalPages }).map(
                    (_, index) => {
                      const pageNum = index + 1;
                      // Show first page, last page, current page, and pages around current
                      if (
                        pageNum === 1 ||
                        pageNum === pageInfo.totalPages ||
                        (pageNum >= currentPage - 1 &&
                          pageNum <= currentPage + 1)
                      ) {
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(pageNum);
                              }}
                              isActive={pageNum === currentPage}
                              className="h-8 w-8 sm:h-10 sm:w-10 text-xs sm:text-sm"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                      // Show ellipsis
                      if (
                        (pageNum === currentPage - 2 && currentPage > 3) ||
                        (pageNum === currentPage + 2 &&
                          currentPage < pageInfo.totalPages - 2)
                      ) {
                        return (
                          <PaginationItem key={`ellipsis-${pageNum}`}>
                            <span className="px-1 sm:px-1.5 py-2 text-xs sm:text-sm">
                              ...
                            </span>
                          </PaginationItem>
                        );
                      }
                      return null;
                    }
                  )}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage((prev) =>
                          Math.min(prev + 1, pageInfo.totalPages)
                        );
                      }}
                      className={
                        currentPage === pageInfo.totalPages
                          ? "pointer-events-none opacity-50 h-8 sm:h-10 text-xs sm:text-sm"
                          : "cursor-pointer h-8 sm:h-10 text-xs sm:text-sm"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
        {/* Remove card footer */}
      </Card>
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
              variant="destructive"
              onClick={handleDeleteTransaction}
              className="w-full sm:w-auto"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Item Dialog */}
      <Dialog
        open={isCustomItemDialogOpen}
        onOpenChange={setIsCustomItemDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px] max-w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              Add Custom Item
            </DialogTitle>
            <DialogDescription className="text-sm">
              Enter the name and description for your custom item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Item Name *</label>
              <Input
                placeholder="Enter item name"
                value={customItemData.name}
                onChange={(e) =>
                  setCustomItemData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                placeholder="Enter item description (optional)"
                value={customItemData.description}
                onChange={(e) =>
                  setCustomItemData((prev) => ({
                    ...prev,
                    description: e.target.value,
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
                setIsCustomItemDialogOpen(false);
                setCustomItemData({ name: "", description: "" });
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button onClick={handleAddCustomItem} className="w-full sm:w-auto">
              Add Item
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
        onOpenChange={(open) =>
          setErrorDialog((prev) => ({ ...prev, open }))
        }
        title={errorDialog.title}
        message={errorDialog.message}
        isSuccess={errorDialog.isSuccess}
      />
    </>
  );
}
