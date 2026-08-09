// src/app/[locale]/admin/reports/receivable-summary/page.tsx

"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePermissions } from "@/hooks/use-permissions";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  X,
  Filter as FilterIcon,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { exportReceivableSummaryToExcel } from "@/lib/excel";

export default function ReceivableSummaryPage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const { can } = usePermissions();
  const tCommon = useTranslations("common");
  const tRec = useTranslations("receivableSummaryPage");

  // Localized title & descriptions with custom fallbacks
  const titleStr = tRec("title") || tNav("receivableSummary") || "Receivable Summary";
  const descStr = tRec("description") || "Summary of outstanding receivables";

  // Search and Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter States
  const [statusFilter, setStatusFilter] = useState("all");
  const [minBalance, setMinBalance] = useState("");
  const [maxBalance, setMaxBalance] = useState("");
  const debouncedMinBalance = useDebounce(minBalance, 500);
  const debouncedMaxBalance = useDebounce(maxBalance, 500);
  const [pdfDebtors, setPdfDebtors] = useState<any[]>([]);

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
      if (statusFilter && statusFilter !== "all") {
        url.searchParams.set("status", statusFilter);
      }
      if (debouncedMinBalance) {
        url.searchParams.set("minBalance", debouncedMinBalance);
      }
      if (debouncedMaxBalance) {
        url.searchParams.set("maxBalance", debouncedMaxBalance);
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
  }, [currentPage, pageSize, debouncedSearchTerm, statusFilter, debouncedMinBalance, debouncedMaxBalance]);

  // Fetch whenever page or search/filter terms change
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
  }, [debouncedSearchTerm, statusFilter, debouncedMinBalance, debouncedMaxBalance, pageSize]);

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
    setIsExportingPdf(true);
    try {
      const allFilteredDebtors = await fetchReceivableReport(true);
      if (allFilteredDebtors) {
        setPdfDebtors(allFilteredDebtors);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (!reportRef.current) return;

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
  }, [fetchReceivableReport, tCommon]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setMinBalance("");
    setMaxBalance("");
    setCurrentPage(1);
  };

  // Format Currency Helper
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

  // Card summary object mapping
  const summaryCards = useMemo(() => [
    {
      title: tRec("totalOutstanding"),
      value: formatCurrency(summary.totalReceivable),
      currency: "Rs.",
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
      currency: "Rs.",
      subValue: tRec("avgOutstandingDesc"),
      icon: UserCheck,
      bgClass: "bg-amber-50/50 dark:bg-amber-950/20",
      iconClass: "text-amber-500",
      borderClass: "hover:border-amber-500/20"
    },
    {
      title: tRec("maxReceivable"),
      value: formatCurrency(summary.maxReceivable),
      currency: "Rs.",
      subValue: tRec("maxReceivableDesc"),
      icon: TrendingDown,
      bgClass: "bg-rose-50/50 dark:bg-rose-950/20",
      iconClass: "text-rose-500",
      borderClass: "hover:border-rose-500/20"
    }
  ], [summary, tRec]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {titleStr}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {descStr}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {can('reports', 'export_receivable_summary') && (
            <>
              {/* Export Excel (Top, White Default) */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={isExporting || debtors.length === 0}
                className="h-7 text-[11px] px-2 gap-1 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-none w-full justify-center"
              >
                {isExporting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <FileDown className="h-3 w-3" />
                )}
                <span>{tCommon("exportExcel") || "Export Excel"}</span>
              </Button>

              {/* Download Report (PDF) (Below, Theme Sky Blue) */}
              <Button
                size="sm"
                onClick={handleExportPdf}
                disabled={isExportingPdf || debtors.length === 0}
                className="h-7 text-[11px] px-2 gap-1 bg-sky-500 hover:bg-sky-600 text-white shadow-none w-full justify-center"
              >
                {isExportingPdf ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Printer className="h-3 w-3" />
                )}
                <span>{tCommon("downloadPdf") || "Download PDF"}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards with Slider Layout */}
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

      {/* Main Panel Container */}
      <Card className="flex flex-col gap-4 sm:gap-6 p-3.5 sm:p-6 shadow-md overflow-hidden">
        <CardHeader className="p-0">
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={tRec("searchPlaceholder") || "Search parties..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs sm:text-sm w-full bg-background"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                  <span>{tCommon("filter") || "Filter"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-3 space-y-3">
                {/* Status Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    {tRec("status") || "Status"}
                  </Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(val) => setStatusFilter(val)}
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">{tRec("active") || "Active"}</SelectItem>
                      <SelectItem value="inactive">{tRec("inactive") || "Inactive"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Balance Range Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    {tRec("outstandingBalance") || "Balance Range"}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minBalance}
                      onChange={(e) => setMinBalance(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                    <span className="text-xs text-muted-foreground">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxBalance}
                      onChange={(e) => setMaxBalance(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>

                {(searchTerm || statusFilter !== "all" || minBalance !== "" || maxBalance !== "") && (
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
                  <span>Preparing & downloading your A4 receivable report PDF...</span>
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
                          {branding.logo && (
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
                                marginBottom: "4px",
                              }}
                            />
                          )}
                          <div style={{ fontWeight: 900, fontSize: "18px", color: "#0f172a", textTransform: "uppercase" }}>
                            {branding.name}
                          </div>
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
                          <div style={{ fontWeight: 900, fontSize: "20px", color: "#0f172a", textTransform: "uppercase" }}>
                            {titleStr}
                          </div>
                          <div style={{ fontSize: "10px", color: "#475569", marginTop: "4px" }}>
                            Date: <span style={{ fontWeight: 700, color: "#0f172a" }}>{new Date().toLocaleDateString(locale)}</span>
                          </div>
                          <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
                            Total Records: <span style={{ fontWeight: 700, color: "#0284c7" }}>{(pdfDebtors.length > 0 ? pdfDebtors : debtors).length}</span>
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
                        <td style={{ width: "50%", color: "#64748b", fontWeight: 500 }}>
                          Total Outstanding: <span style={{ color: "#0f172a", fontWeight: 700 }}>Rs. {formatCurrency(summary.totalReceivable)}</span>
                        </td>
                        <td style={{ width: "50%", textAlign: "right", color: "#64748b", fontWeight: 500 }}>
                          Total Debtors: <span style={{ color: "#0f172a", fontWeight: 700 }}>{summary.totalDebtors || 0}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Minimal Table Form for Debtors Data */}
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", tableLayout: "fixed" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#0f172a", color: "#ffffff" }}>
                      <th style={{ width: "6%", padding: "7px 6px", textAlign: "left", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>#</th>
                      <th style={{ width: "26%", padding: "7px 6px", textAlign: "left", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>{tRec("partyName") || "Party Name"}</th>
                      <th style={{ width: "22%", padding: "7px 6px", textAlign: "left", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>{tRec("companyName") || "Company"}</th>
                      <th style={{ width: "20%", padding: "7px 6px", textAlign: "left", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>{tRec("contactInformation") || "Contact"}</th>
                      <th style={{ width: "12%", padding: "7px 6px", textAlign: "center", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>{tRec("status") || "Status"}</th>
                      <th style={{ width: "14%", padding: "7px 6px", textAlign: "right", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>{tRec("outstandingBalance") || "Balance"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pdfDebtors.length > 0 ? pdfDebtors : debtors).map((d, idx) => {
                      const balance = d.balance || 0;
                      const isActive = d.status === "active";
                      return (
                        <tr key={d.id || idx} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "6px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{idx + 1}</td>
                          <td style={{ padding: "6px", fontWeight: "600", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</td>
                          <td style={{ padding: "6px", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.company_name || "-"}</td>
                          <td style={{ padding: "6px", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.phone || d.email || "-"}</td>
                          <td style={{ padding: "6px", textAlign: "center", fontWeight: "600", color: isActive ? "#16a34a" : "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {isActive ? tRec("active") || "Active" : tRec("inactive") || "Inactive"}
                          </td>
                          <td style={{ padding: "6px", textAlign: "right", fontWeight: "700", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Rs. {formatCurrency(balance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Data List: Table or Cards */}
        <CardContent className="p-0 relative">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
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
                        <TableCell className="px-6 py-4 font-bold text-foreground max-w-xs truncate text-xs sm:text-sm">
                          {debtor.name}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-muted-foreground truncate text-xs">
                          {debtor.company_name || "-"}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-muted-foreground text-xs">
                          <div className="flex flex-col gap-0.5">
                            {debtor.phone && <span>{debtor.phone}</span>}
                            {debtor.email && <span className="text-muted-foreground/60">{debtor.email}</span>}
                            {!debtor.phone && !debtor.email && <span>-</span>}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right font-bold text-foreground text-xs sm:text-sm">
                          <span className="text-xs font-normal text-muted-foreground mr-1">Rs.</span>
                          <span>{formatCurrency(balance)}</span>
                        </TableCell>
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

          {/* Mobile View: Cards Layout */}
          <div className="block md:hidden space-y-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {tCommon("loading") || "Loading..."}
                </span>
              </div>
            ) : debtors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <Info className="h-10 w-10 text-muted-foreground/50" />
                <span className="text-sm font-medium">
                  {tRec("noData") || "No active receivables found."}
                </span>
              </div>
            ) : (
              debtors.map((debtor) => {
                const balance = debtor.balance || 0;
                const isActive = debtor.status === "active";
                const hasCompanyName = Boolean(
                  debtor.company_name &&
                  debtor.company_name.trim() !== "" &&
                  debtor.company_name !== "-"
                );

                return (
                  <div
                    key={debtor.id}
                    className="bg-card border rounded-lg p-3.5 shadow-sm space-y-2.5"
                  >
                    {/* Header Row: Party Name & Status Badge */}
                    <div className="flex justify-between items-start gap-2 border-b border-zinc-100 dark:border-zinc-800/60 pb-2">
                      <h3 className="font-semibold text-sm text-foreground truncate max-w-[70%]">
                        {debtor.name}
                      </h3>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isActive
                            ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {isActive ? tRec("active") || "Active" : tRec("inactive") || "Inactive"}
                      </span>
                    </div>

                    {/* Details Section */}
                    <div className="space-y-2 text-xs">
                      {/* Company Name (Rendered only if available) */}
                      {hasCompanyName && (
                        <div className="flex justify-between items-center text-muted-foreground">
                          <span>{tRec("companyName") || "Company"}:</span>
                          <span className="font-medium text-foreground">{debtor.company_name}</span>
                        </div>
                      )}

                      {/* Contact Info */}
                      {(debtor.phone || debtor.email) && (
                        <div className="flex justify-between items-center text-muted-foreground">
                          <span>{tRec("contactInformation") || "Contact"}:</span>
                          <span className="font-medium text-foreground">
                            {debtor.phone || debtor.email || "-"}
                          </span>
                        </div>
                      )}

                      {/* Outstanding Balance */}
                      <div className="flex justify-between items-center pt-1.5 border-t border-zinc-100 dark:border-zinc-800/40">
                        <span className="text-muted-foreground font-medium">{tRec("outstandingBalance") || "Outstanding"}:</span>
                        <span className="font-bold text-foreground text-sm">
                          <span className="text-xs font-normal text-muted-foreground mr-1">Rs.</span>
                          <span>{formatCurrency(balance)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>

        {/* Footer with Pagination */}
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center px-0 pt-4 pb-0 border-t gap-4">
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
