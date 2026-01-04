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
import {
  EllipsisVerticalIcon,
  Loader2Icon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { formatDate, getYearsFromDates } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TransactionType = "income" | "expense";

const ITEMS_PER_PAGE = 25;

interface Transaction {
  id: number;
  description: string;
  type: TransactionType;
  created_at: string;
  amount: number;
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
    description: "",
    type: "income",
    amount: 0,
    created_at: new Date().toISOString(),
  });
  const [editFormData, setEditFormData] = useState<Partial<Transaction>>({});

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
      newTransaction.description?.trim() &&
      newTransaction.amount &&
      newTransaction.amount > 0
    );
  };

  const handleOpenEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditFormData({
      description: transaction.description,
      type: transaction.type,
      amount: transaction.amount,
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

  const handleUpdateTransaction = async (id: number) => {
    // Validate required fields
    if (!editFormData.description?.trim()) {
      alert("Description is required");
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
    if (!newTransaction.description?.trim()) {
      alert("Description is required");
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
          description: "",
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
    try {
      const response = await fetch(
        `/api/transactions/${transactionToDelete.id}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        // Refresh current page after deletion
        setCurrentPage(1);
        setIsDeleteConfirmationOpen(false);
        setTransactionToDelete(null);
      } else {
        console.error("Failed to delete transaction");
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  }, [transactionToDelete]);

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
            <CardDescription className="text-xs md:text-sm">{t("pageDescription")}</CardDescription>
          </div>

          {/* Desktop controls */}
          <div className="hidden md:flex flex-col items-end gap-1 md:ml-auto">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">Year:</label>
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
                <label className="text-xs font-medium whitespace-nowrap">Year:</label>
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
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">Total: {pageInfo.total.toLocaleString()}</span>
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
          {/* Desktop Table View */}
          <div className="hidden md:block">
          <div className="overflow-x-auto -mx-4 md:mx-0">
          <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4"
                  onClick={() => handleSort("id")}
                >
                  ID {getSortIcon("id")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4 min-w-[150px]"
                  onClick={() => handleSort("description")}
                >
                  Description {getSortIcon("description")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4"
                  onClick={() => handleSort("type")}
                >
                  Type {getSortIcon("type")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4"
                  onClick={() => handleSort("created_at")}
                >
                  Date {getSortIcon("created_at")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap text-xs sm:text-sm px-2 sm:px-4"
                  onClick={() => handleSort("amount")}
                >
                  Amount {getSortIcon("amount")}
                </TableHead>
                <TableHead className="px-2 sm:px-4"></TableHead>
                <TableHead className="px-2 sm:px-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs sm:text-sm px-2 sm:px-4">New</TableCell>
                <TableCell className="px-2 sm:px-4">
                  <Input
                    name="description"
                    value={newTransaction.description}
                    onChange={handleInputChange}
                    placeholder="Description"
                    required
                    className="text-xs sm:text-sm h-8 sm:h-10 min-w-[120px]"
                  />
                </TableCell>
                <TableCell className="px-2 sm:px-4">
                  <Select
                    defaultValue={newTransaction.type}
                    onValueChange={(value) =>
                      setNewTransaction({
                        ...newTransaction,
                        type: value as TransactionType,
                      })
                    }
                  >
                    <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-10 w-[90px] sm:w-[110px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="px-2 sm:px-4">
                  <Input
                    name="created_at"
                    type="date"
                    value={isoToDateInput(newTransaction.created_at)}
                    onChange={handleInputChange}
                    required
                    className="text-xs sm:text-sm h-8 sm:h-10 w-[120px] sm:w-[140px]"
                  />
                </TableCell>
                <TableCell className="px-2 sm:px-4">
                  <Input
                    name="amount"
                    type="number"
                    value={newTransaction.amount}
                    onChange={handleInputChange}
                    placeholder="Amount"
                    required
                    className="text-xs sm:text-sm h-8 sm:h-10 w-[90px] sm:w-[110px]"
                  />
                </TableCell>
                <TableCell className="px-2 sm:px-4">
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
                      <TableCell className="text-xs sm:text-sm px-2 sm:px-4">{transaction.id}</TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <Input
                          name="description"
                          value={editFormData.description || ""}
                          onChange={handleEditInputChange}
                          placeholder="Description"
                          className="text-xs sm:text-sm h-8 sm:h-10 min-w-[120px]"
                        />
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <Select
                          value={editFormData.type || "income"}
                          onValueChange={(value) =>
                            setEditFormData({
                              ...editFormData,
                              type: value as TransactionType,
                            })
                          }
                        >
                          <SelectTrigger className="text-xs sm:text-sm h-8 sm:h-10 w-[90px] sm:w-[110px]">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">Income</SelectItem>
                            <SelectItem value="expense">Expense</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <Input
                          name="created_at"
                          type="date"
                          value={isoToDateInput(
                            editFormData.created_at || transaction.created_at
                          )}
                          onChange={handleEditInputChange}
                          className="text-xs sm:text-sm h-8 sm:h-10 w-[120px] sm:w-[140px] px-1"
                        />
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
                        <Input
                          name="amount"
                          type="number"
                          value={editFormData.amount || ""}
                          onChange={handleEditInputChange}
                          placeholder="Amount"
                          className="text-xs sm:text-sm h-8 sm:h-10 w-[90px] sm:w-[110px]"
                        />
                      </TableCell>
                      <TableCell className="px-2 sm:px-4">
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
                        <TableCell className="text-xs sm:text-sm px-2 sm:px-4">{transaction.id}</TableCell>
                        <TableCell className="text-xs sm:text-sm px-2 sm:px-4 whitespace-normal break-words min-w-[150px]">{transaction.description}</TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <Badge variant={transaction.type} className="text-xs">
                            {transaction.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">
                          {formatDate(transaction.created_at, false, {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm px-2 sm:px-4 whitespace-nowrap">
                          Rs. {Math.floor(transaction.amount)}
                        </TableCell>
                        <TableCell className="px-2 sm:px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                aria-haspopup="true"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
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
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-2">
                    <label className="text-xs font-medium">Description</label>
                    <Input
                      name="description"
                      value={newTransaction.description}
                      onChange={handleInputChange}
                      placeholder="Description"
                      required
                      className="text-sm h-9"
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
                    />
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-3 space-y-2">
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
                  <div className="col-span-2 space-y-2">
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
                      <h4 className="font-semibold text-sm">Edit Transaction #{transaction.id}</h4>
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
                      <label className="text-xs font-medium">Description</label>
                      <Input
                        name="description"
                        value={editFormData.description || ""}
                        onChange={handleEditInputChange}
                        placeholder="Description"
                        className="text-sm h-9"
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
                    <div className="flex gap-2">
                      <Button
                        onClick={() =>
                          handleUpdateTransaction(transaction.id)
                        }
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white break-words">
                          {transaction.description}
                        </p>
                        <span className="text-[11px] text-muted-foreground">Txn #{transaction.id}</span>
                      </div>
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
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span>{formatDate(transaction.created_at, false, {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      })}</span>
                      <span className="text-gray-400">|</span>
                      <span className="font-semibold text-gray-900 dark:text-white">Rs. {Math.floor(transaction.amount)}</span>
                      <span className="text-gray-400">|</span>
                      <Badge variant={transaction.type} className="text-[10px] px-2 py-0.5 capitalize">
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
                            <span className="px-1 sm:px-1.5 py-2 text-xs sm:text-sm">...</span>
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
            <DialogTitle className="text-lg sm:text-xl">Confirm Deletion</DialogTitle>
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
    </>
  );
}
