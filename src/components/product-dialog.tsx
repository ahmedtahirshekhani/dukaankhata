"use client";

import { useState, useEffect, useCallback } from "react";
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
import { CategorySelector } from "@/components/category-selector";
import { BranchSelector } from "@/components/branch-selector";

interface Product {
  id: number;
  type?: string;
  name: string;
  description: string;
  price?: number;
  sell_price?: number;
  cost_price?: number;
  in_stock?: number;
  quantity?: number;
  category: string;
  unit_of_measurement?: string;
  branch?: string;
}

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProduct: Product | null;
  onSuccess: (product: Product, isEdit: boolean) => void;
}

export type UnitOption = { value: string; label: string };

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

const SORTED_UNITS_OF_MEASUREMENT = [...UNITS_OF_MEASUREMENT].sort((a, b) =>
  a.label.localeCompare(b.label),
);

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
  const [itemType, setItemType] = useState<"goods" | "services">("goods");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState<number | "">("");
  const [sellPrice, setSellPrice] = useState<number | "">("");
  const [costPrice, setCostPrice] = useState<number | "">("");
  const [productInStock, setProductInStock] = useState<number | "">("");
  const [productCategory, setProductCategory] = useState("");
  const [unitOfMeasurement, setUnitOfMeasurement] = useState("");
  const [branch, setBranch] = useState("");
  const [loading, setLoading] = useState(false);

  const isEditMode = selectedProduct !== null;

  useEffect(() => {
    if (selectedProduct) {
      setItemType((selectedProduct.type as "goods" | "services") || "goods");
      setProductName(selectedProduct.name);
      setProductDescription(selectedProduct.description);
      if (selectedProduct.type === "goods") {
        setSellPrice(selectedProduct.sell_price || "");
        setCostPrice(selectedProduct.cost_price || "");
        setProductInStock(selectedProduct.quantity || "");
        setUnitOfMeasurement(selectedProduct.unit_of_measurement || "");
        setBranch(selectedProduct.branch || "");
      } else {
        setSellPrice(selectedProduct.sell_price || "");
      }
      setProductCategory(selectedProduct.category);
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? t("dialogEditTitle") : t("dialogAddTitle")}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? t("dialogEditDescription")
                : t("dialogAddDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-right">{t("type")}</Label>
              </div>
              <div className="col-span-3">
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
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="name" className="">
                    {t("nameLabel")}
                  </Label>
                  <span className="text-red-500 text-xs">{t("required")}</span>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button type="button" className="cursor-help">
                        <Info className="w-3 h-3 text-gray-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("tooltipName")}</TooltipContent>
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
                  <Label htmlFor="description" className="">
                    {t("descriptionLabel")}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {t("maxChars")}
                  </span>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button type="button" className="cursor-help">
                        <Info className="w-3 h-3 text-gray-400" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("tooltipDescription")}</TooltipContent>
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
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="quantity" className="">
                        {t("quantityLabel")}
                      </Label>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button type="button" className="cursor-help">
                            <Info className="w-3 h-3 text-gray-400" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("tooltipQuantity")}</TooltipContent>
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
                      <Label htmlFor="unitOfMeasurement" className="">
                        {t("unitOfMeasurementLabel")}
                      </Label>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button type="button" className="cursor-help">
                            <Info className="w-3 h-3 text-gray-400" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("tooltipUnitOfMeasurement")}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select
                      inputId="unitOfMeasurement"
                      isClearable
                      isSearchable
                      options={SORTED_UNITS_OF_MEASUREMENT}
                      placeholder={t("selectUnitPlaceholder")}
                      styles={selectStyles}
                      value={
                        SORTED_UNITS_OF_MEASUREMENT.find(
                          (unit) => unit.value === unitOfMeasurement,
                        ) || null
                      }
                      onChange={(option: SingleValue<UnitOption>) =>
                        setUnitOfMeasurement(option?.value || "")
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="sellPrice" className="">
                        {t("sellPriceLabel")}
                      </Label>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button type="button" className="cursor-help">
                            <Info className="w-3 h-3 text-gray-400" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("tooltipSellPrice")}</TooltipContent>
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
                      <Label htmlFor="costPrice" className="">
                        {t("costPriceLabel")}
                      </Label>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button type="button" className="cursor-help">
                            <Info className="w-3 h-3 text-gray-400" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("tooltipCostPrice")}</TooltipContent>
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

                <div className="grid grid-cols-2 gap-6">
                  <CategorySelector
                    value={productCategory}
                    onChange={setProductCategory}
                  />

                  <BranchSelector value={branch} onChange={setBranch} />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="sellPrice" className="">
                        {t("sellPriceLabel")}
                      </Label>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button type="button" className="cursor-help">
                            <Info className="w-3 h-3 text-gray-400" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t("tooltipSellPriceService")}
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
                  : t("addItem")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </TooltipProvider>
    </Dialog>
  );
}
