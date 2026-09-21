"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import CreatableSelect from "react-select/creatable";
import { useOfflineExpenses } from "@/lib/hooks/useOfflineData";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { usePermissions } from "@/hooks/use-permissions";
import {
  PlusCircle,
  Trash2,
  Edit,
  Eye,
  FilterIcon,
  Calendar,
  Tag,
  Receipt,
  FileText,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NumericInput } from "@/components/ui/numeric-input";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { TableRowActions } from "@/components/ui/table-row-actions";
import { DatePicker } from "@/components/ui/date-picker";
import { formatReadableDate } from "@/lib/date-utils";
import { PageHeader } from "@/components/layout/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type SelectOption = {
  value: string;
  label: string;
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
  const randomString = Math.random().toString(16).substring(2).padEnd(16, "0");
  return timestamp + randomString;
};

function formatNumber(value: number): string {
  const normalized = Number(Number(value || 0).toFixed(2));
  return normalized.toString();
}

function parseNumericInput(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: "38px",
    height: "38px",
    fontSize: "13px",
    borderRadius: "0.375rem",
    backgroundColor: "hsl(var(--background))",
    borderColor: state.isFocused ? "hsl(var(--ring))" : "hsl(var(--input))",
    boxShadow: "none",
    "&:hover": {
      borderColor: "hsl(var(--ring))",
    },
  }),
  singleValue: (base: any) => ({
    ...base,
    color: "hsl(var(--foreground))",
  }),
  input: (base: any) => ({
    ...base,
    color: "hsl(var(--foreground))",
  }),
  placeholder: (base: any) => ({
    ...base,
    color: "hsl(var(--muted-foreground))",
    fontSize: "13px",
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: "hsl(var(--popover))",
    borderColor: "hsl(var(--border))",
    borderWidth: "1px",
    borderRadius: "0.5rem",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: 60,
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "hsl(var(--primary))"
      : state.isFocused
      ? "hsl(var(--accent))"
      : "transparent",
    color: state.isSelected
      ? "hsl(var(--primary-foreground))"
      : "hsl(var(--foreground))",
    cursor: "pointer",
    fontSize: "13px",
  }),
};

