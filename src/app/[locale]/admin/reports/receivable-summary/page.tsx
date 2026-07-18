// src/app/[locale]/admin/reports/receivable-summary/page.tsx

"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Search,
  FileDown,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Loader2,
  Info,
  Printer,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { exportReceivableSummaryToExcel } from "@/lib/excel";

export default function ReceivableSummaryPage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const tRec = useTranslations("receivableSummaryPage");

  // Localized title & descriptions with custom fallbacks
  const titleStr = tRec("title") || tNav("receivableSummary") || "Receivable Summary";
  const descStr = tRec("description") || tNav("receivableSummaryDescription") || "Summary of outstanding receivables from all parties";

  // Search and Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // States for API data
  const [debtors, setDebtors] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalReceivable: 0,
    totalDebtors: 0,
    maxReceivable: 0,
    avgReceivable: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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
  const fetchReceivableReport = useCallback(async (isExportMode = false) => {
    if (!isExportMode) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
    }

    const signal = !isExportMode ? abortControllerRef.current?.signal : undefined;

    try {
      if (!isExportMode) setLoading(true);

      const url = new URL("/api/reports/receivable-summary", window.location.origin);
      url.searchParams.set("page", String(isExportMode ? 1 : currentPage));
      url.searchParams.set("limit", String(isExportMode ? -1 : pageSize));

      if (debouncedSearchTerm) {
        url.searchParams.set("search", debouncedSearchTerm);
      }

      const res = await fetch(url.toString(), { signal });
      if (!res.ok) throw new Error("Failed to fetch receivable summary");

      const data = await res.json();

      if (isExportMode) {
        return data.debtors;
      } else {
        setDebtors(data.debtors || []);
        setSummary(data.summary || {});
        setTotalCount(data.pagination?.totalCount || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Error loading receivable summary:", err);
      }
    } finally {
      if (!isExportMode && !signal?.aborted) setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearchTerm]);

  // Fetch whenever page or search terms change
  useEffect(() => {
    fetchReceivableReport();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchReceivableReport]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize]);

  // Excel Export Handler
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const allFilteredDebtors = await fetchReceivableReport(true);
      if (allFilteredDebtors && allFilteredDebtors.length > 0) {
        const filename = `receivable-summary-${new Date().toISOString().split("T")[0]}.xlsx`;
        exportReceivableSummaryToExcel(allFilteredDebtors, filename);
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

      const mod = await import("html2pdf.js");
      const html2pdf = (mod as any).default || mod;

      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: `receivable-summary-${new Date().toISOString().split("T")[0]}.pdf`,
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

  // Card summary object mapping with small currency format support
  const summaryCards = useMemo(() => [
    {
      title: tRec("totalOutstanding"),
      value: formatCurrency(summary.totalReceivable),
      currency: "PKR",
      subValue: tRec("totalOutstandingDesc"),
      icon: TrendingUp,
      bgClass: "bg-emerald-50/50 dark:bg-emerald-950/20",
      iconClass: "text-emerald-500",
      borderClass: "hover:border-emerald-500/20"
    },
    {
      title: tRec("totalDebtors"),
      value: summary.totalDebtors || 0,
      subValue: tRec("totalDebtorsDesc"),
      icon: Users,
      bgClass: "bg-blue-50/50 dark:bg-blue-950/20",
      iconClass: "text-blue-500",
      borderClass: "hover:border-blue-500/20"
    },
    {
      title: tRec("avgOutstanding"),
      value: formatCurrency(summary.avgReceivable),
      currency: "PKR",
      subValue: tRec("avgOutstandingDesc"),
      icon: UserCheck,
      bgClass: "bg-amber-50/50 dark:bg-amber-950/20",
      iconClass: "text-amber-500",
      borderClass: "hover:border-amber-500/20"
    },
    {
      title: tRec("maxReceivable"),
      value: formatCurrency(summary.maxReceivable),
      currency: "PKR",
      subValue: tRec("maxReceivableDesc"),
      icon: TrendingDown,
      bgClass: "bg-rose-50/50 dark:bg-rose-950/20",
      iconClass: "text-rose-500",
      borderClass: "hover:border-rose-500/20"
    }
  ], [summary, tRec]);

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
              {titleStr}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {descStr}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={isExportingPdf || loading}
              className="w-full sm:w-auto h-10 px-4 rounded-xl border-gray-200 shadow-sm"
            >
              {isExportingPdf ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4 " />
              )}
              <span>{tCommon("downloadPdf") || "Download PDF"}</span>
            </Button>

            <Button
              onClick={handleExportExcel}
              disabled={isExporting || loading}
              className="flex items-center gap-2 rounded-xl h-11 shadow-sm transition-all duration-300"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              <span>{tCommon("exportExcel") || "Export Excel"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards with Slider Layout (Identical to Stock Report) */}
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
                className={`h-1.5 rounded-full transition-all duration-300 ${isActive ? "w-6 bg-[#7CD2F1]" : "w-1.5 bg-zinc-300 dark:bg-zinc-700"
                  }`}
              />
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        {/* Interactive Filters Bar */}
        <CardHeader className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50/50 dark:bg-zinc-950/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search Bar Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={tRec("searchPlaceholder") || "Search parties by name or phone..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 rounded-xl bg-background border-border/60 focus-visible:ring-primary"
                />
              </div>

              {/* Clear Filters options */}
              {searchTerm && (
                <Button variant="ghost" onClick={handleClearFilters} className="h-10 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl">
                  {tCommon("clearFilters") || "Clear Filters"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Capture Report Block for Landscape PDF */}
        <div ref={reportRef}>
          <style dangerouslySetInnerHTML={{
            __html: `
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
                        fontSize: "20px",
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
                        {titleStr}
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
                  <span className="text-gray-500 font-medium">{tRec("searchMatch")}:</span>
                  <span className="font-bold">{searchTerm || tRec("active")}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-1">
                  <span className="text-gray-500 font-medium">{tRec("exportDate")}:</span>
                  <span className="font-medium text-gray-700">{new Date().toLocaleDateString(locale)} at {new Date().toLocaleTimeString(locale)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-1">
                  <span className="text-gray-500 font-medium">{tRec("totalOutstanding")}:</span>
                  <span className="font-bold text-emerald-600">PKR {formatCurrency(summary.totalReceivable)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-1">
                  <span className="text-gray-500 font-medium">{tRec("totalDebtors")}:</span>
                  <span className="font-bold">{summary.totalDebtors || 0}</span>
                </div>
              </div>
            </div>

            {/* PDF Summary Stats Row */}
            <div style={{ padding: "0 24px 20px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "12px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>{tRec("totalOutstanding")}</div>
                      <div style={{ fontSize: "16px", fontWeight: "bold", color: "#059669", marginTop: "4px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "normal", color: "#64748b", marginRight: "4px" }}>PKR</span>
                        <span>{formatCurrency(summary.totalReceivable)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>{tRec("avgOutstanding")}</div>
                      <div style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a", marginTop: "4px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "normal", color: "#64748b", marginRight: "4px" }}>PKR</span>
                        <span>{formatCurrency(summary.avgReceivable)}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>{tRec("maxReceivable")}</div>
                      <div style={{ fontSize: "16px", fontWeight: "bold", color: "#0f172a", marginTop: "4px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "normal", color: "#64748b", marginRight: "4px" }}>PKR</span>
                        <span>{formatCurrency(summary.maxReceivable)}</span>
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
                    <TableHead className="px-6 py-4 font-bold text-xs text-gray-600 uppercase">{tRec("partyName")}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-xs text-gray-600 uppercase">{tRec("companyName")}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-xs text-gray-600 uppercase">{tRec("contactInformation")}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-xs text-gray-600 uppercase text-right">{tRec("outstandingBalance")}</TableHead>
                    <TableHead className="px-6 py-4 font-bold text-xs text-gray-600 uppercase text-center">{tRec("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">
                            {tCommon("loading") || "Loading..."}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : debtors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-64 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Info className="h-10 w-10 text-muted-foreground/50" />
                          <span className="text-sm font-medium">
                            {tRec("noData") || "No active receivables found."}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    debtors.map((debtor) => {
                      const balance = debtor.balance || 0;

                      return (
                        <TableRow
                          key={debtor.id}
                          className="border-b border-gray-100 transition-colors duration-200"
                        >
                          {/* Party Name */}
                          <TableCell className="px-6 py-4 font-bold text-foreground max-w-xs truncate text-xs sm:text-sm">
                            {debtor.name}
                          </TableCell>

                          {/* Company Name */}
                          <TableCell className="px-6 py-4 text-muted-foreground truncate text-xs">
                            {debtor.company_name || "-"}
                          </TableCell>

                          {/* Contact Info */}
                          <TableCell className="px-6 py-4 text-muted-foreground text-xs font-mono">
                            <div className="flex flex-col gap-0.5">
                              {debtor.phone && <span>{debtor.phone}</span>}
                              {debtor.email && <span className="text-muted-foreground/60">{debtor.email}</span>}
                              {!debtor.phone && !debtor.email && <span>-</span>}
                            </div>
                          </TableCell>

                          {/* Balance */}
                          <TableCell className="px-6 py-4 text-right font-bold text-emerald-600 text-xs sm:text-sm">
                            <span className="text-[10px] font-normal text-muted-foreground mr-1">PKR</span>
                            <span>{formatCurrency(balance)}</span>
                          </TableCell>

                          {/* Status */}
                          <TableCell className="px-6 py-4 text-center text-xs">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${debtor.status === "active"
                                  ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                                  : "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-400"
                                }`}
                            >
                              {debtor.status === "active" ? tRec("active") : tRec("inactive")}
                            </span>
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
