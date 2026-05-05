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
import { Button } from "@/components/ui/button";
import Select, { type SingleValue } from "react-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
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
  const [productPrice, setProductPrice] = useState<number | "">("");
  const [sellPrice, setSellPrice] = useState<number | "">("");
  const [costPrice, setCostPrice] = useState<number | "">("");
  const [productInStock, setProductInStock] = useState<number | "">("");
  const [damagedQuantity, setDamagedQuantity] = useState<number | "">("");
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
        setSellPrice(selectedProduct.sell_price || "");
        setCostPrice(selectedProduct.cost_price || "");
        setProductInStock(selectedProduct.quantity || "");
        setDamagedQuantity(selectedProduct.damaged_quantity || "");
        setUnitOfMeasurement(selectedProduct.unit_of_measurement || "");
        setBranch(selectedProduct.branch || "");
      } else {
        setSellPrice(selectedProduct.sell_price || "");
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
          sell_price: sellPrice === "" ? 0 : sellPrice,
          cost_price: costPrice === "" ? 0 : costPrice,
          quantity: productInStock === "" ? 0 : productInStock,
          unit_of_measurement: unitOfMeasurement,
          branch: branch,
        }),
        ...(itemType === "services" && {
          sell_price: sellPrice === "" ? 0 : sellPrice,
        }),
      };
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newProduct),
      });

      if (response.ok) {
        const addedProduct = await response.json();
        onSuccess(addedProduct, false);
        onOpenChange(false);
        resetForm();
      } else {
        console.error("Failed to add product");
      }
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
          sell_price: sellPrice === "" ? 0 : sellPrice,
          cost_price: costPrice === "" ? 0 : costPrice,
          quantity: productInStock === "" ? 0 : productInStock,
          damaged_quantity: damagedQuantity === "" ? 0 : damagedQuantity,
          unit_of_measurement: unitOfMeasurement,
          branch: branch,
        }),
        ...(itemType === "services" && {
          sell_price: sellPrice === "" ? 0 : sellPrice,
        }),
      };
      const response = await fetch(`/api/products/${selectedProduct.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedProduct),
      });

      if (response.ok) {
        const updatedProductFromServer = await response.json();
        onSuccess(updatedProductFromServer, true);
        onOpenChange(false);
        resetForm();
      } else {
        console.error("Failed to update product");
      }
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
                    <Input
                      id="sellPrice"
                      type="number"
                      value={sellPrice}
                      onChange={(e) => {
                        const val =
                          e.target.value === "" ? "" : Number(e.target.value);
                        setSellPrice(val === "" ? "" : Math.max(0, val));
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
                    <Input
                      id="costPrice"
                      type="number"
                      value={costPrice}
                      onChange={(e) => {
                        const val =
                          e.target.value === "" ? "" : Number(e.target.value);
                        setCostPrice(val === "" ? "" : Math.max(0, val));
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
                    <Input
                      id="quantity"
                      type="number"
                      value={productInStock}
                      onChange={(e) => {
                        const val =
                          e.target.value === "" ? "" : Number(e.target.value);
                        setProductInStock(val === "" ? "" : Math.max(0, val));
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
                    <Input
                      id="damagedQuantity"
                      type="number"
                      value={damagedQuantity}
                      onChange={(e) => {
                        const val =
                          e.target.value === "" ? "" : Number(e.target.value);
                        setDamagedQuantity(val === "" ? "" : Math.max(0, val));
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
                    <Input
                      id="sellPrice"
                      type="number"
                      value={sellPrice}
                      onChange={(e) => {
                        const val =
                          e.target.value === "" ? "" : Number(e.target.value);
                        setSellPrice(val === "" ? "" : Math.max(0, val));
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