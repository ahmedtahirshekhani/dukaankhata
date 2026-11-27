"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Eye,
  Edit,
  FileText,
  PlusCircle,
  SearchIcon,
  XIcon,
  FilePenIcon,
  DollarSign,
  Landmark,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  useOfflinePaymentMethodsWithBalance,
  useOfflineCashAdjustments,
} from "@/lib/hooks/useOfflineData";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatCurrencyString, formatStatementDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { BankAccountStatementModal } from "./bank-account-statement-modal";
import { AdjustCashDialog } from "@/components/dialogs/adjust-cash-dialog";
import { ViewCashAdjustmentDialog } from "@/components/dialogs/view-cash-adjustment-dialog";
import { deleteCashAdjustmentOffline } from "@/lib/db/offline-cash-manager";

export interface BankAccountItem {
  id: string;
  bankName: string;
  bankDetails: string;
  openingBalance: number;
  currentBalance?: number;
  createdAt?: string;
  updatedAt?: string;
}

const INPUT_CLASS =
  "flex min-h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface BankAccountsClientProps {
  locale: string;
}

export function BankAccountsClient({ locale }: BankAccountsClientProps) {
  const t = useTranslations("configurationPage");
  const tBank = useTranslations("bankAccounts");
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const tCustomers = useTranslations("customers");
  const { can } = usePermissions();
  const canEdit = can("payment_methods", "edit");
  const canCreate = can("payment_methods", "create");

  const offlineMethods = useOfflinePaymentMethodsWithBalance();
  const isLoadingMethods = offlineMethods === undefined;
  
  const allList: BankAccountItem[] = (offlineMethods || []).map((item: any) => ({
    id: item.id || item._id,
    bankName: item.bankName || item.name || item.bank_name || "",
    bankDetails: item.bankDetails || item.bank_details || "",
    openingBalance: item.openingBalance || item.opening_balance || 0,
    currentBalance: item.currentBalance !== undefined ? item.currentBalance : (item.openingBalance || item.opening_balance || 0),
    createdAt: item.createdAt || item.created_at,
    updatedAt: item.updatedAt || item.updated_at
  }));

  const cashInHandBalance = useMemo(() => {
    const cashMethod = allList.find(m => m.bankName.toLowerCase() === "cash in hand");
    return cashMethod ? (cashMethod.currentBalance ?? cashMethod.openingBalance ?? 0) : 0;
  }, [allList]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);

  const [bankName, setBankName] = useState("");
  const [bankDetails, setBankDetails] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [viewItem, setViewItem] = useState<BankAccountItem | null>(null);
  const [statementItem, setStatementItem] = useState<BankAccountItem | null>(null);

  const [activeTab, setActiveTab] = useState<"accounts" | "adjustments">("accounts");
  const [showAdjustCashDialog, setShowAdjustCashDialog] = useState(false);
  const [selectedAdjustAccountId, setSelectedAdjustAccountId] = useState<string | undefined>(undefined);
  const [viewAdjustment, setViewAdjustment] = useState<any | null>(null);
  const [adjustmentToEdit, setAdjustmentToEdit] = useState<any | null>(null);
  const [adjustmentToDelete, setAdjustmentToDelete] = useState<any | null>(null);
  const [isDeletingAdjustment, setIsDeletingAdjustment] = useState<boolean>(false);

  const handleDeleteAdjustment = async () => {
    if (!adjustmentToDelete) return;
    setIsDeletingAdjustment(true);
    try {
      const targetId = adjustmentToDelete.id || adjustmentToDelete._id;
      await deleteCashAdjustmentOffline(targetId);
      showMessage(tBank("adjustmentDeleted") || "Cash adjustment deleted & balance reverted successfully");
      setAdjustmentToDelete(null);
    } catch (err: any) {
      console.error("Failed to delete cash adjustment:", err);
      showMessage(err?.message || "Failed to delete cash adjustment", true);
    } finally {
      setIsDeletingAdjustment(false);
    }
  };

  // Cash Adjustments Offline Hook
  const rawAdjustments = useOfflineCashAdjustments();
  const adjustmentsList = useMemo(() => {
    return Array.isArray(rawAdjustments) ? rawAdjustments : [];
  }, [rawAdjustments]);

  const [adjustmentsSearch, setAdjustmentsSearch] = useState("");
  const [adjCurrentPage, setAdjCurrentPage] = useState(1);
  const [adjPageSize, setAdjPageSize] = useState(10);

  const filteredAdjustments = useMemo(() => {
    if (!adjustmentsSearch.trim()) return adjustmentsList;
    const term = adjustmentsSearch.toLowerCase();
    return adjustmentsList.filter((a: any) =>
      a.ref_no?.toLowerCase().includes(term) ||
      a.account_name?.toLowerCase().includes(term) ||
      a.reason?.toLowerCase().includes(term) ||
      a.notes?.toLowerCase().includes(term)
    );
  }, [adjustmentsList, adjustmentsSearch]);

  const adjTotalCount = filteredAdjustments.length;
  const adjTotalPages = Math.ceil(adjTotalCount / adjPageSize) || 1;

  const paginatedAdjustments = useMemo(() => {
    const start = (adjCurrentPage - 1) * adjPageSize;
    return filteredAdjustments.slice(start, start + adjPageSize);
  }, [filteredAdjustments, adjCurrentPage, adjPageSize]);

  const [searchTerm, setSearchTerm] = useState("");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const baseUrl = `/${locale}/api/configuration/payment-method`;

  const filteredList = useMemo(() => {
    if (!searchTerm) return allList;
    const lower = searchTerm.toLowerCase();
    return allList.filter((item) => 
      item.bankName.toLowerCase().includes(lower) || 
      item.bankDetails.toLowerCase().includes(lower)
    );
  }, [allList, searchTerm]);

  const totalCount = filteredList.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const totalBankBalance = useMemo(() => {
    return allList.reduce((sum, item) => sum + (item.currentBalance ?? item.openingBalance ?? 0), 0);
  }, [allList]);

  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  const showMessage = useCallback((text: string, isError = false) => {
    setMessage(text);
    setMessageError(isError);
    setTimeout(() => {
      setMessage("");
      setMessageError(false);
    }, 2500);
  }, []);

  const resetForm = useCallback(() => {
    setBankName("");
    setBankDetails("");
    setOpeningBalance("");
    setEditingId(null);
  }, []);

  const openAddDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const openEditDialog = (item: BankAccountItem) => {
    setBankName(item.bankName);
    setBankDetails(item.bankDetails);
    setOpeningBalance(item.openingBalance ? item.openingBalance.toString() : "");
    setEditingId(item.id);
    setShowEditDialog(true);
  };

  const handleSave = async () => {
    const name = bankName.trim();
    if (!name) {
      showMessage(t("paymentMethodBankNameRequired"), true);
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        bankName: name,
        bankDetails: bankDetails.trim(),
        openingBalance: parseFloat(openingBalance) || 0,
      };

      if (editingId) {
        const existing = await db.payment_methods.get(editingId);
        if (existing) {
          await db.payment_methods.put({ ...existing, ...payload });
        } else {
          await db.payment_methods.put({ id: editingId, ...payload });
        }
        await SyncEngine.queueOperation("payment_methods", "PUT", `${baseUrl}/${editingId}`, payload);
        showMessage(t("paymentMethodUpdated"));
        setShowEditDialog(false);
      } else {
        const existing = offlineMethods?.find(
          (m: any) =>
            (m.bankName || m.name || m.bank_name)?.toLowerCase() === name.toLowerCase()
        );
        if (existing) {
          throw new Error(t("paymentMethodBankNameDuplicate"));
        }

        const methodId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `temp_${Date.now()}`;
        const localMethod = {
          id: methodId,
          ...payload,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await db.payment_methods.add(localMethod as any);
        await SyncEngine.queueOperation("payment_methods", "POST", baseUrl, payload, methodId);
        showMessage(t("paymentMethodSaved"));
        setShowAddDialog(false);
      }
      resetForm();
    } catch (err: unknown) {
      showMessage(err instanceof Error ? err.message : t("failedToSave"), true);
    } finally {
      setSaving(false);
    }
  };

  const renderFormFields = () => (
    <div className="space-y-4 py-4">
      {message && (
        <div
          className={cn(
            "p-3 rounded text-sm",
            messageError
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-blue-50 border border-blue-200 text-blue-700"
          )}
        >
          {message}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="payment-method-bank-name">{t("paymentMethodBankName")}</Label>
          <Input
            id="payment-method-bank-name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder={t("paymentMethodBankNamePlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="opening-balance">{tBank("openingBalance")}</Label>
          <NumericInput
            id="opening-balance"
            min="0"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            placeholder="0.00"
            disabled={!!editingId}
          />
          {!!editingId ? (
            <p className="text-[0.70rem] sm:text-xs text-amber-600 font-medium leading-tight">
              {tCustomers("cannotUpdateBalanceWarning")}
            </p>
          ) : (
            <p className="text-[0.70rem] sm:text-xs text-muted-foreground leading-tight">
              {tCustomers("openingBalanceHelper")}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="payment-method-bank-details">{t("paymentMethodBankDetails")}</Label>
        <textarea
          id="payment-method-bank-details"
          value={bankDetails}
          onChange={(e) => setBankDetails(e.target.value)}
          placeholder={t("paymentMethodBankDetailsPlaceholder")}
          rows={4}
          className={cn(INPUT_CLASS, "min-h-[80px] resize-y")}
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        <div>
          <h1 className="text-2xl font-bold">{tNav("bankAccounts") || "Bank Accounts"}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">{tNav("bankAccountsDescription")}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAdjustmentToEdit(null);
                setSelectedAdjustAccountId(undefined);
                setShowAdjustCashDialog(true);
              }}
              className="h-9 text-xs px-2.5 sm:px-3 flex-shrink-0 whitespace-nowrap gap-1.5 border-border hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline">{tBank("adjustCash")}</span>
              <span className="inline sm:hidden">Adjust</span>
            </Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={openAddDialog} className="h-9 text-xs px-2.5 sm:px-3 shrink-0">
              <PlusCircle className="w-4 h-4 mr-1.5" />
              {tBank("addBankAccount")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-1">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{t("cashInHandBalance") || "Cash in Hand Balance"}</p>
                <p className="text-lg font-semibold mt-1 text-gray-800 dark:text-gray-100">
                  {formatCurrencyString(cashInHandBalance)}
                </p>
              </div>
              <div className="p-2 bg-green-50 dark:bg-green-950/40 rounded-lg">
                <DollarSign className="h-4 w-4 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{t("totalBankBalance") || "Total Bank Balance"}</p>
                <p className="text-lg font-semibold mt-1 text-gray-800 dark:text-gray-100">
                  {formatCurrencyString(totalBankBalance)}
                </p>
              </div>
              <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
                <Landmark className="h-4 w-4 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs Bar (Underline style, matching Items page) */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("accounts")}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "accounts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>{tBank("accountsTab") || "Bank & Cash Accounts"}</span>
          <span className="ml-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {allList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("adjustments")}
          className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "adjustments"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>{tBank("adjustmentsTab") || "Cash Adjustments"}</span>
          <span className="ml-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {adjustmentsList.length}
          </span>
        </button>
      </div>

      {activeTab === "accounts" ? (
        <Card className="flex flex-col gap-6 p-4 sm:p-6 shadow-md">
          <CardHeader className="p-0">
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="relative flex-1 min-w-0">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-9 h-9 text-xs sm:text-sm w-full"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("paymentMethodBankName")}</TableHead>
                    <TableHead>{t("paymentMethodBankDetails")}</TableHead>
                    <TableHead>{tCommon("balance")}</TableHead>
                    <TableHead className="text-right">{tCommon("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingMethods ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {tCommon("loading") || "Loading..."}
                      </TableCell>
                    </TableRow>
                  ) : paginatedList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {t("paymentMethodNoItems")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedList.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.bankName}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.bankDetails || "—"}</TableCell>
                        <TableCell className="font-semibold text-primary">{formatCurrencyString(item.currentBalance ?? item.openingBalance)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary hover:bg-primary/10"
                              onClick={() => setStatementItem(item)}
                              title={tBank("viewStatement")}
                            >
                              <FileText className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:bg-gray-100"
                              onClick={() => setViewItem(item)}
                              title={t("paymentMethodView")}
                            >
                              <Eye className="h-4 w-4 text-gray-500" />
                            </Button>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-sky-500 hover:text-sky-600 hover:bg-sky-50"
                                onClick={() => openEditDialog(item)}
                                title={tCommon("edit")}
                              >
                                <FilePenIcon className="h-4 w-4 text-sky-500" />
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

            {/* Mobile Cards View */}
            <div className="block md:hidden space-y-3">
              {isLoadingMethods ? (
                <div className="flex justify-center py-8 text-muted-foreground">
                  {tCommon("loading") || "Loading..."}
                </div>
              ) : paginatedList.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {t("paymentMethodNoItems")}
                </div>
              ) : (
                paginatedList.map((item) => (
                  <BankAccountCard
                    key={item.id}
                    item={item}
                    onView={() => setViewItem(item)}
                    onStatement={() => setStatementItem(item)}
                    onEdit={canEdit ? () => openEditDialog(item) : undefined}
                    t={t}
                    tBank={tBank}
                    tCommon={tCommon}
                  />
                ))
              )}
            </div>
          </CardContent>

          <div className="border-t p-4 flex flex-col md:flex-row justify-between items-center gap-4">
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
                    setCurrentPage(1);
                  }}
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
            
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                isLoading={false}
              />
            )}
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col gap-6 p-4 sm:p-6 shadow-md">
          <CardHeader className="p-0">
            <div className="flex items-center justify-between gap-2 w-full flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 min-w-0">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={adjustmentsSearch}
                  onChange={(e) => {
                    setAdjustmentsSearch(e.target.value);
                    setAdjCurrentPage(1);
                  }}
                  className="pl-9 pr-9 h-9 text-xs sm:text-sm w-full"
                />
                {adjustmentsSearch && (
                  <button
                    onClick={() => {
                      setAdjustmentsSearch("");
                      setAdjCurrentPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedAdjustAccountId("cash");
                    setShowAdjustCashDialog(true);
                  }}
                  className="h-9 text-xs px-2.5 sm:px-3 flex-shrink-0 whitespace-nowrap gap-1.5 border-border hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors"
                >
                  <SlidersHorizontal className="w-4 h-4 text-primary" />
                  <span className="hidden sm:inline">{tBank("adjustCash")}</span>
                  <span className="inline sm:hidden">Adjust</span>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Adjustments Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tBank("dateTime")}</TableHead>
                    <TableHead>{tBank("refNo")}</TableHead>
                    <TableHead>{tBank("account")}</TableHead>
                    <TableHead>{tBank("type")}</TableHead>
                    <TableHead>{tBank("amount")}</TableHead>
                    <TableHead>{tBank("reason")}</TableHead>
                    <TableHead className="text-right">{tCommon("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAdjustments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {tBank("noAdjustmentsFound")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedAdjustments.map((adj: any) => {
                      const isAdd = adj.type === "add";
                      return (
                        <TableRow key={adj.id}>
                          <TableCell className="text-xs text-muted-foreground font-medium">
                            {formatStatementDate(adj.date || adj.created_at)}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold">
                            {adj.ref_no || "CADJ"}
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {adj.account_name || "Cash in Hand"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                isAdd
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200"
                              }
                            >
                              {isAdd ? tBank("addCash") : tBank("reduceCash")}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`font-bold ${
                              isAdd
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {isAdd ? "+" : "-"} {formatCurrencyString(adj.amount)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                            {adj.reason || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-500 hover:bg-gray-100"
                                onClick={() => setViewAdjustment(adj)}
                                title={tBank("viewAdjustment")}
                              >
                                <Eye className="h-4 w-4 text-gray-500" />
                              </Button>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-sky-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                                  onClick={() => {
                                    setAdjustmentToEdit(adj);
                                    setShowAdjustCashDialog(true);
                                  }}
                                  title={tCommon("edit")}
                                >
                                  <FilePenIcon className="h-4 w-4 text-sky-500" />
                                </Button>
                              )}
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  onClick={() => setAdjustmentToDelete(adj)}
                                  title={tCommon("delete")}
                                >
                                  <Trash2 className="h-4 w-4 text-rose-500" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Adjustments Cards View */}
            <div className="block md:hidden space-y-3">
              {paginatedAdjustments.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  {tBank("noAdjustmentsFound")}
                </div>
              ) : (
                paginatedAdjustments.map((adj: any) => (
                  <CashAdjustmentCard
                    key={adj.id}
                    adjustment={adj}
                    onView={() => setViewAdjustment(adj)}
                    onEdit={canEdit ? () => {
                      setAdjustmentToEdit(adj);
                      setShowAdjustCashDialog(true);
                    } : undefined}
                    onDelete={canEdit ? () => setAdjustmentToDelete(adj) : undefined}
                    tBank={tBank}
                    tCommon={tCommon}
                  />
                ))
              )}
            </div>
          </CardContent>

          {/* Adjustments Pagination */}
          <div className="border-t p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {tCommon("totalCountLabel", { count: adjTotalCount })}
            </div>
            {adjTotalPages > 1 && (
              <Pagination
                currentPage={adjCurrentPage}
                totalPages={adjTotalPages}
                onPageChange={setAdjCurrentPage}
                isLoading={false}
              />
            )}
          </div>
        </Card>
      )}

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tBank("addBankAccount")}</DialogTitle>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={saving}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? tCommon("loading") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tBank("editBankAccount")}</DialogTitle>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={saving}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? tCommon("loading") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{viewItem?.bankName ?? ""}</DialogTitle>
            <DialogDescription>{t("paymentMethodViewDescription")}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
            <p className="font-semibold mb-2 text-primary">
              {tCommon("balance") === "common.balance" ? "Balance" : tCommon("balance")}: {formatCurrencyString(viewItem?.currentBalance ?? viewItem?.openingBalance ?? 0)}
            </p>
            {viewItem?.bankDetails || "—"}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewItem(null)}>
              {tCommon("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {statementItem && (
        <BankAccountStatementModal
          bankAccount={statementItem}
          locale={locale}
          isOpen={!!statementItem}
          onClose={() => setStatementItem(null)}
        />
      )}

      {/* Adjust Cash Dialog */}
      <AdjustCashDialog
        open={showAdjustCashDialog}
        onOpenChange={(open) => {
          setShowAdjustCashDialog(open);
          if (!open) {
            setAdjustmentToEdit(null);
          }
        }}
        accounts={allList}
        defaultAccountId={selectedAdjustAccountId}
        adjustmentToEdit={adjustmentToEdit}
        onSuccess={() => {
          showMessage(
            adjustmentToEdit
              ? (tBank("adjustmentUpdated") || "Cash adjustment updated successfully")
              : (tBank("adjustmentSaved") || "Cash adjustment recorded successfully")
          );
          setAdjustmentToEdit(null);
        }}
      />

      {/* View Cash Adjustment Dialog */}
      {viewAdjustment && (
        <ViewCashAdjustmentDialog
          adjustment={viewAdjustment}
          open={!!viewAdjustment}
          onOpenChange={(open) => !open && setViewAdjustment(null)}
        />
      )}

      {/* Delete Cash Adjustment Confirmation Dialog */}
      <Dialog
        open={!!adjustmentToDelete}
        onOpenChange={(open) => !open && setAdjustmentToDelete(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <span>{tBank("deleteAdjustmentTitle") || "Delete Cash Adjustment"}</span>
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-foreground space-y-2">
              <p>
                {tBank("deleteAdjustmentConfirm") || "Are you sure you want to delete this cash adjustment?"}
              </p>
              {adjustmentToDelete && (
                <div className="p-3 bg-muted/50 rounded-lg border text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tBank("refNo")}:</span>
                    <span className="font-mono font-semibold">{adjustmentToDelete.ref_no || "CADJ"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tBank("account")}:</span>
                    <span className="font-semibold">{adjustmentToDelete.account_name || "Cash in Hand"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{tBank("amount")}:</span>
                    <span className={`font-bold ${adjustmentToDelete.type === "add" ? "text-emerald-600" : "text-rose-600"}`}>
                      {adjustmentToDelete.type === "add" ? "+" : "-"} {formatCurrencyString(adjustmentToDelete.amount)}
                    </span>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-1">
                {tBank("deleteAdjustmentRevertNote") || "Note: Deleting this adjustment will immediately revert the account balance."}
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setAdjustmentToDelete(null)}
              disabled={isDeletingAdjustment}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAdjustment}
              disabled={isDeletingAdjustment}
              className="gap-1.5"
            >
              {isDeletingAdjustment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{tCommon("deleting") || "Deleting..."}</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>{tCommon("delete")}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Mobile Card Component for Bank Accounts
function BankAccountCard({
  item,
  onView,
  onStatement,
  onEdit,
  t,
  tBank,
  tCommon,
}: {
  item: BankAccountItem;
  onView: () => void;
  onStatement: () => void;
  onEdit?: () => void;
  t: (key: string) => string;
  tBank: (key: string) => string;
  tCommon: (key: string) => string;
}) {
  return (
    <div className="bg-card border rounded-lg p-3.5 shadow-sm">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-zinc-100 dark:border-zinc-800/60">
        <h3 className="font-semibold text-sm sm:text-base text-foreground truncate max-w-[65%]">
          {item.bankName}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            onClick={onStatement}
            className="h-8 w-8 text-primary hover:bg-primary/10"
            title={tBank("viewStatement")}
          >
            <FileText className="w-4 h-4 text-primary" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onView}
            className="h-8 w-8 text-gray-500 hover:bg-gray-100"
            title={t("paymentMethodView")}
          >
            <Eye className="w-4 h-4 text-gray-500" />
          </Button>
          {onEdit && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onEdit}
              className="h-8 w-8 text-sky-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40"
            >
              <FilePenIcon className="w-4 h-4 text-sky-500" />
              <span className="sr-only">{tCommon("edit")}</span>
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1.5 text-xs sm:text-sm">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">{tCommon("balance")}:</span>
          <span className="font-semibold text-primary">{formatCurrencyString(item.currentBalance ?? item.openingBalance)}</span>
        </div>
        <div className="mt-2 text-muted-foreground line-clamp-2 pt-2 border-t border-border/50">
          {item.bankDetails || "—"}
        </div>
      </div>
    </div>
  );
}

// Mobile Card Component for Cash Adjustments
function CashAdjustmentCard({
  adjustment,
  onView,
  onEdit,
  onDelete,
  tBank,
  tCommon,
}: {
  adjustment: any;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  tBank: (key: string) => string;
  tCommon: (key: string) => string;
}) {
  const isAdd = adjustment.type === "add";
  return (
    <div className="bg-card border rounded-lg p-3.5 shadow-sm space-y-2">
      <div className="flex justify-between items-start pb-2 border-b">
        <div>
          <span className="text-xs font-mono font-bold text-muted-foreground">
            {adjustment.ref_no || "CADJ"}
          </span>
          <h4 className="font-semibold text-sm text-foreground mt-0.5">
            {adjustment.account_name || "Cash in Hand"}
          </h4>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            className={
              isAdd
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 text-xs"
                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 text-xs"
            }
          >
            {isAdd ? tBank("addCash") : tBank("reduceCash")}
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            onClick={onView}
            className="h-7 w-7 text-gray-500 hover:bg-gray-100"
            title={tBank("viewAdjustment")}
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
          {onEdit && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onEdit}
              className="h-7 w-7 text-sky-500 hover:bg-sky-50"
              title={tCommon("edit")}
            >
              <FilePenIcon className="w-3.5 h-3.5 text-sky-500" />
            </Button>
          )}
          {onDelete && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              className="h-7 w-7 text-rose-500 hover:bg-rose-50"
              title={tCommon("delete")}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center text-xs">
        <span className="text-muted-foreground">
          {formatStatementDate(adjustment.date || adjustment.created_at)}
        </span>
        <span
          className={`font-bold text-sm ${
            isAdd ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {isAdd ? "+" : "-"} {formatCurrencyString(adjustment.amount)}
        </span>
      </div>
      {adjustment.reason && (
        <p className="text-xs text-muted-foreground truncate pt-1 border-t">
          {adjustment.reason}
        </p>
      )}
    </div>
  );
}

