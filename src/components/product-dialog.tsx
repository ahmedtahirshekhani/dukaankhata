"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
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

const UNITS_OF_MEASUREMENT = [
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

export function ProductDialog({
  open,
  onOpenChange,
  selectedProduct,
  onSuccess,
}: ProductDialogProps) {
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
      setItemType(selectedProduct.type as "goods" | "services" || "goods");
      setProductName(selectedProduct.name);
      setProductDescription(selectedProduct.description);
      if (selectedProduct.type === "goods") {
        setSellPrice(selectedProduct.sell_price || "");
        setCostPrice(selectedProduct.cost_price || "");
        setProductInStock(selectedProduct.quantity || "");
        setUnitOfMeasurement(selectedProduct.unit_of_measurement || "");
        setBranch(selectedProduct.branch || "");
      } else {
        setProductPrice(selectedProduct.price || "");
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
          price: productPrice === "" ? 0 : productPrice,
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
          price: productPrice === "" ? 0 : productPrice,
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
  }, [selectedProduct, itemType, productName, productDescription, productPrice, sellPrice, costPrice, productInStock, productCategory, unitOfMeasurement, branch, onSuccess, onOpenChange]);

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
              {isEditMode ? "Edit Item" : "Add New Item"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Edit the details of the item."
                : "Enter the details of the new item."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-right">Type</Label>
            </div>
            <div className="col-span-3">
              <RadioGroup value={itemType} onValueChange={(value) => setItemType(value as "goods" | "services")}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="goods" id="goods" />
                    <Label htmlFor="goods" className="font-normal cursor-pointer">Goods</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="services" id="services" />
                    <Label htmlFor="services" className="font-normal cursor-pointer">Services</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="name" className="">
                  Name
                </Label>
                  <span className="text-red-500 text-xs">* (Required)</span>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button type="button" className="cursor-help">
                      <Info className="w-3 h-3 text-gray-400" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Enter the name or title of the item
                  </TooltipContent>
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
                  Description
                </Label>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button type="button" className="cursor-help">
                      <Info className="w-3 h-3 text-gray-400" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Add details about the item
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="description"
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
              />
            </div>
          </div>

          {itemType === "goods" ? (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="sellPrice" className="">
                      Sell Price
                    </Label>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button type="button" className="cursor-help">
                          <Info className="w-3 h-3 text-gray-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Price at which you sell this item
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="sellPrice"
                    type="number"
                    value={sellPrice}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : Number(e.target.value);
                      setSellPrice(val === "" ? "" : Math.max(0, val));
                    }}
                    placeholder="0"
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="costPrice" className="">
                      Cost Price
                    </Label>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button type="button" className="cursor-help">
                          <Info className="w-3 h-3 text-gray-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Price at which you purchased this item
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="costPrice"
                    type="number"
                    value={costPrice}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : Number(e.target.value);
                      setCostPrice(val === "" ? "" : Math.max(0, val));
                    }}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="quantity" className="">
                      Quantity
                    </Label>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button type="button" className="cursor-help">
                          <Info className="w-3 h-3 text-gray-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Current stock or quantity available
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="quantity"
                    type="number"
                    value={productInStock}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : Number(e.target.value);
                      setProductInStock(val === "" ? "" : Math.max(0, val));
                    }}
                    placeholder="0"
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="unitOfMeasurement" className="">
                      Unit of Measurement
                    </Label>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button type="button" className="cursor-help">
                          <Info className="w-3 h-3 text-gray-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Choose the unit for measuring quantity (kg, liter, piece, etc.)
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select value={unitOfMeasurement} onValueChange={(value) => setUnitOfMeasurement(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS_OF_MEASUREMENT.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <CategorySelector value={productCategory} onChange={setProductCategory} />

                <BranchSelector value={branch} onChange={setBranch} />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="price" className="">
                      Price
                    </Label>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button type="button" className="cursor-help">
                          <Info className="w-3 h-3 text-gray-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Price for this service
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="price"
                    type="number"
                    value={productPrice}
                    onChange={(e) => {
                      const val = e.target.value === "" ? "" : Number(e.target.value);
                      setProductPrice(val === "" ? "" : Math.max(0, val));
                    }}
                    placeholder="0"
                    min="0"
                  />
                </div>

                <CategorySelector value={productCategory} onChange={setProductCategory} />
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
              ? "Processing..."
              : isEditMode
                ? "Update Item"
                : "Add Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
      </TooltipProvider>
    </Dialog>
  );
}