export default function ExpensesPage() {
  const locale = useLocale();
  const t = useTranslations("expenses");
  const tCommon = useTranslations("common");
  const { can } = usePermissions();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const offlineExpenses = useOfflineExpenses(searchQuery);
  const isLoading = offlineExpenses === undefined;
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);

  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingExpense, setViewingExpense] = useState<ExpenseRow | null>(null);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseRow | null>(null);

  // Form State
  const [formExpenseNumber, setFormExpenseNumber] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formItemName, setFormItemName] = useState("");
  const [formQty, setFormQty] = useState("1");
  const [formRate, setFormRate] = useState("");

  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>(
    defaultCategories.map((value) => ({ value, label: value })),
  );
  const [itemOptions, setItemOptions] = useState<SelectOption[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    message: string;
    title?: string;
    isSuccess?: boolean;
  }>({ open: false, message: "" });

  const calculatedAmount = useMemo(() => {
    const q = parseNumericInput(formQty);
    const r = parseNumericInput(formRate);
    return Number((q * r).toFixed(2));
  }, [formQty, formRate]);

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

      filtered.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      setTotalCount(filtered.length);

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

  const openAddModal = () => {
    setEditingExpense(null);
    setFormExpenseNumber(generateExpenseNumber());
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormCategory("");
    setFormItemName("");
    setFormQty("1");
    setFormRate("");
    setShowFormModal(true);
  };

  const openEditModal = (expense: ExpenseRow) => {
    setEditingExpense(expense);
    setFormExpenseNumber(expense.expenseNumber || "");
    setFormDate(expense.date || new Date().toISOString().split("T")[0]);
    setFormCategory(expense.category || "");
    setFormItemName(expense.itemName || "");
    setFormQty((expense.qty || 1).toString());
    setFormRate((expense.rate || 0).toString());
    setShowFormModal(true);
  };

  const openViewModal = (expense: ExpenseRow) => {
    setViewingExpense(expense);
    setShowViewModal(true);
  };

  const handleCreateCategory = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setCategoryOptions((prev) => mergeOptions(prev, [trimmed]));
    setFormCategory(trimmed);
  };

  const handleCreateItem = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setItemOptions((prev) => mergeOptions(prev, [trimmed]));
    setFormItemName(trimmed);
  };

  const handleSaveForm = async () => {
    if (!formExpenseNumber.trim() || !formDate) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("numberDateRequired"),
      });
      return;
    }

    const qty = parseNumericInput(formQty);
    const rate = parseNumericInput(formRate);

    if (!formCategory.trim() || !formItemName.trim() || qty <= 0 || rate < 0 || qty * rate <= 0) {
      setErrorDialog({
        open: true,
        title: t("validationError"),
        message: t("lineValidationError"),
      });
      return;
    }

    setIsSaving(true);
    try {
      if (editingExpense) {
        // Edit Mode
        const updatedExpense = {
          ...editingExpense,
          expenseNumber: formExpenseNumber.trim(),
          date: formDate,
          category: formCategory.trim(),
          itemName: formItemName.trim(),
          qty,
          rate,
          amount: Number((qty * rate).toFixed(2)),
        };

        await db.expenses.put(updatedExpense);

        await SyncEngine.queueOperation(
          "expenses",
          "PUT",
          `/api/expenses/${editingExpense.id}`,
          {
            expenseNumber: updatedExpense.expenseNumber,
            date: updatedExpense.date,
            category: updatedExpense.category,
            itemName: updatedExpense.itemName,
            qty: updatedExpense.qty,
            rate: updatedExpense.rate,
          },
        );

        setShowFormModal(false);
        setEditingExpense(null);
        setErrorDialog({
          open: true,
          title: tCommon("success"),
          message: t("updatedSuccess"),
          isSuccess: true,
        });
      } else {
        // Add Mode
        const newId = generateObjectId();
        const payloadItem = {
          id: newId,
          qty,
          rate,
          category: formCategory.trim(),
          itemName: formItemName.trim(),
          amount: Number((qty * rate).toFixed(2)),
        };

        const payload = {
          expenseNumber: formExpenseNumber.trim(),
          date: formDate,
          items: [payloadItem],
        };

        const expenseDoc = {
          id: payloadItem.id,
          expenseNumber: payload.expenseNumber,
          date: payload.date,
          category: payloadItem.category,
          itemName: payloadItem.itemName,
          qty: payloadItem.qty,
          rate: payloadItem.rate,
          amount: payloadItem.amount,
          created_at: new Date().toISOString(),
        };

        await db.expenses.put(expenseDoc);

        await SyncEngine.queueOperation(
          "expenses",
          "POST",
          `/api/expenses`,
          payload,
        );

        setShowFormModal(false);
        setPage(1);
        setErrorDialog({
          open: true,
          title: tCommon("success"),
          message: t("createdSuccess"),
          isSuccess: true,
        });
      }
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

  const requestDeleteExpense = (expense: ExpenseRow) => {
    setExpenseToDelete(expense);
    setShowDeleteDialog(true);
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;

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

  // Define Columns for DataTable
  const columns = useMemo<ColumnDef<ExpenseRow>[]>(() => [
    {
      id: "expenseNumber",
      header: <span className="text-black dark:text-white font-semibold">{t("expenseNumber") || "Expense No"}</span>,
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-black dark:text-white">
          {row.expenseNumber}
        </span>
      ),
    },
    {
      id: "date",
      header: <span className="text-black dark:text-white font-semibold">{t("date") || "Date"}</span>,
      cell: (row) => (
        <span className="text-xs font-medium text-black dark:text-white whitespace-nowrap">
          {formatReadableDate(row.date)}
        </span>
      ),
    },
    {
      id: "category",
      header: <span className="text-black dark:text-white font-semibold">{t("category") || "Category"}</span>,
      cell: (row) => (
        <Badge variant="outline" className="font-medium text-xs text-black dark:text-white border-zinc-300 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/80">
          {row.category || "-"}
        </Badge>
      ),
    },
    {
      id: "itemName",
      header: <span className="text-black dark:text-white font-semibold">{t("itemName") || "Item Name"}</span>,
      cell: (row) => (
        <span className="font-medium text-xs text-black dark:text-white">
          {row.itemName || "-"}
        </span>
      ),
    },
    {
      id: "qty",
      header: <span className="text-black dark:text-white font-semibold">{t("qty") || "Qty"}</span>,
      className: "text-right",
      cell: (row) => (
        <span className="text-xs font-medium text-black dark:text-white">
          {formatNumber(row.qty)}
        </span>
      ),
    },
    {
      id: "rate",
      header: <span className="text-black dark:text-white font-semibold">{t("rate") || "Rate"}</span>,
      className: "text-right",
      cell: (row) => (
        <span className="text-xs font-medium text-black dark:text-white">
          Rs. {formatNumber(row.rate)}
        </span>
      ),
    },
    {
      id: "amount",
      header: <span className="text-black dark:text-white font-semibold">{t("amount") || "Amount"}</span>,
      className: "text-right",
      cell: (row) => (
        <span className="text-xs font-semibold text-black dark:text-white">
          Rs. {formatNumber(row.amount)}
        </span>
      ),
    },
    {
      id: "actions",
      header: <div className="text-right pr-2 text-black dark:text-white font-semibold">{tCommon("actions") || "Actions"}</div>,
      className: "text-right pr-4",
      cell: (row) => {
        return (
          <TableRowActions
            align="right"
            canEdit={can("expenses", "edit")}
            canDelete={can("expenses", "delete")}
            onEdit={() => openEditModal(row)}
            onDelete={() => requestDeleteExpense(row)}
            extraActions={[
              {
                label: t("viewExpense") || tCommon("view") || "View",
                icon: <Eye className="w-4 h-4" />,
                onClick: () => openViewModal(row),
              },
            ]}
          />
        );
      },
    },
  ], [t, tCommon, can]);

  // Toolbar action with category filter dropdown
  const toolbarActions = useMemo(() => (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-10 px-3 text-xs shrink-0"
          >
            <FilterIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              {filterCategory === "all"
                ? tCommon("filter") || "Filter"
                : filterCategory}
            </span>
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
  ), [filterCategory, categoryOptions, t, tCommon]);

  return (
    <div className="flex-1 space-y-4 w-full mx-auto animate-in fade-in duration-300">
      <PageHeader
        title={t("title")}
        description={t("pageDescription")}
        mobileActionsRows={2}
        actions={
          <Button
            size="sm"
            onClick={openAddModal}
            className="h-9 text-xs px-3.5 shrink-0 gap-1.5 shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t("addExpense")}</span>
          </Button>
        }
      />

      <DataTable<ExpenseRow>
        columns={columns}
        data={expenses}
        isLoading={isLoading}
        pageSize={pageSize}
        currentPage={page}
        totalCount={totalCount}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        searchTerm={searchQuery}
        onSearchChange={(term) => {
          setSearchQuery(term);
          setPage(1);
        }}
        searchPlaceholder={
          typeof tCommon("search") === "string" && tCommon("search")
            ? tCommon("search")
            : "Search expenses..."
        }
        emptyMessage={t("noExpenses") || "No expenses found"}
        keyExtractor={(row) => row.id}
        toolbarActions={toolbarActions}
        renderMobileCard={(expense) => (
          <ExpenseCard
            expense={expense}
            onView={() => openViewModal(expense)}
            onEdit={can("expenses", "edit") ? () => openEditModal(expense) : undefined}
            onDelete={can("expenses", "delete") ? () => requestDeleteExpense(expense) : undefined}
            t={t}
            tCommon={tCommon}
          />
        )}
      />

      {/* Unified Add / Edit Expense Dialog */}
      <Dialog
        open={showFormModal}
        onOpenChange={(open) => {
          setShowFormModal(open);
          if (!open) {
            setEditingExpense(null);
          }
        }}
      >
        <DialogContent className="max-w-xl w-[95vw] sm:w-full overflow-hidden p-0 gap-0 border rounded-xl shadow-xl">
          <DialogHeader className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-foreground">
                    {editingExpense ? t("editExpense") : t("addExpense")}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {editingExpense
                      ? editingExpense.expenseNumber
                      : t("pageDescription")}
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5">
            {/* Row 1: Expense Number & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="modalExpenseNumber" className="text-xs font-medium text-foreground">
                  {t("expenseNumber")}
                </Label>
                <Input
                  id="modalExpenseNumber"
                  value={formExpenseNumber}
                  onChange={(e) => setFormExpenseNumber(e.target.value)}
                  className="h-10 text-xs font-mono bg-background"
                  placeholder="EXP-XXXXX"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="modalExpenseDate" className="text-xs font-medium text-foreground">
                  {t("date")}
                </Label>
                <DatePicker
                  value={formDate}
                  onChange={(val) => setFormDate(val)}
                  className="h-10 text-xs bg-background w-full"
                />
              </div>
            </div>

            {/* Row 2: Category & Item Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{t("category")}</span>
                </Label>
                <CreatableSelect
                  options={categoryOptions}
                  value={
                    formCategory
                      ? { value: formCategory, label: formCategory }
                      : null
                  }
                  onChange={(opt) => setFormCategory(opt?.value ?? "")}
                  onCreateOption={handleCreateCategory}
                  placeholder={t("selectOrCreateCategory")}
                  formatCreateLabel={(val) => t("createCategory", { value: val })}
                  isClearable
                  styles={selectStyles}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{t("itemName")}</span>
                </Label>
                <CreatableSelect
                  options={itemOptions}
                  value={
                    formItemName
                      ? { value: formItemName, label: formItemName }
                      : null
                  }
                  onChange={(opt) => setFormItemName(opt?.value ?? "")}
                  onCreateOption={handleCreateItem}
                  placeholder={t("selectOrCreateItem")}
                  formatCreateLabel={(val) => t("createItem", { value: val })}
                  isClearable
                  styles={selectStyles}
                />
              </div>
            </div>

            {/* Row 3: Qty, Rate, and Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/20 border">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{t("qty")}</Label>
                <NumericInput
                  min="0"
                  value={formQty}
                  onChange={(e) => setFormQty(e.target.value)}
                  className="h-10 text-xs bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{t("rate")}</Label>
                <NumericInput
                  min="0"
                  value={formRate}
                  onChange={(e) => setFormRate(e.target.value)}
                  placeholder="0.00"
                  className="h-10 text-xs bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">{t("amount")}</Label>
                <div className="h-10 px-3 flex items-center rounded-md border bg-muted/40 text-xs font-semibold text-foreground">
                  Rs. {formatNumber(calculatedAmount)}
                </div>
              </div>
            </div>

            {/* Summary Banner */}
            <div className="flex items-center justify-between p-3.5 rounded-lg bg-primary/5 border border-primary/15">
              <span className="text-xs font-medium text-muted-foreground">
                {t("total")}
              </span>
              <span className="text-lg font-bold text-primary">
                Rs. {formatNumber(calculatedAmount)}
              </span>
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t bg-muted/20 flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowFormModal(false)}
              disabled={isSaving}
              className="h-9 px-4 text-xs"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveForm}
              disabled={isSaving}
              className="h-9 px-5 text-xs gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t("saving")}</span>
                </>
              ) : (
                <span>{editingExpense ? tCommon("save") : t("saveExpense")}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Expense Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full overflow-hidden p-0 gap-0 border rounded-xl shadow-xl">
          <DialogHeader className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold text-foreground">
                    {t("expenseDetails")}
                  </DialogTitle>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    {viewingExpense?.expenseNumber}
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          {viewingExpense && (
            <div className="p-6 space-y-4">
              {/* Header Details */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="font-medium text-foreground">
                    {formatReadableDate(viewingExpense.date)}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs font-medium px-2.5 py-0.5">
                  {viewingExpense.category || "-"}
                </Badge>
              </div>

              {/* Expense Info Card */}
              <div className="p-4 rounded-lg border bg-card space-y-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {t("itemName")}
                  </span>
                  <h4 className="text-base font-semibold text-foreground">
                    {viewingExpense.itemName || "-"}
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground">{t("qty")}:</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      {formatNumber(viewingExpense.qty)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("rate")}:</span>
                    <p className="font-semibold text-foreground mt-0.5">
                      Rs. {formatNumber(viewingExpense.rate)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Total Amount Card */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border border-primary/20">
                <span className="text-xs font-medium text-primary">
                  {t("total")} {t("amount")}
                </span>
                <span className="text-xl font-bold text-primary">
                  Rs. {formatNumber(viewingExpense.amount)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="px-6 py-3.5 border-t bg-muted/20 flex flex-row items-center justify-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowViewModal(false)}
              className="h-9 px-4 text-xs"
            >
              {tCommon("close")}
            </Button>
            {can("expenses", "edit") && viewingExpense && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setShowViewModal(false);
                  openEditModal(viewingExpense);
                }}
                className="h-9 px-4 text-xs gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>{t("editExpense")}</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error & Success Dialog */}
      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
        title={errorDialog.title}
        message={errorDialog.message}
        isSuccess={errorDialog.isSuccess}
      />

      {/* Confirm Delete Dialog */}
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

// Mobile Card Component for Expense
function ExpenseCard({
  expense,
  onView,
  onEdit,
  onDelete,
  t,
  tCommon,
}: {
  expense: ExpenseRow;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  t: (key: string) => string;
  tCommon: (key: string) => string;
}) {
  return (
    <div className="bg-card border rounded-lg p-3.5 shadow-sm space-y-3">
      {/* Header Row */}
      <div className="flex justify-between items-start pb-2 border-b border-border/50">
        <div
          className="min-w-0 flex-1 pr-2 cursor-pointer"
          onClick={onView}
        >
          <h3 className="font-semibold text-sm sm:text-base text-foreground truncate hover:text-primary transition-colors">
            {expense.itemName || "-"}
          </h3>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate">
            {expense.expenseNumber}
          </p>
        </div>
        <TableRowActions
          canEdit={Boolean(onEdit)}
          canDelete={Boolean(onDelete)}
          onEdit={onEdit}
          onDelete={onDelete}
          extraActions={[
            {
              label: t("viewExpense") || tCommon("view") || "View",
              icon: <Eye className="w-4 h-4" />,
              onClick: onView || (() => {}),
            },
          ]}
        />
      </div>

      <div className="space-y-2 text-xs">
        {/* Row 1: Date on Left & Category on Right */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-black dark:text-white font-medium">
            {formatReadableDate(expense.date)}
          </span>
          <Badge variant="outline" className="text-[11px] font-medium px-2 py-0.5 text-black dark:text-white border-zinc-300 dark:border-zinc-700 bg-zinc-100/80 dark:bg-zinc-800/80">
            {expense.category || "-"}
          </Badge>
        </div>

        {/* Row 2: Rate to Left & Qty to Right */}
        <div className="flex justify-between items-center text-xs">
          <span>
            <span className="text-black dark:text-white font-medium">{t("rate")}: </span>
            <span className="font-semibold text-black dark:text-white">Rs. {formatNumber(expense.rate)}</span>
          </span>
          <span>
            <span className="text-black dark:text-white font-medium">{t("qty")}: </span>
            <span className="font-semibold text-black dark:text-white">{formatNumber(expense.qty)}</span>
          </span>
        </div>

        {/* Row 3: Total Amount */}
        <div className="flex justify-between items-center text-xs pt-1.5 border-t border-border/50">
          <span className="text-black dark:text-white font-semibold">{t("amount")}:</span>
          <span className="font-bold text-black dark:text-white text-sm">
            Rs. {formatNumber(expense.amount)}
          </span>
        </div>
      </div>
    </div>
  );
}
