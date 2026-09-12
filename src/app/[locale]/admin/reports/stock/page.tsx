"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  FileDown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Printer,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { exportStockReportToExcel } from "@/lib/excel";
import { useCategories, useBranches } from "@/components/products/use-products-data";
import { formatCurrency } from "@/lib/utils";
import { StockProduct, StockSummary } from "@/types/reports";
import {
  ReportPdfHeader,
  ReportPdfKpi,
  ReportPdfMetaItem,
} from "@/components/reports/report-pdf-header";
import { ReportPdfModal } from "@/components/reports/report-pdf-modal";

export default function StockReportPage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const { can } = usePermissions();
  const tCommon = useTranslations("common");
  const tStock = useTranslations("stockReportPage");

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // States for API data
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [pdfProducts, setPdfProducts] = useState<StockProduct[]>([]);
  const [summary, setSummary] = useState<any>({
    totalProducts: 0,
    totalStock: 0,
    totalCostValue: 0,
    totalSellValue: 0,
    totalProfitPotential: 0,
    totalDamagedQuantity: 0,
    totalDamagedValue: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // States for dynamic Categories & Branches loaded from active products in stock
  const { categories: categoryOptions } = useCategories();
  const { branches: availableBranches } = useBranches();

  // Branding for PDF Export
  const [branding, setBranding] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    logo: null as string | null,
  });

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Load Company Branding
  useEffect(() => {
    const loadBranding = async () => {
      try {
        const res = await fetch(`/${locale}/api/configuration/assets`);
        if (res.ok) {
          const data = await res.json();
          setBranding({
            name: data.companyName || "",
            address: data.companyAddress || "",
            phone: data.companyPhone || "",
            email: data.companyEmail || "",
            logo: data.companyLogo || null,
          });
        }
      } catch (err) {
        console.error("Failed to load branding", err);
      }
    };
    loadBranding();
  }, [locale]);

  // Fetch report handler
  const fetchStockReport = useCallback(async (isExportMode = false) => {
    if (!isExportMode) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
    }

    const signal = !isExportMode ? abortControllerRef.current?.signal : undefined;

    try {
      if (!isExportMode) setLoading(true);

      const url = new URL("/api/reports/stock", window.location.origin);
      url.searchParams.set("page", String(isExportMode ? 1 : currentPage));
      url.searchParams.set("limit", String(isExportMode ? -1 : pageSize));

      if (debouncedSearchTerm) {
        url.searchParams.set("search", debouncedSearchTerm);
      }
      if (categoryFilter && categoryFilter !== "all") {
        url.searchParams.set("category", categoryFilter);
      }
      if (branchFilter && branchFilter !== "all") {
        url.searchParams.set("branch", branchFilter);
      }

      const res = await fetch(url.toString(), { signal });
      if (!res.ok) throw new Error("Failed to fetch stock report");

      const data = await res.json();

      if (isExportMode) {
        return data.products;
      } else {
        setProducts(data.products || []);
        setSummary(data.summary || {});
        setTotalCount(data.pagination?.totalCount || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Error loading stock report:", err);
      }
    } finally {
      if (!isExportMode && !signal?.aborted) setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearchTerm, categoryFilter, branchFilter]);

  // Fetch whenever page or search/filter terms change
  useEffect(() => {
    fetchStockReport();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchStockReport]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, categoryFilter, branchFilter, pageSize]);

  // Excel Export Handler
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const allFilteredProducts = await fetchStockReport(true);
      if (allFilteredProducts && allFilteredProducts.length > 0) {
        const filename = `stock-report-${new Date().toISOString().split("T")[0]}.xlsx`;
        exportStockReportToExcel(allFilteredProducts, filename);
      }
    } catch (err) {
      console.error("Export to Excel failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // PDF Export Handler
  const handleExportPdf = useCallback(async () => {
    setIsExportingPdf(true);

    try {
      const allFilteredProducts = await fetchStockReport(true);
      const itemsToExport = allFilteredProducts && allFilteredProducts.length > 0 ? allFilteredProducts : products;
      setPdfProducts(itemsToExport);

      await new Promise((resolve) => setTimeout(resolve, 300));

      if (!reportRef.current) return;

      const mod = await import("html2pdf.js");
      const html2pdf = (mod as any).default || mod;

      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: `stock-report-${new Date().toISOString().split("T")[0]}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait",
          },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        })
        .from(reportRef.current)
        .toPdf()
        .get("pdf")
        .then((pdf: any) => {
          const totalPages = pdf.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184);
            pdf.text(
              tCommon("pdfWatermarkText") || "Generated by DukaanKhata",
              210 / 2,
              297 - 4,
              { align: "center" }
            );
          }
        })
        .save();
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      setIsExportingPdf(false);
    }
  }, [fetchStockReport, products, tCommon]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setBranchFilter("all");
    setCurrentPage(1);
    setLoading(true);
  };

  const summaryCards = useMemo(() => [
    {
      title: tStock("totalStockItems"),
      value: summary.totalStock || 0,
      subValue: `${summary.totalProducts || 0} ${tStock("products")}`,
      icon: Package,
      iconClass: "text-emerald-500",
    },
    {
      title: tStock("costValuation"),
      value: formatCurrency(summary.totalCostValue),
      subValue: tStock("totalCostValuation"),
      icon: TrendingDown,
      iconClass: "text-blue-500",
    },
    {
      title: tStock("retailValuation"),
      value: formatCurrency(summary.totalSellValue),
      subValue: tStock("totalRetailValuation"),
      icon: TrendingUp,
      iconClass: "text-amber-500",
    },
    {
      title: tStock("profitPotential"),
      value: formatCurrency(summary.totalProfitPotential),
      subValue: tStock("profit"),
      icon: TrendingUp,
      iconClass: "text-violet-500",
    }
  ], [summary, tStock]);

  const pdfKpis: ReportPdfKpi[] = useMemo(() => [
    { label: tStock("totalStockItems") || "Total Units", value: summary.totalStock || 0 },
    { label: tStock("costValuation") || "Cost Valuation", value: formatCurrency(summary.totalCostValue) },
    { label: tStock("retailValuation") || "Retail Valuation", value: formatCurrency(summary.totalSellValue), highlight: true },
    { label: tStock("profitPotential") || "Potential Profit", value: formatCurrency(summary.totalProfitPotential), highlight: true },
  ], [summary, tStock]);

  const pdfMetaItems: ReportPdfMetaItem[] = useMemo(() => [
    { label: "Category", value: categoryFilter === "all" ? "All Categories" : categoryFilter },
    { label: "Branch", value: branchFilter === "all" ? "All Branches" : branchFilter },
    { label: "Total Products", value: String(summary.totalProducts || 0) },
    { label: "Generated", value: new Date().toLocaleDateString("en-GB") },
  ], [categoryFilter, branchFilter, summary.totalProducts]);

  // DataTable Columns Definition
  const columns: ColumnDef<StockProduct>[] = useMemo(
    () => [
      {
        id: "name",
        header: tStock("productName"),
        className: "min-w-[200px] font-bold text-foreground text-xs sm:text-sm",
        cell: (product) => (
          <div>
            <div className="font-semibold text-foreground text-xs sm:text-sm">{product.name}</div>
            {product.sku && <div className="text-[10px] text-muted-foreground">SKU: {product.sku}</div>}
          </div>
        ),
      },
      {
        id: "category",
        header: tStock("category"),
        className: "w-[120px] text-xs text-muted-foreground",
        cell: (product) => product.category || "-",
      },
      {
        id: "branch",
        header: tStock("branch"),
        className: "w-[120px] text-xs text-muted-foreground",
        cell: (product) => product.branch || "-",
      },
      {
        id: "quantity",
        header: tStock("quantity"),
        className: "w-[100px] text-center",
        cell: (product) => {
          const qty = product.quantity || 0;
          const isOut = qty <= 0;
          const isLow = qty > 0 && qty <= 5;
          return (
            <div className="flex items-center justify-center gap-1.5">
              <span className={`font-semibold text-xs ${isOut ? "text-rose-500" : isLow ? "text-amber-500" : "text-foreground"}`}>
                {qty} {product.unit_of_measurement || ""}
              </span>
              {isOut && (
                <span className="text-[9px] font-semibold bg-rose-500/10 text-rose-500 px-1 py-0.5 rounded uppercase">
                  {tStock("outOfStock")}
                </span>
              )}
              {isLow && (
                <span className="text-[9px] font-semibold bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded uppercase">
                  {tStock("lowStock")}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "costPrice",
        header: tStock("costPrice"),
        className: "w-[110px] text-right text-xs",
        cell: (product) => formatCurrency(product.cost_price || 0),
      },
      {
        id: "sellPrice",
        header: tStock("sellPrice"),
        className: "w-[110px] text-right text-xs",
        cell: (product) => formatCurrency(product.sell_price || 0),
      },
      {
        id: "totalCostValuation",
        header: tStock("totalCostValuation"),
        className: "w-[120px] text-right font-bold text-muted-foreground text-xs",
        cell: (product) => formatCurrency((product.quantity || 0) * (product.cost_price || 0)),
      },
      {
        id: "totalRetailValuation",
        header: tStock("totalRetailValuation"),
        className: "w-[130px] text-right font-bold text-sky-600 dark:text-sky-400 text-xs",
        cell: (product) => formatCurrency((product.quantity || 0) * (product.sell_price || 0)),
      },
      {
        id: "damagedQuantity",
        header: tStock("damagedQuantity"),
        className: "w-[100px] text-center text-xs",
        cell: (product) =>
          product.damaged_quantity && product.damaged_quantity > 0 ? (
            <div className="flex items-center justify-center gap-1 text-rose-500 font-semibold text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{product.damaged_quantity}</span>
            </div>
          ) : (
            <span className="text-muted-foreground/30">-</span>
          ),
      },
    ],
    [tStock]
  );

  return (
    <div className="p-1 sm:p-1 w-full space-y-3">
      {/* Top Header Controls with PageHeader */}
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="h-7 w-7 rounded-full">
              <Link href={`/${locale}/admin/reports`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <span className="text-xl font-bold">{tStock("title")}</span>
          </div>
        }
        description={tStock("description")}
        className="mb-1"
        actions={
          <div className="flex items-center gap-1.5 flex-wrap">
            {can("reports", "export_stock") && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={isExporting || products.length === 0}
                  className="h-8 text-xs gap-1.5"
                >
                  {isExporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                  <span>{tStock("exportExcel")}</span>
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf || products.length === 0}
                  className="h-8 text-xs gap-1.5 bg-sky-500 hover:bg-sky-600 text-white"
                >
                  {isExportingPdf ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Printer className="h-3.5 w-3.5" />
                  )}
                  <span>{tStock("downloadPdf")}</span>
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Summary Cards with StatCard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {summaryCards.map((card, idx) => (
          <StatCard
            key={idx}
            title={card.title}
            value={card.value}
            subValue={card.subValue}
            icon={<card.icon className={`h-4 w-4 ${card.iconClass}`} />}
            isLoading={loading}
          />
        ))}
      </div>

      {/* Interactive Products DataTable */}
      <DataTable
        columns={columns}
        data={products}
        isLoading={loading}
        pageSize={pageSize}
        currentPage={currentPage}
        totalCount={totalCount}
        onPageChange={(p) => {
          setCurrentPage(p);
          setLoading(true);
        }}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setLoading(true);
        }}
        searchTerm={searchTerm}
        onSearchChange={(term) => setSearchTerm(term)}
        searchPlaceholder={tStock("searchPlaceholder") || "Search products..."}
        keyExtractor={(item, idx) => String(item.id || item._id || idx)}
        toolbarActions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={categoryFilter}
              onValueChange={(val) => {
                setCategoryFilter(val);
                setLoading(true);
              }}
            >
              <SelectTrigger className="h-9 text-xs w-[140px]">
                <SelectValue placeholder={tStock("category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tStock("allCategories") || "All Categories"}</SelectItem>
                {categoryOptions.map((cat, idx) => (
                  <SelectItem key={idx} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={branchFilter}
              onValueChange={(val) => {
                setBranchFilter(val);
                setLoading(true);
              }}
            >
              <SelectTrigger className="h-9 text-xs w-[140px]">
                <SelectValue placeholder={tStock("branch")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tStock("allBranches") || "All Branches"}</SelectItem>
                {availableBranches.map((br, idx) => (
                  <SelectItem key={idx} value={br}>{br}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchTerm || categoryFilter !== "all" || branchFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-9 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50"
              >
                {tCommon("clearFilters") || "Clear"}
              </Button>
            )}
          </div>
        }
        renderMobileCard={(product) => {
          const qty = product.quantity || 0;
          const cost = product.cost_price || 0;
          const sell = product.sell_price || 0;
          const isOut = qty <= 0;
          const isLow = qty > 0 && qty <= 5;
          return (
            <div className="bg-card border rounded-lg p-3.5 shadow-sm space-y-2.5">
              <div className="flex justify-between items-start gap-2 border-b border-zinc-100 dark:border-zinc-800/60 pb-2">
                <div>
                  <h3 className="font-semibold text-sm text-foreground truncate max-w-[200px]">
                    {product.name}
                  </h3>
                  {product.sku && <p className="text-[10px] text-muted-foreground">SKU: {product.sku}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-bold ${isOut ? "text-rose-500" : isLow ? "text-amber-500" : "text-foreground"}`}>
                    {qty} {product.unit_of_measurement || ""}
                  </span>
                  {isOut && <span className="text-[9px] bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded font-semibold">OUT</span>}
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Category: <span className="text-foreground">{product.category || "-"}</span></span>
                  <span>Branch: <span className="text-foreground">{product.branch || "-"}</span></span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Cost: <span className="text-foreground font-medium">{formatCurrency(cost)}</span></span>
                  <span>Sell: <span className="text-foreground font-medium">{formatCurrency(sell)}</span></span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-zinc-100 dark:border-zinc-800/40">
                  <span className="text-muted-foreground font-medium">Total Retail:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">{formatCurrency(qty * sell)}</span>
                </div>
              </div>
            </div>
          );
        }}
      />

      {/* PDF Preview & Auto-Download Dialog Modal */}
      <ReportPdfModal
        isOpen={isExportingPdf}
        onOpenChange={setIsExportingPdf}
        title="PDF Report Preview"
        description="Preparing & downloading your A4 stock report PDF..."
        reportRef={reportRef}
        width="700px"
        isPortrait={true}
      >
        <ReportPdfHeader
          branding={branding}
          title={tStock("title") || "STOCK REPORT"}
          subtitle={tStock("description")}
          fromDate="All Records"
          toDate={new Date().toISOString().split("T")[0]}
          metaItems={pdfMetaItems}
          kpis={pdfKpis}
        />

        <Card className="border-none shadow-none bg-white overflow-hidden">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-[#0f172a] border-b border-[#0f172a]">
                <TableHead className="py-2.5 text-xs font-bold uppercase text-white">{tStock("productName") || "Product"}</TableHead>
                <TableHead className="py-2.5 text-xs font-bold uppercase text-white">{tStock("category") || "Category"}</TableHead>
                <TableHead className="py-2.5 text-xs font-bold uppercase text-white">{tStock("branch") || "Branch"}</TableHead>
                <TableHead className="py-2.5 text-center text-xs font-bold uppercase text-white">{tStock("quantity") || "Qty"}</TableHead>
                <TableHead className="py-2.5 text-right text-xs font-bold uppercase text-white">{tStock("costPrice") || "Cost"}</TableHead>
                <TableHead className="py-2.5 text-right text-xs font-bold uppercase text-white">{tStock("sellPrice") || "Sell"}</TableHead>
                <TableHead className="py-2.5 text-right text-xs font-bold uppercase text-white">{tStock("totalRetailValuation") || "Total Retail"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pdfProducts.length > 0 ? pdfProducts : products).map((p, idx) => {
                const qty = p.quantity || 0;
                const cost = p.cost_price || 0;
                const sell = p.sell_price || 0;
                const isOut = qty <= 0;
                return (
                  <TableRow
                    key={p.id || idx}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"} border-b border-gray-100`}
                  >
                    <TableCell className="py-2 text-xs font-bold text-gray-900">{p.name}</TableCell>
                    <TableCell className="py-2 text-xs text-gray-700">{p.category || "-"}</TableCell>
                    <TableCell className="py-2 text-xs text-gray-700">{p.branch || "-"}</TableCell>
                    <TableCell className={`py-2 text-center text-xs font-bold ${isOut ? "text-rose-600" : "text-gray-900"}`}>
                      {qty} {p.unit_of_measurement || ""}
                    </TableCell>
                    <TableCell className="py-2 text-right text-xs text-gray-700">{formatCurrency(cost)}</TableCell>
                    <TableCell className="py-2 text-right text-xs text-gray-700">{formatCurrency(sell)}</TableCell>
                    <TableCell className="py-2 text-right text-xs font-bold text-gray-900">{formatCurrency(qty * sell)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </ReportPdfModal>
    </div>
  );
}
