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

export interface Product {
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
              <TableHead>Name</TableHead>
              <TableHead>Sell Price</TableHead>
              <TableHead>Cost Price</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>UOM</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Actions</TableHead>
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
                        {capitalizeFirstLetter(truncateDescription(product.description))}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  {product.sell_price !== undefined && product.sell_price !== null
                    ? `Rs. ${Math.floor(product.sell_price)}`
                    : "-"}
                </TableCell>
                <TableCell className="text-xs">
                  {product.cost_price !== undefined && product.cost_price !== null
                    ? `Rs. ${Math.floor(product.cost_price)}`
                    : "-"}
                </TableCell>
               
                <TableCell className="text-xs">
                  {product.quantity || product.in_stock || "-"}
                </TableCell>
                <TableCell className="text-xs">
                  {capitalizeFirstLetter(product.unit_of_measurement)}
                </TableCell>
                <TableCell className="text-xs">
                  {capitalizeFirstLetter(product.category)}
                </TableCell>
                <TableCell className="text-xs font-medium capitalize">
                  {capitalizeFirstLetter(product.type || "goods")}
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
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete(product)}
                      style={{ display: "none" }}
                    >
                      <TrashIcon className="w-4 h-4" />
                      <span className="sr-only">Delete</span>
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
                  {capitalizeFirstLetter(truncateDescription(product.description))}
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
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-1 font-medium">
                  {capitalizeFirstLetter(product.type || "goods")}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Category:</span>
                <span className="ml-1 font-medium">
                  {capitalizeFirstLetter(product.category)}
                </span>
              </div>
              
              {product.sell_price !== undefined && product.sell_price !== null && (
                <div>
                  <span className="text-muted-foreground">Sell Price:</span>
                  <span className="ml-1 font-medium">Rs. {Math.floor(product.sell_price)}</span>
                </div>
              )}
              
              {product.cost_price !== undefined && product.cost_price !== null && (
                <div>
                  <span className="text-muted-foreground">Cost Price:</span>
                  <span className="ml-1 font-medium">Rs. {Math.floor(product.cost_price)}</span>
                </div>
              )}
              
              
              {(product.quantity || product.in_stock) && (
                <div>
                  <span className="text-muted-foreground">Quantity:</span>
                  <span className="ml-1 font-medium">
                    {product.quantity || product.in_stock} {capitalizeFirstLetter(product.unit_of_measurement)}
                  </span>
                </div>
              )}
              
              {product.branch && (
                <div>
                  <span className="text-muted-foreground">Branch:</span>
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
            No products found
          </div>
        )}
      </div>
    </>
  );
}
