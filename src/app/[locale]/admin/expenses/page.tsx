"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import CreatableSelect from "react-select/creatable";
import { useOfflineExpenses } from "@/lib/hooks/useOfflineData";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";
import {
  PlusCircle,
  Trash2,
  Edit,
  Loader2,
  Edit2,
  Search,
  X,
  FilterIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SelectOption = {
  value: string;
  label: string;
};

type ExpenseLine = {
  id: string;
  category: string;
  itemName: string;
  qty: string;
  rate: string;
};

type ExpenseRow = {
  id: string;
  expenseNumber: string;
  date: string;
  category: string;
  itemName: string;
  qty: number;
  rate: number;
  amount: number;
};

const defaultCategories = [
  "Petrol",
  "Rent",
  "Salary",
  "Tea",
  "Electricity",
  "Transport",
  "Internet",
  "Maintenance",
];

function generateExpenseNumber() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `EXP-${timestamp}-${random}`;
}

const generateObjectId = () => {
  const timestamp = Math.floor(new Date().getTime() / 1000).toString(16);
  const randomString = Math.random().toString(16).substring(2, 18);
  return timestamp + randomString.substring(0, 16);
};

function createLine(): ExpenseLine {
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    category: "",
    itemName: "",
    qty: "1",
    rate: "",
  };
}

function formatNumber(value: number): string {
  const normalized = Number(Number(value || 0).toFixed(2));
  return normalized.toString();
}

