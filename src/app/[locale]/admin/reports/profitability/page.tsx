// src/app/[locale]/admin/reports/profitability/page.tsx

"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardFooter,
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
  const tNav = useTranslations("navigation");
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
    totalExpenses: 0,
    netProfit: 0,
    profitMargin: 0,
    totalOrders: 0,
    totalExpenseItems: 0,
    avgOrderValue: 0,
    avgExpenseValue: 0,
  });
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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
    const pdfHeader = reportRef.current.querySelector(".pdf-header") as HTMLElement;
    try {
      if (pdfHeader) pdfHeader.style.display = "block";
      reportRef.current.classList.add("is-exporting");

      const mod = await import("html2pdf.js");
      const html2pdf = (mod as any).default || mod;

      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename: `profitability-report-${fromDate}_to_${toDate}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "landscape",
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
              210 - 4,
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
  }, [fromDate, toDate, tCommon]);

  // Excel Export
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await fetchReport(true);
      setTimeout(() => {
        exportProfitabilityToExcel(
          { summary, breakdown, expenses },
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
      bgClass: "bg-green-50/50 dark:bg-green-950/20",
      iconClass: "text-green-500",
      borderClass: "hover:border-green-500/20"
    },
    {
      title: tProfit("totalExpenses"),
      value: formatCurrency(summary.totalExpenses),
      currency: "PKR",
      subValue: `${summary.totalExpenseItems || 0} ${tProfit("expenses")}`,
      icon: TrendingDown,
      bgClass: "bg-red-50/50 dark:bg-red-950/20",
      iconClass: "text-red-500",
      borderClass: "hover:border-red-500/20"
    },
    {
      title: tProfit("netProfit"),
      value: formatCurrency(summary.netProfit),
      currency: "PKR",
      subValue: `${((summary.netProfit / (summary.totalRevenue || 1)) * 100).toFixed(2)}% ${tProfit("margin")}`,
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
    }
  ], [summary, tProfit]);

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
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent">
              {tProfit("title")}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {tProfit("description")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={isExportingPdf || !hasSearched}
              className="w-full sm:w-auto h-10 px-4 rounded-xl border-gray-200 shadow-sm"
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
              className="w-full sm:w-auto h-10 px-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 bg-[#7CD2F1] hover:bg-[#6bc2e1] text-white border-none"
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
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{tProfit("fromDate")}</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{tProfit("toDate")}</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-2"
              />
            </div>
            <div className="flex items-end col-span-1 md:col-span-2">
              <Button
                onClick={handleGenerateReport}
                disabled={!isFormValid || loading}
                className="w-full"
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

      {/* Summary Cards with Slider */}
      {hasSearched && !loading && (
        <>
          <div className="relative">
            {/* Left Arrow */}
            {showLeftArrow && (
              <button
                onClick={scrollLeft}
                type="button"
                aria-label="Scroll summary cards left"
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-zinc-900 rounded-full shadow-md p-1.5 border border-border hover:bg-accent transition-all lg:hidden"
              >
                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
              </button>
            )}

            {/* Right Arrow */}
            {showRightArrow && (
              <button
                onClick={scrollRight}
                type="button"
                aria-label="Scroll summary cards right"
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-zinc-900 rounded-full shadow-md p-1.5 border border-border hover:bg-accent transition-all lg:hidden"
              >
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            )}

            {/* Slider Track */}
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
          </div>

          {/* Report Content */}
          <div ref={reportRef}>
            {/* PDF Header (hidden) */}
            <div className="pdf-header hidden bg-white p-6 rounded-lg mb-6">
              <div className="flex items-start gap-6">
                {branding.logo && (
                  <Image
                    src={branding.logo}
                    alt={branding.name}
                    width={80}
                    height={80}
                    className="rounded"
                  />
                )}
                <div>
                  <h2 className="text-2xl font-bold">{branding.name}</h2>
                  <p className="text-sm text-muted-foreground">{branding.address}</p>
                  <p className="text-sm text-muted-foreground">{branding.phone}</p>
                  <p className="text-sm text-muted-foreground">{branding.email}</p>
                </div>
              </div>
            </div>

            {/* Revenue Breakdown Table */}
            {breakdown.length > 0 && (
              <Card className="bg-white shadow-sm border-border/50">
                <CardContent className="p-5 overflow-x-auto">
                  <h3 className="text-sm font-semibold mb-4">{tProfit("revenueBreakdown")}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">{tProfit("category")}</TableHead>
                        <TableHead className="text-right font-semibold">{tProfit("revenue")}</TableHead>
                        <TableHead className="text-right font-semibold">{tProfit("orders")}</TableHead>
                        <TableHead className="text-right font-semibold">{tProfit("avgValue")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakdown.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.category}</TableCell>
                          <TableCell className="text-right text-emerald-600 font-semibold">
                            Rs. {formatCurrency(item.revenue || 0)}
                          </TableCell>
                          <TableCell className="text-right">{item.orders}</TableCell>
                          <TableCell className="text-right">
                            Rs. {formatCurrency((item.revenue || 0) / (item.orders || 1))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Top Expenses Table */}
            {expenses.length > 0 && (
              <Card className="bg-white shadow-sm border-border/50 mt-6">
                <CardContent className="p-5 overflow-x-auto">
                  <h3 className="text-sm font-semibold mb-4">{tProfit("topExpenses")}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-semibold">{tProfit("category")}</TableHead>
                        <TableHead className="font-semibold">{tProfit("expenseDescription")}</TableHead>
                        <TableHead className="text-right font-semibold">{tProfit("amount")}</TableHead>
                        <TableHead className="font-semibold">{tProfit("date")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense: any) => (
                        <TableRow key={expense._id || expense.id}>
                          <TableCell className="font-medium">{expense.category}</TableCell>
                          <TableCell className="text-muted-foreground">{expense.description}</TableCell>
                          <TableCell className="text-right text-rose-600 font-semibold">
                            Rs. {formatCurrency(expense.amount || 0)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(expense.date).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
                {totalPages > 1 && (
                  <CardFooter className="pt-4 justify-between">
                    <span className="text-sm text-muted-foreground">
                      {tCommon("page")} {currentPage} {tCommon("of")} {totalPages}
                    </span>
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </CardFooter>
                )}
              </Card>
            )}

            {/* No Data State */}
            {breakdown.length === 0 && expenses.length === 0 && (
              <Card className="bg-white shadow-sm border-border/50">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">{tProfit("noData")}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="bg-white shadow-sm border-border/50">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">{tCommon("loading")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
