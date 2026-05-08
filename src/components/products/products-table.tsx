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
import { FilePenIcon, TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Product } from "@/types/product";
export type { Product };

interface ProductsTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  capitalizeFirstLetter: (str: string | undefined | null) => string;
}

export function ProductsTable({
  products,
  onEdit,
  onDelete,
  capitalizeFirstLetter,
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
                  {product.sell_price !== undefined &&
                  product.sell_price !== null
                    ? `Rs. ${Math.floor(product.sell_price)}`
                    : "-"}
                </TableCell>
                <TableCell className="text-xs">
                  {product.cost_price !== undefined &&
                  product.cost_price !== null
                    ? `Rs. ${Math.floor(product.cost_price)}`
                    : "-"}
                </TableCell>

                <TableCell className="text-xs">
                  {product.quantity || product.in_stock || "-"}
                </TableCell>
                <TableCell className="text-xs">
                  {product.damaged_quantity !== undefined &&
                  product.damaged_quantity !== null
                    ? product.damaged_quantity
                    : "-"}
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
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onEdit(product)}
                    >
                      <FilePenIcon className="w-4 h-4" />
                      <span className="sr-only">{editLabel}</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="danger"
                      className="h-8 w-8"
                      onClick={() => onDelete(product)}
                      style={{ display: "none" }}
                    >
                      <TrashIcon className="w-4 h-4" />
                      <span className="sr-only">{deleteLabel}</span>
                    </Button>
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
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{product.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {capitalizeFirstLetter(
                    truncateDescription(product.description),
                  )}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onEdit(product)}
                className="h-8 w-8"
              >
                <FilePenIcon className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
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

              {product.sell_price !== undefined &&
                product.sell_price !== null && (
                  <div>
                    <span className="text-muted-foreground">
                      {sellPriceLabel}:
                    </span>
                    <span className="ml-1 font-medium">
                      Rs. {Math.floor(product.sell_price)}
                    </span>
                  </div>
                )}

              {product.cost_price !== undefined &&
                product.cost_price !== null && (
                  <div>
                    <span className="text-muted-foreground">
                      {costPriceLabel}:
                    </span>
                    <span className="ml-1 font-medium">
                      Rs. {Math.floor(product.cost_price)}
                    </span>
                  </div>
                )}

              {(product.quantity || product.in_stock) && (
                <div>
                  <span className="text-muted-foreground">
                    {quantityLabel}:
                  </span>
                  <span className="ml-1 font-medium">
                    {product.quantity || product.in_stock}{" "}
                    {capitalizeFirstLetter(product.unit_of_measurement)}
                  </span>
                </div>
              )}

              {product.damaged_quantity !== undefined &&
                product.damaged_quantity !== null && (
                  <div>
                    <span className="text-muted-foreground">
                      {damagedQuantityLabel}:
                    </span>
                    <span className="ml-1 font-medium">
                      {product.damaged_quantity}
                    </span>
                  </div>
                )}

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
    </>
  );
}
