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

const ITEMS_PER_PAGE = 15;

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
          `/api/transactions?page=${currentPage}&limit=${ITEMS_PER_PAGE}&sortColumn=${sortColumn}&sortDirection=${sortDirection}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch transactions");
        }
        const result: PaginatedResponse = await response.json();
        setTransactions(result.data);
        setPageInfo({
          total: result.total,
          totalPages: result.totalPages,
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
  }, [currentPage, sortColumn, sortDirection]);

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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("pageDescription")}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Year:</label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-[150px]">
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
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort("id")}
                >
                  ID {getSortIcon("id")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort("description")}
                >
                  Description {getSortIcon("description")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort("type")}
                >
                  Type {getSortIcon("type")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort("created_at")}
                >
                  Date {getSortIcon("created_at")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort("amount")}
                >
                  Amount {getSortIcon("amount")}
                </TableHead>
                <TableHead></TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
              <TableRow>
                <TableCell>New</TableCell>
                <TableCell>
                  <Input
                    name="description"
                    value={newTransaction.description}
                    onChange={handleInputChange}
                    placeholder="Description (Required)"
                    required
                  />
                </TableCell>
                <TableCell>
                  <Select
                    defaultValue={newTransaction.type}
                    onValueChange={(value) =>
                      setNewTransaction({
                        ...newTransaction,
                        type: value as TransactionType,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    name="created_at"
                    type="date"
                    value={isoToDateInput(newTransaction.created_at)}
                    onChange={handleInputChange}
                    required
                  />
                </TableCell>
                <TableCell>
                  <Input
                    name="amount"
                    type="number"
                    value={newTransaction.amount}
                    onChange={handleInputChange}
                    placeholder="Amount (Required)"
                    required
                  />
                </TableCell>
                <TableCell>
                  <Button
                    onClick={handleAddTransaction}
                    disabled={!isAddFormValid()}
                  >
                    Add
                  </Button>
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getSortedTransactions().map((transaction) => (
                <React.Fragment key={transaction.id}>
                  {editingId === transaction.id ? (
                    <TableRow>
                      <TableCell>{transaction.id}</TableCell>
                      <TableCell>
                        <Input
                          name="description"
                          value={editFormData.description || ""}
                          onChange={handleEditInputChange}
                          placeholder="Description (Required)"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={editFormData.type || "income"}
                          onValueChange={(value) =>
                            setEditFormData({
                              ...editFormData,
                              type: value as TransactionType,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">Income</SelectItem>
                            <SelectItem value="expense">Expense</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          name="created_at"
                          type="date"
                          value={isoToDateInput(
                            editFormData.created_at || transaction.created_at
                          )}
                          onChange={handleEditInputChange}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          name="amount"
                          type="number"
                          value={editFormData.amount || ""}
                          onChange={handleEditInputChange}
                          placeholder="Amount (Required)"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleUpdateTransaction(transaction.id)
                            }
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
                          >
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableCell>{transaction.id}</TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell>
                        <Badge variant={transaction.type}>
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDate(transaction.created_at, false, {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        Rs. {Math.floor(transaction.amount)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-haspopup="true"
                              size="icon"
                              variant="ghost"
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
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pageInfo.totalPages > 1 && (
            <div className="mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage((prev) => Math.max(prev - 1, 1));
                      }}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
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
                            <span className="px-1.5 py-2">...</span>
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
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmationOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteTransaction}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
