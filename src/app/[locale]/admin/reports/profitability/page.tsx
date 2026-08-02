// src/app/[locale]/admin/reports/profitability/page.tsx

"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const { can } = usePermissions();

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
  const [scrollPosition, setScrollPosition] = useState(0);
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

  // Slider scroll handler - DONO ARROWS KE LIYE FIX
  const handleScroll = useCallback(() => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      setScrollPosition(scrollLeft);
      
      // Left arrow show karo agar scroll left > 0 hai
      setShowLeftArrow(scrollLeft > 20);
      
      // Right arrow show karo agar end tak nahi pahunchay
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
      // Initial check for arrows
      handleScroll();
      return () => slider.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  // PDF Export
  const handleExportPdf = useCallback(async () => {
    setIsExportingPdf(true);
    try {
      await fetchReport(true);
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (!reportRef.current) return;

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
  }, [fetchReport, fromDate, toDate, tCommon]);

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

  // Summary cards data
  const summaryCards = useMemo(() => [
    {
      title: tProfit("totalRevenue"),
      value: formatCurrency(summary.totalRevenue),
      currency: "PKR",
      subValue: `${summary.totalOrders || 0} ${tProfit("orders")}`,
      icon: TrendingUp,
      bgClass: "bg-emerald-50/50 dark:bg-emerald-950/20",
      iconClass: "text-emerald-500",
      borderClass: "hover:border-emerald-500/20"
    },
    {
      title: tProfit("totalExpenses"),
      value: formatCurrency(summary.totalExpenses),
      currency: "PKR",
      subValue: `${summary.totalExpenseItems || 0} ${tProfit("expenses")}`,
      icon: TrendingDown,
      bgClass: "bg-rose-50/50 dark:bg-rose-950/20",
      iconClass: "text-rose-500",
      borderClass: "hover:border-rose-500/20"
    },
    {
      title: tProfit("netProfit"),
      value: formatCurrency(summary.operatingProfit),
      currency: "PKR",
      subValue: `${((summary.operatingProfit / (summary.totalRevenue || 1)) * 100).toFixed(2)}% ${tProfit("margin")}`,
      icon: DollarSign,
      bgClass: "bg-blue-50/50 dark:bg-blue-950/20",
      iconClass: "text-blue-500",
      borderClass: "hover:border-blue-500/20"
    },
    {
      title: tProfit("profitMargin"),
      value: `${(summary.profitMargin || 0).toFixed(2)}%`,
      subValue: tProfit("marginDescription"),
      icon: Percent,
      bgClass: "bg-violet-50/50 dark:bg-violet-950/20",
      iconClass: "text-violet-500",
      borderClass: "hover:border-violet-500/20"
    },
  ], [summary, tProfit]);

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {tProfit("title")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {tProfit("description")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {can('reports', 'export_profitability') && (
            <>
              {/* Export Excel (Top, White Default) */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={isExporting || !hasSearched}
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
                disabled={isExportingPdf || !hasSearched}
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
                <span>Preparing & downloading your A4 profitability report PDF...</span>
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
                padding: "24px",
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
                          PROFITABILITY REPORT
                        </div>
                        <div style={{ fontSize: "10px", color: "#475569", marginTop: "4px" }}>
                          Date Range: <span style={{ fontWeight: 700, color: "#0f172a" }}>{fromDate} to {toDate}</span>
                        </div>
                        <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
                          Generated On: <span style={{ fontWeight: 700, color: "#0284c7" }}>{new Date().toLocaleDateString(locale)}</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Minimal Metadata Summary Cards Grid */}
              <div style={{ marginBottom: "16px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #cbd5e1", backgroundColor: "#f8fafc", tableLayout: "fixed" }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                        <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>Total Sales</div>
                        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#0284c7", marginTop: "2px" }}>
                          Rs. {formatCurrency(summary.totalRevenue)}
                        </div>
                      </td>
                      <td style={{ padding: "10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                        <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>Total Expenses</div>
                        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#ef4444", marginTop: "2px" }}>
                          Rs. {formatCurrency(summary.totalExpenses)}
                        </div>
                      </td>
                      <td style={{ padding: "10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                        <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>Net Profit</div>
                        <div style={{ fontSize: "13px", fontWeight: "bold", color: summary.operatingProfit >= 0 ? "#16a34a" : "#ef4444", marginTop: "2px" }}>
                          Rs. {formatCurrency(summary.operatingProfit)}
                        </div>
                      </td>
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold" }}>Profit Margin</div>
                        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#0f172a", marginTop: "2px" }}>
                          {(summary.profitMargin || 0).toFixed(2)}%
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Minimal Financial Summary Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", tableLayout: "fixed" }}>
                <thead>
                  <tr style={{ backgroundColor: "#0f172a", color: "#ffffff" }}>
                    <th style={{ width: "70%", padding: "7px 10px", textAlign: "left", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>Account Description</th>
                    <th style={{ width: "30%", padding: "7px 10px", textAlign: "right", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>Amount (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Operating Income */}
                  <tr style={{ backgroundColor: "#f1f5f9", fontWeight: "bold", borderBottom: "1px solid #cbd5e1" }}>
                    <td style={{ padding: "8px 10px", color: "#0f172a", fontSize: "10px" }}>Operating Income</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}></td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "6px 16px", color: "#475569" }}>Sales / Revenue</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: "600", color: "#0f172a" }}>Rs. {formatCurrency(summary.totalRevenue)}</td>
                  </tr>
                  <tr style={{ backgroundColor: "#f8fafc", fontWeight: "bold", borderBottom: "1px solid #cbd5e1" }}>
                    <td style={{ padding: "6px 10px", color: "#0f172a" }}>Total Operating Income</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#0284c7" }}>Rs. {formatCurrency(summary.totalRevenue)}</td>
                  </tr>

                  {/* Cost of Goods Sold */}
                  <tr style={{ backgroundColor: "#f1f5f9", fontWeight: "bold", borderBottom: "1px solid #cbd5e1" }}>
                    <td style={{ padding: "8px 10px", color: "#0f172a", fontSize: "10px" }}>Cost of Goods Sold (COGS)</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#0f172a" }}>Rs. {formatCurrency(summary.totalCOGS)}</td>
                  </tr>

                  {/* Gross Profit */}
                  <tr style={{ backgroundColor: "#e2e8f0", fontWeight: "bold", borderBottom: "2px solid #94a3b8" }}>
                    <td style={{ padding: "8px 10px", color: "#0f172a", fontSize: "10px" }}>Gross Profit</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#0f172a", fontSize: "11px" }}>Rs. {formatCurrency(summary.grossProfit)}</td>
                  </tr>

                  {/* Operating Expenses */}
                  <tr style={{ backgroundColor: "#f1f5f9", fontWeight: "bold", borderBottom: "1px solid #cbd5e1" }}>
                    <td style={{ padding: "8px 10px", color: "#0f172a", fontSize: "10px" }}>Operating Expenses</td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}></td>
                  </tr>
                  {expensesByCategory.map((exp: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                      <td style={{ padding: "6px 16px", color: "#475569" }}>{exp.category}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: "600", color: "#0f172a" }}>Rs. {formatCurrency(exp.amount)}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: "#f8fafc", fontWeight: "bold", borderBottom: "1px solid #cbd5e1" }}>
                    <td style={{ padding: "6px 10px", color: "#0f172a" }}>Total Operating Expenses</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#ef4444" }}>Rs. {formatCurrency(summary.totalExpenses)}</td>
                  </tr>

                  {/* Operating Profit */}
                  <tr style={{ backgroundColor: "#0f172a", color: "#ffffff", fontWeight: "bold" }}>
                    <td style={{ padding: "10px", fontSize: "11px", textTransform: "uppercase" }}>Net Operating Profit</td>
                    <td style={{ padding: "10px", textAlign: "right", fontSize: "12px", color: "#38bdf8" }}>Rs. {formatCurrency(summary.operatingProfit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Content */}
      {hasSearched && !loading && (
        <div>

          {/* Summary Cards with Slider Layout - DONO ARROWS AB SHOW HONGE */}
          <div className="relative mb-6">
            {/* Left Arrow - Jab scroll ho ga tab show hoga */}
            {showLeftArrow && (
              <button
                onClick={scrollLeft}
                className="slider-arrows absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-zinc-900 rounded-full shadow-md p-1.5 border border-border hover:bg-accent transition-all lg:hidden"
                style={{ transform: "translateY(-50%)" }}
              >
                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
              </button>
            )}

            {/* Right Arrow - Jab end nahi aya tab show hoga */}
            {showRightArrow && (
              <button
                onClick={scrollRight}
                className="slider-arrows absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-zinc-900 rounded-full shadow-md p-1.5 border border-border hover:bg-accent transition-all lg:hidden"
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

          {/* Main Financial Table */}
          <Card className="bg-white shadow-sm border-border/50 overflow-x-auto">
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs sm:text-sm sm:min-w-[600px] min-w-full">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left font-semibold py-3 px-4 sm:px-6 text-muted-foreground">{tProfit("account")}</th>
                      <th className="text-right font-semibold py-3 px-4 sm:px-6 text-muted-foreground">{tProfit("total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Operating Income */}
                    <tr className="bg-[hsl(var(--soft-gray-bg))]">
                      <td colSpan={2} className="font-bold py-3 px-4 sm:px-6 text-sm sm:text-base text-foreground">{tProfit("operatingIncome")}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2.5 px-6 sm:px-10 text-muted-foreground">{tProfit("sales") || "Revenue"}</td>
                      <td className="text-right py-2.5 px-4 sm:px-6 font-medium">{formatCurrency(summary.totalRevenue)}</td>
                    </tr>
                    <tr className="bg-[hsl(var(--soft-gray-bg))] border-b">
                      <td className="font-bold py-3 px-4 sm:px-6 text-foreground">{tProfit("totalFor", { name: tProfit("operatingIncome") })}</td>
                      <td className="text-right font-bold py-3 px-4 sm:px-6">{formatCurrency(summary.totalRevenue)}</td>
                    </tr>

                    {/* Cost of Goods Sold */}
                    <tr className="bg-[hsl(var(--soft-gray-bg))]">
                      <td colSpan={2} className="font-bold py-3 px-4 sm:px-6 text-sm sm:text-base text-foreground mt-2">{tProfit("costOfGoodsSold")}</td>
                    </tr>
                    <tr className="bg-[hsl(var(--soft-gray-bg))] border-b">
                      <td className="font-bold py-3 px-4 sm:px-6 text-foreground">{tProfit("totalFor", { name: tProfit("costOfGoodsSold") })}</td>
                      <td className="text-right font-bold py-3 px-4 sm:px-6">{formatCurrency(summary.totalCOGS)}</td>
                    </tr>

                    {/* Gross Profit */}
                    <tr className="border-b-2 border-b-gray-300 bg-[hsl(var(--soft-gray-bg))]">
                      <td className="font-bold py-4 px-4 sm:px-6 text-sm sm:text-base">{tProfit("grossProfit")}</td>
                      <td className="text-right font-bold py-4 px-4 sm:px-6 text-sm sm:text-base">{formatCurrency(summary.grossProfit)}</td>
                    </tr>

                    {/* Operating Expense */}
                    <tr className="bg-[hsl(var(--soft-gray-bg))]">
                      <td colSpan={2} className="font-bold py-3 px-4 sm:px-6 text-sm sm:text-base text-foreground mt-2">{tProfit("operatingExpense")}</td>
                    </tr>
                    {expensesByCategory.map((exp: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2.5 px-6 sm:px-10 text-muted-foreground break-words whitespace-normal max-w-[150px] sm:max-w-none">{exp.category}</td>
                        <td className="text-right py-2.5 px-4 sm:px-6 font-medium">{formatCurrency(exp.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-b-gray-300 bg-[hsl(var(--soft-gray-bg))]">
                      <td className="font-bold py-3 px-4 sm:px-6 text-foreground border-t">{tProfit("totalFor", { name: tProfit("operatingExpense") })}</td>
                      <td className="text-right font-bold py-3 px-4 sm:px-6 border-t">{formatCurrency(summary.totalExpenses)}</td>
                    </tr>

                    {/* Operating Profit */}
                    <tr className="bg-[hsl(var(--soft-gray-bg))] font-bold border-t-2 border-t-gray-300">
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