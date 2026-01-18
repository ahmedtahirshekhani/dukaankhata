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
  Loader2Icon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit2Icon,
  DownloadIcon,
  Trash2Icon,
  SearchIcon,
  FilterIcon,
  ChevronDownIcon,
  XIcon,
  CalendarIcon,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { formatDate, getYearsFromDates } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UNITS_OF_MEASUREMENT } from "@/components/product-dialog";

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
    quantity: 1,
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

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    type: "all",
  });
  const [amountRange, setAmountRange] = useState({
    min: "",
    max: "",
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
    } else if (name === "unitPrice" || name === "quantity") {
      const numValue = parseFloat(value) || 0;
      setNewTransaction((prev) => {
        const updated = { ...prev, [name]: numValue };
        // Auto-calculate amount
        const price = name === "unitPrice" ? numValue : (prev.unitPrice || 0);
        const qty = name === "quantity" ? numValue : (prev.quantity || 0);
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
        const price = name === "unitPrice" ? numValue : (prev.unitPrice || 0);
        const qty = name === "quantity" ? numValue : (prev.quantity || 0);
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

  const handleAddCustomItem = () => {
    if (!customItemData.name.trim()) {
      alert("Item name is required");
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
      alert("Product is required");
      return;
    }
    if (!editFormData.amount || editFormData.amount <= 0) {
      alert("Amount must be greater than 0");
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

        // Update the transaction in the local state
        setTransactions((prev) =>
          prev.map((t) => (t.id === id ? updatedTransaction : t))
        );

        // Close edit mode
        setEditingId(null);
        setEditFormData({});
      } else {
        alert("Failed to update transaction");
        console.error("Failed to update transaction");
      }
    } catch (error) {
      alert("Error updating transaction");
      console.error("Error updating transaction:", error);
    }
  };

  const handleAddTransaction = async () => {
    // Validate required fields
    if (!newTransaction.productId) {
      alert("Product is required");
      return;
    }
    if (!newTransaction.amount || newTransaction.amount <= 0) {
      alert("Amount must be greater than 0");
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
              background-color: ${
                transaction.type === "income" ? "#d1fae5" : "#fee2e2"
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
              ${
                transaction.productDescription
                  ? `<div class="item-description">${transaction.productDescription}</div>`
                  : ""
              }
              <div class="detail-row">
                <span class="detail-label">Unit Price:</span>
                <span class="detail-value">Rs. ${transaction.unitPrice || 0}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">UOM:</span>
                <span class="detail-value">${transaction.uom || "N/A"}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Quantity:</span>
                <span class="detail-value">${transaction.quantity || 1}</span>
              </div>
            </div>
            
            ${
              transaction.customerName || transaction.customerNumber
                ? `
            <hr class="divider">
            
            <!-- Customer Details -->
            <div class="receipt-section">
              <div class="section-title">Customer Details</div>
              ${
                transaction.customerName
                  ? `
              <div class="detail-row">
                <span class="detail-label">Name:</span>
                <span class="detail-value">${transaction.customerName}</span>
              </div>
              `
                  : ""
              }
              ${
                transaction.customerNumber
                  ? `
              <div class="detail-row">
                <span class="detail-label">Contact:</span>
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
                transaction.amount
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
          <div className="hidden md:flex flex-col items-end gap-1 md:ml-auto">
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
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              Total: {pageInfo.total.toLocaleString()}
            </div>
          </div>

          {/* Mobile controls */}
          <div className="md:hidden w-full">
            <div className="flex items-center gap-2 justify-between">
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
          </div>
        </CardHeader>

        <CardContent>
          {/* Filter Section - Desktop */}
          <div className="hidden md:block -mx-6 -mt-6 mb-6 px-6 py-4 border-b">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative w-48 flex-shrink-0">
                <Input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pr-8 h-9 text-sm"
                />
                <SearchIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>

              {/* Type Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 h-9 text-xs flex-shrink-0"
                  >
                    <span className="text-muted-foreground hidden sm:inline">
                      Type:
                    </span>
                    <span>{filters.type === "all" ? "All" : filters.type}</span>
                    <ChevronDownIcon className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuLabel>Type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={filters.type === "all"}
                    onCheckedChange={() => handleFilterChange("type", "all")}
                  >
                    All
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filters.type === "income"}
                    onCheckedChange={() => handleFilterChange("type", "income")}
                  >
                    Income
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={filters.type === "expense"}
                    onCheckedChange={() =>
                      handleFilterChange("type", "expense")
                    }
                  >
                    Expense
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Amount Range Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 h-9 flex-shrink-0"
                  >
                    <FilterIcon className="w-3 h-3" />
                    <span className="text-xs hidden sm:inline">Amount</span>
                    <ChevronDownIcon className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 sm:w-80 p-4">
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold">
                      Amount Range
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={amountRange.min}
                        onChange={(e) =>
                          handleAmountRangeChange("min", e.target.value)
                        }
                        className="h-8 text-xs"
                      />
                      <Input
                        type="number"
                        placeholder="Max"
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

              {/* Reset Filters Button */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllFilters}
                  className="h-9 w-9 md:w-auto md:px-3 p-0 flex-shrink-0"
                >
                  <XIcon className="w-4 h-4" />
                  <span className="hidden md:inline md:ml-1 text-xs">
                    Clear
                  </span>
                </Button>
              )}
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-48 whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4">
                          Item
                        </TableHead>
                        <TableHead className="w-28 whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4">
                          Unit Price
                        </TableHead>
                        <TableHead className="w-24 whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4">
                          UOM
                        </TableHead>
                        <TableHead className="w-20 whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4">
                          Qty
                        </TableHead>
                        <TableHead
                          className="w-32 cursor-pointer select-none whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4"
                          onClick={() => handleSort("amount")}
                        >
                          Amount {getSortIcon("amount")}
                        </TableHead>
                        <TableHead
                          className="w-28 cursor-pointer select-none whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4"
                          onClick={() => handleSort("type")}
                        >
                          Type {getSortIcon("type")}
                        </TableHead>
                        <TableHead
                          className="w-36 cursor-pointer select-none whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4"
                          onClick={() => handleSort("created_at")}
                        >
                          Date {getSortIcon("created_at")}
                        </TableHead>
                        <TableHead className="w-36 whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4">
                          Customer Name
                        </TableHead>
                        <TableHead className="w-36 whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4">
                          Customer Number
                        </TableHead>
                        <TableHead className="w-20 px-2 sm:px-4"></TableHead>
                        <TableHead className="w-20 px-2 sm:px-4">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                      <TableRow>
                        <TableCell className="w-40 px-2 sm:px-4 overflow-hidden">
                          <Combobox
                            items={products}
                            placeholder="Select Item"
                            className="w-40 truncate"
                            value={newTransaction.productName}
                            onSelect={(productId) => {
                              if (productId === 0) {
                                // "Others" option selected
                                setSelectedComboboxContext("add");
                                setNewTransaction((prev) => ({
                                  ...prev,
                                  unitPrice: 0,
                                  quantity: 1,
                                  amount: 0,
                                  uom: "unit",
                                }));
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
                                  unitPrice: products.find(
                                    (p) => p.id === productId
                                  )?.sell_price || 0,
                                  uom: products.find(
                                (p) => p.id === productId
                              )?.unit_of_measurement || "unit",
                                  quantity: 1, // Default quantity
                                  amount: (products.find(
                                    (p) => p.id === productId
                                  )?.sell_price || 0) * 1,
                                }));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="w-24 px-2 sm:px-4 overflow-hidden">
                          <Input
                            name="unitPrice"
                            type="number"
                            value={newTransaction.unitPrice || ""}
                            onChange={handleInputChange}
                            placeholder="Price"
                            className="text-xs sm:text-sm h-8 sm:h-10 w-24"
                            required
                          />
                        </TableCell>
                        <TableCell className="w-20 px-2 sm:px-4 overflow-hidden">
                          <Select
                            value={newTransaction.uom}
                            onValueChange={(value) => handleUOMChange(value, false)}
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
                            placeholder="Qty"
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
                            placeholder="Amount"
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
                                <SelectValue placeholder="Type" />
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
                            <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer" onClick={(e) => { (e.currentTarget.previousElementSibling as HTMLInputElement)?.showPicker?.(); }} />
                          </div>
                        </TableCell>
                        <TableCell className="w-32 px-2 sm:px-4 overflow-hidden">
                          <Input
                            name="customerName"
                            value={newTransaction.customerName || ""}
                            onChange={handleInputChange}
                            placeholder="Name"
                            className="text-xs sm:text-sm h-8 sm:h-10 w-32"
                          />
                        </TableCell>
                        <TableCell className="w-32 px-2 sm:px-4 overflow-hidden">
                          <Input
                            name="customerNumber"
                            value={newTransaction.customerNumber || ""}
                            onChange={handleInputChange}
                            placeholder="Number"
                            className="text-xs sm:text-sm h-8 sm:h-10 w-32"
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
                      {filteredTransactions.map((transaction) => (
                        <React.Fragment key={transaction.id}>
                          {/* Desktop Edit Row */}
                          {editingId === transaction.id ? (
                            <TableRow className="hidden md:table-row">
                              <TableCell className="w-40 px-2 sm:px-4 overflow-hidden">
                                <Combobox
                                  items={products}
                                  placeholder="Select Item"
                                  className="w-40 truncate"
                                  value={editFormData.productName}
                                  onSelect={(productId) => {
                                    if (productId === 0) {
                                      // "Others" option selected
                                      setSelectedComboboxContext("edit");
                                      setEditFormData((prev) => ({
                                        ...prev,
                                        unitPrice: 0,
                                        quantity: 1,
                                        amount: 0,
                                        uom: "unit",
                                      }));
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
                                        unitPrice: products.find(
                                          (p) => p.id === productId
                                        )?.sell_price || 0,
                                        uom: products.find(
                                          (p) => p.id === productId
                                        )?.unit_of_measurement || "unit",
                                        quantity: 1,
                                        amount: (products.find(
                                          (p) => p.id === productId
                                        )?.sell_price || 0) * 1,
                                      }));
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="w-24 px-2 sm:px-4 overflow-hidden">
                                <Input
                                  name="unitPrice"
                                  type="number"
                                  value={editFormData.unitPrice || ""}
                                  onChange={handleEditInputChange}
                                  placeholder="Price"
                                  className="text-xs sm:text-sm h-8 sm:h-10 w-24"
                                  required
                                />
                              </TableCell>
                              <TableCell className="w-20 px-2 sm:px-4 overflow-hidden">
                                <Select
                                  value={editFormData.uom}
                                  onValueChange={(value) => handleUOMChange(value, true)}
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
                                  value={editFormData.quantity || ""}
                                  onChange={handleEditInputChange}
                                  placeholder="Qty"
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
                                        transaction.created_at
                                    )}
                                    onChange={handleEditInputChange}
                                    className="text-xs sm:text-sm h-8 sm:h-10 w-full pr-8 [&::-webkit-calendar-picker-indicator]:opacity-0 cursor-pointer"
                                  />
                                  <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer" onClick={(e) => { (e.currentTarget.previousElementSibling as HTMLInputElement)?.showPicker?.(); }} />
                                </div>
                              </TableCell>
                              <TableCell className="w-32 px-2 sm:px-4 overflow-hidden">
                                <Input
                                  name="customerName"
                                  value={editFormData.customerName || ""}
                                  onChange={handleEditInputChange}
                                  placeholder="Name"
                                  className="text-xs sm:text-sm h-8 sm:h-10 w-32"
                                />
                              </TableCell>
                              <TableCell className="w-32 px-2 sm:px-4 overflow-hidden">
                                <Input
                                  name="customerNumber"
                                  value={editFormData.customerNumber || ""}
                                  onChange={handleEditInputChange}
                                  placeholder="Number"
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
                                        {transaction.productDescription}
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
                                    <Button
                                      aria-haspopup="true"
                                      size="icon"
                                      variant="ghost"
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
                        setNewTransaction((prev) => ({
                          ...prev,
                          unitPrice: 0,
                          quantity: 1,
                          amount: 0,
                          uom: "unit",
                        }));
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
                          unitPrice: products.find(
                            (p) => p.id === productId
                          )?.sell_price || 0,
                          uom: products.find(
                            (p) => p.id === productId
                          )?.unit_of_measurement || "unit",
                          quantity: 1,
                          amount: (products.find(
                            (p) => p.id === productId
                          )?.sell_price || 0) * 1,
                        }));
                      }
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Unit Price</label>
                    <Input
                      name="unitPrice"
                      type="number"
                      value={newTransaction.unitPrice || ""}
                      onChange={handleInputChange}
                      placeholder="Price"
                      className="text-sm h-9"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">UOM</label>
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
                    <label className="text-xs font-medium">Quantity</label>
                    <Input
                      name="quantity"
                      type="number"
                      value={newTransaction.quantity || ""}
                      onChange={handleInputChange}
                      placeholder="Qty"
                      className="text-sm h-9"
                      required
                    />
                  </div>
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
                      readOnly
                    />
                  </div>
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

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Date</label>
                    <div className="relative">
                      <Input
                        name="created_at"
                        type="date"
                        value={isoToDateInput(newTransaction.created_at)}
                        onChange={handleInputChange}
                        required
                        className="text-sm h-9 w-full pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 cursor-pointer"
                      />
                      <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer" onClick={(e) => { (e.currentTarget.previousElementSibling as HTMLInputElement)?.showPicker?.(); }} />
                    </div>
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

            {/* Mobile Filter Section */}
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border">
              <div className="flex flex-col gap-3">
                {/* Search */}
                <div className="relative w-full">
                  <Input
                    type="text"
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={handleSearch}
                    className="pr-8 h-9 text-sm w-full"
                  />
                  <SearchIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {/* Type Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-9 text-xs flex-shrink-0"
                      >
                        <span className="text-muted-foreground">Type:</span>
                        <span>{filters.type === "all" ? "All" : filters.type}</span>
                        <ChevronDownIcon className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[200px]">
                      <DropdownMenuLabel>Type</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={filters.type === "all"}
                        onCheckedChange={() => handleFilterChange("type", "all")}
                      >
                        All
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filters.type === "income"}
                        onCheckedChange={() => handleFilterChange("type", "income")}
                      >
                        Income
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filters.type === "expense"}
                        onCheckedChange={() => handleFilterChange("type", "expense")}
                      >
                        Expense
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Amount Range Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 h-9 flex-shrink-0"
                      >
                        <FilterIcon className="w-3 h-3" />
                        <span className="text-xs">Amount</span>
                        <ChevronDownIcon className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[280px] p-4">
                      <div className="space-y-3">
                        <Label className="text-xs font-semibold">
                          Amount Range
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Min"
                            value={amountRange.min}
                            onChange={(e) =>
                              handleAmountRangeChange("min", e.target.value)
                            }
                            className="h-8 text-xs"
                          />
                          <Input
                            type="number"
                            placeholder="Max"
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

                  {/* Reset Filters Button */}
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAllFilters}
                      className="h-9 px-2 flex-shrink-0 text-xs"
                    >
                      <XIcon className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Transaction Cards */}
            {filteredTransactions.map((transaction) => (
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
                            setEditFormData((prev) => ({
                              ...prev,
                              unitPrice: 0,
                              quantity: 1,
                              amount: 0,
                              uom: "unit",
                            }));
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
                              unitPrice: products.find(
                                (p) => p.id === productId
                              )?.sell_price || 0,
                              uom: products.find(
                                (p) => p.id === productId
                              )?.unit_of_measurement || "unit",
                              quantity: 1,
                              amount: (products.find(
                                (p) => p.id === productId
                              )?.sell_price || 0) * 1,
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
                    <div className="grid grid-cols-2 gap-2">
                       <div className="space-y-2">
                        <label className="text-xs font-medium">Unit Price</label>
                        <Input
                          name="unitPrice"
                          type="number"
                          value={editFormData.unitPrice || ""}
                          onChange={handleEditInputChange}
                          placeholder="Price"
                          className="text-sm h-9"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium">UOM</label>
                        <Select
                          value={editFormData.uom}
                          onValueChange={(value) => handleUOMChange(value, true)}
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
                        <label className="text-xs font-medium">Quantity</label>
                        <Input
                          name="quantity"
                          type="number"
                          value={editFormData.quantity || ""}
                          onChange={handleEditInputChange}
                          placeholder="Qty"
                          className="text-sm h-9"
                          required
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
                          readOnly
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Date</label>
                      <div className="relative">
                        <Input
                          name="created_at"
                          type="date"
                          value={isoToDateInput(
                            editFormData.created_at || transaction.created_at
                          )}
                          onChange={handleEditInputChange}
                          className="text-sm h-9 w-full pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 cursor-pointer"
                        />
                        <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer" onClick={(e) => { (e.currentTarget.previousElementSibling as HTMLInputElement)?.showPicker?.(); }} />
                      </div>
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
                       <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
                        {transaction.unitPrice && (
                          <span>
                            Price: Rs. {transaction.unitPrice}
                            {transaction.uom ? `/${transaction.uom}` : ""}
                          </span>
                        )}
                        {transaction.quantity && (
                          <span>Qty: {transaction.quantity}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex gap-2">
                        <Button
                          aria-haspopup="true"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleOpenEdit(transaction)}
                          title="Edit"
                        >
                          <Edit2Icon className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          aria-haspopup="true"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleDownloadPDF(transaction)}
                          title="Download"
                        >
                          <DownloadIcon className="h-4 w-4" />
                          <span className="sr-only">Download</span>
                        </Button>
                        <Button
                          aria-haspopup="true"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setTransactionToDelete(transaction);
                            setIsDeleteConfirmationOpen(true);
                          }}
                          title="Delete"
                        >
                          <Trash2Icon className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
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
    </>
  );
}