function parseNumericInput(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ExpensesPage() {
  const locale = useLocale();
  const t = useTranslations("expenses");
  const tCommon = useTranslations("common");

  const [expenseNumber, setExpenseNumber] = useState(generateExpenseNumber());
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [lines, setLines] = useState<ExpenseLine[]>([createLine()]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const offlineExpenses = useOfflineExpenses(searchQuery);
  const isLoading = offlineExpenses === undefined;
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRow | null>(
    null,
  );
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseRow | null>(
    null,
  );
  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>(
    defaultCategories.map((value) => ({ value, label: value })),
  );
  const [itemOptions, setItemOptions] = useState<SelectOption[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    message: string;
    title?: string;
    isSuccess?: boolean;
  }>({ open: false, message: "" });

  const [editExpenseNumber, setEditExpenseNumber] = useState("");
  const [editExpenseDate, setEditExpenseDate] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editItemName, setEditItemName] = useState("");
  const [editQty, setEditQty] = useState("1");
  const [editRate, setEditRate] = useState("");

  const lineTotals = useMemo(() => {
    return lines.map((line) => {
      const qty = parseNumericInput(line.qty);
      const rate = parseNumericInput(line.rate);
      return Number((qty * rate).toFixed(2));
    });
  }, [lines]);

  const grandTotal = useMemo(() => {
    return Number(lineTotals.reduce((sum, value) => sum + value, 0).toFixed(2));
  }, [lineTotals]);

  const mergeOptions = useCallback(
    (existing: SelectOption[], values: string[]) => {
      const map = new Map(existing.map((option) => [option.value, option]));
      values.forEach((value) => {
        const trimmed = value.trim();
        if (trimmed) {
          map.set(trimmed, { value: trimmed, label: trimmed });
        }
      });
      return Array.from(map.values()).sort((a, b) =>
        a.label.localeCompare(b.label),
      );
    },
    [],
  );

  const fetchExpensesData = useCallback(async () => {
    try {
      const categories = new Set(defaultCategories);
      const items = new Set<string>();

      if (offlineExpenses) {
        offlineExpenses.forEach((expense) => {
          if (expense.category) categories.add(expense.category);
          if (expense.itemName) items.add(expense.itemName);
        });
      }

      setCategoryOptions(
        Array.from(categories)
          .map((value) => ({ value, label: value }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      );
      setItemOptions(
        Array.from(items)
          .map((value) => ({ value, label: value }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      );

      let filtered = offlineExpenses ? [...offlineExpenses] : [];
      if (filterCategory !== "all") {
        filtered = filtered.filter(
          (expense) => expense.category === filterCategory,
        );
      }

      filtered.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      setTotalCount(filtered.length);
      setTotalPages(Math.ceil(filtered.length / pageSize) || 1);

      const startIndex = (page - 1) * pageSize;
      const paginated = filtered.slice(startIndex, startIndex + pageSize);
      setExpenses(paginated);
    } catch {
      setCategoryOptions((prev) => mergeOptions(prev, defaultCategories));
    }
  }, [offlineExpenses, mergeOptions, page, pageSize, filterCategory]);

  useEffect(() => {
    fetchExpensesData();
  }, [fetchExpensesData]);

  const updateLine = <K extends keyof ExpenseLine>(
    id: string,
    key: K,
    value: ExpenseLine[K],
  ) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [key]: value } : line)),
    );
  };

  const addRow = () => {
    setLines((prev) => [...prev, createLine()]);
  };

  const removeRow = (id: string) => {
    setLines((prev) =>
      prev.length > 1 ? prev.filter((line) => line.id !== id) : prev,
    );
  };

  const handleCreateCategory = (lineId: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setCategoryOptions((prev) => mergeOptions(prev, [trimmed]));
    updateLine(lineId, "category", trimmed);
  };

  const handleCreateItem = (lineId: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setItemOptions((prev) => mergeOptions(prev, [trimmed]));
    updateLine(lineId, "itemName", trimmed);
  };

  const resetForm = () => {
    setExpenseNumber(generateExpenseNumber());
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setLines([createLine()]);
  };

  const openAddDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const handleSave = async () => {
    if (!expenseNumber.trim() || !expenseDate) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("numberDateRequired"),
      });
      return;
    }

    const isInvalidLine = lines.some((line) => {
      const qty = parseNumericInput(line.qty);
      const rate = parseNumericInput(line.rate);
      return (
        !line.category.trim() ||
        !line.itemName.trim() ||
        qty <= 0 ||
        rate < 0 ||
        qty * rate <= 0
      );
    });

    if (isInvalidLine) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("lineValidationError"),
      });
      return;
    }

    setIsSaving(true);
    try {
      const payloadItems = lines.map((line) => ({
        id: generateObjectId(),
        qty: Number(parseNumericInput(line.qty)),
        rate: Number(parseNumericInput(line.rate)),
        category: line.category.trim(),
        itemName: line.itemName.trim(),
        amount: Number(
          (parseNumericInput(line.qty) * parseNumericInput(line.rate)).toFixed(
            2,
          ),
        ),
      }));

      const payload = {
        expenseNumber,
        date: expenseDate,
        items: payloadItems,
      };

      const expenseDocs = payload.items.map((item) => {
        return {
          id: item.id,
          expenseNumber: payload.expenseNumber,
          date: payload.date,
          category: item.category,
          itemName: item.itemName,
          qty: item.qty,
          rate: item.rate,
          amount: item.amount,
          created_at: new Date().toISOString(),
        };
      });

      // Save to local Dexie
      await db.expenses.bulkPut(expenseDocs);

      // Queue sync
      await SyncEngine.queueOperation(
        "expenses",
        "POST",
        `/api/expenses`,
        payload,
      );

      setErrorDialog({
        open: true,
        title: tCommon("success"),
        message: t("createdSuccess"),
        isSuccess: true,
      });

      setShowAddDialog(false);
      resetForm();
      setPage(1);
    } catch (err) {
      setErrorDialog({
        open: true,
        title: tCommon("error"),
        message: err instanceof Error ? err.message : t("failedToSave"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (expense: ExpenseRow) => {
    setSelectedExpense(expense);
    setEditExpenseNumber(expense.expenseNumber || "");
    setEditExpenseDate(expense.date || "");
    setEditCategory(expense.category || "");
    setEditItemName(expense.itemName || "");
    setEditQty((expense.qty || 0).toString());
    setEditRate((expense.rate || 0).toString());
    setShowEditDialog(true);
  };

  const handleCreateEditCategory = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setCategoryOptions((prev) => mergeOptions(prev, [trimmed]));
    setEditCategory(trimmed);
  };

  const handleCreateEditItem = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setItemOptions((prev) => mergeOptions(prev, [trimmed]));
    setEditItemName(trimmed);
  };

  const handleUpdateExpense = async () => {
    if (!selectedExpense) return;

    if (
      !editExpenseNumber?.trim() ||
      !editExpenseDate ||
      !(editCategory || "").trim() ||
      !(editItemName || "").trim() ||
      parseNumericInput(editQty) <= 0 ||
      parseNumericInput(editRate) < 0 ||
      parseNumericInput(editQty) * parseNumericInput(editRate) <= 0
    ) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("lineValidationError"),
      });
      return;
    }

    setIsUpdating(true);
    try {
      const updatedExpense = {
        ...selectedExpense,
        expenseNumber: (editExpenseNumber || "").trim(),
        date: editExpenseDate,
        category: (editCategory || "").trim(),
        itemName: (editItemName || "").trim(),
        qty: Number(parseNumericInput(editQty)),
        rate: Number(parseNumericInput(editRate)),
        amount:
          Number(parseNumericInput(editQty)) *
          Number(parseNumericInput(editRate)),
      };

      await db.expenses.put(updatedExpense);

      await SyncEngine.queueOperation(
        "expenses",
        "PUT",
        `/api/expenses/${selectedExpense.id}`,
        {
          expenseNumber: updatedExpense.expenseNumber,
          date: updatedExpense.date,
          category: updatedExpense.category,
          itemName: updatedExpense.itemName,
          qty: updatedExpense.qty,
          rate: updatedExpense.rate,
        },
      );

      setShowEditDialog(false);
      setSelectedExpense(null);
      setErrorDialog({
        open: true,
        title: tCommon("success"),
        message: t("updatedSuccess"),
        isSuccess: true,
      });
    } catch (err) {
      setErrorDialog({
        open: true,
        title: tCommon("error"),
        message: err instanceof Error ? err.message : t("failedToSave"),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const requestDeleteExpense = (expense: ExpenseRow) => {
    setExpenseToDelete(expense);
    setShowDeleteDialog(true);
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      await db.expenses.delete(expenseToDelete.id);

      await SyncEngine.queueOperation(
        "expenses",
        "DELETE",
        `/api/expenses/${expenseToDelete.id}`,
        null,
      );

      setShowDeleteDialog(false);
      setExpenseToDelete(null);
      setErrorDialog({
        open: true,
        title: tCommon("success"),
        message: t("deletedSuccess"),
        isSuccess: true,
      });
    } catch (err) {
      setErrorDialog({
        open: true,
        title: tCommon("error"),
        message: err instanceof Error ? err.message : t("deleteExpense"),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {t("pageDescription")}
          </p>
        </div>
        <Button
          size="sm"
          onClick={openAddDialog}
          className="h-9 text-xs px-3 shrink-0"
        >
          <PlusCircle className="w-3.5 h-3.5 mr-1" />
          <span>{t("addExpense")}</span>
        </Button>
      </div>

      <Card className="flex flex-col gap-6 p-4 sm:p-6 shadow-md">
        <CardHeader className="p-0">
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={
                  typeof tCommon("search") === "string" && tCommon("search")
                    ? tCommon("search")
                    : "Search..."
                }
                className="pl-9 pr-9 h-9 text-xs sm:text-sm w-full bg-background"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-9 px-2.5 sm:px-3 text-xs shrink-0"
                >
                  <FilterIcon className="h-3.5 w-3.5" />
                  <span>{tCommon("filter")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 max-h-80 overflow-y-auto"
              >
                <DropdownMenuLabel>
                  {t("filterByCategory") || "Filter by Category"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={filterCategory === "all"}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setFilterCategory("all");
                      setPage(1);
                    }
                  }}
                >
                  {tCommon("all", { defaultValue: "All" })}
                </DropdownMenuCheckboxItem>
                {categoryOptions.map((cat) => (
                  <DropdownMenuCheckboxItem
                    key={cat.value}
                    checked={filterCategory === cat.value}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFilterCategory(cat.value);
                        setPage(1);
                      }
                    }}
                  >
                    {cat.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View - hidden on mobile */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("expenseNumber")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("itemName")}</TableHead>
                  <TableHead>{t("qty")}</TableHead>
                  <TableHead>{t("rate")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{tCommon("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                        <p>{tCommon("loading")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : expenses.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      {t("noExpenses")}
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{expense.expenseNumber}</TableCell>
                      <TableCell>{expense.date}</TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>{expense.itemName}</TableCell>
                      <TableCell>{formatNumber(expense.qty)}</TableCell>
                      <TableCell>{formatNumber(expense.rate)}</TableCell>
                      <TableCell>{formatNumber(expense.amount)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(expense)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => requestDeleteExpense(expense)}
                            disabled={isDeleting}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">{tCommon("delete")}</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View - visible only on mobile */}
          <div className="block md:hidden space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p>{tCommon("loading")}</p>
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {t("noExpenses")}
              </div>
            ) : (
              expenses.map((expense) => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  onEdit={() => openEditDialog(expense)}
                  onDelete={() => requestDeleteExpense(expense)}
                  t={t}
                  tCommon={tCommon}
                />
              ))
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
                onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setPage(1);
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
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        </CardFooter>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("addExpense")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="expenseNumber">{t("expenseNumber")}</Label>
                <Input
                  id="expenseNumber"
                  value={expenseNumber}
                  onChange={(event) => setExpenseNumber(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expenseDate">{t("date")}</Label>
                <Input
                  id="expenseDate"
                  type="date"
                  value={expenseDate}
                  onChange={(event) => setExpenseDate(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <div
                  key={line.id}
                  className="grid gap-3 rounded-md border p-3 grid-cols-1 sm:grid-cols-[1.4fr_1.4fr_0.7fr_0.8fr_0.8fr_auto]"
                >
                  <div className="space-y-1">
                    <Label>{t("category")}</Label>
                    <CreatableSelect
                      options={categoryOptions}
                      value={
                        line.category
                          ? { value: line.category, label: line.category }
                          : null
                      }
                      onChange={(option) =>
                        updateLine(line.id, "category", option?.value ?? "")
                      }
                      onCreateOption={(value) =>
                        handleCreateCategory(line.id, value)
                      }
                      placeholder={t("selectOrCreateCategory")}
                      formatCreateLabel={(value) =>
                        t("createCategory", { value })
                      }
                      isClearable
                      classNamePrefix="expense-select"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>{t("itemName")}</Label>
                    <CreatableSelect
                      options={itemOptions}
                      value={
                        line.itemName
                          ? { value: line.itemName, label: line.itemName }
                          : null
                      }
                      onChange={(option) =>
                        updateLine(line.id, "itemName", option?.value ?? "")
                      }
                      onCreateOption={(value) =>
                        handleCreateItem(line.id, value)
                      }
                      placeholder={t("selectOrCreateItem")}
                      formatCreateLabel={(value) => t("createItem", { value })}
                      isClearable
                      classNamePrefix="expense-select"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>{t("qty")}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.qty}
                      onChange={(event) =>
                        updateLine(line.id, "qty", event.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>{t("rate")}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.rate}
                      onChange={(event) =>
                        updateLine(line.id, "rate", event.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>{t("amount")}</Label>
                    <Input value={formatNumber(lineTotals[index])} readOnly />
                  </div>

                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeRow(line.id)}
                      disabled={lines.length === 1}
                      aria-label={t("removeRow")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="outline" onClick={addRow}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t("addRow")}
              </Button>

              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t("total")}</p>
                <p className="text-2xl font-semibold">
                  {formatNumber(grandTotal)}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? t("saving") : t("saveExpense")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) {
            setSelectedExpense(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("editExpense")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("expenseNumber")}</Label>
                <Input
                  value={editExpenseNumber}
                  onChange={(event) => setEditExpenseNumber(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("date")}</Label>
                <Input
                  type="date"
                  value={editExpenseDate}
                  onChange={(event) => setEditExpenseDate(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("category")}</Label>
                <CreatableSelect
                  options={categoryOptions}
                  value={
                    editCategory
                      ? { value: editCategory, label: editCategory }
                      : null
                  }
                  onChange={(option) => setEditCategory(option?.value ?? "")}
                  onCreateOption={handleCreateEditCategory}
                  placeholder={t("selectOrCreateCategory")}
                  formatCreateLabel={(value) => t("createCategory", { value })}
                  isClearable
                  classNamePrefix="expense-select"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("itemName")}</Label>
                <CreatableSelect
                  options={itemOptions}
                  value={
                    editItemName
                      ? { value: editItemName, label: editItemName }
                      : null
                  }
                  onChange={(option) => setEditItemName(option?.value ?? "")}
                  onCreateOption={handleCreateEditItem}
                  placeholder={t("selectOrCreateItem")}
                  formatCreateLabel={(value) => t("createItem", { value })}
                  isClearable
                  classNamePrefix="expense-select"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t("qty")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editQty}
                  onChange={(event) => setEditQty(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("rate")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editRate}
                  onChange={(event) => setEditRate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("amount")}</Label>
                <Input
                  value={formatNumber(
                    parseNumericInput(editQty) * parseNumericInput(editRate),
                  )}
                  readOnly
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleUpdateExpense} disabled={isUpdating}>
                {isUpdating ? t("saving") : tCommon("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
        title={errorDialog.title}
        message={errorDialog.message}
        isSuccess={errorDialog.isSuccess}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) {
            setExpenseToDelete(null);
          }
        }}
        title={t("deleteExpense")}
        description={
          expenseToDelete
            ? `${expenseToDelete.itemName} • ${expenseToDelete.expenseNumber}`
            : undefined
        }
        confirmLabel={tCommon("delete")}
        onConfirm={handleDeleteExpense}
        variant="danger"
      />
    </div>
  );
}

// Helper function for date formatting (DD-MM-YYYY)
function formatDateDMY(dateStr?: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
// Mobile Card Component for Expense
function ExpenseCard({
  expense,
  onEdit,
  onDelete,
  t,
  tCommon,
}: {
  expense: ExpenseRow;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string) => string;
  tCommon: (key: string) => string;
}) {
  return (
    <div className="bg-card border rounded-lg p-3.5 shadow-sm">
      {/* Header Row: Expense Item Name & ID below it on Left, Action Icons on Right */}
      <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="min-w-0 flex-1 pr-2">
          <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">
            {expense.itemName || "-"}
          </h3>
          <p className="text-[11px] text-muted-foreground font-medium truncate">
            {expense.expenseNumber}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            className="h-8 w-8 text-sky-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40"
          >
            <Edit className="w-4 h-4 text-sky-500" />
            <span className="sr-only">{tCommon("edit")}</span>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
            <span className="sr-only">{tCommon("delete")}</span>
          </Button>
        </div>
      </div>

      <div className="space-y-2 text-xs sm:text-sm">
        {/* Row 1: Date on Left & Category on Right in theme grey without labels */}
        <div className="flex justify-between items-center text-muted-foreground text-xs font-medium">
          <span>{formatDateDMY(expense.date)}</span>
          <span>{expense.category || "-"}</span>
        </div>

        {/* Row 2: Rate to Left & Qty to Right */}
        <div className="flex justify-between items-center text-xs">
          <span>
            <span className="text-muted-foreground">{t("rate")}: </span>
            <span className="font-medium text-foreground">Rs. {formatNumber(expense.rate)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">{t("qty")}: </span>
            <span className="font-medium text-foreground">{formatNumber(expense.qty)}</span>
          </span>
        </div>

        {/* Row 3: Total Amount */}
        <div className="flex justify-between items-center text-xs pt-1 border-t border-zinc-100 dark:border-zinc-800/40">
          <span className="text-muted-foreground font-medium">{t("amount")}:</span>
          <span className="font-semibold text-foreground text-sm">
            Rs. {formatNumber(expense.amount)}
          </span>
        </div>
      </div>
    </div>
  );
}
