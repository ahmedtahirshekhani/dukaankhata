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
} from "lucide-react";
import { Product } from "@/types/product";
import { ProductDropdown } from "@/components/dropdown/product-dropdown";
import { recordStockAdjustmentOffline } from "@/lib/db/offline-stock-manager";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { formatLocalizedUom } from "@/lib/uom";

interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSuccess?: (updatedProduct: Product) => void;
}

export function AdjustStockDialog({
  open,
  onOpenChange,
  product: initialProduct = null,
  onSuccess,
}: AdjustStockDialogProps) {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");

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

  // Sync state when dialog opens or initialProduct changes
  useEffect(() => {
    if (open) {
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
      setAdjustmentDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setErrorMsg(null);
    }
  }, [open, initialProduct]);

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
    if (!selectedProduct?.unit_of_measurement) return "";
    return formatLocalizedUom(selectedProduct.unit_of_measurement, (key) => t(key));
  }, [selectedProduct, t]);

  const numQty = parseFloat(quantity) || 0;
  const currentTargetStock = stockType === "available" ? currentAvailable : currentDamaged;

  const previewNewStock = useMemo(() => {
    if (numQty <= 0) return currentTargetStock;
    if (actionType === "add") {
      return Math.round((currentTargetStock + numQty) * 100000) / 100000;
    }
    return Math.max(0, Math.round((currentTargetStock - numQty) * 100000) / 100000);
  }, [currentTargetStock, numQty, actionType]);

  const isExceedingStock = actionType === "reduce" && numQty > currentTargetStock;

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

    if (!reason) {
      setErrorMsg(t("selectReason"));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const parsedCost = costPrice !== "" ? parseFloat(costPrice) : undefined;
      const res = await recordStockAdjustmentOffline({
        productId: selectedProduct.id,
        stockType,
        actionType,
        quantity: numQty,
        reason,
        notes,
        adjustmentDate,
        costPrice: parsedCost,
      });

      const updatedProduct: Product = {
        ...selectedProduct,
        quantity: res.newQuantity,
        quantity_str: res.newQuantity.toString(),
        in_stock: res.newQuantity,
        damaged_quantity: res.newDamagedQuantity,
        damaged_quantity_str: res.newDamagedQuantity.toString(),
      };

      // Queue sync operation for backend MongoDB
      const payload = {
        productId: String(selectedProduct.id),
        stockType,
        actionType,
        quantity: numQty,
        reason,
        notes: notes.trim(),
        adjustmentDate,
        costPrice: parsedCost,
      };

      await SyncEngine.queueOperation(
        "stock_adjustments",
        "POST",
        "/api/stock-adjustments",
        payload,
        `adj_${Date.now()}`
      );

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
              <DialogTitle className="text-base sm:text-lg font-bold truncate">
                {selectedProduct
                  ? t("adjustStockTitle", { name: selectedProduct.name })
                  : (t("adjustStockHeaderTitle") || t("adjustStock"))}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                {t("adjustStockDesc")}
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
                      : isExceedingStock
                      ? "text-rose-600"
                      : "text-foreground"
                  }`}
                >
                  {previewNewStock} {uomLabel}
                </span>
              </div>
            </div>

            {isExceedingStock && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {t("reduceStock")} ({numQty}) {t("currentStock")} ({currentTargetStock}) se zyada hai.
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
                <Input
                  id="adjustDate"
                  type="date"
                  value={adjustmentDate}
                  onChange={(e) => setAdjustmentDate(e.target.value)}
                  className="h-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Cost Price (When Adding to Available Stock) */}
            {actionType === "add" && stockType === "available" && (
              <div className="space-y-1.5">
                <Label htmlFor="costPriceOpt" className="text-xs font-medium text-muted-foreground">
                  {t("costPriceOptional")} (Rs.)
                </Label>
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
                  className="h-10 text-xs sm:text-sm"
                />
              </div>
            )}

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
