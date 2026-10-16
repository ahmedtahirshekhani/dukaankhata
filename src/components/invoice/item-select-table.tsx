"use client";

import React, { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { XIcon, PlusCircle } from "lucide-react";
import { ProductDropdown } from "@/components/dropdown/product-dropdown";
import { calculateLineTotal } from "@/lib/invoice/calculations";
import { type POSProduct, type Product } from "@/app/[locale]/admin/sales/invoice/new/page";
import { getLocalizedUnitOptions, formatUomDisplay } from "@/lib/uom";

export interface ItemSelectTableProps {
  selectedProducts: POSProduct[];
  handleQuantityChange: (id: number | string, val: string) => void;
  handleQuantityBlur: (id: number | string) => void;
  handleQuantityTypeChange?: (id: number | string, val: "prime" | "damaged") => void;
  handleSellPriceChange: (id: number | string, val: string) => void;
  handleSellPriceBlur: (id: number | string) => void;
  handleDiscountChange?: (id: number | string, val: number) => void;
  handleDiscountTypeChange?: (id: number | string, val: "value" | "percentage") => void;
  handleUomChange?: (id: number | string, val: string) => void;
  handleRemoveProduct: (id: number | string) => void;
  handleSelectProduct: (product: Product) => void;
  handleRowProductChange?: (oldId: number | string, newProduct: Product, isSync?: boolean) => void;
  priceLabel?: string;
  showQtyType?: boolean;
  showDiscount?: boolean;
}

export function ItemSelectTable({
  selectedProducts,
  handleQuantityChange,
  handleQuantityBlur,
  handleQuantityTypeChange,
  handleSellPriceChange,
  handleSellPriceBlur,
  handleDiscountChange,
  handleDiscountTypeChange,
  handleUomChange,
  handleRemoveProduct,
  handleSelectProduct,
  handleRowProductChange,
  priceLabel,
  showQtyType = true,
  showDiscount = true,
}: ItemSelectTableProps) {
  const t = useTranslations("invoice");
  const tCommon = useTranslations("common");
  const tProducts = useTranslations("products");

  const unitOptions = useMemo(() => {
    return getLocalizedUnitOptions((key: string) => tProducts(key));
  }, [tProducts]);

  const isUomMissing = (product: POSProduct) => {
    return (
      product.hadNoUomOriginally ||
      !product.unit_of_measurement ||
      product.unit_of_measurement.trim() === "" ||
      product.unit_of_measurement === "-" ||
      product.unit_of_measurement === "none"
    );
  };

  const truncateDescription = (desc?: string, limit = 80) => {
    if (!desc) return "";
    return desc.length > limit ? `${desc.slice(0, limit)}...` : desc;
  };

  const displayPriceLabel = priceLabel || t("sellPrice") || "Price";

  return (
    <div className="w-full">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table className="text-xs">
          <TableHeader className="bg-gray-50/50">
            <TableRow>
              <TableHead className={showQtyType && showDiscount ? "w-[30%] py-2 h-8" : "w-[38%] py-2 h-8"}>
                {t("item") || "Item"}
              </TableHead>
              <TableHead className="py-2 h-8">{t("quantity") || "Qty"}</TableHead>
              {showQtyType && <TableHead className="py-2 h-8">{t("qtyType") || "Type"}</TableHead>}
              <TableHead className="py-2 h-8">{t("uom") || "UOM"}</TableHead>
              <TableHead className="py-2 h-8">{displayPriceLabel}</TableHead>
              {showDiscount && <TableHead className="py-2 h-8">{t("discount") || "Discount"}</TableHead>}
              <TableHead className={!showDiscount && !showQtyType ? "py-2 h-8 text-right" : "py-2 h-8"}>
                {t("amount") || "Amount"}
              </TableHead>
              <TableHead className="w-8 py-2 h-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectedProducts.map((product) => (
              <TableRow key={product.id} className="h-10">
                <TableCell className="py-1">
                  <ProductDropdown
                    resetOnChange={false}
                    value={String(product.id)}
                    onValueChange={(value, newProduct, isSync) => {
                      if (newProduct && handleRowProductChange) {
                        handleRowProductChange(product.id, newProduct as Product, isSync);
                      }
                    }}
                    placeholder={product.name}
                    enableSearch={true}
                    searchPlaceholder={tCommon("searchProduct") || "Search product..."}
                    className="w-full h-7 text-xs"
                  />
                </TableCell>
                <TableCell className="py-1">
                  <NumericInput
                    value={product.quantityInput ?? String(product.quantity ?? 1)}
                    onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                    onBlur={() => handleQuantityBlur(product.id)}
                    className="w-16 h-7 p-1 text-xs"
                  />
                </TableCell>
                {showQtyType && (
                  <TableCell className="py-1">
                    <Select
                      value={product.quantityType || "prime"}
                      onValueChange={(val) =>
                        handleQuantityTypeChange?.(
                          product.id,
                          val as "prime" | "damaged",
                        )
                      }
                    >
                      <SelectTrigger className="w-20 h-7 text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prime" className="text-xs">{t("prime") || "Prime"}</SelectItem>
                        <SelectItem value="damaged" className="text-xs">{t("damaged") || "Damaged"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                <TableCell className="py-1">
                  {!isUomMissing(product) ? (
                    <Select disabled>
                      <SelectTrigger className="w-16 h-7 text-xs bg-gray-50 text-muted-foreground font-medium cursor-not-allowed">
                        <SelectValue placeholder={formatUomDisplay(product.unit_of_measurement)} />
                      </SelectTrigger>
                    </Select>
                  ) : (
                    <Select
                      value={product.unit_of_measurement || ""}
                      onValueChange={(val) => handleUomChange?.(product.id, val)}
                    >
                      <SelectTrigger className="w-24 h-7 text-xs bg-amber-50/70 border-amber-300 text-amber-900 focus:ring-amber-500 font-medium">
                        <SelectValue placeholder={t("selectUom") || "Select UOM"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {unitOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell className="py-1">
                  <NumericInput
                    value={product.sellPriceInput ?? String(product.sell_price)}
                    onChange={(e) => handleSellPriceChange(product.id, e.target.value)}
                    onBlur={() => handleSellPriceBlur(product.id)}
                    onFocus={(e) => {
                      if (e.target.value === "0") e.target.select();
                    }}
                    className="w-24 h-7 text-xs"
                  />
                </TableCell>
                {showDiscount && (
                  <TableCell className="py-1">
                    <div className="flex items-center gap-1">
                      <NumericInput
                        placeholder="0"
                        value={product.discount ?? ""}
                        onChange={(e) =>
                          handleDiscountChange?.(
                            product.id,
                            parseFloat(e.target.value || "0"),
                          )
                        }
                        className="w-16 h-7 text-xs"
                      />
                      <Select
                        value={product.discountType || "value"}
                        onValueChange={(val) =>
                          handleDiscountTypeChange?.(
                            product.id,
                            val as "value" | "percentage",
                          )
                        }
                      >
                        <SelectTrigger className="w-14 h-7 text-xs bg-white">
                          <SelectValue placeholder={t("pkr") || "PKR"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="value" className="text-xs">PKR</SelectItem>
                          <SelectItem value="percentage" className="text-xs">%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                )}
                <TableCell className={!showDiscount && !showQtyType ? "py-1 text-right" : "py-1"}>
                  <span className="font-semibold text-xs text-gray-900">
                    Rs. {Math.floor(calculateLineTotal(product))}
                  </span>
                </TableCell>
                <TableCell className="py-1 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveProduct(product.id)}
                    className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add Item Row - Desktop */}
      <div className="hidden md:flex mt-2 items-center">
        <div className={showQtyType && showDiscount ? "w-[30%]" : "w-[38%]"}>
          <ProductDropdown
            resetOnChange
            value={""}
            onValueChange={(value, product) => {
              if (!product) return;
              handleSelectProduct(product as Product);
            }}
            placeholder={
              <div className="flex items-center gap-1.5 text-primary font-medium">
                <PlusCircle className="h-3.5 w-3.5" />
                {selectedProducts.length > 0 ? (t("addAnotherItem") || "Add Another Item") : (t("addItem") || "Add Item")}
              </div>
            }
            enableSearch={true}
            searchPlaceholder={tCommon("searchProduct") || "Search product..."}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {selectedProducts.map((product) => (
          <Card key={product.id} className="p-2 border">
            <div className="space-y-1.5">
              <div className="flex justify-between items-start gap-1">
                <div className="flex-1">
                  <ProductDropdown
                    resetOnChange={false}
                    value={String(product.id)}
                    onValueChange={(value, newProduct, isSync) => {
                      if (newProduct && handleRowProductChange) {
                        handleRowProductChange(product.id, newProduct as Product, isSync);
                      }
                    }}
                    placeholder={product.name}
                    className="w-full h-7 text-xs"
                  />
                  {product.description && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 px-1 leading-tight">
                      {truncateDescription(product.description, 40)}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveProduct(product.id)}
                  className="h-7 w-7 p-0 text-red-500 shrink-0"
                >
                  <XIcon className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    {displayPriceLabel}
                  </p>
                  <NumericInput
                    value={product.sellPriceInput ?? String(product.sell_price)}
                    onChange={(e) =>
                      handleSellPriceChange(product.id, e.target.value)
                    }
                    onBlur={() => handleSellPriceBlur(product.id)}
                    onFocus={(e) => {
                      if (e.target.value === "0") {
                        e.target.select();
                      }
                    }}
                    className="w-full h-7 text-xs"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    {t("qty") || "Qty"} & {t("uom") || "UOM"}
                  </p>
                  <div className="flex gap-1">
                    <NumericInput
                      value={product.quantityInput ?? String(product.quantity ?? 1)}
                      onChange={(e) => {
                        handleQuantityChange(product.id, e.target.value);
                      }}
                      onBlur={() => handleQuantityBlur(product.id)}
                      className="w-full h-7 p-1 text-xs"
                    />
                    {!isUomMissing(product) ? (
                      <Select disabled>
                        <SelectTrigger className="w-16 h-7 text-xs bg-gray-50 px-1 text-muted-foreground font-medium shrink-0 cursor-not-allowed">
                          <SelectValue placeholder={formatUomDisplay(product.unit_of_measurement)} />
                        </SelectTrigger>
                      </Select>
                    ) : (
                      <Select
                        value={product.unit_of_measurement || ""}
                        onValueChange={(val) => handleUomChange?.(product.id, val)}
                      >
                        <SelectTrigger className="w-20 h-7 text-xs bg-amber-50/70 border-amber-300 text-amber-900 font-medium px-1 shrink-0">
                          <SelectValue placeholder={t("selectUom") || "UOM"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {unitOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>

              {showQtyType && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      {t("qtyType") || "Type"}
                    </p>
                    <Select
                      value={product.quantityType || "prime"}
                      onValueChange={(val) =>
                        handleQuantityTypeChange?.(
                          product.id,
                          val as "prime" | "damaged",
                        )
                      }
                    >
                      <SelectTrigger className="w-full h-7 text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prime" className="text-xs">{t("prime") || "Prime"}</SelectItem>
                        <SelectItem value="damaged" className="text-xs">{t("damaged") || "Damaged"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {showDiscount && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">{t("discount") || "Discount"}</p>
                      <div className="flex items-center gap-1">
                        <NumericInput
                          placeholder="0"
                          value={product.discount ?? ""}
                          onChange={(e) =>
                            handleDiscountChange?.(
                              product.id,
                              parseFloat(e.target.value || "0"),
                            )
                          }
                          className="h-7 text-xs p-1"
                        />
                        <Select
                          value={product.discountType || "value"}
                          onValueChange={(val) =>
                            handleDiscountTypeChange?.(
                              product.id,
                              val as "value" | "percentage",
                            )
                          }
                        >
                          <SelectTrigger className="w-14 h-7 text-xs px-1">
                            <SelectValue placeholder={t("pkr") || "PKR"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="value" className="text-xs">PKR</SelectItem>
                            <SelectItem value="percentage" className="text-xs">%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-1.5 border-t flex justify-between items-center mt-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("amount") || "Amount"}
                </p>
                <p className="font-bold text-xs">
                  Rs. {Math.floor(calculateLineTotal(product))}
                </p>
              </div>
            </div>
          </Card>
        ))}

        {/* Add Item - Mobile */}
        <div className="mt-2">
          <ProductDropdown
            resetOnChange
            value={""}
            onValueChange={(value, product) => {
              if (!product) return;
              handleSelectProduct(product as Product);
            }}
            placeholder={
              <div className="flex items-center gap-1.5 text-primary font-medium">
                <PlusCircle className="h-3.5 w-3.5" />
                {selectedProducts.length > 0 ? (t("addAnotherItem") || "Add Another Item") : (t("addItem") || "Add Item")}
              </div>
            }
            enableSearch={true}
            searchPlaceholder={tCommon("searchProduct") || "Search product..."}
            className="h-8 text-xs"
          />
        </div>
      </div>
    </div>
  );
}
