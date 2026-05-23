// src/app/[locale]/admin/reports/profitability/page.tsx

"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  FileDown,
  Printer,
  ArrowLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { exportProfitabilityToExcel } from "@/lib/excel";

export default function ProfitabilityReportPage() {
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const tProfit = useTranslations("profitabilityPage");

  // Date States
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Data States
  const [summary, setSummary] = useState<any>({
    totalRevenue: 0,
    totalCOGS: 0,
    grossProfit: 0,
    totalExpenses: 0,
    operatingProfit: 0,
    profitMargin: 0,
    totalOrders: 0,
    totalExpenseItems: 0,
    avgOrderValue: 0,
    avgExpenseValue: 0,
  });
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Active preset filter state
  const [activePreset, setActivePreset] = useState<string>("thisMonth");

  // Branding
  const [branding, setBranding] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    logo: null as string | null,
  });

  // Slider State
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Load branding
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

  // Set default from date and auto-load report
  useEffect(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fromDateStr = thirtyDaysAgo.toISOString().split("T")[0];
    setFromDate(fromDateStr);
  }, []);

  // Auto-fetch report when dates are set
  useEffect(() => {
    if (fromDate && toDate && !hasSearched) {
      fetchReport();
    }
  }, [fromDate, toDate]);

  // Fetch report data
  const fetchReport = useCallback(
    async (isExportMode = false) => {
      if (!fromDate || !toDate) return;

      if (!isExportMode) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          fromDate,
          toDate,
          page: String(isExportMode ? 1 : currentPage),
          limit: String(isExportMode ? -1 : pageSize),
        });

        const signal = !isExportMode ? abortControllerRef.current?.signal : undefined;
        const res = await fetch(`/${locale}/api/reports/profitability?${params.toString()}`, {
          signal,
        });

        if (res.ok) {
          const data = await res.json();
          setSummary(data.summary || {});
          setBreakdown(data.breakdown || []);
          setExpenses(data.expenses || []);
          setExpensesByCategory(data.expensesByCategory || []);
          setTotalPages(data.pagination?.totalPages || 1);
          setHasSearched(true);
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Failed to fetch profitability report:", err);
        }
      } finally {
        if (!isExportMode) setLoading(false);
      }
    },
    [fromDate, toDate, currentPage, pageSize, locale]
  );

  // Handle generate report
  const handleGenerateReport = () => {
    setCurrentPage(1);
    setHasSearched(false);
    setTimeout(() => fetchReport(), 100);
  };

  const applyPreset = (preset: "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "thisYear" | "allTime") => {
    setActivePreset(preset);
    const today = new Date();
    
    switch (preset) {
      case "today":
        setFromDate(today.toISOString().split("T")[0]);
        setToDate(today.toISOString().split("T")[0]);
        break;
      case "yesterday": {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setFromDate(yesterday.toISOString().split("T")[0]);
        setToDate(yesterday.toISOString().split("T")[0]);
        break;
      }
      case "thisWeek": {
        const firstDay = new Date(today);
        const day = firstDay.getDay();
        const diff = firstDay.getDate() - day + (day === 0 ? -6 : 1);
        firstDay.setDate(diff);
        setFromDate(firstDay.toISOString().split("T")[0]);
        setToDate(today.toISOString().split("T")[0]);
        break;
      }
      case "lastWeek": {
        const lastWeekEnd = new Date(today);
        const day2 = lastWeekEnd.getDay();
        const diff2 = lastWeekEnd.getDate() - day2 + (day2 === 0 ? -6 : 1) - 1;
        lastWeekEnd.setDate(diff2);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekStart.getDate() - 6);
        setFromDate(lastWeekStart.toISOString().split("T")[0]);
        setToDate(lastWeekEnd.toISOString().split("T")[0]);
        break;
      }
      case "thisMonth": {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        setFromDate(firstDay.toISOString().split("T")[0]);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setToDate(lastDay.toISOString().split("T")[0]);
        break;
      }
      case "lastMonth": {
        const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        setFromDate(firstDay.toISOString().split("T")[0]);
        const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
        setToDate(lastDay.toISOString().split("T")[0]);
        break;
      }
      case "thisYear": {
        const firstDay = new Date(today.getFullYear(), 0, 1);
        setFromDate(firstDay.toISOString().split("T")[0]);
        const lastDay = new Date(today.getFullYear(), 11, 31);
        setToDate(lastDay.toISOString().split("T")[0]);
        break;
      }
      case "allTime": {
        setFromDate("2000-01-01");
        setToDate(today.toISOString().split("T")[0]);
        break;
      }
    }
  };

  // Refetch report when currentPage changes
  useEffect(() => {
    if (hasSearched && currentPage > 1) {
      fetchReport();
    }
  }, [currentPage, hasSearched, fetchReport]);

  const isFormValid = useMemo(() => fromDate && toDate, [fromDate, toDate]);

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Slider handlers
  const handleScroll = useCallback(() => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
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

  // PDF Export
  const handleExportPdf = useCallback(async () => {
    if (!reportRef.current) return;
    setIsExportingPdf(true);
    
    try {
      reportRef.current.classList.add("is-exporting");

      const mod = await import("html2pdf.js");
      const html2pdf = (mod as any).default || mod;

      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: `profitability-report-${fromDate}_to_${toDate}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            logging: false,
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "landscape", // Landscape for better width
          },
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
              297 / 2,
              210 - 6,
              { align: "center" }
            );
          }
        })
        .save();
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      if (reportRef.current) reportRef.current.classList.remove("is-exporting");
      setIsExportingPdf(false);
    }
  }, [fromDate, toDate, tCommon]);

  // Excel Export
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await fetchReport(true);
      setTimeout(() => {
        exportProfitabilityToExcel(
          { summary, breakdown, expenses, expensesByCategory } as any,
          `profitability-report-${fromDate}_to_${toDate}.xlsx`
        );
        setIsExporting(false);
      }, 500);
    } catch (err) {
      console.error("Export to Excel failed:", err);
      setIsExporting(false);
    }
  };

  // Summary cards data - Fixed height and consistent layout
  const summaryCards = useMemo(() => [
    {
      title: tProfit("totalRevenue"),
      value: formatCurrency(summary.totalRevenue),
      currency: "PKR",
      subValue: `${summary.totalOrders || 0} ${tProfit("orders")}`,
      icon: TrendingUp,
      bgClass: "bg-green-50/50 dark:bg-green-950/20",
      iconClass: "text-green-500",
    },
    {
      title: tProfit("totalExpenses"),
      value: formatCurrency(summary.totalExpenses),
      currency: "PKR",
      subValue: `${summary.totalExpenseItems || 0} ${tProfit("expenses")}`,
      icon: TrendingDown,
      bgClass: "bg-red-50/50 dark:bg-red-950/20",
      iconClass: "text-red-500",
    },
    {
      title: tProfit("netProfit"),
      value: formatCurrency(summary.operatingProfit),
      currency: "PKR",
      subValue: `${((summary.operatingProfit / (summary.totalRevenue || 1)) * 100).toFixed(2)}% ${tProfit("margin")}`,
      icon: DollarSign,
      bgClass: "bg-blue-50/50 dark:bg-blue-950/20",
      iconClass: "text-blue-500",
    },
    {
      title: tProfit("profitMargin"),
      value: `${(summary.profitMargin || 0).toFixed(2)}%`,
      subValue: tProfit("marginDescription"),
      icon: Percent,
      bgClass: "bg-violet-50/50 dark:bg-violet-950/20",
      iconClass: "text-violet-500",
    },
  ], [summary, tProfit]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
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
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent">
              {tProfit("title")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {tProfit("description")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={isExportingPdf || !hasSearched}
              className="flex-1 sm:flex-initial h-10 px-3 sm:px-4 rounded-xl border-gray-200 shadow-sm text-sm"
            >
              {isExportingPdf ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              {tCommon("downloadPdf")}
            </Button>
            <Button
              onClick={handleExportExcel}
              disabled={isExporting || !hasSearched}
              className="flex-1 sm:flex-initial h-10 px-3 sm:px-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 bg-[#7CD2F1] hover:bg-[#6bc2e1] text-white border-none text-sm"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              {tCommon("exportExcel")}
            </Button>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="bg-white shadow-sm border-border/50">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
            {[
              { id: "today", label: tCommon("today") || "Today" },
              { id: "yesterday", label: tCommon("yesterday") || "Yesterday" },
              { id: "thisWeek", label: tCommon("thisWeek") || "This Week" },
              { id: "lastWeek", label: tCommon("lastWeek") || "Last Week" },
              { id: "thisMonth", label: tCommon("thisMonth") || "This Month" },
              { id: "lastMonth", label: tCommon("lastMonth") || "Last Month" },
              { id: "thisYear", label: tCommon("thisYear") || "This Year" },
              { id: "allTime", label: tCommon("allTime") || "All Time" },
            ].map((preset) => (
              <Button
                key={preset.id}
                variant={activePreset === preset.id ? "default" : "outline"}
                size="sm"
                onClick={() => applyPreset(preset.id as any)}
                className="text-xs sm:text-sm px-2 sm:px-3"
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{tProfit("fromDate")}</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setActivePreset("");
                }}
                className="mt-1 sm:mt-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{tProfit("toDate")}</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setActivePreset("");
                }}
                className="mt-1 sm:mt-2 text-sm"
              />
            </div>
            <div className="flex items-end col-span-1 sm:col-span-2">
              <Button
                onClick={handleGenerateReport}
                disabled={!isFormValid || loading}
                className="w-full text-sm sm:text-base"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tCommon("loading")}
                  </>
                ) : (
                  tProfit("generate")
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {hasSearched && !loading && (
        <div ref={reportRef} className="mt-2 sm:mt-4">
          <style dangerouslySetInnerHTML={{
            __html: `
              .is-exporting {
                font-family: Arial, Helvetica, sans-serif !important;
                background-color: white !important;
                color: black !important;
              }
              .is-exporting .summary-card {
                break-inside: avoid;
                page-break-inside: avoid;
                margin-bottom: 16px;
                height: auto !important;
              }
              .is-exporting .summary-cards-grid {
                display: grid !important;
                grid-template-columns: repeat(4, 1fr) !important;
                gap: 16px !important;
                overflow: visible !important;
              }
              .is-exporting .slider-arrows {
                display: none !important;
              }
              .is-exporting .hide-scrollbar {
                overflow: visible !important;
              }
              .is-exporting .report-header {
                margin-bottom: 20px !important;
              }
              @media print {
                .no-print {
                  display: none !important;
                }
                .summary-card {
                  break-inside: avoid;
                  page-break-inside: avoid;
                }
              }
            `
          }} />
          
          {/* Report Header - Shows in both UI and PDF */}
          <div className="report-header mb-6 p-4 sm:p-6 bg-white rounded-lg border border-border/50 shadow-sm">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Left: Logo */}
              <div className="flex-shrink-0">
                {branding.logo && (
                  <Image
                    src={branding.logo}
                    alt="Company Logo"
                    width={100}
                    height={50}
                    className="h-12 sm:h-14 w-auto object-contain"
                    unoptimized
                  />
                )}
              </div>
              
              {/* Center: Company Details */}
              <div className="text-center flex-1">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground uppercase tracking-tight">
                  {branding.name || tCommon("appName")}
                </h2>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {branding.address && <p>{branding.address}</p>}
                  {branding.phone && <p className="mt-0.5">📞 {branding.phone}</p>}
                </div>
              </div>
              
              {/* Right: Report Title */}
              <div className="text-right flex-shrink-0">
                <h3 className="text-lg sm:text-xl font-bold text-foreground">{tProfit("title")}</h3>
                <p className="text-xs text-muted-foreground mt-1">Basis: Accrual</p>
              </div>
            </div>
            
            {/* Date Range Info - From and To in separate columns, no Status */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                <div className="flex justify-between items-center sm:justify-start sm:gap-4">
                  <span className="text-muted-foreground font-medium">{tProfit("fromDate")}:</span>
                  <span className="font-semibold">{new Date(fromDate).toLocaleDateString(locale)}</span>
                </div>
                <div className="flex justify-between items-center sm:justify-start sm:gap-4">
                  <span className="text-muted-foreground font-medium">{tProfit("toDate")}:</span>
                  <span className="font-semibold">{new Date(toDate).toLocaleDateString(locale)}</span>
                </div>
                <div className="flex justify-between items-center sm:justify-start sm:gap-4">
                  <span className="text-muted-foreground font-medium">Generated On:</span>
                  <span className="font-medium">{new Date().toLocaleDateString(locale)} at {new Date().toLocaleTimeString(locale)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards - Equal height and consistent alignment */}
          <div className="relative mb-6">
            {/* Left Arrow - Hide in PDF */}
            {showLeftArrow && (
              <button
                onClick={scrollLeft}
                type="button"
                aria-label="Scroll summary cards left"
                className="slider-arrows absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-zinc-900 rounded-full shadow-md p-1.5 border border-border hover:bg-accent transition-all lg:hidden"
              >
                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
              </button>
            )}

            {/* Right Arrow - Hide in PDF */}
            {showRightArrow && (
              <button
                onClick={scrollRight}
                type="button"
                aria-label="Scroll summary cards right"
                className="slider-arrows absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-zinc-900 rounded-full shadow-md p-1.5 border border-border hover:bg-accent transition-all lg:hidden"
              >
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            )}

            {/* Slider Track - Fixed height cards */}
            <div
              ref={sliderRef}
              className="summary-cards-grid flex overflow-x-auto scroll-smooth gap-3 sm:gap-4 pb-2 hide-scrollbar lg:grid lg:grid-cols-4 lg:overflow-visible"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {summaryCards.map((card, index) => (
                <div
                  key={index}
                  className="summary-card flex-shrink-0 w-[260px] sm:w-[280px] lg:w-full"
                >
                  <Card className="border-border/50 shadow-sm overflow-hidden group hover:shadow-md transition-all duration-300 h-full min-h-[140px]">
                    <CardContent className="p-4 sm:p-5 h-full flex flex-col">
                      <div className="flex items-start justify-between mb-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                          {card.title}
                        </p>
                        <div className={`p-2 sm:p-2.5 ${card.bgClass} rounded-xl flex-shrink-0 ml-2`}>
                          <card.icon className={`h-4 w-4 sm:h-4 sm:w-4 ${card.iconClass}`} />
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-baseline gap-1 flex-wrap">
                          {card.currency && (
                            <span className="text-xs sm:text-xs font-normal text-muted-foreground">
                              {card.currency}
                            </span>
                          )}
                          <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words leading-tight">
                            {card.value}
                          </span>
                        </div>
                        {card.subValue && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 leading-relaxed">
                            {card.subValue}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          {/* Main Financial Table */}
          <Card className="bg-white shadow-sm border-border/50 overflow-x-auto">
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs sm:text-sm min-w-[600px]">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left font-semibold py-3 px-4 sm:px-6 text-muted-foreground">{tProfit("account")}</th>
                      <th className="text-right font-semibold py-3 px-4 sm:px-6 text-muted-foreground">{tProfit("total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Operating Income */}
                    <tr className="bg-muted/30">
                      <td colSpan={2} className="font-bold py-3 px-4 sm:px-6 text-sm sm:text-base text-foreground">{tProfit("operatingIncome")}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2.5 px-6 sm:px-10 text-muted-foreground">{tProfit("sales") || "Revenue"}</td>
                      <td className="text-right py-2.5 px-4 sm:px-6 font-medium">{formatCurrency(summary.totalRevenue)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="font-bold py-3 px-4 sm:px-6 text-foreground">{tProfit("totalFor", { name: tProfit("operatingIncome") })}</td>
                      <td className="text-right font-bold py-3 px-4 sm:px-6">{formatCurrency(summary.totalRevenue)}</td>
                    </tr>

                    {/* Cost of Goods Sold */}
                    <tr className="bg-muted/30">
                      <td colSpan={2} className="font-bold py-3 px-4 sm:px-6 text-sm sm:text-base text-foreground mt-2">{tProfit("costOfGoodsSold")}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="font-bold py-3 px-4 sm:px-6 text-foreground">{tProfit("totalFor", { name: tProfit("costOfGoodsSold") })}</td>
                      <td className="text-right font-bold py-3 px-4 sm:px-6">{formatCurrency(summary.totalCOGS)}</td>
                    </tr>

                    {/* Gross Profit */}
                    <tr className="border-b-2 border-b-gray-300 bg-green-50/30">
                       <td className="font-bold py-4 px-4 sm:px-6 text-sm sm:text-base">{tProfit("grossProfit")}</td>
                       <td className="text-right font-bold py-4 px-4 sm:px-6 text-sm sm:text-base">{formatCurrency(summary.grossProfit)}</td>
                    </tr>

                    {/* Operating Expense */}
                    <tr className="bg-muted/30">
                      <td colSpan={2} className="font-bold py-3 px-4 sm:px-6 text-sm sm:text-base text-foreground mt-2">{tProfit("operatingExpense")}</td>
                    </tr>
                    {expensesByCategory.map((exp: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2.5 px-6 sm:px-10 text-muted-foreground">{exp.category}</td>
                        <td className="text-right py-2.5 px-4 sm:px-6 font-medium">{formatCurrency(exp.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-b-gray-300">
                      <td className="font-bold py-3 px-4 sm:px-6 text-foreground border-t">{tProfit("totalFor", { name: tProfit("operatingExpense") })}</td>
                      <td className="text-right font-bold py-3 px-4 sm:px-6 border-t">{formatCurrency(summary.totalExpenses)}</td>
                    </tr>

                    {/* Operating Profit */}
                    <tr className="bg-blue-50/30 font-bold border-t-2 border-t-gray-300">
                      <td className="font-extrabold py-4 px-4 sm:px-6 text-base sm:text-lg text-foreground">{tProfit("operatingProfit")}</td>
                      <td className="text-right font-extrabold py-4 px-4 sm:px-6 text-base sm:text-lg">{formatCurrency(summary.operatingProfit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* No Data State */}
          {summary.totalRevenue === 0 && summary.totalExpenses === 0 && (
            <Card className="bg-white shadow-sm border-border/50 mt-4">
              <CardContent className="py-8 sm:py-12 text-center">
                <p className="text-muted-foreground text-sm sm:text-base">{tProfit("noData") || "No data found for the selected period."}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="bg-white shadow-sm border-border/50">
          <CardContent className="py-8 sm:py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm sm:text-base">{tCommon("loading")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}