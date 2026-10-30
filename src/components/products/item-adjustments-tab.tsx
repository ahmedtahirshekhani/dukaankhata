"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/offline-db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SlidersHorizontal,
  SearchIcon,
  XIcon,
  RotateCcw,
  FileDown,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Package,
  Calendar,
  FilterIcon,
  AlertCircle,
  PlusCircle,
  Loader2,
  Edit2,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { formatPakistaniDateTime, toHTMLDateString } from "@/lib/date-utils";
import { exportStockAdjustmentsToExcel } from "@/lib/excel";
import { Pagination } from "@/components/ui/pagination";
import { deleteStockAdjustmentOffline } from "@/lib/db/offline-stock-manager";
import { AdjustStockDialog } from "@/components/dialogs/adjust-stock-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface StockAdjustmentRecord {
  id: string;
  product_id?: string;
  product_name: string;
  stock_type: "available" | "damaged";
  action_type: "add" | "reduce";
  quantity: number;
  cost_price: number;
  reason: string;
  notes?: string;
  ref_no: string;
  date: string;
  created_at?: string;
}

interface ItemAdjustmentsTabProps {
  onAdjustStock?: () => void;
  canEdit?: boolean;
}

export function ItemAdjustmentsTab({
  onAdjustStock,
  canEdit = true,
}: ItemAdjustmentsTabProps) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");

  const safeT = (key: string, fallback: string) => {
    try {
      const res = (t as any)(key);
      return res || fallback;
    } catch {
      return fallback;
    }
  };

  // Filters state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [stockTypeFilter, setStockTypeFilter] = useState<string>("all");
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [activePreset, setActivePreset] = useState<string>("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Server state & loading
  const [serverAdjustments, setServerAdjustments] = useState<StockAdjustmentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Edit & Delete state
  const [editingAdjustment, setEditingAdjustment] = useState<StockAdjustmentRecord | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [deletingAdjustment, setDeletingAdjustment] = useState<StockAdjustmentRecord | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Reactive Dexie offline queries
  const localAdjustments = useLiveQuery(async () => {
    try {
      const arr = await db.stock_adjustments.toArray();
      return arr.map((a: any) => ({
        id: a.id || `adj_${a.created_at}`,
        product_id: a.product_id,
        product_name: a.product_name || "Unknown Item",
        stock_type: a.stock_type || "available",
        action_type: a.action_type || "add",
        quantity: Number(a.quantity) || 0,
        cost_price: Number(a.cost_price) || 0,
        reason: a.reason || "physicalCount",
        notes: a.notes || "",
        ref_no: a.ref_no || (a.id ? `ADJ-${a.id.slice(-6)}` : "ADJ-OFFLINE"),
        date: a.date ? new Date(a.date).toISOString() : new Date(a.created_at || Date.now()).toISOString(),
        created_at: a.created_at ? new Date(a.created_at).toISOString() : new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  }, []);

  // Fetch from server API
  const fetchServerAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/stock-adjustments", window.location.origin);
      url.searchParams.set("limit", "-1"); // Fetch all for local filtering & pagination
      if (fromDate) url.searchParams.set("fromDate", fromDate);
      if (toDate) url.searchParams.set("toDate", toDate);

      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        if (json?.adjustments) {
          setServerAdjustments(json.adjustments);
        }
      }
    } catch (err) {
      console.error("Error loading server adjustments:", err);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchServerAdjustments();
    const handleSync = (e: any) => {
      if (!e?.detail?.collection || e.detail.collection === "stock_adjustments") {
        fetchServerAdjustments();
      }
    };
    window.addEventListener("syncComplete", handleSync);
    window.addEventListener("localIdReplaced", handleSync);
    return () => {
      window.removeEventListener("syncComplete", handleSync);
      window.removeEventListener("localIdReplaced", handleSync);
    };
  }, [fetchServerAdjustments]);

  // Merge server and local adjustments without duplicates
  const allAdjustments = useMemo(() => {
    const map = new Map<string, StockAdjustmentRecord>();

    // 1. Add server records
    for (const a of serverAdjustments) {
      map.set(a.id, a);
      if (a.ref_no) map.set(a.ref_no, a);
    }

    // 2. Merge local Dexie records (may contain un-synced recent adjustments)
    if (localAdjustments && localAdjustments.length > 0) {
      for (const loc of localAdjustments) {
        if (!map.has(loc.id) && (!loc.ref_no || !map.has(loc.ref_no))) {
          // Extra deduplication against server records: check matching product_id, action_type, quantity, within 60s
          const isDuplicateOfServer = serverAdjustments.some((srv) =>
            String(srv.product_id) === String(loc.product_id) &&
            srv.action_type === loc.action_type &&
            Number(srv.quantity) === Number(loc.quantity) &&
            Math.abs(new Date(srv.date || (srv as any).created_at || "").getTime() - new Date(loc.date || (loc as any).created_at || "").getTime()) < 60000
          );
          if (!isDuplicateOfServer) {
            map.set(loc.id, loc);
          }
        }
      }
    }

    return Array.from(new Set(Array.from(map.values()))).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [serverAdjustments, localAdjustments]);

  // Filter adjustments
  const filteredAdjustments = useMemo(() => {
    return allAdjustments.filter((a) => {
      // Search
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const matches =
          (a.product_name && a.product_name.toLowerCase().includes(s)) ||
          (a.ref_no && a.ref_no.toLowerCase().includes(s)) ||
          (a.reason && a.reason.toLowerCase().includes(s)) ||
          (a.notes && a.notes.toLowerCase().includes(s));
        if (!matches) return false;
      }

      // Stock Type
      if (stockTypeFilter !== "all" && a.stock_type !== stockTypeFilter) {
        return false;
      }

      // Action Type
      if (actionTypeFilter !== "all" && a.action_type !== actionTypeFilter) {
        return false;
      }

      // Reason
      if (reasonFilter !== "all" && a.reason !== reasonFilter) {
        return false;
      }

      // Date Range
      if (fromDate) {
        const d = new Date(a.date);
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);
        if (d < from) return false;
      }

      if (toDate) {
        const d = new Date(a.date);
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }

      return true;
    });
  }, [allAdjustments, searchTerm, stockTypeFilter, actionTypeFilter, reasonFilter, fromDate, toDate]);

  // KPI Summaries
  const summary = useMemo(() => {
    let totalAdded = 0;
    let totalReduced = 0;
    let netQty = 0;
    let totalValue = 0;

    for (const a of filteredAdjustments) {
      const q = Number(a.quantity) || 0;
      const c = Number(a.cost_price) || 0;
      if (a.action_type === "add") {
        totalAdded += q;
        netQty += q;
        totalValue += q * c;
      } else {
        totalReduced += q;
        netQty -= q;
        totalValue -= q * c;
      }
    }

    return {
      totalCount: filteredAdjustments.length,
      totalAdded: Math.round(totalAdded * 1000) / 1000,
      totalReduced: Math.round(totalReduced * 1000) / 1000,
      netQty: Math.round(netQty * 1000) / 1000,
      totalValue: Math.round(totalValue * 100) / 100,
    };
  }, [filteredAdjustments]);

  // Pagination
  const totalCount = filteredAdjustments.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedAdjustments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAdjustments.slice(start, start + pageSize);
  }, [filteredAdjustments, currentPage, pageSize]);

  const handlePresetChange = (preset: "all" | "thisMonth" | "last30Days") => {
    setActivePreset(preset);
    const today = new Date();
    if (preset === "all") {
      setFromDate("");
      setToDate("");
    } else if (preset === "thisMonth") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(toHTMLDateString(firstDay));
      setToDate(toHTMLDateString(today));
    } else if (preset === "last30Days") {
      const past = new Date(today);
      past.setDate(past.getDate() - 30);
      setFromDate(toHTMLDateString(past));
      setToDate(toHTMLDateString(today));
    }
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    stockTypeFilter !== "all" ||
    actionTypeFilter !== "all" ||
    reasonFilter !== "all" ||
    fromDate ||
    toDate ||
    activePreset !== "all"
  );

  const handleResetFilters = () => {
    setSearchTerm("");
    setStockTypeFilter("all");
    setActionTypeFilter("all");
    setReasonFilter("all");
    setFromDate("");
    setToDate("");
    setActivePreset("all");
    setCurrentPage(1);
  };

  const handleExport = () => {
    if (filteredAdjustments.length === 0) return;
    setIsExporting(true);
    try {
      exportStockAdjustmentsToExcel(
        filteredAdjustments,
        `stock-adjustments-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingAdjustment) return;
    setIsDeleting(true);
    try {
      const res = await deleteStockAdjustmentOffline({
        adjustmentId: deletingAdjustment.id,
        fallbackRecord: deletingAdjustment,
      });

      toast.success(
        `${safeT("deleteAdjustmentSuccess", "Adjustment deleted & stock reverted")}. New Stock: ${res.newQuantity}, Rate: ${formatCurrency(res.newCostPrice)}`
      );
      setIsDeleteDialogOpen(false);
      setDeletingAdjustment(null);
      await fetchServerAdjustments();
    } catch (err: any) {
      console.error("Failed to delete stock adjustment:", err);
      toast.error(err.message || safeT("deleteAdjustmentError", "Failed to delete stock adjustment"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5 sm:gap-4 w-full max-w-full">

      {/* Filters & Actions Toolbar */}
      <div className="p-3 sm:p-4 rounded-xl border bg-card/50 shadow-xs space-y-2.5 sm:space-y-3">
        {/* Row 1: Search Box & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-0">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder={safeT("searchAdjustments", "Search adjustments...")}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-8 h-9 text-xs sm:text-sm w-full"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                title="Clear Search"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Actions (Export, Refresh) */}
          <div className="flex items-center gap-2 justify-end shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting || filteredAdjustments.length === 0}
              className="h-9 text-xs gap-1.5 flex-1 sm:flex-initial"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{safeT("exportAdjustments", "Export")}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchServerAdjustments}
              disabled={loading}
              className="h-9 w-9 p-0 shrink-0"
              title="Refresh"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Row 2: Filter Selects & Date Presets */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-2 border-t border-border/60">
          {/* Action, Stock Type, Reason Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center gap-2 w-full lg:w-auto">
            {/* Action Filter */}
            <Select
              value={actionTypeFilter}
              onValueChange={(val) => {
                setActionTypeFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs w-full lg:w-[130px]">
                <SelectValue placeholder={safeT("allActions", "All Actions")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{safeT("allActions", "All Actions")}</SelectItem>
                <SelectItem value="add">{safeT("addStock", "Add Stock (+)")}</SelectItem>
                <SelectItem value="reduce">{safeT("reduceStock", "Reduce Stock (-)")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Stock Type Filter */}
            <Select
              value={stockTypeFilter}
              onValueChange={(val) => {
                setStockTypeFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs w-full lg:w-[135px]">
                <SelectValue placeholder={safeT("allTypes", "All Types")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{safeT("allTypes", "All Types")}</SelectItem>
                <SelectItem value="available">{safeT("availableStock", "Available Stock")}</SelectItem>
                <SelectItem value="damaged">{safeT("damagedStock", "Damaged Stock")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Reason Filter */}
            <div className="col-span-2 sm:col-span-1 lg:w-auto">
              <Select
                value={reasonFilter}
                onValueChange={(val) => {
                  setReasonFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs w-full lg:w-[155px]">
                  <SelectValue placeholder={safeT("adjustmentReason", "Reason")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reasons</SelectItem>
                  <SelectItem value="physicalCount">{safeT("reasons.physicalCount", "Physical Count / Audit")}</SelectItem>
                  <SelectItem value="damaged">{safeT("reasons.damaged", "Damaged / Broken")}</SelectItem>
                  <SelectItem value="expired">{safeT("reasons.expired", "Expired Goods")}</SelectItem>
                  <SelectItem value="theft">{safeT("reasons.theft", "Lost / Theft")}</SelectItem>
                  <SelectItem value="internalUse">{safeT("reasons.internalUse", "Internal Use / Sample")}</SelectItem>
                  <SelectItem value="found">{safeT("reasons.found", "Surplus / Found Stock")}</SelectItem>
                  <SelectItem value="other">{safeT("reasons.other", "Other Reason")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Presets & Date Inputs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {/* Presets Button Group */}
            <div className="grid grid-cols-3 sm:flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50 shrink-0">
              <Button
                variant={activePreset === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("all")}
                className="h-7 text-xs px-2.5 rounded-md"
              >
                All
              </Button>
              <Button
                variant={activePreset === "thisMonth" ? "default" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("thisMonth")}
                className="h-7 text-xs px-2.5 rounded-md"
              >
                This Month
              </Button>
              <Button
                variant={activePreset === "last30Days" ? "default" : "ghost"}
                size="sm"
                onClick={() => handlePresetChange("last30Days")}
                className="h-7 text-xs px-2.5 rounded-md"
              >
                30 Days
              </Button>
            </div>

            {/* From - To Date Pickers */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
              <div className="w-full sm:w-[125px]">
                <DatePicker
                  className="h-8 text-xs pl-7 pr-1.5"
                  value={fromDate}
                  onChange={(val) => {
                    setFromDate(val);
                    setActivePreset("custom");
                    setCurrentPage(1);
                  }}
                  placeholder="From Date"
                />
              </div>
              <div className="w-full sm:w-[125px]">
                <DatePicker
                  className="h-8 text-xs pl-7 pr-1.5"
                  value={toDate}
                  onChange={(val) => {
                    setToDate(val);
                    setActivePreset("custom");
                    setCurrentPage(1);
                  }}
                  placeholder="To Date"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Active Filters Summary & Reset */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50 text-muted-foreground flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <FilterIcon className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-[11px] font-medium">Filtered adjustments:</span>
              <Badge variant="secondary" className="text-[10px] font-mono font-semibold py-0 px-1.5">
                {filteredAdjustments.length}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-6 text-[11px] px-2 text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </Button>
          </div>
        )}
      </div>

      {/* Adjustments Container */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
        {/* DESKTOP TABLE VIEW (md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs min-w-[950px]">
            <thead className="bg-muted/60 border-b text-muted-foreground text-[11px]">
              <tr>
                <th className="py-3 px-3.5 text-left font-semibold">{safeT("dateTime", "Date")}</th>
                <th className="py-3 px-3.5 text-left font-semibold">{safeT("refNo", "Ref #")}</th>
                <th className="py-3 px-3.5 text-left font-semibold">{safeT("product", "Product / Item")}</th>
                <th className="py-3 px-3.5 text-left font-semibold">{safeT("stockType", "Stock Category")}</th>
                <th className="py-3 px-3.5 text-left font-semibold">{safeT("action", "Action")}</th>
                <th className="py-3 px-3.5 text-right font-semibold">{safeT("adjustedQty", "Adjusted Qty")}</th>
                <th className="py-3 px-3.5 text-right font-semibold">{safeT("rate", "Rate")}</th>
                <th className="py-3 px-3.5 text-right font-semibold">{safeT("totalValue", "Total Value")}</th>
                <th className="py-3 px-3.5 text-left font-semibold">{safeT("reason", "Reason")}</th>
                <th className="py-3 px-3.5 text-left font-semibold">{safeT("notesRemarks", "Notes / Remarks")}</th>
                <th className="py-3 px-3.5 text-center font-semibold">{safeT("actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading && allAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    <span>{safeT("loading", "Loading...")}</span>
                  </td>
                </tr>
              ) : paginatedAdjustments.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-muted-foreground">
                    <div className="max-w-xs mx-auto space-y-2">
                      <SlidersHorizontal className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                      <p className="font-semibold text-foreground text-sm">
                        {hasActiveFilters
                          ? safeT("noMatchingAdjustments", "No adjustments match your current filters.")
                          : safeT("noAdjustmentsFound", "No stock adjustments recorded yet.")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {hasActiveFilters
                          ? "Try clearing filters or search terms to see all adjustments."
                          : safeT("adjustStockDesc", "Add or reduce available/damaged stock with reason tracking.")}
                      </p>
                      {hasActiveFilters && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetFilters}
                          className="mt-2 text-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          <span>Reset Filters</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedAdjustments.map((a) => {
                  const isAdd = a.action_type === "add";
                  const isDamaged = a.stock_type === "damaged";
                  const total = Math.round(a.quantity * (a.cost_price || 0) * 100) / 100;
                  let reasonLabel = a.reason || "-";
                  if (a.reason) {
                    try {
                      const translated = (t as any)(`reasons.${a.reason}`);
                      if (translated && typeof translated === "string" && !translated.startsWith("reasons.")) {
                        reasonLabel = translated;
                      }
                    } catch {
                      reasonLabel = a.reason;
                    }
                  }

                  return (
                    <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                      {/* Date & Time down to seconds */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                        {formatPakistaniDateTime(a.date, false)}
                      </td>

                      {/* Ref # */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap font-mono font-semibold text-foreground">
                        {a.ref_no}
                      </td>

                      {/* Product Name */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="font-semibold text-foreground max-w-[200px] truncate" title={a.product_name}>
                          {a.product_name}
                        </div>
                      </td>

                      {/* Stock Category (Available vs Damaged) */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {isDamaged ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-semibold">
                            {safeT("damagedStock", "Damaged")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-semibold bg-muted/40">
                            {safeT("availableStock", "Available")}
                          </Badge>
                        )}
                      </td>

                      {/* Action (Add vs Reduce) */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {isAdd ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold gap-1">
                            <ArrowDownLeft className="w-3 h-3" />
                            {safeT("addStock", "Add")}
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] font-semibold gap-1">
                            <ArrowUpRight className="w-3 h-3" />
                            {safeT("reduceStock", "Reduce")}
                          </Badge>
                        )}
                      </td>

                      {/* Quantity */}
                      <td
                        className={`py-2.5 px-3.5 text-right font-bold whitespace-nowrap ${
                          isAdd
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {isAdd ? `+${a.quantity}` : `-${a.quantity}`}
                      </td>

                      {/* Unit Cost Rate */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono text-muted-foreground">
                        {formatCurrency(a.cost_price || 0)}
                      </td>

                      {/* Total Value Impact */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-medium font-mono text-foreground">
                        {formatCurrency(total)}
                      </td>

                      {/* Reason */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-muted/60 text-foreground font-medium">
                          {reasonLabel}
                        </span>
                      </td>

                      {/* Notes / Remarks */}
                      <td className="py-2.5 px-3.5 text-muted-foreground text-[11px] max-w-[200px] truncate" title={a.notes}>
                        {a.notes || "-"}
                      </td>

                      {/* Actions (Edit & Delete) */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingAdjustment(a);
                                setIsEditDialogOpen(true);
                              }}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                              title={safeT("editAdjustment", "Edit Adjustment")}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingAdjustment(a);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-md transition-colors"
                              title={safeT("deleteAdjustment", "Delete Adjustment")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE / TABLET CARD VIEW (under md) */}
        <div className="block md:hidden divide-y divide-border/60">
          {loading && allAdjustments.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
              <span>{safeT("loading", "Loading...")}</span>
            </div>
          ) : paginatedAdjustments.length === 0 ? (
            <div className="py-12 px-4 text-center text-muted-foreground">
              <div className="max-w-xs mx-auto space-y-2">
                <SlidersHorizontal className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="font-semibold text-foreground text-sm">
                  {hasActiveFilters
                    ? safeT("noMatchingAdjustments", "No adjustments match your current filters.")
                    : safeT("noAdjustmentsFound", "No stock adjustments recorded yet.")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {hasActiveFilters
                    ? "Try clearing filters or search terms to see all adjustments."
                    : safeT("adjustStockDesc", "Add or reduce available/damaged stock with reason tracking.")}
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetFilters}
                    className="mt-2 text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    <span>Reset Filters</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            paginatedAdjustments.map((a) => {
              const isAdd = a.action_type === "add";
              const isDamaged = a.stock_type === "damaged";
              const total = Math.round(a.quantity * (a.cost_price || 0) * 100) / 100;
              let reasonLabel = a.reason || "-";
              if (a.reason) {
                try {
                  const translated = (t as any)(`reasons.${a.reason}`);
                  if (translated && typeof translated === "string" && !translated.startsWith("reasons.")) {
                    reasonLabel = translated;
                  }
                } catch {
                  reasonLabel = a.reason;
                }
              }

              return (
                <div key={a.id} className="p-3.5 sm:p-4 space-y-2.5 hover:bg-muted/20 transition-colors">
                  {/* Line 1: Ref #, Stock Category, Action Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {a.ref_no}
                      </span>
                      {isDamaged ? (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-semibold py-0 px-1.5">
                          {safeT("damagedStock", "Damaged")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-semibold py-0 px-1.5 bg-muted/40 text-muted-foreground">
                          {safeT("availableStock", "Available")}
                        </Badge>
                      )}
                    </div>

                    <div className="shrink-0">
                      {isAdd ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] sm:text-[11px] font-semibold gap-1 py-0.5">
                          <ArrowDownLeft className="w-3 h-3" />
                          <span>{safeT("addStock", "Add")}</span>
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] sm:text-[11px] font-semibold gap-1 py-0.5">
                          <ArrowUpRight className="w-3 h-3" />
                          <span>{safeT("reduceStock", "Reduce")}</span>
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Line 2: Product Name & Reason */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-foreground leading-tight line-clamp-2" title={a.product_name}>
                        {a.product_name}
                      </p>
                    </div>
                    <span className="inline-block shrink-0 px-2 py-0.5 rounded text-[10px] font-medium bg-muted/70 text-foreground border border-border/40">
                      {reasonLabel}
                    </span>
                  </div>

                  {/* Line 3: Quantity & Financial Impact Box */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-muted-foreground font-medium truncate">{safeT("adjustedQty", "Adjusted Qty")}</span>
                      <span className={`text-sm font-extrabold mt-0.5 truncate ${isAdd ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {isAdd ? `+${a.quantity}` : `-${a.quantity}`}
                      </span>
                    </div>

                    <div className="flex flex-col border-l border-border/50 pl-2 min-w-0">
                      <span className="text-[10px] text-muted-foreground font-medium truncate">{safeT("rate", "Rate")}</span>
                      <span className="text-xs font-semibold text-foreground mt-0.5 font-mono truncate">
                        {formatCurrency(a.cost_price || 0)}
                      </span>
                    </div>

                    <div className="flex flex-col border-l border-border/50 pl-2 min-w-0">
                      <span className="text-[10px] text-muted-foreground font-medium truncate">{safeT("totalValue", "Total Value")}</span>
                      <span className="text-xs font-bold text-foreground mt-0.5 font-mono truncate">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>

                  {/* Notes (if any) */}
                  {a.notes && (
                    <p className="text-[11px] text-muted-foreground bg-background/60 p-2 rounded border border-border/40 italic line-clamp-2">
                      {a.notes}
                    </p>
                  )}

                  {/* Line 4: Timestamp and Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground flex-wrap gap-2">
                    <div className="flex items-center gap-1 font-mono text-[10px] truncate pr-2">
                      <Calendar className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                      <span className="truncate">{formatPakistaniDateTime(a.date, false)}</span>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingAdjustment(a);
                            setIsEditDialogOpen(true);
                          }}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                          title={safeT("editAdjustment", "Edit Adjustment")}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDeletingAdjustment(a);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-200 dark:hover:border-rose-900 rounded-md"
                          title={safeT("deleteAdjustment", "Delete Adjustment")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Footer */}
        {totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 border-t border-border/60 gap-3">
            <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-6 w-full sm:w-auto text-xs text-muted-foreground">
              <span className="whitespace-nowrap">{tCommon("totalCountLabel", { count: totalCount })}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] whitespace-nowrap">{tCommon("rowsPerPage") || "Rows:"}</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(val) => {
                    setPageSize(Number(val));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-7 w-[60px] text-xs">
                    <SelectValue placeholder={String(pageSize)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="w-full sm:w-auto flex justify-center sm:justify-end overflow-x-auto [&>div]:py-0 [&>div]:px-0">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => setCurrentPage(page)}
                  isLoading={loading}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Adjustment Dialog */}
      {isEditDialogOpen && (
        <AdjustStockDialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open);
            if (!open) setEditingAdjustment(null);
          }}
          adjustment={editingAdjustment}
          onSuccess={async (updatedProduct) => {
            toast.success(
              `${safeT("updateAdjustmentSuccess", "Adjustment updated")}. ${updatedProduct.name}: Stock ${updatedProduct.quantity}, Rate: ${formatCurrency(updatedProduct.cost_price || 0)}`
            );
            await fetchServerAdjustments();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{safeT("deleteAdjustmentTitle", "Delete Stock Adjustment")}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {safeT(
                "deleteAdjustmentConfirm",
                "Are you sure you want to delete this adjustment? The stock change will be reverted and the product average cost price will be recalculated."
              )}
            </DialogDescription>
          </DialogHeader>

          {deletingAdjustment && (
            <div className="bg-muted/50 p-3 rounded-xl space-y-1.5 text-xs border border-border/80 my-1">
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Ref #:</span>
                <span className="font-mono font-bold text-foreground">{deletingAdjustment.ref_no}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Product:</span>
                <span className="font-semibold text-foreground truncate max-w-[200px]">{deletingAdjustment.product_name}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Stock Type:</span>
                <span className="capitalize font-medium">{deletingAdjustment.stock_type}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Action & Qty:</span>
                <span className={`font-bold ${deletingAdjustment.action_type === "add" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {deletingAdjustment.action_type === "add"
                    ? `+${deletingAdjustment.quantity} (Stock will be deducted)`
                    : `-${deletingAdjustment.quantity} (Stock will be restored)`}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground">Unit Cost:</span>
                <span className="font-mono font-medium">{formatCurrency(deletingAdjustment.cost_price || 0)}</span>
              </div>
              <div className="flex justify-between items-center gap-2 border-t border-border/60 pt-1.5">
                <span className="text-muted-foreground">Total Valuation:</span>
                <span className="font-bold font-mono">{formatCurrency(deletingAdjustment.quantity * (deletingAdjustment.cost_price || 0))}</span>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setIsDeleteDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="gap-1.5 font-semibold w-full sm:w-auto"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{safeT("revertAndRecalculate", "Reverting & Recalculating...")}</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{safeT("deleteAdjustment", "Delete & Revert")}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
