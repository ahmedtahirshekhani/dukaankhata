// components/dropdown/product-dropdown.tsx
"use client";

import React, { useState, useEffect, forwardRef, useRef } from "react";
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
import { useProductsCache } from "@/hooks/use-products-cache";

import { Product } from "@/types/product";

interface ProductDropdownProps {
  value?: string | number;
  onValueChange: (value: string, product?: Product) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  noResultsText?: string;
  addButtonPosition?: "top" | "bottom";
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
    },
    ref
  ) => {
    const t = useTranslations("products");

    const {
      products,
      loading,
      loadingMore,
      hasMore,
      fetchProducts,
      fetchProductById,
      revalidate,
    } = useProductsCache();

    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [isOpen, setIsOpen] = useState(false);
    const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
    const [selectedProductForDialog, setSelectedProductForDialog] = useState<Product | null>(null);
    const [selectResetKey, setSelectResetKey] = useState(0);
    
    const [page, setPage] = useState(1);
    const observerTarget = useRef<HTMLDivElement>(null);
    const lastFetchedValue = useRef<string | number | undefined>(undefined);

    const getProductId = (p: Product) => String(p.id || p._id);

    // Load only when dropdown is open; avoids duplicate calls from hidden responsive instances.
    useEffect(() => {
      if (!isOpen) return;
      setPage(1);
      fetchProducts({ page: 1, limit: ITEMS_PER_PAGE, search: debouncedSearchTerm, append: false });
    }, [debouncedSearchTerm, fetchProducts, isOpen]);

    // Ensure selected product is loaded
    useEffect(() => {
      const valStr = value ? String(value) : "";
      if (valStr && valStr !== String(lastFetchedValue.current)) {
        const exists = products.find(p => getProductId(p) === valStr);
        if (!exists) {
          fetchProductById(value!);
        }
        lastFetchedValue.current = value;
      }
    }, [value, products, fetchProductById]);

    // Handle intersection observer for infinite scroll
    useEffect(() => {
      if (!hasMore || loading || loadingMore || !isOpen) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchProducts({ page: nextPage, limit: ITEMS_PER_PAGE, search: debouncedSearchTerm, append: true });
          }
        },
        { threshold: 0.1 }
      );

      if (observerTarget.current) {
        observer.observe(observerTarget.current);
      }

      return () => observer.disconnect();
    }, [hasMore, loading, loadingMore, page, debouncedSearchTerm, fetchProducts, isOpen]);

    const handleValueChange = (newValue: string) => {
      const selected = products.find((p) => getProductId(p) === newValue);
      onValueChange(newValue, selected);
      setIsOpen(false);
      setSearchTerm("");
      setSelectResetKey((current) => current + 1);
    };

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (!open) setSearchTerm("");
    };

    const handleProductDialogSuccess = async (product: Product, isEdit: boolean) => {
      setPage(1);
      await revalidate();
      const productId = getProductId(product);
      onValueChange(productId, product);
      setIsProductDialogOpen(false);
    };

    const truncateDesc = (desc?: string) => {
      if (!desc) return "";
      return desc.length > 60 ? desc.substring(0, 57) + "..." : desc;
    };

    const openAddProductDialog = () => {
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
              <SelectValue placeholder={loading && page === 1 ? "Loading..." : placeholder} />
            </SelectTrigger>
            <SelectContent 
              position="popper" 
              sideOffset={5} 
              className="min-w-[280px] max-w-[90vw] p-0 overflow-hidden"
              collisionPadding={10}
            >
              {addButtonPosition === "top" && <AddButtonTop />}

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

              <div className="max-h-[min(300px,var(--radix-select-content-available-height)-100px)] overflow-y-auto custom-scrollbar">
                {products.length === 0 && !loading && (
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
                
                {/* Intersection Observer Target */}
                <div ref={observerTarget} className="flex flex-col items-center justify-center p-4 gap-2 min-h-[50px]">
                  {loadingMore ? (
                    <>
                      <Loader2Icon className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground animate-pulse">Loading more...</span>
                    </>
                  ) : hasMore ? (
                    <div className="h-1 w-1" />
                  ) : products.length > 0 ? (
                    <span className="text-[10px] text-muted-foreground/50">End of list</span>
                  ) : null}
                </div>
              </div>

              {addButtonPosition === "bottom" && <AddButton />}
            </SelectContent>
          </Select>

          {loading && page === 1 && (
            <div className="absolute right-8 top-1/2 -translate-y-1/2">
              <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

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
