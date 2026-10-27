"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Package,
  TrendingUp,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Loader2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { formatCurrency, formatStatementDate } from "@/lib/utils";
import { getUomShortcut } from "@/lib/uom";
import { toHTMLDateString, formatPakistaniDateTime } from "@/lib/date-utils";

interface ProductStockLedgerModalProps {
  productId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductStockLedgerModal({
  productId,
  open,
  onOpenChange,
}: ProductStockLedgerModalProps) {
  const t = useTranslations("stockLedgerModal");
  const tCommon = useTranslations("common");

  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Date Filters
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [activePreset, setActivePreset] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"ledger" | "batches">("ledger");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const fetchHistory = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/reports/stock/history", window.location.origin);
      url.searchParams.set("productId", productId);
      url.searchParams.set("mode", "movement");
      if (fromDate) url.searchParams.set("fromDate", fromDate);
      if (toDate) url.searchParams.set("toDate", toDate);

      const res = await fetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLoading(false);
        return;
      }
      throw new Error("Server fetch failed");
    } catch (err: any) {
      try {
        const { getOfflineProductStockValuationHistory } = await import("@/lib/db/offline-stock-manager");
        const localData = await getOfflineProductStockValuationHistory({
          productId,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          mode: "movement",
        });
        if (localData) {
          setData(localData);
          setLoading(false);
          return;
        }
      } catch (localErr) {
        console.error("Offline stock ledger fetch error:", localErr);
      }
      console.error("Error loading stock ledger history:", err);
      setError(err.message || t("failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [productId, fromDate, toDate, t]);

  useEffect(() => {
    if (open && productId) {
      fetchHistory();
    } else {
      setData(null);
      setError(null);
    }
  }, [open, productId, fetchHistory]);

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
  };

  const product = data?.product;
  const summary = data?.summary;
  const movements = data?.movements || [];
  const batches = data?.batches || [];

  const sortedMovements = React.useMemo(() => {
    if (!movements || movements.length === 0) return [];
    const list = [...movements];
    if (sortOrder === "desc") {
      list.reverse();
    }
    return list;
  }, [movements, sortOrder]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        {/* Header */}
        <DialogHeader className="pb-3 border-b flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  {product ? product.name : t("title")}
                </DialogTitle>
                {product && (
                  <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                    {product.category || "General"}
                  </Badge>
                )}
                {product?.sku && product.sku !== "-" && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    SKU: {product.sku}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs mt-1 text-muted-foreground">
                {t("description")}
              </DialogDescription>
            </div>

            {product && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Badge
                  variant="outline"
                  className="px-2.5 py-1 text-xs font-semibold gap-1.5 border-primary/20 bg-primary/10 text-primary"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    {product.valuationMethod === "fifo" ? t("valuationFifo") : t("valuationAverage")}
                  </span>
                </Badge>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Filters Bar */}
        <div className="py-2.5 border-b bg-muted/20 -mx-4 sm:-mx-6 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-2.5 flex-shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="font-semibold text-muted-foreground text-xs mr-1">{t("period")}:</span>
            <Button
              variant={activePreset === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => handlePresetChange("all")}
              className="h-7 text-xs px-2.5"
            >
              {t("allTime")}
            </Button>
            <Button
              variant={activePreset === "thisMonth" ? "default" : "outline"}
              size="sm"
              onClick={() => handlePresetChange("thisMonth")}
              className="h-7 text-xs px-2.5"
            >
              {t("thisMonth")}
            </Button>
            <Button
              variant={activePreset === "last30Days" ? "default" : "outline"}
              size="sm"
              onClick={() => handlePresetChange("last30Days")}
              className="h-7 text-xs px-2.5"
            >
              {t("last30Days")}
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-[130px]">
              <DatePicker
                value={fromDate}
                onChange={(val) => {
                  setFromDate(val);
                  setActivePreset("custom");
                }}
                placeholder={t("fromDate")}
              />
            </div>
            <span className="text-xs text-muted-foreground">{t("to")}</span>
            <div className="w-[130px]">
              <DatePicker
                value={toDate}
                onChange={(val) => {
                  setToDate(val);
                  setActivePreset("custom");
                }}
                placeholder={t("toDate")}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHistory}
              disabled={loading}
              className="h-8 text-xs gap-1"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto pt-3 space-y-4 pr-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && !data ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs">{t("loading")}</span>
            </div>
          ) : data ? (
            <>
              {/* Summary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                <div className="p-3 rounded-xl border bg-card/60 shadow-xs border-emerald-500/20">
                  <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ArrowDownLeft className="w-3.5 h-3.5" /> {t("totalInward")}
                  </div>
                  <div className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    +{summary?.totalInward || 0}{" "}
                    <span className="text-[10px] text-muted-foreground">{getUomShortcut(product?.uom)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{t("purchasesAndReturns")}</div>
                </div>

                <div className="p-3 rounded-xl border bg-card/60 shadow-xs border-rose-500/20">
                  <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> {t("totalOutward")}
                  </div>
                  <div className="text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                    -{summary?.totalOutward || 0}{" "}
                    <span className="text-[10px] text-muted-foreground">{getUomShortcut(product?.uom)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{t("salesInvoices")}</div>
                </div>

                <div className="p-3 rounded-xl border bg-card/60 shadow-xs border-primary/20">
                  <div className="text-[11px] font-medium text-primary flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" /> {t("closingBalance")}
                  </div>
                  <div className="text-base sm:text-lg font-bold text-foreground mt-0.5">
                    {summary?.closingStock ?? product?.currentStock}{" "}
                    <span className="text-[10px] text-muted-foreground">{getUomShortcut(product?.uom)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {t("physical")}: {product?.currentStock} {getUomShortcut(product?.uom)}
                  </div>
                </div>
              </div>

              {/* Tabs Bar */}
              <div className="flex items-center gap-2 border-b pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("ledger")}
                  className={`pb-2 text-xs font-semibold px-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === "ledger"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{t("movementLedger")} ({sortedMovements.length})</span>
                </button>
                {batches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("batches")}
                    className={`pb-2 text-xs font-semibold px-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                      activeTab === "batches"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{t("trackedBatches")} ({batches.length})</span>
                  </button>
                )}
              </div>

              {/* TAB 1: Movement Ledger Table */}
              {activeTab === "ledger" && (
                <div className="border rounded-xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-b text-muted-foreground text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 text-left font-semibold">
                            <button
                              type="button"
                              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                              className="flex items-center gap-1.5 hover:text-foreground transition-colors group cursor-pointer"
                              title={sortOrder === "asc" ? "Sorted Oldest First (Click for Newest)" : "Sorted Newest First (Click for Oldest)"}
                            >
                              <span>{t("date")}</span>
                              {sortOrder === "asc" ? (
                                <ArrowUp className="w-3.5 h-3.5 text-primary" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-primary" />
                              )}
                            </button>
                          </th>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("type")}</th>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("refNo")}</th>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("party")}</th>
                          <th className="py-2.5 px-3 text-right font-semibold">{t("inward")}</th>
                          <th className="py-2.5 px-3 text-right font-semibold">{t("outward")}</th>
                          <th className="py-2.5 px-3 text-right font-semibold">{t("rate")}</th>
                          <th className="py-2.5 px-3 text-right font-semibold">{t("runningBalance")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {sortedMovements.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-muted-foreground text-xs">
                              {t("noMovements")}
                            </td>
                          </tr>
                        ) : (
                          sortedMovements.map((m: any, idx: number) => {
                            const isOpening = m.type === "opening_stock";
                            const isPurchase = m.type === "purchase";
                            const isSale = m.type === "sale";
                            const isReturn = m.type === "sale_return";
                            const isAdjustmentAdd = m.type === "adjustment_add";
                            const isAdjustmentReduce = m.type === "adjustment_reduce";
                            return (
                              <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                                  {formatPakistaniDateTime(m.date, false)}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  {isOpening && (
                                    <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] font-semibold">
                                      {t("openingStock")}
                                    </Badge>
                                  )}
                                  {isPurchase && (
                                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold">
                                      {t("purchaseIn")}
                                    </Badge>
                                  )}
                                  {isSale && (
                                    <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 text-[10px] font-semibold">
                                      {t("saleOut")}
                                    </Badge>
                                  )}
                                  {isReturn && (
                                    <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30 text-[10px] font-semibold">
                                      {t("saleReturn")}
                                    </Badge>
                                  )}
                                  {isAdjustmentAdd && (
                                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-semibold">
                                      {t("adjustmentIn")}
                                    </Badge>
                                  )}
                                  {isAdjustmentReduce && (
                                    <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] font-semibold">
                                      {t("adjustmentOut")}
                                    </Badge>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="font-semibold text-foreground">{m.refNo}</div>
                                  {m.batchNumber && (
                                    <span
                                      className={`text-[10px] font-mono block ${
                                        m.batchNumber === "DEFICIT"
                                          ? "text-rose-600 dark:text-rose-400 font-semibold"
                                          : "text-sky-600 dark:text-sky-400"
                                      }`}
                                    >
                                      {m.batchNumber === "DEFICIT" ? "Oversold Deficit" : `Batch: ${m.batchNumber}`}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap max-w-[130px] truncate">
                                  {m.partyName}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                  {m.inwardQty > 0 ? `+${m.inwardQty}` : "-"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                                  {m.outwardQty > 0 ? `-${m.outwardQty}` : "-"}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  {formatCurrency(m.unitRate)}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${
                                      m.balance > 0
                                        ? "bg-primary/10 text-primary"
                                        : m.balance === 0
                                        ? "bg-muted text-muted-foreground"
                                        : "bg-rose-500/15 text-rose-600"
                                    }`}
                                  >
                                    {m.balance} {getUomShortcut(product?.uom)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: Tracked Batches Table */}
              {activeTab === "batches" && (
                <div className="border rounded-xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-b text-muted-foreground text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("batchNumber")}</th>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("source")}</th>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("inwardDate")}</th>
                          <th className="py-2.5 px-3 text-right font-semibold">{t("initialQty")}</th>
                          <th className="py-2.5 px-3 text-right font-semibold">{t("remainingQty")}</th>
                          <th className="py-2.5 px-3 text-right font-semibold">{t("batchCost")}</th>
                          <th className="py-2.5 px-3 text-center font-semibold">{t("status")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {batches.map((b: any, idx: number) => {
                          const isActive = b.status === "active" && b.remaining_quantity > 0;
                          const isAdjustment = b.source_type === "stock_adjustment";
                          const isOpening = b.source_type === "opening_stock";
                          const isPurchase = b.source_type === "purchase_bill";
                          return (
                            <tr key={idx} className="hover:bg-muted/30 transition-colors">
                              <td className="py-2.5 px-3 font-semibold font-mono text-foreground whitespace-nowrap">
                                {b.batch_number}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {isAdjustment ? (
                                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-semibold">
                                    {t("adjustmentIn") || "Adjustment (+)"}
                                  </Badge>
                                ) : isOpening ? (
                                  <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[10px] font-semibold">
                                    {t("openingStock") || "Opening Stock"}
                                  </Badge>
                                ) : isPurchase ? (
                                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-semibold">
                                    {t("purchaseIn") || "Purchase In"}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground capitalize">{b.source_type?.replace("_", " ")}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                                {formatPakistaniDateTime(b.batch_date, false)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium whitespace-nowrap">
                                {b.initial_quantity}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-foreground whitespace-nowrap">
                                {b.remaining_quantity}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                {formatCurrency(b.cost_price)}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <Badge
                                  className={`text-[10px] font-semibold ${
                                    isActive
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                      : "bg-muted text-muted-foreground border-transparent"
                                  }`}
                                >
                                  {isActive ? t("activeInStock") : t("depleted")}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
