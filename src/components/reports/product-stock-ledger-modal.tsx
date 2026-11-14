"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Calendar,
} from "lucide-react";
import { formatCurrency, formatStatementDate } from "@/lib/utils";
import { getUomShortcut } from "@/lib/uom";
import { formatPakistaniDateTime, formatReadableDate } from "@/lib/date-utils";

interface ProductStockLedgerModalProps {
  productId: string | null;
  fromDate?: string;
  toDate?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductStockLedgerModal({
  productId,
  fromDate,
  toDate,
  open,
  onOpenChange,
}: ProductStockLedgerModalProps) {
  const t = useTranslations("stockLedgerModal");
  const tCommon = useTranslations("common");

  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Default sorting: Oldest to Latest ('asc') so opening/start date transaction is at the top
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
      setSortOrder("asc");
      fetchHistory();
    } else {
      setData(null);
      setError(null);
    }
  }, [open, productId, fetchHistory]);

  const product = data?.product;
  const summary = data?.summary;
  const movements = data?.movements || [];
  const batches = data?.batches || [];

  interface MovementGroup {
    key: string;
    refNo: string;
    type: string;
    date: any;
    partyName: string;
    items: any[];
  }

  const groupedMovements = React.useMemo(() => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        {/* Header */}
        <DialogHeader className="pb-3 border-b flex-shrink-0 text-left sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left">
            <div className="text-left">
              <div className="flex items-center gap-2 flex-wrap justify-start text-left">
                <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 text-left">
                  <Package className="w-5 h-5 text-primary shrink-0" />
                  <span>{product ? product.name : t("title")}</span>
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
              <DialogDescription className="text-xs mt-1 text-muted-foreground text-left">
                {t("description")}
              </DialogDescription>
              {(fromDate || toDate) && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>
                    {fromDate && toDate
                      ? `${formatReadableDate(fromDate)} - ${formatReadableDate(toDate)}`
                      : fromDate
                      ? `From: ${formatReadableDate(fromDate)}`
                      : `To: ${formatReadableDate(toDate)}`}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {product && (
                <Badge
                  variant="outline"
                  className="px-2.5 py-1 text-xs font-semibold gap-1.5 border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>
                    {product.currentStock} {getUomShortcut(product.uom)}
                  </span>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchHistory}
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

              {/* Section Header */}
              <div className="flex items-center justify-between border-b pb-2 pt-1">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span>{t("movementLedger")} ({movements.length})</span>
                </div>
              </div>

              {/* Movement Ledger Table */}
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
                        {groupedMovements.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-muted-foreground text-xs">
                              {t("noMovements")}
                            </td>
                          </tr>
                        ) : (
                          groupedMovements.map((group) => {
                            return group.items.map((m: any, subIdx: number) => {
                              const isOpening = m.type === "opening_stock";
                              const isPurchase = m.type === "purchase";
                              const isSale = m.type === "sale";
                              const isReturn = m.type === "sale_return";
                              const isAdjustmentAdd = m.type === "adjustment_add";
                              const isAdjustmentReduce = m.type === "adjustment_reduce";
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
                                    </>
                                  )}

                                  {/* Ref / Voucher # & Batch Number */}
                                  <td className={`py-2.5 px-3 whitespace-nowrap align-top ${subBorderClass}`}>
                                    {subIdx === 0 && (
                                      <div className="font-semibold text-foreground">{group.refNo}</div>
                                    )}
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

                                  {subIdx === 0 && (
                                    /* Party */
                                    <td
                                      rowSpan={group.items.length}
                                      className="py-2.5 px-3 text-muted-foreground whitespace-nowrap max-w-[130px] truncate align-top border-b border-border/60 bg-card/60"
                                      title={m.partyName}
                                    >
                                      {m.partyName}
                                    </td>
                                  )}

                                  {/* Inward */}
                                  <td className={`py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap ${subBorderClass}`}>
                                    {m.inwardQty > 0 ? `+${m.inwardQty}` : "-"}
                                  </td>

                                  {/* Outward */}
                                  <td className={`py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap ${subBorderClass}`}>
                                    {m.outwardQty > 0 ? `-${m.outwardQty}` : "-"}
                                  </td>

                                  {/* Rate */}
                                  <td className={`py-2.5 px-3 text-right whitespace-nowrap font-mono ${subBorderClass}`}>
                                    {formatCurrency(m.unitRate)}
                                  </td>

                                  {/* Running Balance */}
                                  <td className={`py-2.5 px-3 text-right whitespace-nowrap ${subBorderClass}`}>
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded font-bold text-xs font-mono ${
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
                            });
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
