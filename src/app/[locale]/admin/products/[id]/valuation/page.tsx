"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  TrendingUp,
  Layers,
  FileDown,
  Printer,
  Calendar,
  RotateCcw,
  Loader2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Tag,
  Building2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { formatPakistaniDateTime, toPakistaniDateString, toHTMLDateString } from "@/lib/date-utils";
import { getUomShortcut, formatLocalizedUom } from "@/lib/uom";
import { exportStockValuationLedgerToExcel } from "@/lib/excel";
import { getOfflineProductStockValuationHistory } from "@/lib/db/offline-stock-manager";
import { cn } from "@/lib/utils";

const formatValuationPrice = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === "") return "-";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "-";
  return `Rs. ${num.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export default function StockValuationLedgerPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;

  const t = useTranslations("stockValuationLedger");
  const tCommon = useTranslations("common");
  const tProducts = useTranslations("products");

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters (default to current month as per accounting standards)
  const [fromDate, setFromDate] = useState<string>(() => {
    const today = new Date();
    return toHTMLDateString(new Date(today.getFullYear(), today.getMonth(), 1));
  });
  const [toDate, setToDate] = useState<string>(() => {
    const today = new Date();
    return toHTMLDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  });
  const [activePreset, setActivePreset] = useState<"all" | "today" | "thisMonth" | "last30Days">("thisMonth");
  const [valuationMethod, setValuationMethod] = useState<"average" | "fifo">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("setting_stockValuationMethod");
      if (saved === "fifo") return "fifo";
    }
    return "average";
  });

  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [activeTab, setActiveTab] = useState<"ledger" | "batches">("ledger");

  // Sync valuation method from loaded data if specified
  useEffect(() => {
    if (data?.product?.valuationMethod && data.product.valuationMethod !== valuationMethod) {
      setValuationMethod(data.product.valuationMethod);
    }
  }, [data, valuationMethod]);

  // Sync valuation method from localStorage & listen for updates across app
  useEffect(() => {
    const syncMethod = () => {
      if (typeof window !== "undefined") {
        const saved = (localStorage.getItem("setting_stockValuationMethod") || "average") as "average" | "fifo";
        setValuationMethod(saved);
      }
    };

    syncMethod();
    window.addEventListener("stockValuationMethodUpdated", syncMethod);
    window.addEventListener("storage", syncMethod);
    return () => {
      window.removeEventListener("stockValuationMethodUpdated", syncMethod);
      window.removeEventListener("storage", syncMethod);
    };
  }, []);

  // Ensure activeTab is reset to ledger if method is not FIFO
  useEffect(() => {
    if (valuationMethod !== "fifo" && activeTab === "batches") {
      setActiveTab("ledger");
    }
  }, [valuationMethod, activeTab]);

  const fetchValuationData = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Try server API
      const url = new URL("/api/reports/stock/history", window.location.origin);
      url.searchParams.set("productId", productId);
      url.searchParams.set("mode", "valuation");
      if (fromDate) url.searchParams.set("fromDate", fromDate);
      if (toDate) url.searchParams.set("toDate", toDate);

      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLoading(false);
        return;
      }
      throw new Error("Server fetch failed, falling back to local database");
    } catch (apiErr) {
      // 2. Fallback to Dexie local database for offline support
      try {
        const localData = await getOfflineProductStockValuationHistory({
          productId,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          mode: "valuation",
        });
        if (localData) {
          setData(localData);
          setLoading(false);
          return;
        }
      } catch (localErr: any) {
        console.error("Offline valuation fetch error:", localErr);
      }
      setError("Failed to load valuation ledger. Please verify product ID.");
    } finally {
      setLoading(false);
    }
  }, [productId, fromDate, toDate]);

  useEffect(() => {
    fetchValuationData();
  }, [fetchValuationData]);

  const handlePresetChange = (preset: "all" | "today" | "thisMonth" | "last30Days") => {
    setActivePreset(preset);
    const today = new Date();
    if (preset === "all") {
      setFromDate("");
      setToDate("");
    } else if (preset === "today") {
      const todayStr = toHTMLDateString(today);
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === "thisMonth") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFromDate(toHTMLDateString(firstDay));
      setToDate(toHTMLDateString(lastDay));
    } else if (preset === "last30Days") {
      const past30 = new Date(today);
      past30.setDate(today.getDate() - 30);
      setFromDate(toHTMLDateString(past30));
      setToDate(toHTMLDateString(today));
    }
  };

  const product = data?.product;
  const summary = data?.summary;
  const batches = data?.batches || [];
  const movements = data?.movements || [];

  interface MovementGroup {
    key: string;
    refNo: string;
    type: string;
    date: any;
    partyName: string;
    items: any[];
  }

  const groupedMovements = useMemo(() => {
    if (!movements || movements.length === 0) return [];

    const groups: MovementGroup[] = [];

    for (const m of movements) {
      const isGroupable =
        m.refNo &&
        m.refNo !== "-" &&
        m.refNo !== "OPENING" &&
        m.type !== "opening_stock";

      const lastGroup = groups[groups.length - 1];
      const isSameTransaction =
        isGroupable &&
        lastGroup &&
        lastGroup.refNo === m.refNo &&
        lastGroup.type === m.type &&
        new Date(lastGroup.date).getTime() === new Date(m.date).getTime();

      if (isSameTransaction) {
        lastGroup.items.push(m);
      } else {
        groups.push({
          key: m.id || `${m.refNo}-${m.type}-${m.date}-${groups.length}`,
          refNo: m.refNo || "-",
          type: m.type,
          date: m.date,
          partyName: m.partyName || "-",
          items: [m],
        });
      }
    }

    if (sortOrder === "desc") {
      groups.reverse();
    }

    return groups;
  }, [movements, sortOrder]);

  const sortedMovements = useMemo(() => {
    const list = [...movements];
    // Do NOT re-sort by date timestamps: the valuation engine already sequenced
    // inwards before deficit sales to guarantee accurate running stock and WAC.
    if (sortOrder === "desc") {
      list.reverse();
    }
    return list;
  }, [movements, sortOrder]);

  const handleExportExcel = () => {
    if (!product || sortedMovements.length === 0) return;
    exportStockValuationLedgerToExcel(product.name || "Item", sortedMovements, undefined, valuationMethod);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4 print:p-0">
      {/* Print Stylesheet */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          nav, aside, header, .no-print {
            display: none !important;
          }
          .print-full {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print border-b pb-4">
        <div>
          <Link
            href={`/${locale}/admin/products`}
            className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground mb-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            {t("backToProducts")}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              {t("title")}
            </h1>
            <Badge variant="outline" className="text-xs px-2.5 py-0.5 border-primary/40 bg-primary/10 text-primary font-semibold">
              {valuationMethod === "fifo" ? t("fifo") : t("weightedAverage")}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {product?.name ? `${product.name} • ` : ""}
            From {toPakistaniDateString(fromDate || summary?.periodStart || new Date())} To {toPakistaniDateString(toDate || summary?.periodEnd || new Date())}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1.5 text-xs font-semibold"
            disabled={loading || !data}
          >
            <Printer className="w-3.5 h-3.5" />
            {t("print")}
          </Button> */}
          <Button
            variant="default"
            size="sm"
            onClick={handleExportExcel}
            className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
            disabled={loading || sortedMovements.length === 0}
          >
            <FileDown className="w-3.5 h-3.5" />
            {t("exportExcel")}
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading && !data && (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm font-medium">{tCommon("loading")}</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={fetchValuationData} className="ml-auto text-xs">
            {tCommon("tryAgain")}
          </Button>
        </div>
      )}

      {data && (
        <>
          {/* Product Profile Card */}
          <Card className="border shadow-xs bg-card/60 backdrop-blur-xs">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground uppercase px-2 py-0.5 rounded bg-muted">
                      SKU: {product?.sku || "-"}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Tag className="w-3 h-3" /> {product?.category || "General"}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {product?.branch || "Main"}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">
                    {product?.name}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-3.5 py-2 rounded-xl bg-muted/40 border text-right">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                      {t("sellingPrice")}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {formatValuationPrice(product?.sellPrice || 0)}
                    </span>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-primary/10 border border-primary/30 text-right">
                    <span className="text-[10px] uppercase font-semibold text-primary block">
                      {valuationMethod === "fifo" ? (t("currentFifoCost") || "Current FIFO Cost") : t("currentWac")}
                    </span>
                    <span className="text-sm font-extrabold text-primary">
                      {formatValuationPrice(summary?.closingWac ?? product?.costPrice ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4 Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Physical Stock */}
            <div className="p-4 rounded-xl border bg-card/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-muted-foreground block">{t("currentStock")}</span>
                <div className="text-xl font-extrabold text-foreground mt-1 flex items-baseline gap-1">
                  <span>{summary?.closingStock ?? product?.currentStock}</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {getUomShortcut(product?.uom)}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  Opening: {summary?.openingStock || 0} {getUomShortcut(product?.uom)}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
            </div>

            {/* Card 2: Total Inward */}
            <div className="p-4 rounded-xl border bg-card/80 shadow-xs flex items-center justify-between border-emerald-500/20">
              <div>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 block">{t("inwardQty")}</span>
                <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                  +{summary?.totalInward || 0}{" "}
                  <span className="text-xs font-medium text-muted-foreground">
                    {getUomShortcut(product?.uom)}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  Purchases, Returns, Adj (+)
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
            </div>

            {/* Card 3: Total Outward */}
            <div className="p-4 rounded-xl border bg-card/80 shadow-xs flex items-center justify-between border-rose-500/20">
              <div>
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400 block">{t("outwardQty")}</span>
                <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                  -{summary?.totalOutward || 0}{" "}
                  <span className="text-xs font-medium text-muted-foreground">
                    {getUomShortcut(product?.uom)}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  Sales, Returns, Adj (-)
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            {/* Card 4: Total Stock Valuation */}
            <div className="p-4 rounded-xl border bg-card/80 shadow-xs flex items-center justify-between border-blue-500/20">
              <div>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 block">{t("totalValuation")}</span>
                <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                  {formatValuationPrice(summary?.closingValuation ?? product?.totalValuation ?? 0)}
                </div>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  {valuationMethod === "fifo" ? "Unsold FIFO Batches Value" : "Stock × WAC Unit Cost"}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filters Bar (no-print) */}
          <div className="p-3 sm:p-4 rounded-xl border bg-card/60 shadow-xs space-y-3 no-print">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant={activePreset === "all" ? "default" : "outline"}
                  className="h-8 text-xs font-medium"
                  onClick={() => handlePresetChange("all")}
                >
                  {t("allTime")}
                </Button>
                <Button
                  size="sm"
                  variant={activePreset === "today" ? "default" : "outline"}
                  className="h-8 text-xs font-medium"
                  onClick={() => handlePresetChange("today")}
                >
                  {t("today")}
                </Button>
                <Button
                  size="sm"
                  variant={activePreset === "thisMonth" ? "default" : "outline"}
                  className="h-8 text-xs font-medium"
                  onClick={() => handlePresetChange("thisMonth")}
                >
                  {t("thisMonth")}
                </Button>
                <Button
                  size="sm"
                  variant={activePreset === "last30Days" ? "default" : "outline"}
                  className="h-8 text-xs font-medium"
                  onClick={() => handlePresetChange("last30Days")}
                >
                  {t("last30Days")}
                </Button>
              </div>

              {/* Date Inputs */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{t("fromDate")}:</span>
                  <div className="w-36">
                    <DatePicker
                      value={fromDate}
                      onChange={(val) => {
                        setFromDate(val);
                        setActivePreset("all");
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{t("toDate")}:</span>
                  <div className="w-36">
                    <DatePicker
                      value={toDate}
                      onChange={(val) => {
                        setToDate(val);
                        setActivePreset("all");
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                {(fromDate || toDate) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePresetChange("all")}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title="Reset dates"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Active Valuation Method View Header */}
          <div className="flex items-center justify-between border-b pt-1 no-print">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("ledger")}
                className={cn(
                  "pb-3 text-xs sm:text-sm font-bold px-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer",
                  activeTab === "ledger"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <TrendingUp className="w-4 h-4" />
                <span>
                  {valuationMethod === "fifo"
                    ? (t("fifoLedgerTab"))
                    : t("wacTab")}{" "}
                  ({sortedMovements.length})
                </span>
              </button>

              {valuationMethod === "fifo" && (
                <button
                  type="button"
                  onClick={() => setActiveTab("batches")}
                  className={cn(
                    "pb-3 text-xs sm:text-sm font-bold px-3 border-b-2 flex items-center gap-2 transition-colors cursor-pointer",
                    activeTab === "batches"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Layers className="w-4 h-4" />
                  <span>{t("fifoTab")} ({batches.length})</span>
                </button>
              )}
            </div>

            {activeTab === "ledger" && (
              <div className="text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                  className="hover:text-foreground font-medium flex items-center gap-1 pb-2 cursor-pointer"
                >
                  <span>{sortOrder === "asc" ? "Oldest First ↑" : "Newest First ↓"}</span>
                </button>
              </div>
            )}
          </div>

          {/* TAB 1: Moving Average (WAC) / FIFO Movement Ledger Table */}
          {activeTab === "ledger" && (
            <Card className="border shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b text-muted-foreground text-[11px]">
                    <tr>
                      <th className="py-3 px-3 text-left font-semibold">{t("date")}</th>
                      <th className="py-3 px-3 text-left font-semibold">{t("type")}</th>
                      <th className="py-3 px-3 text-left font-semibold">{t("refNo")}</th>
                      <th className="py-3 px-3 text-left font-semibold">{t("party")}</th>
                      {/* Qty & Unit Cost (2 clean columns for both FIFO and WAC) */}
                      <th className="py-3 px-3 text-right font-semibold">{t("qty")}</th>
                      <th className="py-3 px-3 text-right font-semibold">{t("unitCost")}</th>
                      <th className="py-3 px-3 text-right font-semibold">{t("balanceStock")}</th>
                      {valuationMethod !== "fifo" && (
                        <th className="py-3 px-3 text-right font-extrabold text-primary bg-primary/5">
                          {t("effectiveWac")}
                        </th>
                      )}
                      <th className="py-3 px-3 text-right font-bold text-blue-600 dark:text-blue-400">{t("stockValuation")}</th>
                      <th className="py-3 px-3 text-left font-semibold">
                        {valuationMethod === "fifo" ? (t("fifoImpact") || "FIFO Depletion Impact") : t("calculationImpact")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {groupedMovements.length === 0 ? (
                      <tr>
                        <td colSpan={valuationMethod === "fifo" ? 9 : 10} className="py-16 text-center text-muted-foreground text-xs">
                          {t("noRecords")}
                        </td>
                      </tr>
                    ) : (
                      groupedMovements.map((group) => {
                        const isMulti = group.items.length > 1;

                        return group.items.map((m: any, subIdx: number) => {
                          const isOpening = m.type === "opening_stock";
                          const isPurchase = m.type === "purchase";
                          const isSale = m.type === "sale";
                          const isReturn = m.type === "sale_return";
                          const isAdjustmentAdd = m.type === "adjustment_add";
                          const isAdjustmentReduce = m.type === "adjustment_reduce";

                          const isNegativeBalance = Number(m.balance) < 0;
                          const isLastSub = subIdx === group.items.length - 1;
                          const subBorderClass = isLastSub ? "border-b border-border/60" : "border-b border-dashed border-border/40";

                          return (
                            <tr
                              key={m.id || `${group.key}-${subIdx}`}
                              className={`hover:bg-muted/30 transition-colors ${subIdx > 0 ? "bg-muted/10" : ""}`}
                            >
                              {subIdx === 0 && (
                                <>
                                  {/* Date */}
                                  <td
                                    rowSpan={group.items.length}
                                    className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap align-top border-b border-border/60 bg-card/60"
                                  >
                                    {formatPakistaniDateTime(m.date, false)}
                                  </td>

                                  {/* Type Badge */}
                                  <td
                                    rowSpan={group.items.length}
                                    className="py-2.5 px-3 whitespace-nowrap align-top border-b border-border/60 bg-card/60"
                                  >
                                    {isOpening && (
                                      <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] font-semibold">
                                        Opening Stock
                                      </Badge>
                                    )}
                                    {isPurchase && (
                                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold">
                                        Purchase Inward
                                      </Badge>
                                    )}
                                    {isSale && (
                                      <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] font-semibold">
                                        Sale Outward
                                      </Badge>
                                    )}
                                    {isReturn && (
                                      <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 text-[10px] font-semibold">
                                        Sale Return
                                      </Badge>
                                    )}
                                    {isAdjustmentAdd && (
                                      <Badge className="bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30 text-[10px] font-semibold">
                                        Adjustment (+)
                                      </Badge>
                                    )}
                                    {isAdjustmentReduce && (
                                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-semibold">
                                        Adjustment (-)
                                      </Badge>
                                    )}
                                  </td>
                                </>
                              )}

                              {/* Ref / Voucher # & Batch Number */}
                              <td className={`py-2.5 px-3 font-mono text-[11px] whitespace-nowrap align-top ${subBorderClass}`}>
                                {subIdx === 0 && (
                                  <div className="font-medium text-foreground">{group.refNo || "-"}</div>
                                )}
                                {m.batchNumber && (
                                  <span
                                    className={`text-[10px] font-mono block ${
                                      m.batchNumber === "DEFICIT"
                                        ? "text-rose-600 dark:text-rose-400 font-semibold"
                                        : "text-sky-600 dark:text-sky-400 font-medium"
                                    }`}
                                  >
                                    {m.batchNumber === "DEFICIT" ? "Oversold Deficit" : `Batch: ${m.batchNumber}`}
                                  </span>
                                )}
                              </td>

                              {subIdx === 0 && (
                                /* Party / Entity */
                                <td
                                  rowSpan={group.items.length}
                                  className="py-2.5 px-3 text-muted-foreground max-w-[180px] truncate align-top border-b border-border/60 bg-card/60"
                                  title={m.partyName}
                                >
                                  {m.partyName || "-"}
                                </td>
                              )}

                              {/* Qty: Only number, no + or - */}
                              <td className={`py-2.5 px-3 text-right font-mono font-medium text-foreground whitespace-nowrap ${subBorderClass}`}>
                                {m.inwardQty > 0
                                  ? m.inwardQty
                                  : m.outwardQty > 0
                                  ? m.outwardQty
                                  : "-"}
                              </td>

                              {/* Unit Cost */}
                              <td className={`py-2.5 px-3 text-right font-mono text-muted-foreground whitespace-nowrap ${subBorderClass}`}>
                                {m.inwardQty > 0
                                  ? formatValuationPrice(m.unitRate)
                                  : m.outwardQty > 0
                                  ? formatValuationPrice(m.costPrice)
                                  : "-"}
                              </td>

                              {/* Running Balance Stock */}
                              <td className={`py-2.5 px-3 text-right whitespace-nowrap ${subBorderClass}`}>
                                <span
                                  className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                                    isNegativeBalance
                                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                                      : "bg-muted text-foreground"
                                  }`}
                                >
                                  {m.balance} {getUomShortcut(product?.uom)}
                                </span>
                              </td>

                              {/* Effective WAC Unit Rate (Only shown in WAC mode) */}
                              {valuationMethod !== "fifo" && (
                                <td className={`py-2.5 px-3 text-right font-mono font-black text-primary bg-primary/5 whitespace-nowrap ${subBorderClass}`}>
                                  {formatValuationPrice(m.effectiveWac ?? m.costPrice ?? 0)}
                                </td>
                              )}

                              {/* Running Valuation */}
                              <td className={`py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap ${subBorderClass}`}>
                                {formatValuationPrice(m.runningValuation ?? 0)}
                              </td>

                              {/* WAC Formula / Calculation Notes */}
                              <td className={`py-2.5 px-3 text-[11px] text-muted-foreground font-mono min-w-[240px] max-w-[420px] whitespace-normal break-words leading-relaxed align-top ${subBorderClass}`} title={m.wacFormula}>
                                <div className="flex items-start gap-1.5 flex-wrap">
                                  {m.batchNumber && (
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] font-mono px-1.5 py-0 shrink-0 font-semibold mt-0.5 ${
                                        m.batchNumber === "DEFICIT"
                                          ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                          : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                      }`}
                                    >
                                      {m.batchNumber === "DEFICIT" ? "Oversold" : `Batch: ${m.batchNumber}`}
                                    </Badge>
                                  )}
                                  {m.wacFormula ? (
                                    <span className="whitespace-normal break-words">{m.wacFormula}</span>
                                  ) : (
                                    "-"
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })
                    )}
                  </tbody>
                  {sortedMovements.length > 0 && (
                    <tfoot className="bg-muted/70 border-t-2 border-border font-bold text-foreground">
                      <tr>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {toPakistaniDateString(toDate || summary?.periodEnd || new Date())}
                        </td>
                        <td colSpan={3} className="py-2.5 px-3 text-left font-bold text-foreground">
                          *** Closing Stock ***
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground whitespace-nowrap">-</td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground whitespace-nowrap">-</td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                              (summary?.closingStock ?? product?.currentStock ?? 0) < 0
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                                : "bg-muted text-foreground"
                            }`}
                          >
                            {summary?.closingStock ?? product?.currentStock ?? 0} {getUomShortcut(product?.uom)}
                          </span>
                        </td>
                        {valuationMethod !== "fifo" && (
                          <td className="py-2.5 px-3 text-right font-mono font-black text-primary bg-primary/10 whitespace-nowrap">
                            {formatValuationPrice(summary?.closingWac ?? 0)}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {formatValuationPrice(summary?.closingValuation ?? 0)}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-muted-foreground italic">
                          {valuationMethod === "fifo" ? "Period closing FIFO valuation" : "Period closing valuation"}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>
          )}

          {/* TAB 2: Tracked Batches Table */}
          {valuationMethod === "fifo" && activeTab === "batches" && (
            <Card className="border shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b text-muted-foreground text-[11px]">
                    <tr>
                      <th className="py-3 px-3 text-left font-semibold">{t("date")}</th>
                      <th className="py-3 px-3 text-left font-semibold">{t("type")}</th>
                      <th className="py-3 px-3 text-left font-semibold">{t("batchNumber")}</th>
                      <th className="py-3 px-3 text-right font-semibold">{t("initialQty")}</th>
                      <th className="py-3 px-3 text-right font-semibold">{t("remainingQty")}</th>
                      <th className="py-3 px-3 text-right font-semibold">{t("batchCost")}</th>
                      <th className="py-3 px-3 text-left font-semibold">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {batches.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground text-xs">
                          {t("noBatches")}
                        </td>
                      </tr>
                    ) : (
                      batches.map((b: any) => {
                        const isDepleted = Number(b.remaining_quantity) <= 0;
                        const isOpening = b.source_type === "opening_stock";
                        const isPurchase = b.source_type === "purchase_bill" || b.source_type === "purchase";
                        const isAdjustment = b.source_type === "stock_adjustment";
                        const isReturn = b.source_type === "sale_return";

                        return (
                          <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                            {/* Date */}
                            <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                              {formatPakistaniDateTime(b.batch_date, false)}
                            </td>

                            {/* Type */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {isOpening && (
                                <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] font-semibold">
                                  Opening Stock
                                </Badge>
                              )}
                              {isPurchase && (
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold">
                                  Purchase Inward
                                </Badge>
                              )}
                              {isAdjustment && (
                                <Badge className="bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30 text-[10px] font-semibold">
                                  Adjustment
                                </Badge>
                              )}
                              {isReturn && (
                                <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 text-[10px] font-semibold">
                                  Sale Return
                                </Badge>
                              )}
                              {!isOpening && !isPurchase && !isAdjustment && !isReturn && (
                                <span className="text-muted-foreground capitalize">
                                  {b.source_type?.replace(/_/g, " ") || "-"}
                                </span>
                              )}
                            </td>

                            {/* Batch # */}
                            <td className="py-2.5 px-3 font-mono font-medium text-foreground whitespace-nowrap">
                              {b.batch_number}
                            </td>

                            {/* Initial Qty */}
                            <td className="py-2.5 px-3 text-right font-mono font-medium">
                              {b.initial_quantity} {getUomShortcut(product?.uom)}
                            </td>

                            {/* Remaining Qty */}
                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              <span className={isDepleted ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"}>
                                {b.remaining_quantity} {getUomShortcut(product?.uom)}
                              </span>
                            </td>

                            {/* Batch Cost */}
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-primary">
                              {formatValuationPrice(b.cost_price)}
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {isDepleted ? (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground bg-muted/40">
                                  {t("exhausted")}
                                </Badge>
                              ) : (
                                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                                  {t("active")}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
