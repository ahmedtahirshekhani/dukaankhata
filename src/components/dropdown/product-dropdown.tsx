// components/dropdown/product-dropdown.tsx
"use client";

import React, { useState, useEffect, forwardRef, useRef, useMemo } from "react";
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
import { useDebounce } from "@/hooks/use-debounce";
import { useOfflineProducts } from "@/lib/hooks/useOfflineData";
import { usePermissions } from "@/hooks/use-permissions";

import { Product } from "@/types/product";

interface ProductDropdownProps {
  value?: string | number;
  onValueChange: (value: string, product?: Product, isSync?: boolean) => void;
  placeholder?: string | React.ReactNode;
  disabled?: boolean;
  className?: string;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  noResultsText?: string;
  addButtonPosition?: "top" | "bottom";
  resetOnChange?: boolean;
}

const ITEMS_PER_PAGE = 20;

export const ProductDropdown = forwardRef<HTMLButtonElement, ProductDropdownProps>(
  (
    {
      value,
      onValueChange,
      placeholder = "Add new item",
      disabled = false,
      className = "",
      enableSearch = true,
      searchPlaceholder = "Search product...",
      noResultsText = "No products found",
      addButtonPosition = "bottom",
      resetOnChange = false,
    },
    ref
  ) => {
    const t = useTranslations("products");
    const { can } = usePermissions();
    const canCreate = can("products", "create");

    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [isOpen, setIsOpen] = useState(false);
    const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
    const [selectedProductForDialog, setSelectedProductForDialog] = useState<Product | null>(null);
    const [selectResetKey, setSelectResetKey] = useState(0);
    const [optimisticProduct, setOptimisticProduct] = useState<Product | null>(null);
    
    // Reset internal select if parent explicitly clears the value
    useEffect(() => {
      if (!value) {
        setSelectResetKey((k) => k + 1);
      }
    }, [value]);

    const [page, setPage] = useState(1);
    
    // Replace API fetching with offline hook
    const offlineProducts = useOfflineProducts(debouncedSearchTerm) || [];
    const getProductId = (p: Product) => String(p.id || p._id);

    const products = useMemo(() => {
      let paginated = offlineProducts.slice(0, page * ITEMS_PER_PAGE);

      if (optimisticProduct) {
        const optimisticId = getProductId(optimisticProduct);
        if (!paginated.some(p => getProductId(p) === optimisticId)) {
          paginated = [optimisticProduct, ...paginated];
        }
      }

      if (value) {
        const stringValue = String(value);
        const isSelectedInPaginated = paginated.some(p => getProductId(p) === stringValue);
        if (!isSelectedInPaginated) {
          let selectedProduct = offlineProducts.find(p => getProductId(p) === stringValue);
          if (!selectedProduct && optimisticProduct && getProductId(optimisticProduct) === stringValue) {
             selectedProduct = optimisticProduct;
          }
          if (selectedProduct) {
            paginated = [selectedProduct, ...paginated];
          }
        }
      }

      return paginated;
    }, [offlineProducts, page, value, optimisticProduct]);
    
    const hasMore = products.length < offlineProducts.length;

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      if (target.scrollHeight - target.scrollTop <= target.clientHeight + 20) {
        if (hasMore) {
          setPage(prev => prev + 1);
        }
      }
    };

    useEffect(() => {
      const handleLocalIdReplaced = (e: any) => {
        const { collection, oldId, newId } = e.detail;
        if (collection === "products" && value === oldId) {
          const newProduct = products.find(p => getProductId(p) === newId) || { id: newId, name: "" };
          onValueChange(newId, newProduct as Product, true);
        }
      };

      window.addEventListener("localIdReplaced", handleLocalIdReplaced);
      return () => window.removeEventListener("localIdReplaced", handleLocalIdReplaced);
    }, [value, products, onValueChange]);

    const handleValueChange = (newValue: string) => {
      const selected = products.find((p) => getProductId(p) === newValue);
      onValueChange(newValue, selected);
      setIsOpen(false);
      setSearchTerm("");
      if (resetOnChange) {
        setSelectResetKey((current) => current + 1);
      }
    };

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (!open) setSearchTerm("");
    };

    const handleProductDialogSuccess = async (product: Product, isEdit: boolean) => {
      setPage(1);
      setOptimisticProduct(product);
      const productId = getProductId(product);
      onValueChange(productId, product);
      setIsProductDialogOpen(false);
    };

    const truncateDesc = (desc?: string) => {
      if (!desc) return "";
      return desc.length > 60 ? desc.substring(0, 57) + "..." : desc;
    };

    const openAddProductDialog = () => {
      if (!canCreate) return;
      setIsOpen(false);
      setSelectedProductForDialog(null);
      setIsProductDialogOpen(true);
    };

    const AddButton = () => (
      <div className="border-t mt-0 pt-1 sticky bottom-0 bg-popover" onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant="ghost"
          className="flex w-full items-center gap-2 px-2 py-2 rounded-none hover:bg-accent"
          onClick={openAddProductDialog}
        >
          <PlusCircle className="h-4 w-4" />
          Add new item
        </Button>
      </div>
    );

    const AddButtonTop = () => (
      <div className="sticky top-0 bg-popover z-10 border-b" onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant="ghost"
          className="flex w-full items-center gap-2 px-2 py-2 rounded-none hover:bg-accent"
          onClick={openAddProductDialog}
        >
          <PlusCircle className="h-4 w-4" />
          Add new item
        </Button>
      </div>
    );

    return (
      <>
        <div className="relative">
          <Select
            key={selectResetKey}
            value={value ? String(value) : undefined}
            onValueChange={handleValueChange}
            disabled={disabled}
            open={isOpen}
            onOpenChange={handleOpenChange}
          >
            <SelectTrigger className={className} ref={ref}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent 
            position="popper" 
            sideOffset={5} 
            className="min-w-[280px] max-w-[90vw] p-0 overflow-hidden"
            collisionPadding={10}
          >
            {canCreate && addButtonPosition === "top" && <AddButtonTop />}

              {enableSearch && (
                <div className="sticky top-0 bg-popover z-10 border-b p-2">
                  <div className="relative">
                    <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder={searchPlaceholder}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
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

              <div 
                className="max-h-[min(300px,var(--radix-select-content-available-height)-100px)] overflow-y-auto custom-scrollbar"
                onScroll={handleScroll}
              >
                {products.length === 0 && (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    {searchTerm ? noResultsText : "No products available"}
                  </div>
                )}
                {products.map((product) => {
                  const productId = getProductId(product);
                  const shortDesc = truncateDesc(product.description);
                  return (
                    <SelectItem key={productId} value={productId}>
                      <div className="flex flex-col items-start gap-0.5 py-0.5">
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">{product.name}</span>
                        </div>
                        {shortDesc && (
                          <span className="text-xs text-muted-foreground truncate max-w-[240px]">
                            {shortDesc}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
                
                {/* Infinite Scroll Target Area */}
                <div className="flex flex-col items-center justify-center p-4 gap-2 min-h-[50px]">
                  {hasMore ? (
                    <div className="h-1 w-1" />
                  ) : products.length > 0 ? (
                    <span className="text-[10px] text-muted-foreground/50">End of list</span>
                  ) : null}
                </div>
              </div>

              {canCreate && addButtonPosition === "bottom" && <AddButton />}
            </SelectContent>
          </Select>


        </div>

        {canCreate && (
          <ProductDialog
            open={isProductDialogOpen}
            onOpenChange={setIsProductDialogOpen}
            selectedProduct={selectedProductForDialog}
            onSuccess={handleProductDialogSuccess}
          />
        )}
      </>
    );
  }
);

ProductDropdown.displayName = "ProductDropdown";
