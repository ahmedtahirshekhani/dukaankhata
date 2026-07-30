"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { FilePenIcon, Trash2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Product } from "@/types/product";
export type { Product };

interface ProductsTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  capitalizeFirstLetter: (str: string | undefined | null) => string;
  isLoading?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function ProductsTable({
  products,
  onEdit,
  onDelete,
  capitalizeFirstLetter,
  isLoading = false,
  canEdit = true,
  canDelete = true,
}: ProductsTableProps) {
  const t = useTranslations("products");
  const nameLabel = t("name");
  const sellPriceLabel = t("sellPrice");
  const costPriceLabel = t("costPrice");
  const quantityLabel = t("quantity");
  const damagedQuantityLabel = t("damagedQuantity");
  const uomLabel = t("uom");
  const categoryLabel = t("category");
  const typeLabel = t("type");
  const branchLabel = t("branch");
  const actionsLabel = t("actions");
  const editLabel = t("edit");
  const deleteLabel = t("delete");
  const noProductsLabel = t("noProducts");
  const goodsLabel = t("goods");
  const servicesLabel = t("services");
  const getTypeLabel = (type?: string) =>
    type === "services" ? servicesLabel : goodsLabel;

  const truncateDescription = (desc?: string, limit = 100) => {
    if (!desc) return "";
    return desc.length > limit ? `${desc.slice(0, limit)}...` : desc;
  };

  const formatQuantity = (val: number | string | undefined | null) => {
    if (val === undefined || val === null || val === "") return "-";
    const num = Number(val);
    if (isNaN(num)) return "-";
    if (Number.isInteger(num)) return num.toString();
    // Return up to 3 decimal places without unnecessary zeros if it exceeds it, but wait!
    // If they typed 45.50, it is 45.5 in DB. We format to 3 decimals.
    // 45.5 -> 45.500
    // But what if it's a price? For price, 2 decimals is standard.
    // The user specifically complained about quantity: "teen decimal places jao"
    return num.toFixed(3);
  };

  const formatPrice = (val: number | string | undefined | null) => {
    if (val === undefined || val === null || val === "") return "-";
    const num = Number(val);
    if (isNaN(num)) return "-";
    if (Number.isInteger(num)) return `Rs. ${num}`;
    return `Rs. ${num.toFixed(2)}`;
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{nameLabel}</TableHead>
              <TableHead>{sellPriceLabel}</TableHead>
              <TableHead>{costPriceLabel}</TableHead>
              <TableHead>{quantityLabel}</TableHead>
              <TableHead>{damagedQuantityLabel}</TableHead>
              <TableHead>{uomLabel}</TableHead>
              <TableHead>{categoryLabel}</TableHead>
              <TableHead>{typeLabel}</TableHead>
              <TableHead>{branchLabel}</TableHead>
              <TableHead>{actionsLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium text-sm">
                  <div className="flex flex-col gap-1">
                    <span>{product.name}</span>
                    {product.description && (
                      <span className="text-xs text-muted-foreground leading-snug">
                        {capitalizeFirstLetter(
                          truncateDescription(product.description),
                        )}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  {product.sell_price_str ? `Rs. ${product.sell_price_str}` : formatPrice(product.sell_price)}
                </TableCell>
                <TableCell className="text-xs">
                  {product.cost_price_str ? `Rs. ${product.cost_price_str}` : formatPrice(product.cost_price)}
                </TableCell>

                <TableCell className="text-xs">
                  {formatQuantity(product.quantity ?? product.in_stock)}
                </TableCell>
                <TableCell className="text-xs">
                  {formatQuantity(product.damaged_quantity)}
                </TableCell>
                <TableCell className="text-xs">
                  {capitalizeFirstLetter(product.unit_of_measurement)}
                </TableCell>
                <TableCell className="text-xs">
                  {capitalizeFirstLetter(product.category)}
                </TableCell>
                <TableCell className="text-xs font-medium">
                  {getTypeLabel(product.type)}
                </TableCell>
                <TableCell className="text-xs">
                  {capitalizeFirstLetter(product.branch)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onEdit(product)}
                      >
                        <FilePenIcon className="w-4 h-4" />
                        <span className="sr-only">{editLabel}</span>
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="danger"
                        className="h-8 w-8"
                        onClick={() => onDelete(product)}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sr-only">{deleteLabel}</span>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {products.map((product) => (
          <Card key={product.id} className="p-4">
            <div className="flex justify-between items-center mb-3 gap-2">
              <h3 className="font-semibold text-sm truncate">{product.name}</h3>
              <div className="flex items-center gap-1 shrink-0">
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onEdit(product)}
                    className="h-8 w-8"
                  >
                    <FilePenIcon className="w-4 h-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(product)}
                    className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <p className="text-sm">
                  <span className="text-muted-foreground">
                    {sellPriceLabel}:
                  </span>{" "}
                  {product.sell_price_str ? `Rs. ${product.sell_price_str}` : formatPrice(product.sell_price)}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">
                    {costPriceLabel}:
                  </span>{" "}
                  {product.cost_price_str ? `Rs. ${product.cost_price_str}` : formatPrice(product.cost_price)}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">
                    {quantityLabel}:
                  </span>{" "}
                  {formatQuantity(product.quantity ?? product.in_stock)}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">
                    {damagedQuantityLabel}:
                  </span>{" "}
                  {formatQuantity(product.damaged_quantity)}
                </p>
              </div>

            <div className="grid grid-cols-2 gap-2 text-xs mt-3">
              <div>
                <span className="text-muted-foreground">{typeLabel}:</span>
                <span className="ml-1 font-medium">
                  {getTypeLabel(product.type)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{categoryLabel}:</span>
                <span className="ml-1 font-medium">
                  {capitalizeFirstLetter(product.category)}
                </span>
              </div>
              {product.branch && (
                <div>
                  <span className="text-muted-foreground">{branchLabel}:</span>
                  <span className="ml-1 font-medium">
                    {capitalizeFirstLetter(product.branch)}
                  </span>
                </div>
              )}
            </div>
          </Card>
        ))}

        {products.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {noProductsLabel}
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-20 min-h-[200px]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-xs font-medium text-muted-foreground animate-pulse">
              {t("loading") || "Loading..."}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
