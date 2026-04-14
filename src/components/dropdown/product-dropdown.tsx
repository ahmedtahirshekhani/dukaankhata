// components/dropdown/product-dropdown.tsx
"use client";

import React, { useState, useEffect, useCallback, forwardRef } from "react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircle, Loader2Icon, SearchIcon, X } from "lucide-react";
import { ProductDialog } from "@/components/dialogs/product-dialog";
import { formatCurrencyString } from "@/lib/utils";

interface Product {
  id: number;
  _id?: number;
  type?: string;
  name: string;
  description?: string;
  sell_price?: number;
  cost_price?: number;
  quantity?: number;
  unit_of_measurement?: string;
  category?: string;
  branch?: string;
}

interface ProductDropdownProps {
  value?: string;
  onValueChange: (value: string, product?: Product) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  noResultsText?: string;
  addButtonPosition?: "top" | "bottom";  // NEW PROP
}

export const ProductDropdown = forwardRef<HTMLButtonElement, ProductDropdownProps>(
  (
    {
      value,
      onValueChange,
      placeholder = "Select Product",
      disabled = false,
      className = "",
      enableSearch = true,
      searchPlaceholder = "Search product...",
      noResultsText = "No products found",
      addButtonPosition = "bottom", // default bottom
    },
    ref
  ) => {
    const t = useTranslations("products");
    const tCommon = useTranslations("common");

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
    const [selectedProductForDialog, setSelectedProductForDialog] = useState<Product | null>(null);

    const fetchProducts = useCallback(async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/products");
        if (!res.ok) throw new Error("Failed to fetch products");
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      fetchProducts();
    }, [fetchProducts]);

    // Filter products based on search term
    const filteredProducts = React.useMemo(() => {
      if (!searchTerm.trim()) return products;
      const term = searchTerm.toLowerCase();
      return products.filter(
        (p) =>
          p.name?.toLowerCase().includes(term) ||
          p.description?.toLowerCase().includes(term)
      );
    }, [products, searchTerm]);

    const handleValueChange = (newValue: string) => {
      const selected = products.find((p) => String(p.id || p._id) === newValue);
      onValueChange(newValue, selected);
      setIsOpen(false);
      setSearchTerm("");
    };

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (!open) setSearchTerm("");
    };

    const handleProductDialogSuccess = (product: Product, isEdit: boolean) => {
      // Refresh product list
      fetchProducts();
      // Auto-select the newly added or edited product
      const productId = String(product.id || product._id);
      onValueChange(productId, product);
      setIsProductDialogOpen(false);
      setSelectedProductForDialog(null);
    };

    const getProductId = (p: Product) => String(p.id || p._id);

    // Truncate description for dropdown (max 60 chars)
    const truncateDesc = (desc?: string) => {
      if (!desc) return "";
      return desc.length > 60 ? desc.substring(0, 57) + "..." : desc;
    };

    // Function to open add product dialog and close dropdown
    const openAddProductDialog = () => {
      setIsOpen(false); // Close dropdown first to prevent overlay conflict
      setSelectedProductForDialog(null);
      setIsProductDialogOpen(true);
    };

    // Render Add Button component
    const AddButton = () => (
      <div
        className="border-t mt-0 pt-1 sticky bottom-0 bg-popover"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          className="flex w-full items-center gap-2 px-2 py-2 rounded-none hover:bg-accent"
          onClick={openAddProductDialog}
        >
          <PlusCircle className="h-4 w-4" />
          {t("addNewItem") || "Add New Product"}
        </Button>
      </div>
    );

    // Render Add Button at top (sticky)
    const AddButtonTop = () => (
      <div
        className="sticky top-0 bg-popover z-10 border-b"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          className="flex w-full items-center gap-2 px-2 py-2 rounded-none hover:bg-accent"
          onClick={openAddProductDialog}
        >
          <PlusCircle className="h-4 w-4" />
          {t("addNewItem") || "Add New Product"}
        </Button>
      </div>
    );

    return (
      <>
        <div className="relative">
          <Select
            value={value}
            onValueChange={handleValueChange}
            disabled={disabled || loading}
            open={isOpen}
            onOpenChange={handleOpenChange}
          >
            <SelectTrigger className={className} ref={ref}>
              <SelectValue placeholder={loading ? "Loading..." : placeholder} />
            </SelectTrigger>
            <SelectContent className="min-w-[280px] max-w-[90vw] p-0">
              {/* Add Button at Top if position is top */}
              {addButtonPosition === "top" && <AddButtonTop />}

              {/* Search Input */}
              {enableSearch && (
                <div className="sticky top-0 bg-popover z-10 border-b p-2">
                  <div className="relative">
                    <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={searchPlaceholder}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 pr-8 h-8 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchTerm("");
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      >
                        <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Product List */}
              <div className="max-h-[300px] overflow-y-auto">
                {filteredProducts.length === 0 && !loading && (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    {searchTerm ? noResultsText : "No products available"}
                  </div>
                )}
                {filteredProducts.map((product) => {
                  const productId = getProductId(product);
                  const price = product.sell_price || 0;
                  const shortDesc = truncateDesc(product.description);
                  return (
                    <SelectItem key={productId} value={productId}>
                      <div className="flex flex-col items-start gap-0.5 py-0.5">
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">{product.name}</span>
                          {/* <span className="text-xs text-muted-foreground ml-2">
                            {formatCurrencyString(price)}
                          </span> */}
                        </div>
                        {shortDesc && (
                          <span className="text-xs text-black hover:text-white truncate max-w-[280px]">
                            {shortDesc}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </div>

              {/* Add Button at Bottom if position is bottom */}
              {addButtonPosition === "bottom" && <AddButton />}
            </SelectContent>
          </Select>

          {loading && (
            <div className="absolute right-8 top-1/2 -translate-y-1/2">
              <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Product Dialog - will render with normal overlay */}
        <ProductDialog
          open={isProductDialogOpen}
          onOpenChange={setIsProductDialogOpen}
          selectedProduct={selectedProductForDialog}
          onSuccess={handleProductDialogSuccess}
        />
      </>
    );
  }
);

ProductDropdown.displayName = "ProductDropdown";