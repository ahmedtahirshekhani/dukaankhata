import React from "react";
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
import { Input } from "@/components/ui/input";
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

interface ItemSelectTableProps {
  selectedProducts: POSProduct[];
  handleQuantityChange: (id: number | string, val: string) => void;
  handleQuantityBlur: (id: number | string) => void;
  handleQuantityTypeChange: (id: number | string, val: "prime" | "damaged") => void;
  handleSellPriceChange: (id: number | string, val: string) => void;
  handleSellPriceBlur: (id: number | string) => void;
  handleDiscountChange: (id: number | string, val: number) => void;
  handleDiscountTypeChange: (id: number | string, val: "value" | "percentage") => void;
  handleRemoveProduct: (id: number | string) => void;
  handleSelectProduct: (product: Product) => void;
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
  handleRemoveProduct,
  handleSelectProduct,
}: ItemSelectTableProps) {
  const t = useTranslations("invoice");
  const tCommon = useTranslations("common");

  const formatUom = (uom?: string) =>
    uom ? uom.charAt(0).toUpperCase() + uom.slice(1) : "-";

  const truncateDescription = (desc?: string, limit = 80) => {
    if (!desc) return "";
    return desc.length > limit ? `${desc.slice(0, limit)}...` : desc;
  };

  return (
    <div className="w-full">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table className="text-xs">
          <TableHeader className="bg-gray-50/50">
            <TableRow>
              <TableHead className="w-[30%] py-2 h-8">{t("item")}</TableHead>
              <TableHead className="py-2 h-8">{t("quantity")}</TableHead>
              <TableHead className="py-2 h-8">{t("qtyType")}</TableHead>
              <TableHead className="py-2 h-8">{t("uom")}</TableHead>
              <TableHead className="py-2 h-8">{t("sellPrice")}</TableHead>
              <TableHead className="py-2 h-8">{t("discount")}</TableHead>
              <TableHead className="py-2 h-8">{t("amount")}</TableHead>
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
                    onValueChange={(value, newProduct) => {}}
                    placeholder={product.name}
                    enableSearch={true}
                    searchPlaceholder={tCommon("searchProduct") || "Search product..."}
                    className="w-full h-7 text-xs"
                  />
                </TableCell>
                <TableCell className="py-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={product.quantityInput ?? String(product.quantity ?? 1)}
                    onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                    onBlur={() => handleQuantityBlur(product.id)}
                    className="w-14 p-1 h-7 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </TableCell>
                <TableCell className="py-1">
                  <Select
                    value={product.quantityType || "prime"}
                    onValueChange={(val) =>
                      handleQuantityTypeChange(
                        product.id,
                        val as "prime" | "damaged",
                      )
                    }
                  >
                    <SelectTrigger className="w-20 h-7 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prime" className="text-xs">{t("prime")}</SelectItem>
                      <SelectItem value="damaged" className="text-xs">{t("damaged")}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground py-1">
                  <Select disabled>
                    <SelectTrigger className="w-16 h-7 text-xs bg-gray-50">
                      <SelectValue placeholder={formatUom(product.unit_of_measurement || "pcs")} />
                    </SelectTrigger>
                  </Select>
                </TableCell>
                <TableCell className="py-1">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={product.sellPriceInput ?? String(product.sell_price)}
                    onChange={(e) => handleSellPriceChange(product.id, e.target.value)}
                    onBlur={() => handleSellPriceBlur(product.id)}
                    onFocus={(e) => {
                      if (e.target.value === "0") e.target.select();
                    }}
                    className="w-20 h-7 text-xs"
                  />
                </TableCell>
                <TableCell className="py-1">
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      placeholder="0"
                      value={product.discount || ""}
                      onChange={(e) =>
                        handleDiscountChange(
                          product.id,
                          parseFloat(e.target.value),
                        )
                      }
                      className="w-16 h-7 text-xs"
                    />
                    <Select
                      value={product.discountType || "value"}
                      onValueChange={(val) =>
                        handleDiscountTypeChange(
                          product.id,
                          val as "value" | "percentage",
                        )
                      }
                    >
                      <SelectTrigger className="w-14 h-7 text-xs bg-white">
                        <SelectValue placeholder={t("pkr")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="value" className="text-xs">PKR</SelectItem>
                        <SelectItem value="percentage" className="text-xs">%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
                <TableCell className="py-1">
                  <span className="font-medium text-xs">
                    {Math.floor(calculateLineTotal(product))}
                  </span>
                </TableCell>
                <TableCell className="py-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveProduct(product.id)}
                    className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <XIcon className="w-3 h-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add Item Row - Desktop */}
      <div className="hidden md:flex mt-2 items-center">
        <div className="w-[30%]">
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
                  {selectedProducts.length > 0 ? "Add Another Item" : "Add Item"}
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
                      onValueChange={(value, newProduct) => {}}
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
                    {t("sellPrice")}
                  </p>
                  <Input
                    type="text"
                    inputMode="decimal"
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
                    {t("qty")} / {t("uom")}
                  </p>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={product.quantityInput ?? String(product.quantity ?? 1)}
                      onChange={(e) => {
                        handleQuantityChange(product.id, e.target.value);
                      }}
                      onBlur={() => handleQuantityBlur(product.id)}
                      className="w-full h-7 p-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Select disabled>
                      <SelectTrigger className="w-16 h-7 text-xs bg-gray-50 px-1">
                        <SelectValue placeholder={formatUom(product.unit_of_measurement || "pcs")} />
                      </SelectTrigger>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    {t("qtyType")}
                  </p>
                  <Select
                    value={product.quantityType || "prime"}
                    onValueChange={(val) =>
                      handleQuantityTypeChange(
                        product.id,
                        val as "prime" | "damaged",
                      )
                    }
                  >
                    <SelectTrigger className="w-full h-7 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prime" className="text-xs">{t("prime")}</SelectItem>
                      <SelectItem value="damaged" className="text-xs">{t("damaged")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Discount</p>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      placeholder="0"
                      value={product.discount || ""}
                      onChange={(e) =>
                        handleDiscountChange(
                          product.id,
                          parseFloat(e.target.value),
                        )
                      }
                      className="h-7 text-xs p-1"
                    />
                    <Select
                      value={product.discountType || "value"}
                      onValueChange={(val) =>
                        handleDiscountTypeChange(
                          product.id,
                          val as "value" | "percentage",
                        )
                      }
                    >
                      <SelectTrigger className="w-14 h-7 text-xs px-1">
                        <SelectValue placeholder={t("pkr")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="value" className="text-xs">PKR</SelectItem>
                        <SelectItem value="percentage" className="text-xs">%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="pt-1.5 border-t flex justify-between items-center mt-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("amount")}
                </p>
                <p className="font-bold text-xs">
                  {Math.floor(calculateLineTotal(product))}
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
                {selectedProducts.length > 0 ? "Add Another Item" : "Add Item"}
              </div>
            }
            enableSearch={true}
            searchPlaceholder={t("searchProduct") || "Search product..."}
            className="h-8 text-xs"
          />
        </div>
      </div>
    </div>
  );
}
