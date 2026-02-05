"use client";

import { useTranslations } from "next-intl";
import { useState, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  PlusIcon,
  Loader2Icon,
  SearchIcon,
  FileDown,
  Upload,
  MoreVertical,
} from "lucide-react";
import {
  exportProductsToExcel,
  exportProductsTemplate,
} from "@/lib/excel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ProductDialog } from "@/components/dialogs/product-dialog";
import { ProductFilters } from "@/components/products/product-filters";
import {
  ProductsTable,
  type Product,
} from "@/components/products/products-table";
import { useProductsData } from "@/components/products/use-products-data";
import { FilterIcon, ChevronDownIcon } from "lucide-react";
import { ErrorDialog } from "@/components/dialogs/error-dialog";

const capitalizeFirstLetter = (str: string | undefined | null): string => {
  if (!str) return "-";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export default function Products() {
  const t = useTranslations("products");
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    category: "all",
    inStock: "all",
    type: "all",
    branch: "all",
  });
  const [priceRanges, setPriceRanges] = useState({
    sellPriceMin: "",
    sellPriceMax: "",
    costPriceMin: "",
    costPriceMax: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(100);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [mobileFilters, setMobileFilters] = useState({
    category: "all",
    inStock: "all",
    type: "all",
    branch: "all",
  });
  const [mobilePriceRanges, setMobilePriceRanges] = useState({
    sellPriceMin: "",
    sellPriceMax: "",
    costPriceMin: "",
    costPriceMax: "",
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title?: string;
    message: string;
    isSuccess?: boolean;
  }>({
    open: false,
    message: "",
  });

  // Use custom hook for data fetching
  const { products, categories, branches, loading, setProducts, refetchData } =
    useProductsData({
      filters,
      priceRanges,
    });

  const handleProductDialogSuccess = (product: Product, isEdit: boolean) => {
    if (isEdit) {
      setProducts(products.map((p) => (p.id === product.id ? product : p)));
    } else {
      setProducts([...products, product]);
    }
  };

  const handleDeleteProduct = useCallback(async () => {
    if (!productToDelete) return;
    try {
      const response = await fetch(`/api/products/${productToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setProducts(products.filter((p) => p.id !== productToDelete.id));
        setIsDeleteConfirmationOpen(false);
        setProductToDelete(null);
      } else {
        console.error("Failed to delete product");
      }
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  }, [productToDelete, products, setProducts]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Category filter
      if (filters.category !== "all" && product.category !== filters.category) {
        return false;
      }
      // Branch filter
      if (filters.branch !== "all" && product.branch !== filters.branch) {
        return false;
      }
      // Stock filter
      if (
        filters.inStock !== "all" &&
        filters.inStock === "in-stock" &&
        (product.quantity === 0 ||
          (product.in_stock === 0 && !product.quantity))
      ) {
        return false;
      }
      // Sell price range filter
      if (
        priceRanges.sellPriceMin &&
        product.sell_price !== undefined &&
        product.sell_price < Number(priceRanges.sellPriceMin)
      ) {
        return false;
      }
      if (
        priceRanges.sellPriceMax &&
        product.sell_price !== undefined &&
        product.sell_price > Number(priceRanges.sellPriceMax)
      ) {
        return false;
      }
      // Cost price range filter
      if (
        priceRanges.costPriceMin &&
        product.cost_price !== undefined &&
        product.cost_price < Number(priceRanges.costPriceMin)
      ) {
        return false;
      }
      if (
        priceRanges.costPriceMax &&
        product.cost_price !== undefined &&
        product.cost_price > Number(priceRanges.costPriceMax)
      ) {
        return false;
      }

      // Search filter
      return product.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [products, filters, priceRanges, searchTerm]);

  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(
    indexOfFirstProduct,
    indexOfLastProduct,
  );

  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (
    type: "category" | "type" | "branch",
    value: string,
  ) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      [type]: value,
    }));
    setCurrentPage(1);
  };

  const handlePriceRangeChange = (field: string, value: string) => {
    setPriceRanges((prev) => ({
      ...prev,
      [field]: value,
    }));
    setCurrentPage(1);
  };

  const handleMobileFilterChange = (
    type: "category" | "type" | "branch",
    value: string,
  ) => {
    setMobileFilters((prevFilters) => ({
      ...prevFilters,
      [type]: value,
    }));
  };

  const handleMobilePriceRangeChange = (field: string, value: string) => {
    setMobilePriceRanges((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApplyMobileFilters = () => {
    setFilters(mobileFilters);
    setPriceRanges(mobilePriceRanges);
    setCurrentPage(1);
    setIsMobileFilterOpen(false);
  };

  const handleClearMobileFilters = () => {
    const clearedFilters = {
      category: "all",
      inStock: "all",
      type: "all",
      branch: "all",
    };
    const clearedPriceRanges = {
      sellPriceMin: "",
      sellPriceMax: "",
      costPriceMin: "",
      costPriceMax: "",
    };
    setMobileFilters(clearedFilters);
    setMobilePriceRanges(clearedPriceRanges);
    setFilters(clearedFilters);
    setPriceRanges(clearedPriceRanges);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    const clearedFilters = {
      category: "all",
      inStock: "all",
      type: "all",
      branch: "all",
    };
    const clearedPriceRanges = {
      sellPriceMin: "",
      sellPriceMax: "",
      costPriceMin: "",
      costPriceMax: "",
    };
    setFilters(clearedFilters);
    setPriceRanges(clearedPriceRanges);
    setCurrentPage(1);
  };

  const handleDownloadExcel = useCallback(async () => {
    try {
      setIsDownloading(true);
      // Fetch all products (without filters for export)
      const response = await fetch("/api/products?type=all");
      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }
      const allProducts = await response.json();

      // Generate filename
      const filename = `products.xlsx`;

      // Export to Excel
      exportProductsToExcel(allProducts, filename);
    } catch (error) {
      console.error("Error downloading Excel:", error);
      setErrorDialog({
        open: true,
        title: t("downloadError"),
        message: t("downloadError"),
      });
    } finally {
      setIsDownloading(false);
    }
  }, [t]);

  const handleDownloadTemplate = useCallback(() => {
    exportProductsTemplate("products-template.xlsx");
  }, []);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (
        !file.name.endsWith(".xlsx") &&
        !file.name.endsWith(".xls") &&
        !file.type.includes("spreadsheet")
      ) {
        setErrorDialog({
          open: true,
          title: t("importValidationError"),
          message: t("importValidationError"),
        });
        return;
      }

      try {
        setIsImporting(true);
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/products/import", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t("importError"));
        }

        const result = await response.json();
        const message = `${t("importSuccess")}: ${
          result.successCount
        } product(s) imported.${
          result.errorCount > 0
            ? `\n\n${result.errorCount} error(s) occurred.`
            : ""
        }${
          result.errors && result.errors.length > 0
            ? `\n\nFirst few errors:\n${result.errors.slice(0, 3).join("\n")}`
            : ""
        }`;

        setErrorDialog({
          open: true,
          title: t("importSuccess"),
          message: message,
          isSuccess: result.errorCount === 0,
        });

        // Refresh products
        await refetchData();

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        console.error("Error importing Excel:", error);
        setErrorDialog({
          open: true,
          title: t("importError"),
          message: error instanceof Error ? error.message : t("importError"),
        });
      } finally {
        setIsImporting(false);
      }
    },
    [t, refetchData],
  );

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2Icon className="mx-auto h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="hidden sm:flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t("title")}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {t("pageDescription")}
          </p>
        </div>
      </div>
      <Card className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
        <CardHeader className="p-0">
          <div className="flex flex-col gap-3">
            {/* Mobile: Search + Add Button in Grid */}
            <div className="grid grid-cols-3 gap-2 md:hidden">
              <div className="col-span-2 relative">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full h-9 text-sm px-3 pr-8 border rounded-md"
                />
                <SearchIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
              <Button
                size="sm"
                onClick={() => setIsProductDialogOpen(true)}
                className="h-9 text-xs px-2"
              >
                <PlusIcon className="w-3 h-3 mr-1" />
                Add
              </Button>
            </div>

            {/* Mobile: Excel buttons */}
            <div className="flex justify-end md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-10 p-0 min-h-[44px]"
                    disabled={isDownloading || isImporting}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDownloadExcel}
                    disabled={isDownloading || isImporting}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    {isDownloading ? t("downloading") : t("downloadExcel")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDownloadTemplate}
                    disabled={isDownloading || isImporting}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    {t("downloadTemplate")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleImportClick}
                    disabled={isDownloading || isImporting}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {isImporting ? t("importing") : t("import")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileSelect}
                style={{ display: "none" }}
              />
            </div>

            {/* Desktop: Filters with Add Button */}
            <div className="hidden md:flex items-center gap-2">
              <ProductFilters
                searchTerm={searchTerm}
                filters={filters}
                priceRanges={priceRanges}
                categories={categories}
                branches={branches}
                onSearchChange={handleSearch}
                onFilterChange={handleFilterChange}
                onPriceRangeChange={handlePriceRangeChange}
                onClearAll={clearAllFilters}
                capitalizeFirstLetter={capitalizeFirstLetter}
              />
              <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                      disabled={isDownloading || isImporting}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDownloadExcel}
                      disabled={isDownloading || isImporting}
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      {isDownloading ? t("downloading") : t("downloadExcel")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDownloadTemplate}
                      disabled={isDownloading || isImporting}
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      {t("downloadTemplate")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleImportClick}
                      disabled={isDownloading || isImporting}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {isImporting ? t("importing") : t("import")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
                <Button
                  size="sm"
                  onClick={() => setIsProductDialogOpen(true)}
                  className="h-9 text-xs px-3 flex-shrink-0"
                >
                  <PlusIcon className="w-3 h-3 mr-1" />
                  {t("addProduct")}
                </Button>
              </div>
            </div>

            {/* Mobile: Filters Button */}
            <div className="flex md:hidden items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMobileFilters(filters);
                  setMobilePriceRanges(priceRanges);
                  setIsMobileFilterOpen(true);
                }}
                className="h-9 text-xs"
              >
                <FilterIcon className="w-3 h-3 mr-1" />
                Filters
              </Button>
              <div className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                Total: {filteredProducts.length.toLocaleString()}
              </div>
            </div>

            {/* Desktop Total */}
            <div className="hidden md:flex text-xs text-muted-foreground justify-end">
              Total: {filteredProducts.length.toLocaleString()}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ProductsTable
            products={currentProducts}
            onEdit={(product) => {
              setSelectedProduct(product);
              setIsProductDialogOpen(true);
            }}
            onDelete={(product) => {
              setProductToDelete(product);
              setIsDeleteConfirmationOpen(true);
            }}
            capitalizeFirstLetter={capitalizeFirstLetter}
          />
        </CardContent>
        <CardFooter></CardFooter>
      </Card>
      <ProductDialog
        open={isProductDialogOpen}
        onOpenChange={(open) => {
          setIsProductDialogOpen(open);
          if (!open) {
            setSelectedProduct(null);
          }
        }}
        selectedProduct={selectedProduct}
        onSuccess={handleProductDialogSuccess}
      />
      <Dialog
        open={isDeleteConfirmationOpen}
        onOpenChange={setIsDeleteConfirmationOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this product? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmationOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProduct}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Mobile Filter Dialog */}
      <Dialog open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription>
              Filter products by type, category, branch, and price ranges.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 2 Filters per row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Type Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 h-9 text-xs justify-start w-full"
                  >
                    <span className="text-muted-foreground">Type:</span>
                    <span>
                      {mobileFilters.type === "all"
                        ? "All"
                        : mobileFilters.type === "goods"
                          ? "Goods"
                          : "Services"}
                    </span>
                    <ChevronDownIcon className="w-3 h-3 text-muted-foreground ml-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuLabel>Type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={mobileFilters.type === "all"}
                    onCheckedChange={() =>
                      handleMobileFilterChange("type", "all")
                    }
                  >
                    All
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={mobileFilters.type === "goods"}
                    onCheckedChange={() =>
                      handleMobileFilterChange("type", "goods")
                    }
                  >
                    Goods
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={mobileFilters.type === "services"}
                    onCheckedChange={() =>
                      handleMobileFilterChange("type", "services")
                    }
                  >
                    Services
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Category Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 h-9 text-xs justify-start w-full"
                  >
                    <span className="text-muted-foreground">Category:</span>
                    <span className="truncate">
                      {mobileFilters.category === "all"
                        ? "All"
                        : mobileFilters.category}
                    </span>
                    <ChevronDownIcon className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-40 max-h-64 overflow-y-auto"
                >
                  <DropdownMenuLabel>Category</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={mobileFilters.category === "all"}
                    onCheckedChange={() =>
                      handleMobileFilterChange("category", "all")
                    }
                  >
                    All
                  </DropdownMenuCheckboxItem>
                  {categories.map((cat) => (
                    <DropdownMenuCheckboxItem
                      key={cat}
                      checked={mobileFilters.category === cat}
                      onCheckedChange={() =>
                        handleMobileFilterChange("category", cat)
                      }
                    >
                      {capitalizeFirstLetter(cat)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Branch Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 h-9 text-xs justify-start w-full"
                  >
                    <span className="text-muted-foreground">Branch:</span>
                    <span className="truncate">
                      {mobileFilters.branch === "all"
                        ? "All"
                        : mobileFilters.branch}
                    </span>
                    <ChevronDownIcon className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-40 max-h-64 overflow-y-auto"
                >
                  <DropdownMenuLabel>Branch</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={mobileFilters.branch === "all"}
                    onCheckedChange={() =>
                      handleMobileFilterChange("branch", "all")
                    }
                  >
                    All
                  </DropdownMenuCheckboxItem>
                  {branches.map((branch) => (
                    <DropdownMenuCheckboxItem
                      key={branch}
                      checked={mobileFilters.branch === branch}
                      onCheckedChange={() =>
                        handleMobileFilterChange("branch", branch)
                      }
                    >
                      {capitalizeFirstLetter(branch)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Price Range Filters */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 h-9 text-xs justify-start w-full"
                  >
                    <FilterIcon className="w-3 h-3" />
                    <span>Price Ranges</span>
                    <ChevronDownIcon className="w-3 h-3 text-muted-foreground ml-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-semibold mb-2 block">
                        Sell Price Range
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={mobilePriceRanges.sellPriceMin}
                          onChange={(e) =>
                            handleMobilePriceRangeChange(
                              "sellPriceMin",
                              e.target.value,
                            )
                          }
                          className="h-8 text-xs"
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={mobilePriceRanges.sellPriceMax}
                          onChange={(e) =>
                            handleMobilePriceRangeChange(
                              "sellPriceMax",
                              e.target.value,
                            )
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold mb-2 block">
                        Cost Price Range
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={mobilePriceRanges.costPriceMin}
                          onChange={(e) =>
                            handleMobilePriceRangeChange(
                              "costPriceMin",
                              e.target.value,
                            )
                          }
                          className="h-8 text-xs"
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={mobilePriceRanges.costPriceMax}
                          onChange={(e) =>
                            handleMobilePriceRangeChange(
                              "costPriceMax",
                              e.target.value,
                            )
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {(mobileFilters.type !== "all" ||
              mobileFilters.category !== "all" ||
              mobileFilters.branch !== "all" ||
              mobilePriceRanges.sellPriceMin !== "" ||
              mobilePriceRanges.sellPriceMax !== "" ||
              mobilePriceRanges.costPriceMin !== "" ||
              mobilePriceRanges.costPriceMax !== "") && (
              <Button
                variant="outline"
                onClick={() => {
                  setMobileFilters({
                    category: "all",
                    inStock: "all",
                    type: "all",
                    branch: "all",
                  });
                  setMobilePriceRanges({
                    sellPriceMin: "",
                    sellPriceMax: "",
                    costPriceMin: "",
                    costPriceMax: "",
                  });
                }}
              >
                Reset Filters
              </Button>
            )}
            <Button onClick={handleApplyMobileFilters}>Apply Filters</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
        title={errorDialog.title}
        message={errorDialog.message}
        isSuccess={errorDialog.isSuccess}
      />
    </>
  );
}
