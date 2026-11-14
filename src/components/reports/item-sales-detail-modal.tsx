"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  TrendingUp,
  RotateCcw,
  Loader2,
  AlertCircle,
  DollarSign,
  Receipt,
  Calendar,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { formatCurrency, formatStatementDate } from "@/lib/utils";
import { getUomShortcut } from "@/lib/uom";
import { formatReadableDate } from "@/lib/date-utils";

interface ItemSalesDetailModalProps {
  productId: string | null;
  productName?: string;
  fromDate?: string;
  toDate?: string;
  initialFromDate?: string;
  initialToDate?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ItemSalesDetailModal({
  productId,
  productName,
  fromDate,
  toDate,
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
  const [activeTab, setActiveTab] = useState<"sales" | "returns">("sales");

  // Sorting state - Defaults to 'date' 'asc' (Oldest to Latest: start date invoice appears at the top)
  const [salesSortKey, setSalesSortKey] = useState<string>("date");
  const [salesSortOrder, setSalesSortOrder] = useState<"asc" | "desc">("asc");

  // Active dates strictly inherited from the parent table
  const activeFromDate = fromDate !== undefined ? fromDate : (initialFromDate || "");
  const activeToDate = toDate !== undefined ? toDate : (initialToDate || "");

  const fetchDetails = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/reports/item-wise-sales/details", window.location.origin);
      url.searchParams.set("productId", productId);
      if (activeFromDate) url.searchParams.set("fromDate", activeFromDate);
      if (activeToDate) url.searchParams.set("toDate", activeToDate);

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
  }, [productId, activeFromDate, activeToDate, t]);

  useEffect(() => {
    if (open && productId) {
      // Reset sort to oldest first on new open
      setSalesSortKey("date");
      setSalesSortOrder("asc");
      fetchDetails();
    } else {
      setData(null);
      setError(null);
    }
  }, [open, productId, fetchDetails]);

  const product = data?.product;
  const summary = data?.summary;
  const rawSales: any[] = data?.sales || [];
  const returns: any[] = data?.returns || [];

  // Sort sales: default is Oldest to Latest (start date invoice first)
  const sortedSales = useMemo(() => {
    const list = [...rawSales];
    list.sort((a: any, b: any) => {
      let comparison = 0;
      if (salesSortKey === "date") {
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        comparison = timeA - timeB;
      } else if (salesSortKey === "invoiceNo") {
        comparison = (a.invoiceNo || "").localeCompare(b.invoiceNo || "", undefined, { numeric: true });
      } else if (salesSortKey === "customer") {
        comparison = (a.customerName || "").localeCompare(b.customerName || "");
      } else if (salesSortKey === "quantity") {
        comparison = (Number(a.quantity) || 0) - (Number(b.quantity) || 0);
      } else if (salesSortKey === "price") {
        comparison = (Number(a.price) || 0) - (Number(b.price) || 0);
      } else if (salesSortKey === "lineRevenue") {
        comparison = (Number(a.lineRevenue) || 0) - (Number(b.lineRevenue) || 0);
      } else if (salesSortKey === "profit") {
        comparison = (Number(a.profit) || 0) - (Number(b.profit) || 0);
      }
      return salesSortOrder === "asc" ? comparison : -comparison;
    });
    return list;
  }, [rawSales, salesSortKey, salesSortOrder]);

  const handleSort = (key: string) => {
    if (salesSortKey === key) {
      setSalesSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSalesSortKey(key);
      setSalesSortOrder(key === "date" ? "asc" : "desc");
    }
  };

  const renderSortIndicator = (key: string) => {
    if (salesSortKey !== key) {
      return <ArrowUpDown className="w-3 h-3 opacity-40 ml-1 inline" />;
    }
    return salesSortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 text-primary ml-1 inline" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary ml-1 inline" />
    );
  };

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

              {/* Active Filter Date Display inherited from main table */}
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>
                  {activeFromDate || activeToDate ? (
                    activeFromDate && activeToDate
                      ? `${formatReadableDate(activeFromDate)} - ${formatReadableDate(activeToDate)}`
                      : activeFromDate
                      ? `From: ${formatReadableDate(activeFromDate)}`
                      : `To: ${formatReadableDate(activeToDate)}`
                  ) : (
                    t("allTime")
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {product && (
                <Badge
                  variant="outline"
                  className="px-2.5 py-1 text-xs font-semibold gap-1.5 border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>
                    {t("currentStock")}: {product.currentStock} {getUomShortcut(product.uom)}
                  </span>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchDetails}
                disabled={loading}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title={tCommon("reload") || "Refresh"}
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </DialogHeader>

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
                  <span>{t("salesInvoicesTab")} ({rawSales.length})</span>
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
                          <th
                            onClick={() => handleSort("date")}
                            className="py-2.5 px-3 text-left font-semibold cursor-pointer hover:text-foreground select-none"
                          >
                            {t("date")}
                            {renderSortIndicator("date")}
                          </th>
                          <th
                            onClick={() => handleSort("invoiceNo")}
                            className="py-2.5 px-3 text-left font-semibold cursor-pointer hover:text-foreground select-none"
                          >
                            {t("invoiceNo")}
                            {renderSortIndicator("invoiceNo")}
                          </th>
                          <th
                            onClick={() => handleSort("customer")}
                            className="py-2.5 px-3 text-left font-semibold cursor-pointer hover:text-foreground select-none"
                          >
                            {t("customer")}
                            {renderSortIndicator("customer")}
                          </th>
                          <th
                            onClick={() => handleSort("quantity")}
                            className="py-2.5 px-3 text-right font-semibold cursor-pointer hover:text-foreground select-none"
                          >
                            {t("qtySold")}
                            {renderSortIndicator("quantity")}
                          </th>
                          <th
                            onClick={() => handleSort("price")}
                            className="py-2.5 px-3 text-right font-semibold cursor-pointer hover:text-foreground select-none"
                          >
                            {t("rate")}
                            {renderSortIndicator("price")}
                          </th>
                          <th className="py-2.5 px-3 text-right font-semibold">{t("discount")}</th>
                          <th
                            onClick={() => handleSort("lineRevenue")}
                            className="py-2.5 px-3 text-right font-semibold cursor-pointer hover:text-foreground select-none"
                          >
                            {t("netRevenue")}
                            {renderSortIndicator("lineRevenue")}
                          </th>
                          <th className="py-2.5 px-3 text-right font-semibold">{t("costCogs")}</th>
                          <th
                            onClick={() => handleSort("profit")}
                            className="py-2.5 px-3 text-right font-semibold cursor-pointer hover:text-foreground select-none"
                          >
                            {t("profit")}
                            {renderSortIndicator("profit")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {sortedSales.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-muted-foreground text-xs">
                              {t("noSales")}
                            </td>
                          </tr>
                        ) : (
                          sortedSales.map((s: any, idx: number) => {
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
