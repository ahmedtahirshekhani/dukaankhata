
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import CreatableSelect from "react-select/creatable";
import { PlusCircle, Trash2, Edit, Loader2, Edit2 } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRow | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseRow | null>(null);
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
    return Number(
      lineTotals.reduce((sum, value) => sum + value, 0).toFixed(2),
    );
  }, [lineTotals]);

  const mergeOptions = useCallback((existing: SelectOption[], values: string[]) => {
    const map = new Map(existing.map((option) => [option.value, option]));
    values.forEach((value) => {
      const trimmed = value.trim();
      if (trimmed) {
        map.set(trimmed, { value: trimmed, label: trimmed });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const fetchExpensesData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/${locale}/api/expenses?page=${page}&limit=${pageSize}`);
      if (!response.ok) {
        throw new Error(t("loadOptionsFailed"));
      }

      const data = await response.json();
      const categories = Array.isArray(data?.categories) ? data.categories : [];
      const items = Array.isArray(data?.items) ? data.items : [];
      const rows = Array.isArray(data?.expenses) ? data.expenses : [];

      setCategoryOptions((prev) => mergeOptions(prev, categories));
      setItemOptions((prev) => mergeOptions(prev, items));
      setExpenses(rows);
      setTotalPages(data?.totalPages || 1);
      setTotalCount(data?.totalCount || 0);
    } catch {
      setCategoryOptions((prev) => mergeOptions(prev, defaultCategories));
    } finally {
      setIsLoading(false);
    }
  }, [locale, mergeOptions, t, page, pageSize]);

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
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== id) : prev));
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

    const isInvalidLine = lines.some(
      (line) => {
        const qty = parseNumericInput(line.qty);
        const rate = parseNumericInput(line.rate);
        return (
          !line.category.trim() ||
          !line.itemName.trim() ||
          qty <= 0 ||
          rate < 0 ||
          qty * rate <= 0
        );
      },
    );

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
      const payload = {
        expenseNumber,
        date: expenseDate,
        items: lines.map((line) => ({
          qty: Number(parseNumericInput(line.qty)),
          rate: Number(parseNumericInput(line.rate)),
          category: line.category.trim(),
          itemName: line.itemName.trim(),
          amount: Number(
            (parseNumericInput(line.qty) * parseNumericInput(line.rate)).toFixed(2),
          ),
        })),
      };

      const response = await fetch(`/${locale}/api/expenses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || t("failedToSave"));
      }

      setErrorDialog({
        open: true,
        title: tCommon("success"),
        message: t("createdSuccess"),
        isSuccess: true,
      });

      setShowAddDialog(false);
      resetForm();
      setPage(1);
      fetchExpensesData();
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
    setEditExpenseNumber(expense.expenseNumber);
    setEditExpenseDate(expense.date);
    setEditCategory(expense.category);
    setEditItemName(expense.itemName);
    setEditQty(expense.qty.toString());
    setEditRate(expense.rate.toString());
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
      !editExpenseNumber.trim() ||
      !editExpenseDate ||
      !editCategory.trim() ||
      !editItemName.trim() ||
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
      const response = await fetch(`/${locale}/api/expenses/${selectedExpense.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expenseNumber: editExpenseNumber.trim(),
          date: editExpenseDate,
          category: editCategory.trim(),
          itemName: editItemName.trim(),
          qty: Number(parseNumericInput(editQty)),
          rate: Number(parseNumericInput(editRate)),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || t("failedToSave"));
      }

      setShowEditDialog(false);
      setSelectedExpense(null);
      fetchExpensesData();
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
      const response = await fetch(`/${locale}/api/expenses/${expenseToDelete.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || t("deleteExpense"));
      }

      setShowDeleteDialog(false);
      setExpenseToDelete(null);
      fetchExpensesData();
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
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{t("pageDescription")}</p>
          </div>
          <Button onClick={openAddDialog} className="shrink-0">
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("addExpense")}
          </Button>
        </CardHeader>
        <CardContent>
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
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
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
                      onCreateOption={(value) => handleCreateCategory(line.id, value)}
                      placeholder={t("selectOrCreateCategory")}
                      formatCreateLabel={(value) => t("createCategory", { value })}
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
                      onCreateOption={(value) => handleCreateItem(line.id, value)}
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
                <p className="text-2xl font-semibold">{formatNumber(grandTotal)}</p>
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
                  value={editCategory ? { value: editCategory, label: editCategory } : null}
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
                  value={editItemName ? { value: editItemName, label: editItemName } : null}
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

// Mobile Card Component for Expense Row
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
    <div className="bg-card border rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-base">{expense.expenseNumber}</h3>
          <p className="text-xs text-muted-foreground">{expense.date}</p>
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit} className="h-8 w-8">
            <Edit className="w-4 h-4" />
            <span className="sr-only">{tCommon("edit")}</span>
          </Button>
          <Button 
            size="icon" 
            variant="danger" 
            onClick={onDelete} 
            className="h-8 w-8"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">{tCommon("delete")}</span>
          </Button>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("category")}:</span>
          <span>{expense.category}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("itemName")}:</span>
          <span>{expense.itemName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("qty")}:</span>
          <span>{formatNumber(expense.qty)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t("rate")}:</span>
          <span>{formatNumber(expense.rate)}</span>
        </div>
        <div className="flex justify-between pt-1 border-t">
          <span className="font-medium">{t("amount")}:</span>
          <span className="font-bold">{formatNumber(expense.amount)}</span>
        </div>
      </div>
    </div>
  );
}