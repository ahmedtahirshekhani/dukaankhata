"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import Select, { type SingleValue } from "react-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { ErrorDialog } from "./error-dialog";
import { db } from "@/lib/db/offline-db";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { Info } from "lucide-react";
import { CategorySelector } from "@/components/selectors/category-selector";
import { BranchSelector } from "@/components/selectors/branch-selector";

import { Product } from "@/types/product";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProduct: Product | null;
  onSuccess: (product: Product, isEdit: boolean) => void;
}

export type UnitOption = { value: string; label: string };

const UNIT_VALUES = [
  "piece",
  "kg",
  "gram",
  "liter",
  "ml",
  "meter",
  "cm",
  "inch",
  "foot",
  "yard",
  "lb",
  "oz",
  "gallon",
  "pint",
  "quart",
  "sqm",
  "sqft",
  "cum",
  "box",
  "pack",
  "dozen",
  "roll",
  "sheet",
  "bundle",
  "carton",
  "case",
  "bottle",
  "can",
  "jar",
  "bag",
  "pair",
  "set",
  "unit",
  "tube",
  "packet",
  "strip",
  "ton",
  "cft",
  "sft",
  "rft",
  "bale",
  "cone",
  "than",
  "guz",
  "crate",
  "sack",
  "tin",
  "drum",
  "maund",
  "seer",
  "tablet",
  "capsule",
  "ampoule",
  "vial",
  "coil",
  "bucket",
  "ream",
] as const;

