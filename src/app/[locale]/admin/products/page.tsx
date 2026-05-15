"use client";

import { useTranslations } from "next-intl";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
import { exportProductsToExcel, exportProductsTemplate } from "@/lib/excel";
import { createSampleProductsExcel } from "@/lib/excel/sample-products";
import { useDebounce } from "../../../../hooks/use-debounce";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  useProductsData,
  useCategories,
  useBranches,
} from "@/components/products/use-products-data";
import { FilterIcon, ChevronDownIcon } from "lucide-react";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { ImportPreviewModal } from "@/components/dialogs/import-preview-modal";
import * as XLSX from "xlsx";

const capitalizeFirstLetter = (str: string | undefined | null): string => {
  if (!str) return "-";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export default function Products() {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
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
  const [pageSize, setPageSize] = useState(10);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
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
  const [isDeleting, setIsDeleting] = useState(false);
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
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<Record<string, any>[]>([]);
  const [importColumns, setImportColumns] = useState<string[]>([]);

  // Use custom hooks for data fetching
  const { products, loading: isInitialLoading, totalCount, totalPages, setProducts, refetchData } =
    useProductsData({
      filters,
      priceRanges,
      page: currentPage,
      limit: pageSize,
      search: debouncedSearchTerm,
    });

  const { categories } = useCategories();
  const { branches } = useBranches();

  // Handle loading state
  const loading = isInitialLoading || isPageLoading;

  // Reset to first page when search or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize]);

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
      setIsDeleting(true);
      const response = await fetch(`/api/products/${productToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Optimistic update
        setProducts(products.filter((p) => p.id !== productToDelete.id));
        
        // Refresh all data from server to update pagination and totals
        await refetchData();
        
        setIsDeleteConfirmationOpen(false);
        setProductToDelete(null);
      } else {
        console.error("Failed to delete product");
      }
    } catch (error) {
      console.error("Error deleting product:", error);
    } finally {
      setIsDeleting(false);
    }
  }, [productToDelete, products, setProducts, refetchData]);

  const currentProducts = products;

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (
    type: "category" | "type" | "branch",
    value: string
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
    value: string
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
      
      // Fetch all products for export
      const url = new URL("/api/products", window.location.origin);
      url.searchParams.append("limit", "-1");
      
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Failed to fetch products for export");
      
      const data = await response.json();
      const allProducts = data.products;

      if (!allProducts || allProducts.length === 0) {
        throw new Error("No products to export");
      }

      // Generate filename
      const filename = `products-${new Date().toISOString().split('T')[0]}.xlsx`;

      // Export to Excel
      exportProductsToExcel(allProducts, filename);
    } catch (error) {
      console.error("Error downloading Excel:", error);
      setErrorDialog({
        open: true,
        title: t("downloadError"),
        message: error instanceof Error ? error.message : t("downloadError"),
      });
    } finally {
      setIsDownloading(false);
    }
  }, [t]);

  const handleDownloadTemplate = useCallback(() => {
    exportProductsTemplate("products-template.xlsx");
  }, []);

  const handleDownloadSampleFile = useCallback(() => {
    createSampleProductsExcel();
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
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        if (data.length === 0) {
          throw new Error("No data found in Excel file");
        }

        // Get all columns from first row
        const columns = Object.keys(data[0] as Record<string, any>);
        setImportColumns(columns);
        setImportPreviewData(data as Record<string, any>[]);
        setIsImportPreviewOpen(true);
      } catch (error) {
        console.error("Error reading Excel:", error);
        setErrorDialog({
          open: true,
          title: t("importError"),
          message: error instanceof Error ? error.message : t("importError"),
        });
      } finally {
        setIsImporting(false);
      }
    },
    [t]
  );

  const handleConfirmImport = useCallback(
    async (editedData: Record<string, any>[]) => {
      try {
        const response = await fetch("/api/products/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: editedData }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t("importError"));
        }

        const result = await response.json();
        const message = `${t("importSuccess")}: ${t("importedCount", {
          count: result.successCount,
        })}${
          result.errorCount > 0
            ? `\n\n${t("errorCountOccurred", { count: result.errorCount })}`
            : ""
        }${
          result.errors && result.errors.length > 0
            ? `\n\n${t("firstFewErrors")}\n${result.errors
                .slice(0, 3)
                .join("\n")}`
            : ""
        }`;

        setErrorDialog({
          open: true,
          title: t("importSuccess"),
          message: message,
          isSuccess: result.errorCount === 0,
        });

        // Close preview modal
        setIsImportPreviewOpen(false);
        setImportPreviewData([]);
        setImportColumns([]);

        // Refresh products
        await refetchData();

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error) {
        console.error("Error importing products:", error);
        setErrorDialog({
          open: true,
          title: t("importError"),
          message: error instanceof Error ? error.message : t("importError"),
        });
        throw error;
      }
    },
    [t, refetchData]
  );

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);


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
            {/* Mobile: Search + Add Button + Actions in Row */}
            <div className="flex gap-2 md:hidden items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={t("searchProducts")}
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full h-9 text-sm px-3 pr-8 border rounded-md"
                />
                <SearchIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
              <Button
                size="sm"
                onClick={() => setIsProductDialogOpen(true)}
                className="h-9 text-xs px-2 flex-shrink-0"
              >
                <PlusIcon className="w-3 h-3 mr-1" />
                {t("addProduct")}
              </Button>
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
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t("actions")}</DropdownMenuLabel>
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
                  {/* <DropdownMenuItem
                    onClick={handleDownloadSampleFile}
                    disabled={isDownloading || isImporting}
                  >
                    <FileDown className="mr-2 h-4 w-4" />
                    {t("downloadSampleFile") || "Download Sample Data"}
                  </DropdownMenuItem> */}
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
                    <DropdownMenuLabel>{t("actions")}</DropdownMenuLabel>
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
                    {/* <DropdownMenuItem
                      onClick={handleDownloadSampleFile}
                      disabled={isDownloading || isImporting}
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      {t("downloadSampleFile") || "Download Sample Data"}
                    </DropdownMenuItem> */}
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
                {t("filters")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 relative">
          <ProductsTable
            products={currentProducts}
            isLoading={loading}
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
        <CardFooter className="flex flex-col md:flex-row justify-between items-center px-6 py-4 border-t gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 w-full md:w-auto">
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {tCommon("totalCountLabel", { count: totalCount })}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {tCommon("rowsPerPage")}
              </span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => setPageSize(parseInt(value))}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize.toString()} />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            isLoading={loading}
          />
        </CardFooter>
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
            <DialogTitle>{t("confirmDeletion")}</DialogTitle>
            <DialogDescription>
              {t("confirmDeleteProductMessage")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmationOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProduct}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Mobile Filter Dialog */}
      <Dialog open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("filters")}</DialogTitle>
            <DialogDescription>
              {t("filterProductsDescription")}
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
                    <span className="text-muted-foreground">{t("type")}:</span>
                    <span>
                      {mobileFilters.type === "all"
                        ? t("all")
                        : mobileFilters.type === "goods"
                        ? t("goods")
                        : t("services")}
                    </span>
                    <ChevronDownIcon className="w-3 h-3 text-muted-foreground ml-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuLabel>{t("type")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={mobileFilters.type === "all"}
                    onCheckedChange={() =>
                      handleMobileFilterChange("type", "all")
                    }
                  >
                    {t("all")}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={mobileFilters.type === "goods"}
                    onCheckedChange={() =>
                      handleMobileFilterChange("type", "goods")
                    }
                  >
                    {t("goods")}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={mobileFilters.type === "services"}
                    onCheckedChange={() =>
                      handleMobileFilterChange("type", "services")
                    }
                  >
                    {t("services")}
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
                    <span className="text-muted-foreground">
                      {t("category")}:
                    </span>
                    <span className="truncate">
                      {mobileFilters.category === "all"
                        ? t("all")
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
                    <span className="text-muted-foreground">
                      {t("branch")}:
                    </span>
                    <span className="truncate">
                      {mobileFilters.branch === "all"
                        ? t("all")
                        : mobileFilters.branch}
                    </span>
                    <ChevronDownIcon className="w-3 h-3 text-muted-foreground ml-auto flex-shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-40 max-h-64 overflow-y-auto"
                >
                  <DropdownMenuLabel>{t("branch")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={mobileFilters.branch === "all"}
                    onCheckedChange={() =>
                      handleMobileFilterChange("branch", "all")
                    }
                  >
                    {t("all")}
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
                        {t("sellPriceRange")}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder={t("min")}
                          value={mobilePriceRanges.sellPriceMin}
                          onChange={(e) =>
                            handleMobilePriceRangeChange(
                              "sellPriceMin",
                              e.target.value
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
                              e.target.value
                            )
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold mb-2 block">
                        {t("costPriceRange")}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder={t("min")}
                          value={mobilePriceRanges.costPriceMin}
                          onChange={(e) =>
                            handleMobilePriceRangeChange(
                              "costPriceMin",
                              e.target.value
                            )
                          }
                          className="h-8 text-xs"
                        />
                        <Input
                          type="number"
                          placeholder={t("max")}
                          value={mobilePriceRanges.costPriceMax}
                          onChange={(e) =>
                            handleMobilePriceRangeChange(
                              "costPriceMax",
                              e.target.value
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
                {t("resetFilters")}
              </Button>
            )}
            <Button onClick={handleApplyMobileFilters}>
              {t("applyFilters")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportPreviewModal
        open={isImportPreviewOpen}
        onOpenChange={setIsImportPreviewOpen}
        data={importPreviewData}
        columns={importColumns}
        isLoading={isImporting}
        onConfirm={handleConfirmImport}
      />
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
