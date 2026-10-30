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
  RotateCcw,
  Loader2,
  AlertCircle,
  DollarSign,
  Receipt,
} from "lucide-react";
import { formatCurrency, formatStatementDate } from "@/lib/utils";
import { getUomShortcut } from "@/lib/uom";
import { toHTMLDateString } from "@/lib/date-utils";

interface ItemSalesDetailModalProps {
  productId: string | null;
  productName?: string;
  initialFromDate?: string;
  initialToDate?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ItemSalesDetailModal({
  productId,
  productName,
  initialFromDate,
  initialToDate,
  open,
  onOpenChange,
}: ItemSalesDetailModalProps) {
  const t = useTranslations("itemSalesDetailModal");
  const tCommon = useTranslations("common");

  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Date Filters (inherit initial dates if supplied)
  const [fromDate, setFromDate] = useState<string>(initialFromDate || "");
  const [toDate, setToDate] = useState<string>(initialToDate || "");
  const [activePreset, setActivePreset] = useState<string>(initialFromDate ? "custom" : "all");
  const [activeTab, setActiveTab] = useState<"sales" | "returns">("sales");

  // Keep in sync when initial dates change upon opening
  useEffect(() => {
    if (open) {
      if (initialFromDate) setFromDate(initialFromDate);
      if (initialToDate) setToDate(initialToDate);
      if (initialFromDate || initialToDate) {
        setActivePreset("custom");
      }
    }
  }, [open, initialFromDate, initialToDate]);

  const fetchDetails = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/reports/item-wise-sales/details", window.location.origin);
      url.searchParams.set("productId", productId);
      if (fromDate) url.searchParams.set("fromDate", fromDate);
      if (toDate) url.searchParams.set("toDate", toDate);

      const res = await fetch(url.toString());
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || t("failedToLoad"));
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("Error loading item sales details:", err);
      setError(err.message || t("failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [productId, fromDate, toDate, t]);

  useEffect(() => {
    if (open && productId) {
      fetchDetails();
    } else {
      setData(null);
      setError(null);
    }
  }, [open, productId, fetchDetails]);

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
  const sales = data?.sales || [];
  const returns = data?.returns || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        {/* Header */}
        <DialogHeader className="pb-3 border-b flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  {product ? product.name : productName || t("title")}
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
              {/* <DialogDescription className="text-xs mt-1 text-muted-foreground">
                {t("description")}
              </DialogDescription> */}
            </div>

            {product && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Badge
                  variant="outline"
                  className="px-2.5 py-1 text-xs font-semibold gap-1.5 border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>
                    {t("currentStock")}: {product.currentStock} {getUomShortcut(product.uom)}
                  </span>
                </Badge>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Filter Toolbar */}
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
              onClick={fetchDetails}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="p-3 rounded-xl border bg-card/60 shadow-xs">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-indigo-600" /> {t("totalInvoices")}
                  </div>
                  <div className="text-base sm:text-lg font-bold text-foreground mt-0.5">
                    {summary?.totalInvoices || 0}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{t("salesTransactions")}</div>
                </div>

                <div className="p-3 rounded-xl border bg-card/60 shadow-xs border-sky-500/20">
                  <div className="text-[11px] font-medium text-sky-600 dark:text-sky-400 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" /> {t("netUnitsSold")}
                  </div>
                  <div className="text-base sm:text-lg font-bold text-sky-600 dark:text-sky-400 mt-0.5">
                    {summary?.netQuantitySold || 0}{" "}
                    <span className="text-[10px] text-muted-foreground">{getUomShortcut(product?.uom)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {summary?.totalReturnedQuantity > 0
                      ? `(${summary.totalReturnedQuantity} ${t("returned")})`
                      : `${t("gross")}: ${summary?.totalQuantitySold || 0}`}
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-card/60 shadow-xs border-indigo-500/20">
                  <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> {t("netRevenue")}
                  </div>
                  <div className="text-base sm:text-lg font-bold text-foreground mt-0.5">
                    {formatCurrency(summary?.totalNetRevenue || 0)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {t("avgRate")}: {formatCurrency(summary?.avgSellingPrice || 0)}
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-card/60 shadow-xs border-emerald-500/20">
                  <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> {t("grossProfit")}
                  </div>
                  <div className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatCurrency(summary?.totalProfit || 0)}
                  </div>
                  <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-medium">
                    {summary?.profitMargin || 0}% {t("margin")} ({t("cogs")}: {formatCurrency(summary?.totalCogs || 0)})
                  </div>
                </div>
              </div>

              {/* Tabs Bar */}
              <div className="flex items-center gap-2 border-b pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("sales")}
                  className={`pb-2 text-xs font-semibold px-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === "sales"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>{t("salesInvoicesTab")} ({sales.length})</span>
                </button>
                {returns.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("returns")}
                    className={`pb-2 text-xs font-semibold px-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                      activeTab === "returns"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t("saleReturnsTab")} ({returns.length})</span>
                  </button>
                )}
              </div>

              {/* TAB 1: Sales Invoices Table */}
              {activeTab === "sales" && (
                <div className="border rounded-xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-b text-muted-foreground text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("date")}</th>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("invoiceNo")}</th>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("customer")}</th>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("qtySold")}</th>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("rate")}</th>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("discount")}</th>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("netRevenue")}</th>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("costCogs")}</th>
                          <th className="py-2.5 px-3 text-right font-semibold">{t("profit")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {sales.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-muted-foreground text-xs">
                              {t("noSales")}
                            </td>
                          </tr>
                        ) : (
                          sales.map((s: any, idx: number) => {
                            const hasBatchSplits = s.batchSplits && s.batchSplits.length > 0;
                            return (
                              <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                                  {formatStatementDate(s.date)}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="font-semibold text-foreground">{s.invoiceNo}</div>
                                  {s.batchNumber && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Badge
                                        variant="outline"
                                        className={`text-[9px] px-1.5 py-0 h-4 font-mono ${
                                          s.batchNumber === "DEFICIT"
                                            ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                                            : "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30"
                                        }`}
                                      >
                                        {s.batchNumber === "DEFICIT" ? "Oversold Deficit" : `Batch: ${s.batchNumber}`}
                                        {s.isBatchSplit ? ` (${s.batchIndex}/${s.totalBatches})` : ""}
                                      </Badge>
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap max-w-[140px] truncate">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-foreground">{s.customerName}</span>
                                    {s.customerPhone && (
                                      <span className="text-[10px] text-muted-foreground font-mono">{s.customerPhone}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-foreground whitespace-nowrap">
                                  {s.quantity} {getUomShortcut(product?.uom)}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  {formatCurrency(s.price)}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap text-muted-foreground">
                                  {s.lineDiscount > 0 ? formatCurrency(s.lineDiscount) : "-"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-foreground whitespace-nowrap">
                                  {formatCurrency(s.lineRevenue)}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  <div className="flex flex-col items-end">
                                    <span className="text-muted-foreground font-medium">{formatCurrency(s.totalCogs)}</span>
                                    <span className="text-[9px] text-muted-foreground">@ {formatCurrency(s.unitCost)}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  <div className="flex flex-col items-end">
                                    <span
                                      className={`font-bold ${
                                        s.profit >= 0
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : "text-rose-600 dark:text-rose-400"
                                      }`}
                                    >
                                      {formatCurrency(s.profit)}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {s.profitMargin}%
                                    </span>
                                  </div>
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

              {/* TAB 2: Sale Returns Table */}
              {activeTab === "returns" && (
                <div className="border rounded-xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-b text-muted-foreground text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("date")}</th>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("returnNumber")}</th>
                          <th className="py-2.5 px-3 text-left font-semibold">{t("customer")}</th>
                          <th className="py-2.5 px-3 text-right font-semibold">{t("returnedQty")}</th>
                          <th className="py-2.5 px-3 text-right font-semibold">{t("returnRate")}</th>
                          <th className="py-2.5 px-3 text-right font-semibold">{t("refundAmount")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {returns.map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                              {formatStatementDate(r.date)}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                              {r.returnNumber}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                              {r.customerName}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                              {r.quantity} {getUomShortcut(product?.uom)}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              {formatCurrency(r.rate)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-foreground whitespace-nowrap">
                              {formatCurrency(r.amount)}
                            </td>
                          </tr>
                        ))}
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