/** @deprecated Use UNIT_VALUES with translations. Exported for counter-sale page compatibility. */
export const UNITS_OF_MEASUREMENT: UnitOption[] = [
  { value: "piece", label: "Piece" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "gram", label: "Gram (g)" },
  { value: "liter", label: "Liter (L)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "meter", label: "Meter (m)" },
  { value: "cm", label: "Centimeter (cm)" },
  { value: "inch", label: "Inch (in)" },
  { value: "foot", label: "Foot (ft)" },
  { value: "yard", label: "Yard (yd)" },
  { value: "lb", label: "Pound (lb)" },
  { value: "oz", label: "Ounce (oz)" },
  { value: "gallon", label: "Gallon (gal)" },
  { value: "pint", label: "Pint (pt)" },
  { value: "quart", label: "Quart (qt)" },
  { value: "sqm", label: "Square Meter (m²)" },
  { value: "sqft", label: "Square Foot (ft²)" },
  { value: "cum", label: "Cubic Meter (m³)" },
  { value: "box", label: "Box" },
  { value: "pack", label: "Pack" },
  { value: "dozen", label: "Dozen" },
  { value: "roll", label: "Roll" },
  { value: "sheet", label: "Sheet" },
  { value: "bundle", label: "Bundle" },
  { value: "carton", label: "Carton" },
  { value: "case", label: "Case" },
  { value: "bottle", label: "Bottle" },
  { value: "can", label: "Can" },
  { value: "jar", label: "Jar" },
  { value: "bag", label: "Bag" },
  { value: "pair", label: "Pair" },
  { value: "set", label: "Set" },
  { value: "unit", label: "Unit" },
  { value: "tube", label: "Tube" },
  { value: "packet", label: "Packet" },
  { value: "strip", label: "Strip" },
  { value: "ton", label: "Ton" },
  { value: "cft", label: "Cubic Foot (cft)" },
  { value: "sft", label: "Square Foot (sft)" },
  { value: "rft", label: "Running Foot (rft)" },
  { value: "bale", label: "Bale" },
  { value: "cone", label: "Cone" },
  { value: "than", label: "Than" },
  { value: "guz", label: "Guz" },
  { value: "crate", label: "Crate" },
  { value: "sack", label: "Sack / Bori" },
  { value: "tin", label: "Tin" },
  { value: "drum", label: "Drum" },
  { value: "maund", label: "Maund" },
  { value: "seer", label: "Seer" },
  { value: "tablet", label: "Tablet" },
  { value: "capsule", label: "Capsule" },
  { value: "ampoule", label: "Ampoule" },
  { value: "vial", label: "Vial" },
  { value: "coil", label: "Coil" },
  { value: "bucket", label: "Bucket" },
  { value: "ream", label: "Ream" },
];

const selectStyles = {
  control: (base: any) => ({
    ...base,
    minHeight: "36px",
    fontSize: "14px",
    borderColor: "#d1d5db",
    boxShadow: "none",
    "&:hover": {
      borderColor: "#9ca3af",
    },
  }),
  placeholder: (base: any) => ({
    ...base,
    color: "black",
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "#111827"
      : state.isFocused
        ? "#f3f4f6"
        : "white",
    color: state.isSelected ? "white" : "black",
    cursor: "pointer",
    fontSize: "14px",
  }),
  menu: (base: any) => ({
    ...base,
    zIndex: 20,
  }),
};

const formatInitialQuantity = (val: number | string | undefined | null) => {
  if (val === undefined || val === null || val === "") return "";
  const num = Number(val);
  if (isNaN(num)) return "";
  if (Number.isInteger(num)) return num.toString();
  return Number(num.toFixed(5)).toString();
};

const formatInitialPrice = (val: number | string | undefined | null) => {
  if (val === undefined || val === null || val === "") return "";
  const num = Number(val);
  if (isNaN(num)) return "";
  if (Number.isInteger(num)) return num.toString();
  return num.toFixed(2);
};

export function ProductDialog({
  open,
  onOpenChange,
  selectedProduct,
  onSuccess,
}: ProductDialogProps) {
  const t = useTranslations("products");
  const sortedUnitOptions = useMemo(() => {
    const options: UnitOption[] = UNIT_VALUES.map((value) => ({
      value,
      label: t(`units.${value}`),
    }));
    return [...options].sort((a, b) => a.label.localeCompare(b.label));
  }, [t]);

  const [itemType, setItemType] = useState<"goods" | "services">("goods");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState<number | string>("");
  const [sellPrice, setSellPrice] = useState<number | string>("");
  const [costPrice, setCostPrice] = useState<number | string>("");
  const [productInStock, setProductInStock] = useState<number | string>("");
  const [damagedQuantity, setDamagedQuantity] = useState<number | string>("");
  const [productCategory, setProductCategory] = useState("");
  const [unitOfMeasurement, setUnitOfMeasurement] = useState("");
  const [branch, setBranch] = useState("");
  const [loading, setLoading] = useState(false);

  const isEditMode = selectedProduct !== null;

  useEffect(() => {
    if (selectedProduct) {
      setItemType((selectedProduct.type as "goods" | "services") || "goods");
      setProductName(selectedProduct.name);
      setProductDescription(selectedProduct.description || "");
      if (selectedProduct.type === "goods") {
        setSellPrice(selectedProduct.sell_price_str ?? formatInitialPrice(selectedProduct.sell_price));
        setCostPrice(selectedProduct.cost_price_str ?? formatInitialPrice(selectedProduct.cost_price));
        setProductInStock(selectedProduct.quantity_str ?? formatInitialQuantity(selectedProduct.quantity));
        setDamagedQuantity(selectedProduct.damaged_quantity_str ?? formatInitialQuantity(selectedProduct.damaged_quantity));
        setUnitOfMeasurement(selectedProduct.unit_of_measurement || "");
        setBranch(selectedProduct.branch || "");
      } else {
        setSellPrice(selectedProduct.sell_price_str ?? formatInitialPrice(selectedProduct.sell_price));
      }
      setProductCategory(selectedProduct.category || "");
    } else {
      resetForm();
    }
  }, [selectedProduct, open]);

  const resetForm = () => {
    setItemType("goods");
    setProductName("");
    setProductDescription("");
    setProductPrice("");
    setSellPrice("");
    setCostPrice("");
    setProductInStock("");
    setDamagedQuantity("");
    setProductCategory("");
    setUnitOfMeasurement("");
    setBranch("");
  };

  const handleAddProduct = useCallback(async () => {
    try {
      setLoading(true);
      const newProduct = {
        type: itemType,
        name: productName,
        description: productDescription,
        category: productCategory,
        ...(itemType === "goods" && {
          sell_price: sellPrice === "" ? 0 : Number(sellPrice),
          sell_price_str: sellPrice === "" ? "" : String(sellPrice),
          cost_price: costPrice === "" ? 0 : Number(costPrice),
          cost_price_str: costPrice === "" ? "" : String(costPrice),
          quantity: productInStock === "" ? 0 : Number(productInStock),
          quantity_str: productInStock === "" ? "" : String(productInStock),
          damaged_quantity: damagedQuantity === "" ? 0 : Number(damagedQuantity),
          damaged_quantity_str: damagedQuantity === "" ? "" : String(damagedQuantity),
          unit_of_measurement: unitOfMeasurement,
          branch: branch,
        }),
        ...(itemType === "services" && {
          sell_price: sellPrice === "" ? 0 : Number(sellPrice),
          sell_price_str: sellPrice === "" ? "" : String(sellPrice),
        }),
        created_at: new Date().toISOString(),
      };
      const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const addedProduct = { ...newProduct, id: tempId, _id: tempId, is_delete: 0 };
      await db.products.add(addedProduct);
      await SyncEngine.queueOperation("products", "POST", "/api/products", newProduct, tempId);
      
      onSuccess(addedProduct as any, false);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error adding product:", error);
    } finally {
      setLoading(false);
    }
  }, [
    itemType,
    productName,
    productDescription,
    productPrice,
    sellPrice,
    costPrice,
    productInStock,
    damagedQuantity,
    productCategory,
    unitOfMeasurement,
    branch,
    onSuccess,
    onOpenChange,
  ]);

  const handleEditProduct = useCallback(async () => {
    if (!selectedProduct) return;
    try {
      setLoading(true);
      const updatedProduct = {
        type: itemType,
        name: productName,
        description: productDescription,
        category: productCategory,
        ...(itemType === "goods" && {
          sell_price: sellPrice === "" ? 0 : Number(sellPrice),
          sell_price_str: sellPrice === "" ? "" : String(sellPrice),
          cost_price: costPrice === "" ? 0 : Number(costPrice),
          cost_price_str: costPrice === "" ? "" : String(costPrice),
          quantity: productInStock === "" ? 0 : Number(productInStock),
          quantity_str: productInStock === "" ? "" : String(productInStock),
          damaged_quantity: damagedQuantity === "" ? 0 : Number(damagedQuantity),
          damaged_quantity_str: damagedQuantity === "" ? "" : String(damagedQuantity),
          unit_of_measurement: unitOfMeasurement,
          branch: branch,
        }),
        ...(itemType === "services" && {
          sell_price: sellPrice === "" ? 0 : Number(sellPrice),
          sell_price_str: sellPrice === "" ? "" : String(sellPrice),
        }),
      };
      const updatedProductFromServer = { ...selectedProduct, ...updatedProduct };
      await db.products.update(selectedProduct.id, updatedProduct);
      await SyncEngine.queueOperation("products", "PUT", `/api/products/${selectedProduct.id}`, updatedProduct, String(selectedProduct.id));
      
      onSuccess(updatedProductFromServer as any, true);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error updating product:", error);
    } finally {
      setLoading(false);
    }
  }, [
    selectedProduct,
    itemType,
    productName,
    productDescription,
    productPrice,
    sellPrice,
    costPrice,
    productInStock,
    damagedQuantity,
    productCategory,
    unitOfMeasurement,
    branch,
    onSuccess,
    onOpenChange,
  ]);

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <TooltipProvider>
        {/* BAS SIRF YAHAN CHANGES HAIN - BAAKI SAB WAISA HI */}
        <DialogContent className="sm:max-w-[600px] max-w-[95vw] rounded-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? t("editProduct") : t("addNewItem")}
            </DialogTitle>
            <DialogDescription>
              {isEditMode ? t("editItemDescription") : t("addItemDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{t("type")}</Label>
              <RadioGroup
                value={itemType}
                onValueChange={(value) =>
                  setItemType(value as "goods" | "services")
                }
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="goods" id="goods" />
                    <Label
                      htmlFor="goods"
                      className="font-normal cursor-pointer"
                    >
                      {t("goods")}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="services" id="services" />
                    <Label
                      htmlFor="services"
                      className="font-normal cursor-pointer"
                    >
                      {t("services")}
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* YAHAN BHI SAME GRID HAI - KUCH CHANGE NAHI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="name">{t("name")}</Label>
                  <span className="text-red-500 text-xs">{t("required")}</span>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button type="button" className="cursor-help">
                        <Info className="w-3 h-3 text-gray-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("nameTooltip")}</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="name"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                  aria-required="true"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="description">{t("description")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {t("descriptionMaxChars")}
                  </span>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button type="button" className="cursor-help">
                        <Info className="w-3 h-3 text-gray-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("descriptionTooltip")}</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="description"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  maxLength={100}
                />
              </div>
            </div>

            {itemType === "goods" ? (
              <>
                {/* YAHAN BHI SAME GRID HAI */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="sellPrice">{t("sellPrice")}</Label>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button type="button" className="cursor-help">
                            <Info className="w-3 h-3 text-gray-400" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("sellPriceTooltip")}</TooltipContent>
                      </Tooltip>
                    </div>
                    <NumericInput
                      id="sellPrice"
                      value={sellPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val !== "" && Number(val) < 0) return;
                        setSellPrice(val);
                      }}
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="costPrice">{t("costPrice")}</Label>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button type="button" className="cursor-help">
                            <Info className="w-3 h-3 text-gray-400" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("costPriceTooltip")}</TooltipContent>
                      </Tooltip>
                    </div>
                    <NumericInput
                      id="costPrice"
                      value={costPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val !== "" && Number(val) < 0) return;
                        setCostPrice(val);
                      }}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="quantity">{t("quantity")}</Label>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button type="button" className="cursor-help">
                            <Info className="w-3 h-3 text-gray-400" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("quantityTooltip")}</TooltipContent>
                      </Tooltip>
                    </div>
                    <NumericInput
                      id="quantity"
                      value={productInStock}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val !== "" && Number(val) < 0) return;
                        setProductInStock(val);
                      }}
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="damagedQuantity">
                        {t("damagedQuantity")}
                      </Label>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button type="button" className="cursor-help">
                            <Info className="w-3 h-3 text-gray-400" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("damagedQuantityTooltip")}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <NumericInput
                      id="damagedQuantity"
                      value={damagedQuantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val !== "" && Number(val) < 0) return;
                        setDamagedQuantity(val);
                      }}
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="unitOfMeasurement">
                        {t("unitOfMeasurement")}
                      </Label>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button type="button" className="cursor-help">
                            <Info className="w-3 h-3 text-gray-400" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("unitTooltip")}</TooltipContent>
                      </Tooltip>
                    </div>
                    <Select
                      inputId="unitOfMeasurement"
                      isClearable
                      isSearchable
                      options={sortedUnitOptions}
                      placeholder={t("selectUnit")}
                      styles={selectStyles}
                      value={
                        sortedUnitOptions.find(
                          (unit) => unit.value === unitOfMeasurement,
                        ) || null
                      }
                      onChange={(option: SingleValue<UnitOption>) =>
                        setUnitOfMeasurement(option?.value || "")
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <CategorySelector
                    value={productCategory}
                    onChange={setProductCategory}
                  />
                  <BranchSelector value={branch} onChange={setBranch} />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="sellPrice">{t("sellPrice")}</Label>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button type="button" className="cursor-help">
                            <Info className="w-3 h-3 text-gray-400" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("sellPriceServiceTooltip")}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <NumericInput
                      id="sellPrice"
                      value={sellPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val !== "" && Number(val) < 0) return;
                        setSellPrice(val);
                      }}
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <CategorySelector
                    value={productCategory}
                    onChange={setProductCategory}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={isEditMode ? handleEditProduct : handleAddProduct}
              disabled={loading || productName.trim() === ""}
            >
              {loading
                ? t("processing")
                : isEditMode
                  ? t("updateItem")
                  : t("addProduct")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </TooltipProvider>
    </Dialog>
  );
}