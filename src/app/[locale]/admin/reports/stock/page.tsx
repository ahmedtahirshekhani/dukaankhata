"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
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
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { exportStockReportToExcel } from "@/lib/excel";

export default function StockReportPage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
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
  const [products, setProducts] = useState<any[]>([]);
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
    if (!reportRef.current) return;
    setIsExportingPdf(true);
    const pdfHeader = reportRef.current.querySelector(".pdf-header") as HTMLElement;
    try {
      if (pdfHeader) pdfHeader.style.display = "block";
      
      reportRef.current.classList.add("is-exporting");
      
      // Reset scroll of horizontally scrollable elements for capture
      const scrollContainers = reportRef.current.querySelectorAll(".overflow-x-auto");
      scrollContainers.forEach((el: any) => {
        el.scrollLeft = 0;
      });

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
            orientation: "landscape"
          },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        })
        .from(reportRef.current)
        .toPdf()
        .get("pdf")
        .then((pdf: any) => {
          const totalPages = pdf.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184); // #94a3b8
            pdf.text(
              tCommon("pdfWatermarkText"),
              297 / 2, // Center of landscape A4 (297mm width)
              210 - 4, // 4mm from the bottom of A4 (210mm height)
              { align: "center" }
            );
          }
        })
        .save();
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      if (pdfHeader) pdfHeader.style.display = "none";
      if (reportRef.current) reportRef.current.classList.remove("is-exporting");
      setIsExportingPdf(false);
    }
  }, [tCommon]);

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
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Top Header Controls */}
      <div className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="w-fit -ml-2 text-muted-foreground hover:text-foreground">
          <Link href={`/${locale}/admin/reports`} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>{tCommon("back") || "Back"}</span>
          </Link>
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              {tStock("title")}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {tStock("description")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            {/* Download Report (PDF) */}
            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={isExportingPdf || products.length === 0}
              className="w-full sm:w-auto h-10 px-4 rounded-xl border-gray-200 shadow-sm"
            >
              {isExportingPdf ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              {tStock("downloadPdf")}
            </Button>
            {/* Export Excel */}
            <Button
              onClick={handleExportExcel}
              disabled={isExporting || products.length === 0}
              className="w-full sm:w-auto h-10 px-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 bg-[#7CD2F1] hover:bg-[#6bc2e1] text-white border-none"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              {tStock("exportExcel")}
            </Button>
          </div>
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

      {/* Main Table Container (Interactive Panel) */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center justify-between">
            {/* Search filter input */}
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder={tStock("searchProducts")}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setLoading(true);
                }}
                className="pl-10 h-10 rounded-xl"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>

            {/* Selector drop downs */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Category selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
                  {tStock("category")}:
                </span>
                <Select
                  value={categoryFilter}
                  onValueChange={(value) => {
                    setCategoryFilter(value);
                    setLoading(true);
                  }}
                >
                  <SelectTrigger className="w-[140px] sm:w-[160px] h-10 rounded-xl">
                    <SelectValue placeholder={tStock("category")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tStock("all")}</SelectItem>
                    {availableCategories.map((cat, idx) => (
                      <SelectItem key={idx} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Branch selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">
                  {tStock("branch")}:
                </span>
                <Select
                  value={branchFilter}
                  onValueChange={(value) => {
                    setBranchFilter(value);
                    setLoading(true);
                  }}
                >
                  <SelectTrigger className="w-[140px] sm:w-[160px] h-10 rounded-xl">
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

              {/* Clear Filters options */}
              {(searchTerm || categoryFilter !== "all" || branchFilter !== "all") && (
                <Button variant="ghost" onClick={handleClearFilters} className="h-10 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl">
                  {tCommon("clearFilters") || "Clear Filters"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Capture Report Block for Landscape PDF */}
        <div ref={reportRef}>
          <style dangerouslySetInnerHTML={{ __html: `
            .is-exporting table {
              font-size: 10px !important;
            }
            .is-exporting th, .is-exporting td {
              padding: 6px 8px !important;
            }
          `}} />
          {/* A4 Landscape PDF Header (Hidden in UI viewport, displayed only in captured PDF) */}
          <div className="pdf-header" style={{ display: "none", backgroundColor: "white", color: "black" }}>
            <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid #e2e8f0" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    {/* Brand logo */}
                    <td style={{ width: "25%", verticalAlign: "top" }}>
                      {branding.logo && (
                        <Image
                          src={branding.logo}
                          alt="Company Logo"
                          width={150}
                          height={64}
                          unoptimized
                          style={{
                            height: "64px",
                            width: "auto",
                            objectFit: "contain",
                            display: "block",
                          }}
                        />
                      )}
                    </td>
                    {/* Brand details */}
                    <td style={{ width: "50%", textAlign: "center", verticalAlign: "top" }}>
                      <div style={{
                        fontWeight: 900,
                        fontSize: "22px",
                        color: "#0f172a",
                        textTransform: "uppercase",
                        letterSpacing: "-0.5px",
                        lineHeight: 1.2,
                      }}>
                        {branding.name}
                      </div>
                      <div style={{
                        fontSize: "11px",
                        color: "#64748b",
                        marginTop: "4px",
                        lineHeight: 1.5,
                        whiteSpace: "pre-line",
                      }}>
                        {branding.address}
                      </div>
                      {(branding.phone || branding.email) && (
                        <table style={{ margin: "6px auto 0", borderCollapse: "collapse" }}>
                          <tbody>
                            <tr>
                              {branding.phone && (
                                <td style={{
                                  paddingRight: branding.email ? "20px" : "0",
                                  fontSize: "11px",
                                  color: "#64748b",
                                  verticalAlign: "middle",
                                  whiteSpace: "nowrap",
                                }}>
                                  <span style={{ fontSize: "12px", marginRight: "4px" }}>☎</span>
                                  <span>{branding.phone}</span>
                                </td>
                              )}
                              {branding.email && (
                                <td style={{
                                  fontSize: "11px",
                                  color: "#64748b",
                                  verticalAlign: "middle",
                                  whiteSpace: "nowrap",
                                }}>
                                  <span style={{ fontSize: "12px", marginRight: "4px" }}>✉</span>
                                  <span style={{ textTransform: "lowercase" }}>{branding.email}</span>
                                </td>
                              )}
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </td>
                    {/* PDF Title */}
                    <td style={{ width: "25%", textAlign: "right", verticalAlign: "top" }}>
                      <div style={{
                        fontWeight: 900,
                        fontSize: "22px",
                        color: "#0f172a",
                        textTransform: "uppercase",
                        letterSpacing: "-0.5px",
                      }}>
                        {tStock("title")}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Filter Params Meta Grid inside PDF */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-[11px]">
                <div className="flex justify-between border-b border-gray-100 pb-1">
                  <span className="text-gray-500 font-medium">{tStock("category")}:</span>
                  <span className="font-bold">{categoryFilter === "all" ? tStock("all") : categoryFilter}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-1">
                  <span className="text-gray-500 font-medium">{tStock("branch")}:</span>
                  <span className="font-bold">{branchFilter === "all" ? tStock("all") : branchFilter}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-1">
                  <span className="text-gray-500 font-medium">Generated On:</span>
                  <span className="font-medium text-gray-700">{new Date().toLocaleDateString(locale)} at {new Date().toLocaleTimeString(locale)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-1">
                  <span className="text-gray-500 font-medium">{tStock("totalStockItems")}:</span>
                  <span className="font-bold text-emerald-600">{summary.totalStock || 0} ({summary.totalProducts || 0} {tStock("products")})</span>
                </div>
              </div>
            </div>

            {/* PDF Summary Stats Row */}
            <div style={{ padding: "0 24px 20px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "12px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>{tStock("costValuation")}</div>
                      <div style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a", marginTop: "4px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "normal", color: "#64748b", marginRight: "4px" }}>PKR</span>
                        <span>{formatCurrency(summary.totalCostValue)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>{tStock("retailValuation")}</div>
                      <div style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a", marginTop: "4px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "normal", color: "#64748b", marginRight: "4px" }}>PKR</span>
                        <span>{formatCurrency(summary.totalSellValue)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>{tStock("profitPotential")}</div>
                      <div style={{ fontSize: "16px", fontWeight: "bold", color: "#8b5cf6", marginTop: "4px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "normal", color: "#64748b", marginRight: "4px" }}>PKR</span>
                        <span>{formatCurrency(summary.totalProfitPotential)}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Products Table Data */}
          <CardContent className="p-0 relative">
            <div className="overflow-x-auto md:overflow-visible [.is-exporting_&]:overflow-visible">
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
        </div>

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
