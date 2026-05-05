// components/dropdown/product-dropdown.tsx
"use client";

import React, { useState, useEffect, useCallback, forwardRef, useRef, useMemo } from "react";
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

import { Product } from "@/types/product";

interface ProductDropdownProps {
  value?: string;
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
      placeholder = "Select Product",
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
    const tCommon = useTranslations("common");

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [isOpen, setIsOpen] = useState(false);
    const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
    const [selectedProductForDialog, setSelectedProductForDialog] = useState<Product | null>(null);
    
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const observerTarget = useRef<HTMLDivElement>(null);
    const [initialProductLoaded, setInitialProductLoaded] = useState(false);

    const getProductId = (p: Product) => String(p.id || p._id);

    // Fetch products from server
    const fetchProducts = useCallback(async (pageNum: number, search: string, append = false) => {
      try {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);

        const url = new URL("/api/products", window.location.origin);
        url.searchParams.append("page", pageNum.toString());
        url.searchParams.append("limit", ITEMS_PER_PAGE.toString());
        if (search) url.searchParams.append("search", search);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Failed to fetch products");
        const data = await res.json();
        
        const newProducts = data.products || [];
        setProducts(prev => append ? [...prev, ...newProducts] : newProducts);
        setHasMore(newProducts.length === ITEMS_PER_PAGE);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    }, []);

    // Load initial product if value is provided and not in the list
    const fetchSelectedProduct = useCallback(async (productId: string) => {
      if (!productId) return;
      try {
        const res = await fetch(`/api/products/${productId}`);
        if (res.ok) {
          const product = await res.json();
          setProducts(prev => {
            const exists = prev.find(p => getProductId(p) === productId);
            if (exists) return prev;
            return [product, ...prev];
          });
        }
      } catch (error) {
        console.error("Error fetching selected product:", error);
      }
    }, []);

    // Initial load and search
    useEffect(() => {
      setPage(1);
      fetchProducts(1, debouncedSearchTerm, false);
    }, [debouncedSearchTerm, fetchProducts]);

    // Ensure selected product is loaded
    useEffect(() => {
      if (value && !initialProductLoaded) {
        const exists = products.find(p => getProductId(p) === value);
        if (!exists) {
          fetchSelectedProduct(value);
        }
        setInitialProductLoaded(true);
      }
    }, [value, products, initialProductLoaded, fetchSelectedProduct]);

    // Handle intersection observer for infinite scroll
    useEffect(() => {
      if (!hasMore || loading || loadingMore || !isOpen) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchProducts(nextPage, debouncedSearchTerm, true);
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
    };

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (!open) setSearchTerm("");
    };

    const handleProductDialogSuccess = (product: Product, isEdit: boolean) => {
      setPage(1);
      fetchProducts(1, "", false);
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
          {t("addNewItem") || "Add New Product"}
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
