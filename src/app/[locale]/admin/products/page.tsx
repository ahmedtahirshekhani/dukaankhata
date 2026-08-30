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
  Loader2Icon,
  SearchIcon,
  FileDown,
  Upload,
  MoreVertical,
  PlusCircle,
  XIcon,
} from "lucide-react";
import { exportProductsToExcel, exportProductsTemplate } from "@/lib/excel";
import { db } from "@/lib/db/offline-db";
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
import { NumericInput } from "@/components/ui/numeric-input";
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
import { SyncEngine } from "@/lib/sync/sync-engine";
import { usePermissions } from "@/hooks/use-permissions";

const capitalizeFirstLetter = (str: string | undefined | null): string => {
  if (!str) return "-";
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export default function Products() {
  const t = useTranslations("products");
  const tCommon = useTranslations("common");
  const { can } = usePermissions();
  const canCreate = can("products", "create");
  const canEdit = can("products", "edit");
  const canDelete = can("products", "delete");
  const canExport = can("products", "view");
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
    // Optimistic updates are handled automatically by useLiveQuery in useProductsData
    // We just need to make sure we're on the first page to see the new item
    if (!isEdit) {
      setCurrentPage(1);
    }
  };

  const handleDeleteProduct = useCallback(async () => {
    if (!productToDelete) return;
    try {
      setIsDeleting(true);
      await db.products.delete(productToDelete.id);
      await SyncEngine.queueOperation("products", "DELETE", `/api/products/${productToDelete.id}`, {}, String(productToDelete.id));
      setIsDeleteConfirmationOpen(false);
      setProductToDelete(null);
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
      
      // Fetch all products for export from db
      const allProducts = await db.products.toArray();

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


  const activeFiltersCount = 
    (filters.category !== "all" ? 1 : 0) +
    (filters.type !== "all" ? 1 : 0) +
    (filters.branch !== "all" ? 1 : 0) +
    ((priceRanges.sellPriceMin || priceRanges.sellPriceMax) ? 1 : 0) +
    ((priceRanges.costPriceMin || priceRanges.costPriceMax) ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Header Section */}
      <div className="flex flex-col gap-1 w-full">
        {/* Row 1: Heading and Actions */}
        <div className="flex flex-row items-center justify-between w-full gap-2">
          <h1 className="text-2xl font-bold truncate">{t("title")}</h1>
          
          <div className="flex items-center gap-1.5 shrink-0">
            {(canCreate || canExport) && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 flex-shrink-0"
                      disabled={isDownloading || isImporting}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>{t("actions")}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {canExport && (
                      <DropdownMenuItem
                        onClick={handleDownloadExcel}
                        disabled={isDownloading || isImporting}
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        {isDownloading ? t("downloading") : t("downloadExcel")}
                      </DropdownMenuItem>
                    )}
                    {canExport && (
                      <DropdownMenuItem
                        onClick={handleDownloadTemplate}
                        disabled={isDownloading || isImporting}
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        {t("downloadTemplate")}
                      </DropdownMenuItem>
                    )}
                    {canCreate && (
                      <DropdownMenuItem
                        onClick={handleImportClick}
                        disabled={isDownloading || isImporting}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {isImporting ? t("importing") : t("import")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {canCreate && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                  />
                )}
              </>
            )}

            {canCreate && (
              <Button
                onClick={() => {
                  setSelectedProduct(null);
                  setIsProductDialogOpen(true);
                }}
                size="sm"
                className="h-9 text-xs px-2.5 sm:px-3 flex-shrink-0 whitespace-nowrap"
              >
                <PlusCircle className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">{t("addProduct")}</span>
                <span className="inline sm:hidden">Add</span>
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Description */}
        <p className="text-sm text-muted-foreground break-words">{t("pageDescription")}</p>
      </div>

      <Card className="flex flex-col gap-6 p-4 sm:p-6 shadow-md">
        <CardHeader className="p-0">
          <div className="flex flex-col gap-4">
            {/* Search and Filters */}
            <div className="flex flex-row items-center gap-2 w-full">
              <div className="relative flex-1 sm:w-64 sm:flex-none">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("searchProducts")}
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-9 pr-9 h-9 text-sm w-full"
                />
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      handleSearch({ target: { value: "" } } as any);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="hidden md:flex flex-wrap items-center gap-2">
                <ProductFilters
                  filters={filters}
                  priceRanges={priceRanges}
                  categories={categories}
                  branches={branches}
                  onFilterChange={handleFilterChange}
                  onPriceRangeChange={handlePriceRangeChange}
                  onClearAll={clearAllFilters}
                  capitalizeFirstLetter={capitalizeFirstLetter}
                />
              </div>
              <div className="flex md:hidden items-center shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMobileFilters(filters);
                    setMobilePriceRanges(priceRanges);
                    setIsMobileFilterOpen(true);
                  }}
                  className="h-9 text-xs whitespace-nowrap"
                >
                  <FilterIcon className="w-3 h-3 mr-1" />
                  {t("filters")}
                  {activeFiltersCount > 0 && ` (${activeFiltersCount})`}
                </Button>
              </div>
            </div>
            
            {/* Active Filters Summary (Mobile only) */}
            {activeFiltersCount > 0 && (
              <div className="flex md:hidden flex-wrap gap-1.5 w-full mt-1">
                {filters.category !== "all" && (
                  <span className="bg-secondary text-secondary-foreground text-[10px] px-2 py-1 rounded-md font-medium border">
                    {t("category")}: {capitalizeFirstLetter(filters.category)}
                  </span>
                )}
                {filters.type !== "all" && (
                  <span className="bg-secondary text-secondary-foreground text-[10px] px-2 py-1 rounded-md font-medium border">
                    {t("type")}: {capitalizeFirstLetter(filters.type)}
                  </span>
                )}
                {filters.branch !== "all" && (
                  <span className="bg-secondary text-secondary-foreground text-[10px] px-2 py-1 rounded-md font-medium border">
                    {t("branch")}: {capitalizeFirstLetter(filters.branch)}
                  </span>
                )}
                {(priceRanges.sellPriceMin || priceRanges.sellPriceMax) && (
                  <span className="bg-secondary text-secondary-foreground text-[10px] px-2 py-1 rounded-md font-medium border">
                    Sell: {priceRanges.sellPriceMin || 0} - {priceRanges.sellPriceMax || "Max"}
                  </span>
                )}
                {(priceRanges.costPriceMin || priceRanges.costPriceMax) && (
                  <span className="bg-secondary text-secondary-foreground text-[10px] px-2 py-1 rounded-md font-medium border">
                    Cost: {priceRanges.costPriceMin || 0} - {priceRanges.costPriceMax || "Max"}
                  </span>
                )}
              </div>
            )}
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
            canEdit={canEdit}
            canDelete={canDelete}
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
        <DialogContent className="max-w-[90vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("filters")}</DialogTitle>
            <DialogDescription>
              {t("filterProductsDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Category Filter */}
            <div>
              <Label className="text-xs font-semibold mb-2 block">{t("category")}</Label>
              <Select
                value={mobileFilters.category}
                onValueChange={(val) => handleMobileFilterChange("category", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("category")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {capitalizeFirstLetter(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Branch Filter */}
            <div>
              <Label className="text-xs font-semibold mb-2 block">{t("branch")}</Label>
              <Select
                value={mobileFilters.branch}
                onValueChange={(val) => handleMobileFilterChange("branch", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("branch")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("all")}</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {capitalizeFirstLetter(branch)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sell Price Range */}
            <div>
              <Label className="text-xs font-semibold mb-2 block">
                {t("sellPriceRange")}
              </Label>
              <div className="flex gap-2">
                <NumericInput
                  min="0"
                  placeholder={t("min")}
                  value={mobilePriceRanges.sellPriceMin}
                  onChange={(e) =>
                    handleMobilePriceRangeChange("sellPriceMin", e.target.value)
                  }
                  className="h-9 text-sm"
                />
                <NumericInput
                  min="0"
                  placeholder="Max"
                  value={mobilePriceRanges.sellPriceMax}
                  onChange={(e) =>
                    handleMobilePriceRangeChange("sellPriceMax", e.target.value)
                  }
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Cost Price Range */}
            <div>
              <Label className="text-xs font-semibold mb-2 block">
                {t("costPriceRange")}
              </Label>
              <div className="flex gap-2">
                <NumericInput
                  min="0"
                  placeholder={t("min")}
                  value={mobilePriceRanges.costPriceMin}
                  onChange={(e) =>
                    handleMobilePriceRangeChange("costPriceMin", e.target.value)
                  }
                  className="h-9 text-sm"
                />
                <NumericInput
                  min="0"
                  placeholder="Max"
                  value={mobilePriceRanges.costPriceMax}
                  onChange={(e) =>
                    handleMobilePriceRangeChange("costPriceMax", e.target.value)
                  }
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
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
                className="w-full sm:w-auto"
              >
                {t("resetFilters")}
              </Button>
            )}
            <Button onClick={handleApplyMobileFilters} className="w-full sm:w-auto">
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
    </div>
  );
}
