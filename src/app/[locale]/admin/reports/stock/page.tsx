"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Pagination } from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Package,
  Search,
  FileDown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Info,
  Printer,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter as FilterIcon,
  X,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { exportStockReportToExcel } from "@/lib/excel";

interface StockProduct {
  id: string;
  name: string;
  category?: string;
  branch?: string;
  quantity?: number;
  unit_of_measurement?: string;
  cost_price?: number;
  sell_price?: number;
  damaged_quantity?: number;
  [key: string]: any;
}

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
  const [availableCategories, setAvailableCategories] = useState<string[]>(["General"]);
  const [availableBranches, setAvailableBranches] = useState<string[]>(["Main"]);

  const DEFAULT_ITEM_CATEGORIES = useMemo(() => [
    "General",
    "Electronics",
    "Clothing",
    "Books",
    "Home",
    "Consulting",
    "Maintenance",
    "Delivery",
    "Installation",
  ], []);

  const categoryOptions = useMemo(() => {
    const merged = new Set([
      ...DEFAULT_ITEM_CATEGORIES,
      ...availableCategories,
    ]);
    return Array.from(merged).filter(Boolean).sort();
  }, [DEFAULT_ITEM_CATEGORIES, availableCategories]);

  // Branding for PDF Export
  const [branding, setBranding] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    logo: null as string | null,
  });

  // Slider State
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
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
      if (categoryFilter !== "all") {
        url.searchParams.set("category", categoryFilter);
      }
      if (branchFilter !== "all") {
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
        
        // Dynamically set available categories & branches from active products in stock
        if (data.categories) setAvailableCategories(data.categories);
        if (data.branches) setAvailableBranches(data.branches);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Error loading stock report data:", err);
      }
    } finally {
      if (!isExportMode && !signal?.aborted) setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearchTerm, categoryFilter, branchFilter]);

  // Fetch stock whenever page or filters change
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
      // Fetch ALL filtered stock items (limit = -1) across all pages
      const allFilteredProducts = await fetchStockReport(true);
      const itemsToExport = allFilteredProducts && allFilteredProducts.length > 0 ? allFilteredProducts : products;
      setPdfProducts(itemsToExport);

      // Allow React 350ms to mount and layout all items in the preview dialog template
      await new Promise((resolve) => setTimeout(resolve, 350));

      if (!reportRef.current) {
        setIsExportingPdf(false);
        return;
      }

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
            scrollY: 0,
            scrollX: 0,
            windowWidth: 720,
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
              tCommon("pdfWatermarkText"),
              210 / 2, // Center of Portrait A4 (210mm width)
              297 - 4, // 4mm from bottom of Portrait A4 (297mm height)
              { align: "center" }
            );
          }
        })
        .save();
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      // Auto-close preview popup once download is done
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

  // Format PKR Helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Card slider scroll listener
  const handleScroll = useCallback(() => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      setScrollPosition(scrollLeft);
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 20);
    }
  }, []);

  const scrollLeft = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -280, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: 280, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const slider = sliderRef.current;
    if (slider) {
      slider.addEventListener("scroll", handleScroll);
      handleScroll();
      return () => slider.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll, summary]);

  const summaryCards = useMemo(() => [
    {
      title: tStock("totalStockItems"),
      value: summary.totalStock || 0,
      subValue: `${summary.totalProducts || 0} ${tStock("products")}`,
      icon: Package,
      bgClass: "bg-emerald-50/50 dark:bg-emerald-950/20",
      iconClass: "text-emerald-500",
      borderClass: "hover:border-emerald-500/20"
    },
    {
      title: tStock("costValuation"),
      value: formatCurrency(summary.totalCostValue),
      currency: "PKR",
      subValue: tStock("totalCostValuation"),
      icon: TrendingDown,
      bgClass: "bg-blue-50/50 dark:bg-blue-950/20",
      iconClass: "text-blue-500",
      borderClass: "hover:border-blue-500/20"
    },
    {
      title: tStock("retailValuation"),
      value: formatCurrency(summary.totalSellValue),
      currency: "PKR",
      subValue: tStock("totalRetailValuation"),
      icon: TrendingUp,
      bgClass: "bg-amber-50/50 dark:bg-amber-950/20",
      iconClass: "text-amber-500",
      borderClass: "hover:border-amber-500/20"
    },
    {
      title: tStock("profitPotential"),
      value: formatCurrency(summary.totalProfitPotential),
      currency: "PKR",
      subValue: tStock("profit"),
      icon: TrendingUp,
      bgClass: "bg-violet-50/50 dark:bg-violet-950/20",
      iconClass: "text-violet-500",
      borderClass: "hover:border-violet-500/20"
    }
  ], [summary, tStock]);

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {tStock("title")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {tStock("description")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {can('reports', 'export_stock') && (
            <>
              {/* Export Excel (Top, White Default) */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={isExporting || products.length === 0}
                className="h-7 text-[11px] px-2 gap-1 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-none w-full justify-center"
              >
                {isExporting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <FileDown className="h-3 w-3" />
                )}
                <span>{tStock("exportExcel")}</span>
              </Button>

              {/* Download Report (PDF) (Below, Theme Sky Blue) */}
              <Button
                size="sm"
                onClick={handleExportPdf}
                disabled={isExportingPdf || products.length === 0}
                className="h-7 text-[11px] px-2 gap-1 bg-sky-500 hover:bg-sky-600 text-white shadow-none w-full justify-center"
              >
                {isExportingPdf ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Printer className="h-3 w-3" />
                )}
                <span>{tStock("downloadPdf")}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards with Slider Layout (Identical to Account Statement) */}
      <div className="relative">
        {/* Slider Left Arrow */}
        {showLeftArrow && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-zinc-900 rounded-full shadow-md p-1.5 border border-border hover:bg-accent transition-all lg:hidden"
            style={{ transform: "translateY(-50%)" }}
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
        )}

        {/* Slider Right Arrow */}
        {showRightArrow && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-zinc-900 rounded-full shadow-md p-1.5 border border-border hover:bg-accent transition-all lg:hidden"
            style={{ transform: "translateY(-50%)" }}
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        )}

        {/* Horizontal Slider Track */}
        <div
          ref={sliderRef}
          className="flex overflow-x-auto scroll-smooth gap-4 pb-2 hide-scrollbar lg:grid lg:grid-cols-4 lg:overflow-visible"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {summaryCards.map((card, index) => (
            <div 
              key={index} 
              className="flex-shrink-0 w-[280px] lg:w-auto"
            >
              <Card className={`border-border/50 shadow-sm overflow-hidden group hover:shadow-md transition-all duration-300 ${card.borderClass}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{card.title}</p>
                      <p className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-2 group-hover:scale-[1.01] transition-transform duration-300 flex items-baseline gap-1">
                        {card.currency && (
                          <span className="text-xs sm:text-sm font-normal text-muted-foreground mr-0.5">{card.currency}</span>
                        )}
                        <span>{card.value}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {card.subValue}
                      </p>
                    </div>
                    <div className={`p-3 ${card.bgClass} rounded-xl`}>
                      <card.icon className={`h-5 w-5 ${card.iconClass}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {/* Slider Indicator Dots for Mobile Viewports */}
        <div className="flex justify-center gap-1.5 mt-3 lg:hidden">
          {summaryCards.map((_, idx) => {
            const cardWidth = 280;
            const currentIndex = Math.round(scrollPosition / cardWidth);
            const isActive = currentIndex === idx;
            return (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  isActive ? "w-6 bg-[#7CD2F1]" : "w-1.5 bg-zinc-300 dark:bg-zinc-700"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Main Panel Container */}
      <Card className="flex flex-col gap-3 sm:gap-4 p-4 sm:p-6 shadow-md">
        <CardHeader className="p-0">
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={tStock("searchProducts")}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setLoading(true);
                }}
                className="pl-9 pr-9 h-9 text-xs sm:text-sm w-full bg-background"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setLoading(true);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-9 px-2.5 sm:px-3 text-xs shrink-0"
                >
                  <FilterIcon className="h-3.5 w-3.5" />
                  <span>{tCommon("filter")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    {tStock("category")}
                  </Label>
                  <Select
                    value={categoryFilter}
                    onValueChange={(value) => {
                      setCategoryFilter(value);
                      setLoading(true);
                    }}
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder={tStock("category")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tStock("all")}</SelectItem>
                      {categoryOptions.map((cat, idx) => (
                        <SelectItem key={idx} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    {tStock("branch")}
                  </Label>
                  <Select
                    value={branchFilter}
                    onValueChange={(value) => {
                      setBranchFilter(value);
                      setLoading(true);
                    }}
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder={tStock("branch")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{tStock("all")}</SelectItem>
                      {availableBranches.map((br, idx) => (
                        <SelectItem key={idx} value={br}>
                          {br}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(searchTerm || categoryFilter !== "all" || branchFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="w-full h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 mt-1"
                  >
                    {tCommon("clearFilters") || "Clear Filters"}
                  </Button>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        {/* PDF Preview & Auto-Download Dialog Modal */}
        <Dialog
          open={isExportingPdf}
          onOpenChange={(open) => {
            if (!open) setIsExportingPdf(false);
          }}
        >
          <DialogContent className="max-w-4xl w-full p-4 max-h-[90vh] flex flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-900 border border-border">
            <DialogHeader className="pb-3 border-b border-border flex flex-row items-center justify-between shrink-0">
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Printer className="h-4 w-4 text-sky-500" />
                  <span>PDF Report Preview</span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-sky-500" />
                  <span>Preparing & downloading your A4 stock report PDF...</span>
                </p>
              </div>
            </DialogHeader>

            {/* Scrollable Preview Area containing printable reportRef */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-zinc-200/50 dark:bg-zinc-950/50 rounded-lg my-2">
              <div
                ref={reportRef}
                style={{
                  width: "700px",
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  padding: "20px",
                  fontFamily: "sans-serif",
                  boxSizing: "border-box",
                  margin: "0 auto",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  borderRadius: "4px",
                }}
              >
                {/* PDF Minimal Header */}
                <div style={{ paddingBottom: "14px", marginBottom: "14px", borderBottom: "2px solid #0f172a" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <tbody>
                      <tr>
                        <td style={{ width: "55%", verticalAlign: "top" }}>
                          {branding.logo ? (
                            <Image
                              src={branding.logo}
                              alt="Company Logo"
                              width={130}
                              height={45}
                              unoptimized
                              style={{
                                height: "45px",
                                width: "auto",
                                objectFit: "contain",
                                display: "block",
                                marginBottom: "6px",
                              }}
                            />
                          ) : (
                            <div style={{ fontWeight: 900, fontSize: "18px", color: "#0f172a", textTransform: "uppercase" }}>
                              {branding.name}
                            </div>
                          )}
                          <div style={{ fontSize: "10px", color: "#475569", lineHeight: 1.4 }}>
                            {branding.address}
                          </div>
                          {(branding.phone || branding.email) && (
                            <div style={{ fontSize: "9px", color: "#64748b", marginTop: "2px" }}>
                              {branding.phone ? `Phone: ${branding.phone}` : ""}
                              {branding.phone && branding.email ? " | " : ""}
                              {branding.email ? `Email: ${branding.email}` : ""}
                            </div>
                          )}
                        </td>
                        <td style={{ width: "45%", textAlign: "right", verticalAlign: "top" }}>
                          <div style={{ fontWeight: 900, fontSize: "20px", color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            {tStock("title") || "STOCK REPORT"}
                          </div>
                          <div style={{ fontSize: "10px", color: "#475569", marginTop: "4px" }}>
                            Date: <span style={{ fontWeight: 700, color: "#0f172a" }}>{new Date().toLocaleDateString(locale)}</span>
                          </div>
                          <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
                            Total Products: <span style={{ fontWeight: 700, color: "#0284c7" }}>{summary.totalProducts || 0}</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Minimal Metadata Summary Grid */}
                <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px 14px", marginBottom: "14px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", tableLayout: "fixed" }}>
                    <tbody>
                      <tr>
                        <td style={{ width: "33%", color: "#64748b", fontWeight: 500 }}>
                          Category: <span style={{ color: "#0f172a", fontWeight: 700 }}>{categoryFilter === "all" ? tStock("all") : categoryFilter}</span>
                        </td>
                        <td style={{ width: "33%", color: "#64748b", fontWeight: 500 }}>
                          Branch: <span style={{ color: "#0f172a", fontWeight: 600 }}>{branchFilter === "all" ? tStock("all") : branchFilter}</span>
                        </td>
                        <td style={{ width: "34%", textAlign: "right", color: "#64748b", fontWeight: 500 }}>
                          Total Stock Items: <span style={{ color: "#0f172a", fontWeight: 700 }}>{summary.totalStock || 0}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Valuation Summary Bar */}
                <div style={{ marginBottom: "16px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", tableLayout: "fixed" }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", backgroundColor: "#f1f5f9" }}>
                          <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>{tStock("costValuation")}</div>
                          <div style={{ fontSize: "12px", fontWeight: "bold", color: "#0f172a", marginTop: "2px" }}>
                            Rs. {formatCurrency(summary.totalCostValue)}
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1", backgroundColor: "#f1f5f9" }}>
                          <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>{tStock("retailValuation")}</div>
                          <div style={{ fontSize: "12px", fontWeight: "bold", color: "#0284c7", marginTop: "2px" }}>
                            Rs. {formatCurrency(summary.totalSellValue)}
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "center", backgroundColor: "#f1f5f9" }}>
                          <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>{tStock("profitPotential")}</div>
                          <div style={{ fontSize: "12px", fontWeight: "bold", color: "#16a34a", marginTop: "2px" }}>
                            Rs. {formatCurrency(summary.totalProfitPotential)}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Minimal Table Form for Stock Data */}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", tableLayout: "fixed" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#0f172a", color: "#ffffff" }}>
                      <th style={{ width: "5%", padding: "7px 6px", textAlign: "left", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>#</th>
                      <th style={{ width: "27%", padding: "7px 6px", textAlign: "left", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>{tStock("productName")}</th>
                      <th style={{ width: "17%", padding: "7px 6px", textAlign: "left", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>{tStock("category")}</th>
                      <th style={{ width: "11%", padding: "7px 6px", textAlign: "center", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>{tStock("quantity")}</th>
                      <th style={{ width: "13%", padding: "7px 6px", textAlign: "right", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>{tStock("costPrice")}</th>
                      <th style={{ width: "13%", padding: "7px 6px", textAlign: "right", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>{tStock("sellPrice")}</th>
                      <th style={{ width: "14%", padding: "7px 6px", textAlign: "right", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>{tStock("totalRetailValuation")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pdfProducts.length > 0 ? pdfProducts : products).map((p, idx) => {
                      const qty = p.quantity || 0;
                      const cost = p.cost_price || 0;
                      const sell = p.sell_price || 0;
                      const isOut = qty <= 0;
                      return (
                        <tr key={p.id || idx} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "6px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{idx + 1}</td>
                          <td style={{ padding: "6px", fontWeight: "600", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</td>
                          <td style={{ padding: "6px", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.category || "-"}</td>
                          <td style={{ padding: "6px", textAlign: "center", fontWeight: "600", color: isOut ? "#ef4444" : "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {qty} {p.unit_of_measurement || ""}
                          </td>
                          <td style={{ padding: "6px", textAlign: "right", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Rs. {formatCurrency(cost)}</td>
                          <td style={{ padding: "6px", textAlign: "right", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Rs. {formatCurrency(sell)}</td>
                          <td style={{ padding: "6px", textAlign: "right", fontWeight: "700", color: "#0284c7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Rs. {formatCurrency(qty * sell)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Interactive Products Table Data / Mobile Cards */}
        <CardContent className="p-0 relative">
          {/* Mobile View: Cards Layout */}
          <div className="block md:hidden space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {tCommon("loading") || "Loading..."}
                </span>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <Info className="h-10 w-10 text-muted-foreground/50" />
                <span className="text-sm font-medium">
                  {tStock("noData")}
                </span>
              </div>
            ) : (
              products.map((product) => {
                const qty = product.quantity || 0;
                const cost = product.cost_price || 0;
                const sell = product.sell_price || 0;
                const isLow = qty > 0 && qty < 5;
                const isOut = qty <= 0;

                return (
                  <div
                    key={product.id}
                    className="bg-card border rounded-lg p-3.5 shadow-sm space-y-2.5"
                  >
                    {/* Header Row: Product Name & Stock Status Badge */}
                    <div className="flex justify-between items-start gap-2 border-b border-zinc-100 dark:border-zinc-800/60 pb-2">
                      <h3 className="font-semibold text-sm text-foreground truncate max-w-[70%]">
                        {product.name}
                      </h3>
                      <div className="shrink-0 flex items-center gap-1">
                        <span
                          className={`font-semibold text-xs ${
                            isOut
                              ? "text-rose-500"
                              : isLow
                              ? "text-amber-500"
                              : "text-foreground"
                          }`}
                        >
                          {qty} {product.unit_of_measurement || ""}
                        </span>
                        {isOut && (
                          <span className="text-[10px] font-semibold bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded uppercase">
                            {tStock("outOfStock")}
                          </span>
                        )}
                        {isLow && (
                          <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded uppercase">
                            {tStock("lowStock")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details Section */}
                    <div className="space-y-2 text-xs">
                      {/* Row 1: Category & Branch */}
                      <div className="flex justify-between items-center text-muted-foreground font-medium">
                        <span>Category: <span className="text-foreground">{product.category || "-"}</span></span>
                        <span>Branch: <span className="text-foreground">{product.branch || "-"}</span></span>
                      </div>

                      {/* Row 2: Cost & Sell Price */}
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Cost: <span className="text-foreground font-medium">Rs. {formatCurrency(cost)}</span></span>
                        <span>Sell: <span className="text-foreground font-medium">Rs. {formatCurrency(sell)}</span></span>
                      </div>

                      {/* Damaged Quantity line if any */}
                      {product.damaged_quantity && product.damaged_quantity > 0 ? (
                        <div className="flex items-center gap-1 text-rose-500 font-medium text-xs">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Damaged Qty: {product.damaged_quantity}</span>
                        </div>
                      ) : null}

                      {/* Row 3: Total Retail Valuation */}
                      <div className="flex justify-between items-center pt-2 border-t border-zinc-100 dark:border-zinc-800/40 text-xs">
                        <span className="text-muted-foreground font-medium">{tStock("totalRetailValuation")}:</span>
                        <span className="font-semibold text-sky-600 dark:text-sky-400 text-sm">
                          Rs. {formatCurrency(qty * sell)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto [.is-exporting_&]:block">
              <Table className="min-w-[800px] md:min-w-full">
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-100">
                    <TableHead className="px-6 py-4 font-bold text-xs text-gray-600 uppercase">{tStock("productName")}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-xs text-gray-600 uppercase">{tStock("category")}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-xs text-gray-600 uppercase">{tStock("branch")}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-xs text-gray-600 uppercase text-center">{tStock("quantity")}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-xs text-gray-600 uppercase text-right">{tStock("costPrice")}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-xs text-gray-600 uppercase text-right">{tStock("sellPrice")}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-xs text-gray-600 uppercase text-right">{tStock("totalCostValuation")}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-xs text-gray-600 uppercase text-right">{tStock("totalRetailValuation")}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-xs text-gray-600 uppercase text-center">{tStock("damagedQuantity")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">
                            {tCommon("loading") || "Loading..."}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-64 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Info className="h-10 w-10 text-muted-foreground/50" />
                          <span className="text-sm font-medium">
                            {tStock("noData")}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    products.map((product) => {
                      const qty = product.quantity || 0;
                      const cost = product.cost_price || 0;
                      const sell = product.sell_price || 0;
                      const isLow = qty > 0 && qty < 5;
                      const isOut = qty <= 0;

                      return (
                        <TableRow
                          key={product.id}
                          className="border-b border-gray-100 transition-colors duration-200"
                        >
                          {/* Product Name */}
                          <TableCell className="px-6 py-4 font-medium text-foreground max-w-xs truncate text-xs">
                            {product.name}
                          </TableCell>

                          {/* Category */}
                          <TableCell className="px-6 py-4 text-muted-foreground truncate text-xs">
                            {product.category || "-"}
                          </TableCell>

                          {/* Branch */}
                          <TableCell className="px-6 py-4 text-muted-foreground truncate text-xs">
                            {product.branch || "-"}
                          </TableCell>

                          {/* Quantity */}
                          <TableCell className="px-6 py-4 text-center text-xs">
                            <div className="flex items-center justify-center gap-1.5">
                              <span
                                className={`font-semibold ${
                                  isOut
                                    ? "text-rose-500"
                                    : isLow
                                    ? "text-amber-500"
                                    : "text-foreground"
                                }`}
                              >
                                {qty}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {product.unit_of_measurement || ""}
                              </span>
                              {isOut && (
                                <span className="text-[10px] font-semibold bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">
                                  {tStock("outOfStock")}
                                </span>
                              )}
                              {isLow && (
                                <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">
                                  {tStock("lowStock")}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Cost Price */}
                          <TableCell className="px-6 py-4 text-right font-medium text-xs">
                            {formatCurrency(cost)}
                          </TableCell>

                          {/* Sell Price */}
                          <TableCell className="px-6 py-4 text-right font-medium text-xs">
                            {formatCurrency(sell)}
                          </TableCell>

                          {/* Total Cost Valuation */}
                          <TableCell className="px-6 py-4 text-right font-bold text-muted-foreground text-xs">
                            {formatCurrency(qty * cost)}
                          </TableCell>

                          {/* Total Retail Valuation */}
                          <TableCell className="px-6 py-4 text-right font-bold text-[#7CD2F1] text-xs">
                            {formatCurrency(qty * sell)}
                          </TableCell>

                          {/* Damaged Quantity */}
                          <TableCell className="px-6 py-4 text-center text-xs">
                            {product.damaged_quantity && product.damaged_quantity > 0 ? (
                              <div className="flex items-center justify-center gap-1.5 text-rose-500 font-semibold text-xs">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>{product.damaged_quantity}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/30">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>

        {/* Footer with Pagination */}
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 border-t gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {tCommon("totalCountLabel", { count: totalCount })}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {tCommon("rowsPerPage")}
              </span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setLoading(true);
                }}
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
            onPageChange={(page) => {
              setCurrentPage(page);
              setLoading(true);
            }}
            isLoading={loading}
          />
        </CardFooter>
      </Card>
    </div>
  );
}
