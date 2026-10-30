"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SlidersHorizontal,
  Plus,
  Minus,
  Package,
  AlertTriangle,
  Loader2,
  Calendar,
  FileText,
  Info,
} from "lucide-react";
import { Product } from "@/types/product";
import { ProductDropdown } from "@/components/dropdown/product-dropdown";
import { recordStockAdjustmentOffline, updateStockAdjustmentOffline } from "@/lib/db/offline-stock-manager";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { getUomShortcut } from "@/lib/uom";
import { DatePicker } from "@/components/ui/date-picker";
import { safeDate, toHTMLDateString } from "@/lib/date-utils";

interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  adjustment?: any | null;
  onSuccess?: (updatedProduct: Product) => void;
}

export function AdjustStockDialog({
  open,
  onOpenChange,
  product: initialProduct = null,
  adjustment = null,
  onSuccess,
}: AdjustStockDialogProps) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const isEditMode = Boolean(adjustment);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(initialProduct);
  const [stockType, setStockType] = useState<"available" | "damaged">("available");
  const [actionType, setActionType] = useState<"add" | "reduce">("add");
  const [quantity, setQuantity] = useState<string>("");
  const [costPrice, setCostPrice] = useState<string>("");
  const [reason, setReason] = useState<string>("physicalCount");
  const [adjustmentDate, setAdjustmentDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [valuationMethod, setValuationMethod] = useState<"average" | "fifo" | "static">("average");
  const [fifoBatchPreview, setFifoBatchPreview] = useState<{
    effectiveCost: number;
    totalCost: number;
    batches: Array<{ batch_number: string; quantity: number; cost_price: number }>;
    isFallback: boolean;
  } | null>(null);

  // Sync state when dialog opens or initialProduct/adjustment changes
  useEffect(() => {
    if (open) {
      if (typeof window !== "undefined") {
        const method = (localStorage.getItem("setting_stockValuationMethod") || "average") as any;
        if (method === "fifo" || method === "average" || method === "static") {
          setValuationMethod(method);
        }
      }

      if (adjustment) {
        setStockType(adjustment.stock_type || "available");
        setActionType(adjustment.action_type || "add");
        setQuantity(String(adjustment.quantity || ""));
        setCostPrice(adjustment.cost_price !== undefined ? String(adjustment.cost_price) : "");
        setReason(adjustment.reason || "physicalCount");
        setAdjustmentDate(toHTMLDateString(adjustment.date ? new Date(adjustment.date) : new Date()));
        setNotes(adjustment.notes || "");
        setErrorMsg(null);

        if (initialProduct) {
          setSelectedProduct(initialProduct);
        } else if (adjustment.product_id) {
          db.products.get(String(adjustment.product_id)).then((p) => {
            if (p) {
              setSelectedProduct(p);
            } else {
              setSelectedProduct({
                id: adjustment.product_id,
                name: adjustment.product_name || "Item",
                unit_of_measurement: (adjustment as any).unit_of_measurement || (adjustment as any).uom || "",
              } as any);
            }
          });
        }
      } else {
        const prod = initialProduct || null;
        setSelectedProduct(prod);
        setStockType("available");
        setActionType("add");
        setQuantity("");
        const initialCost = prod?.cost_price !== undefined
          ? String(prod.cost_price)
          : (prod?.cost_price_str || "0");
        setCostPrice(initialCost);
        setReason("physicalCount");
        setAdjustmentDate(toHTMLDateString(new Date()));
        setNotes("");
        setErrorMsg(null);
      }
    }
  }, [open, initialProduct, adjustment]);

  // When selectedProduct is changed via ProductDropdown
  const handleSelectProduct = (newProd: Product | null) => {
    setSelectedProduct(newProd);
    setQuantity("");
    setErrorMsg(null);
    if (newProd) {
      const initialCost = newProd.cost_price !== undefined
        ? String(newProd.cost_price)
        : (newProd.cost_price_str || "0");
      setCostPrice(initialCost);
    } else {
      setCostPrice("");
    }
  };

  const currentAvailable = useMemo(() => {
    if (!selectedProduct) return 0;
    return parseFloat(selectedProduct.quantity?.toString() || selectedProduct.in_stock?.toString() || "0");
  }, [selectedProduct]);

  const currentDamaged = useMemo(() => {
    if (!selectedProduct) return 0;
    return parseFloat(selectedProduct.damaged_quantity?.toString() || "0");
  }, [selectedProduct]);

  const uomLabel = useMemo(() => {
    const rawUom =
      selectedProduct?.unit_of_measurement ||
      (selectedProduct as any)?.uom ||
      (selectedProduct as any)?.unit ||
      "";
    return getUomShortcut(rawUom);
  }, [selectedProduct]);

  const numQty = parseFloat(quantity) || 0;
  const currentTargetStock = stockType === "available" ? currentAvailable : currentDamaged;

  const previewNewStock = useMemo(() => {
    if (numQty <= 0) return currentTargetStock;
    if (actionType === "add") {
      return Math.round((currentTargetStock + numQty) * 100000) / 100000;
    }
    return Math.max(0, Math.round((currentTargetStock - numQty) * 100000) / 100000);
  }, [currentTargetStock, numQty, actionType]);

  const isCurrentStockNonPositive = actionType === "reduce" && currentTargetStock <= 0;
  const isExceedingStock = actionType === "reduce" && currentTargetStock > 0 && numQty > currentTargetStock;

  // Live FIFO preview when reducing available stock
  useEffect(() => {
    if (!open || actionType !== "reduce" || stockType !== "available" || valuationMethod !== "fifo" || !selectedProduct) {
      setFifoBatchPreview(null);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const prodIdStr = String(selectedProduct.id);
        const batches = await db.inventory_batches.where("product_id").equals(prodIdStr).toArray();
        const activeBatches = batches
          .filter((b: any) => (b.status === "active" || !b.status) && Number(b.remaining_quantity) > 0)
          .sort((a: any, b: any) => new Date(a.batch_date || a.created_at).getTime() - new Date(b.batch_date || b.created_at).getTime());

        const qtyToReduce = numQty > 0 ? numQty : 1;
        let unfulfilled = qtyToReduce;
        let totalCost = 0;
        const usedBatches: Array<{ batch_number: string; quantity: number; cost_price: number }> = [];

        for (const b of activeBatches) {
          if (unfulfilled <= 0) break;
          const avail = Number(b.remaining_quantity) || 0;
          if (avail <= 0) continue;
          const take = Math.min(avail, unfulfilled);
          const cp = Number(b.cost_price) || 0;
          totalCost += take * cp;
          unfulfilled -= take;
          usedBatches.push({
            batch_number: b.batch_number || "BATCH",
            quantity: take,
            cost_price: cp,
          });
        }

        const fallback = Number(selectedProduct.cost_price || (selectedProduct as any).purchase_price) || 0;
        const isFallback = unfulfilled > 0;
        if (unfulfilled > 0) {
          totalCost += unfulfilled * fallback;
        }

        const effectiveCost = qtyToReduce > 0 ? Math.round((totalCost / qtyToReduce) * 100) / 100 : fallback;

        if (isMounted) {
          setFifoBatchPreview({
            effectiveCost,
            totalCost: Math.round(totalCost * 100) / 100,
            batches: usedBatches,
            isFallback,
          });
        }
      } catch (err) {
        console.error("Error previewing FIFO batches:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [open, actionType, stockType, valuationMethod, selectedProduct, numQty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setErrorMsg(t("selectProductPrompt"));
      return;
    }

    if (numQty <= 0) {
      setErrorMsg(t("adjustQuantity") + " > 0");
      return;
    }

    if (actionType === "reduce") {
      if (currentTargetStock <= 0) {
        setErrorMsg(t("stockCannotReduceBelowZero", { current: currentTargetStock }));
        return;
      }
      if (numQty > currentTargetStock) {
        setErrorMsg(t("reduceStockExceedsAvailable", { qty: numQty, current: currentTargetStock }));
        return;
      }
    }

    if (!reason) {
      setErrorMsg(t("selectReason"));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const parsedCost = costPrice !== "" ? parseFloat(costPrice) : undefined;
      const now = new Date();
      let finalAdjustmentTimestamp: string;
      if (adjustmentDate) {
        const parsed = safeDate(adjustmentDate);
        parsed.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
        finalAdjustmentTimestamp = parsed.toISOString();
      } else {
        finalAdjustmentTimestamp = now.toISOString();
      }

      let updatedProduct: Product;
      if (isEditMode && adjustment) {
        const res = await updateStockAdjustmentOffline({
          adjustmentId: adjustment.id || adjustment._id,
          productId: selectedProduct.id,
          stockType,
          actionType,
          quantity: numQty,
          costPrice: actionType === "reduce" ? undefined : parsedCost,
          reason,
          notes,
          adjustmentDate: finalAdjustmentTimestamp,
          fallbackOldRecord: adjustment,
        });

        updatedProduct = {
          ...selectedProduct,
          quantity: res.newQuantity,
          quantity_str: res.newQuantity.toString(),
          in_stock: res.newQuantity,
          damaged_quantity: res.newDamagedQuantity,
          damaged_quantity_str: res.newDamagedQuantity.toString(),
          cost_price: res.newCostPrice !== undefined ? res.newCostPrice : selectedProduct.cost_price,
          cost_price_str: res.newCostPrice !== undefined ? res.newCostPrice.toString() : selectedProduct.cost_price_str,
        };
      } else {
        const res = await recordStockAdjustmentOffline({
          productId: selectedProduct.id,
          stockType,
          actionType,
          quantity: numQty,
          reason,
          notes,
          adjustmentDate: finalAdjustmentTimestamp,
          costPrice: actionType === "reduce" ? undefined : parsedCost,
        });

        updatedProduct = {
          ...selectedProduct,
          quantity: res.newQuantity,
          quantity_str: res.newQuantity.toString(),
          in_stock: res.newQuantity,
          damaged_quantity: res.newDamagedQuantity,
          damaged_quantity_str: res.newDamagedQuantity.toString(),
          cost_price: res.newCostPrice !== undefined ? res.newCostPrice : selectedProduct.cost_price,
          cost_price_str: res.newCostPrice !== undefined ? res.newCostPrice.toString() : selectedProduct.cost_price_str,
        };

        // Queue sync operation for backend MongoDB
        const payload = {
          localId: res.adjustmentId,
          refNo: res.refNo,
          productId: String(selectedProduct.id),
          stockType,
          actionType,
          quantity: numQty,
          reason,
          notes: notes.trim(),
          adjustmentDate: finalAdjustmentTimestamp,
          costPrice: actionType === "reduce" ? res.effectiveCostPrice : parsedCost,
          batch_splits: (res as any).batchSplits,
          previous_cost_price: Number(selectedProduct.cost_price || 0),
          previous_quantity: Number(selectedProduct.quantity || 0),
        };

        await SyncEngine.queueOperation(
          "stock_adjustments",
          "POST",
          "/api/stock-adjustments",
          payload,
          res.adjustmentId
        );
      }

      if (onSuccess) {
        onSuccess(updatedProduct);
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error adjusting stock:", err);
      setErrorMsg(err.message || t("adjustStockError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] w-full max-w-[95vw] p-4 sm:p-6 rounded-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col gap-4">
        <DialogHeader className="space-y-1.5 pb-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 sm:p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
              <SlidersHorizontal className="w-5 h-5 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg font-bold truncate flex items-center gap-2">
                <span>
                  {isEditMode
                    ? (t("editAdjustment") || "Edit Stock Adjustment")
                    : selectedProduct
                    ? t("adjustStockTitle", { name: selectedProduct.name })
                    : (t("adjustStockHeaderTitle") || t("adjustStock"))}
                </span>
                {isEditMode && adjustment?.ref_no && (
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground border">
                    {adjustment.ref_no}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                {isEditMode
                  ? "Update adjustment quantity, rate, or reason. Stock and average cost will be recalculated."
                  : t("adjustStockDesc")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Product Selection via ProductDropdown */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-primary" />
              {t("selectProductToAdjust")} <span className="text-red-500">*</span>
            </span>
            {selectedProduct && (
              <span className="text-[11px] font-normal text-muted-foreground truncate max-w-[150px]">
                {selectedProduct.category || selectedProduct.type || ""}
              </span>
            )}
          </Label>
          <ProductDropdown
            value={selectedProduct?.id || selectedProduct?._id || ""}
            onValueChange={(_id, prod) => {
              handleSelectProduct(prod || null);
            }}
            placeholder={t("selectProductToAdjust")}
            showAddButton={false}
            className="h-10 text-xs sm:text-sm w-full"
          />
        </div>

        {/* If no product selected, show informative prompt */}
        {!selectedProduct ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center border border-dashed rounded-xl bg-muted/20 text-muted-foreground gap-2.5 my-2">
            <Package className="w-10 h-10 text-muted-foreground/40 stroke-1" />
            <p className="text-xs sm:text-sm font-medium max-w-xs text-muted-foreground">
              {t("selectProductPrompt")}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
            {/* Current Stock Banner */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-2.5 sm:p-3 bg-muted/40 rounded-xl border border-border/60 text-xs">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                  {t("availableStock")}
                </span>
                <span className="text-xs sm:text-sm md:text-base font-bold text-foreground mt-0.5 truncate">
                  {currentAvailable} {uomLabel}
                </span>
              </div>
              <div className="flex flex-col border-l border-border/60 pl-2 sm:pl-2.5 min-w-0">
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                  {t("damagedStock")}
                </span>
                <span className="text-xs sm:text-sm md:text-base font-bold text-amber-600 dark:text-amber-500 mt-0.5 truncate">
                  {currentDamaged} {uomLabel}
                </span>
              </div>
              <div className="flex flex-col border-l border-border/60 pl-2 sm:pl-2.5 min-w-0">
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">
                  {t("costPrice")}
                </span>
                <span className="text-xs sm:text-sm md:text-base font-bold text-foreground mt-0.5 truncate">
                  Rs. {selectedProduct.cost_price !== undefined ? selectedProduct.cost_price : (selectedProduct.cost_price_str || 0)}
                </span>
              </div>
            </div>

            {/* Action Type (Add vs Reduce) */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={actionType === "add" ? "default" : "outline"}
                className={`h-10 sm:h-11 text-xs sm:text-sm font-semibold gap-1.5 transition-all ${
                  actionType === "add" ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs" : ""
                }`}
                onClick={() => setActionType("add")}
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="truncate">{t("addStock")}</span>
              </Button>
              <Button
                type="button"
                variant={actionType === "reduce" ? "default" : "outline"}
                className={`h-10 sm:h-11 text-xs sm:text-sm font-semibold gap-1.5 transition-all ${
                  actionType === "reduce" ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs" : ""
                }`}
                onClick={() => setActionType("reduce")}
              >
                <Minus className="w-4 h-4 shrink-0" />
                <span className="truncate">{t("reduceStock")}</span>
              </Button>
            </div>

            {/* Stock Type Selection (Available vs Damaged) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("stockType")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStockType("available")}
                  className={`py-2 sm:py-2.5 px-3 text-xs sm:text-sm font-medium rounded-lg border text-center transition-all ${
                    stockType === "available"
                      ? "bg-accent border-primary text-foreground font-semibold shadow-xs"
                      : "border-border/70 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {t("availableStock")}
                </button>
                <button
                  type="button"
                  onClick={() => setStockType("damaged")}
                  className={`py-2 sm:py-2.5 px-3 text-xs sm:text-sm font-medium rounded-lg border text-center transition-all ${
                    stockType === "damaged"
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-800 dark:text-amber-300 font-semibold shadow-xs"
                      : "border-border/70 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {t("damagedStock")}
                </button>
              </div>
            </div>

            {/* Quantity & Live New Stock Result */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="adjustQty" className="text-xs font-medium">
                  {t("adjustQuantity")} {uomLabel ? `(${uomLabel})` : ""} <span className="text-red-500">*</span>
                </Label>
                <NumericInput
                  id="adjustQty"
                  value={quantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== "" && Number(val) < 0) return;
                    setQuantity(val);
                  }}
                  placeholder="0"
                  min="0"
                  autoFocus
                  className="h-10 text-sm font-semibold"
                />
              </div>

              {/* Live Result Card */}
              <div className="p-2.5 bg-muted/60 border border-border/80 rounded-lg flex items-center justify-between h-10">
                <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">{t("newStock")}:</span>
                <span
                  className={`text-xs sm:text-sm font-bold truncate ${
                    actionType === "add"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isCurrentStockNonPositive || isExceedingStock
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-foreground"
                  }`}
                >
                  {previewNewStock} {uomLabel}
                </span>
              </div>
            </div>

            {isCurrentStockNonPositive && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {t("stockCannotReduceBelowZero", { current: currentTargetStock })}
                </span>
              </div>
            )}

            {isExceedingStock && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {t("reduceStockExceedsAvailable", { qty: numQty, current: currentTargetStock })}
                </span>
              </div>
            )}

            {/* Reason & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t("adjustmentReason")} <span className="text-red-500">*</span>
                </Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="h-10 text-xs sm:text-sm">
                    <SelectValue placeholder={t("selectReason")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physicalCount">{t("reasons.physicalCount")}</SelectItem>
                    <SelectItem value="damaged">{t("reasons.damaged")}</SelectItem>
                    <SelectItem value="expired">{t("reasons.expired")}</SelectItem>
                    <SelectItem value="theft">{t("reasons.theft")}</SelectItem>
                    <SelectItem value="internalUse">{t("reasons.internalUse")}</SelectItem>
                    <SelectItem value="found">{t("reasons.found")}</SelectItem>
                    <SelectItem value="other">{t("reasons.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adjustDate" className="text-xs font-medium">
                  {t("adjustmentDate")}
                </Label>
                <DatePicker
                  id="adjustDate"
                  value={adjustmentDate}
                  onChange={(dateStr) => setAdjustmentDate(dateStr)}
                  className="h-10 text-xs sm:text-sm"
                  placeholder="DD-MM-YYYY"
                />
              </div>
            </div>

            {/* Cost Price (When Adding to Available Stock) */}
            {actionType === "add" && stockType === "available" && (
              <div className="space-y-2 p-3 sm:p-3.5 rounded-xl bg-muted/40 border border-border/70">
                <div className="flex items-center justify-between">
                  <Label htmlFor="costPriceOpt" className="text-xs font-semibold text-foreground">
                    {t("costPriceOptional")} (Rs.)
                  </Label>
                  <span className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground uppercase font-semibold">
                    {valuationMethod === "fifo" ? "Valuation: FIFO" : "Valuation: Average"}
                  </span>
                </div>
                <NumericInput
                  id="costPriceOpt"
                  value={costPrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== "" && Number(val) < 0) return;
                    setCostPrice(val);
                  }}
                  placeholder="0"
                  min="0"
                  className="h-10 text-xs sm:text-sm font-semibold bg-background"
                />

                {/* Valuation Note / Alert */}
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-[11px] sm:text-xs leading-relaxed flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {valuationMethod === "fifo" ? (
                      <p>{t("costPriceFifoNote")}</p>
                    ) : (
                      <p>{t("costPriceAverageNote")}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* FIFO / Valuation Rate Preview on Stock Reduction */}
            {/* {actionType === "reduce" && stockType === "available" && (
              <div className="space-y-2 p-3 sm:p-3.5 rounded-xl bg-muted/40 border border-border/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                    {valuationMethod === "fifo" ? "FIFO Batch Deduction" : "Average Valuation Cost"}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground uppercase font-semibold">
                    {valuationMethod === "fifo" ? "Oldest Batch First" : "Moving Average"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                  <span className="text-muted-foreground">
                    {valuationMethod === "fifo" ? "FIFO Deduction Rate:" : "Current Cost Price:"}
                  </span>
                  <span className="font-bold text-foreground">
                    Rs.{" "}
                    {valuationMethod === "fifo"
                      ? fifoBatchPreview
                        ? fifoBatchPreview.effectiveCost
                        : (selectedProduct.cost_price || 0)
                      : (selectedProduct.cost_price || 0)}{" "}
                    / {uomLabel || "unit"}
                  </span>
                </div>

                {valuationMethod === "fifo" && fifoBatchPreview && fifoBatchPreview.batches.length > 0 && (
                  <div className="text-[11px] bg-background/80 p-2.5 rounded-lg border border-border/60 space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground uppercase">
                      <span>{numQty > 0 ? "Consumed FIFO Batches" : "Next Batch in Queue"}</span>
                      {numQty > 0 && <span>Total: Rs. {fifoBatchPreview.totalCost}</span>}
                    </div>
                    {fifoBatchPreview.batches.map((b, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] font-mono">
                        <span className="truncate pr-2">
                          {b.batch_number}: {b.quantity} {uomLabel} @ Rs. {b.cost_price}
                        </span>
                        <span className="shrink-0 font-medium text-foreground">
                          Rs. {(b.quantity * b.cost_price).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {fifoBatchPreview.isFallback && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        Remaining quantity exceeds available active batches; will consume at fallback cost Rs.{" "}
                        {selectedProduct.cost_price || 0}.
                      </p>
                    )}
                  </div>
                )}

                {valuationMethod === "fifo" && (!fifoBatchPreview || fifoBatchPreview.batches.length === 0) && (
                  <p className="text-[11px] text-muted-foreground">
                    No active batches found for this product. Reduction will use fallback cost Rs.{" "}
                    {selectedProduct.cost_price || 0}.
                  </p>
                )}

                {valuationMethod === "average" && (
                  <p className="text-[11px] text-muted-foreground">
                    Stock will be reduced at the current moving average cost (Rs. {selectedProduct.cost_price || 0}) without altering unit average cost.
                  </p>
                )}
              </div>
            )} */}

            {/* Notes / Remarks */}
            <div className="space-y-1.5">
              <Label htmlFor="adjustNotes" className="text-xs font-medium text-muted-foreground">
                {t("notesRemarks")}
              </Label>
              <Input
                id="adjustNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
                className="h-10 text-xs sm:text-sm"
                maxLength={200}
              />
            </div>

            {errorMsg && (
              <div className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200">
                {errorMsg}
              </div>
            )}

            <DialogFooter className="pt-2 sm:pt-4 flex flex-col-reverse sm:flex-row gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="w-full sm:w-auto h-10 text-xs sm:text-sm"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || numQty <= 0}
                className="w-full sm:w-auto h-10 text-xs sm:text-sm font-semibold gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {tCommon("saving")}
                  </>
                ) : isEditMode ? (
                  t("updateAdjustment") || "Update Adjustment"
                ) : (
                  t("adjustStock")
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
