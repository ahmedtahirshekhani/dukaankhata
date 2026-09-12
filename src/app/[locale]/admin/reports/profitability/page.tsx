// src/app/[locale]/admin/reports/profitability/page.tsx

"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
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
  Loader2,
} from "lucide-react";
import { exportProfitabilityToExcel } from "@/lib/excel";
import { formatCurrency } from "@/lib/utils";
import { ReportPdfHeader, ReportPdfKpi } from "@/components/reports/report-pdf-header";
import { ReportPdfModal } from "@/components/reports/report-pdf-modal";

export default function ProfitabilityReportPage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
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

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
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

  const isFormValid = useMemo(() => Boolean(fromDate && toDate), [fromDate, toDate]);

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

  const pdfKpis: ReportPdfKpi[] = useMemo(() => [
    { label: "Total Sales", value: formatCurrency(summary.totalRevenue) },
    { label: "Total Expenses", value: formatCurrency(summary.totalExpenses) },
    { label: "Net Profit", value: formatCurrency(summary.operatingProfit), highlight: true },
    { label: "Profit Margin", value: `${(summary.profitMargin || 0).toFixed(2)}%`, highlight: true },
  ], [summary]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Reusable PageHeader */}
      <PageHeader
        title={tProfit("title") || "Profitability Report"}
        description={tProfit("description") || "Track business revenue, expenses, and net profit margins"}
        actions={
          can("reports", "export_profitability") ? (
            <div className="flex flex-col items-end gap-1 shrink-0">
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
            </div>
          ) : undefined
        }
      />

      {/* Date Filter */}
      <Card className="bg-card shadow-sm border-border/50">
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
                className="text-xs sm:text-sm h-8"
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 sm:gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-1.5">
                {tCommon("from") || "From"}
              </label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setActivePreset("");
                }}
                className="w-full text-xs sm:text-sm"
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="text-xs sm:text-sm font-medium text-muted-foreground block mb-1.5">
                {tCommon("to") || "To"}
              </label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setActivePreset("");
                }}
                className="w-full text-xs sm:text-sm"
              />
            </div>
            <div className="flex items-end col-span-1 sm:col-span-2">
              <Button
                onClick={handleGenerateReport}
                disabled={!isFormValid || loading}
                className="w-full text-xs sm:text-sm h-9 sm:h-10"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tCommon("loading")}
                  </>
                ) : (
                  tProfit("generate") || "Generate Report"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {hasSearched && !loading && (
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Summary Cards with Reusable StatCard Grid */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard
              title={tProfit("totalRevenue") || "Total Revenue"}
              value={formatCurrency(summary.totalRevenue)}
              subValue={`${summary.totalOrders || 0} ${tProfit("orders") || "Orders"}`}
              icon={TrendingUp}
            />
            <StatCard
              title={tProfit("totalExpenses") || "Total Expenses"}
              value={formatCurrency(summary.totalExpenses)}
              subValue={`${summary.totalExpenseItems || 0} ${tProfit("expenses") || "Expenses"}`}
              icon={TrendingDown}
            />
            <StatCard
              title={tProfit("netProfit") || "Net Profit"}
              value={formatCurrency(summary.operatingProfit)}
              subValue={`${((summary.operatingProfit / (summary.totalRevenue || 1)) * 100).toFixed(2)}% ${tProfit("margin") || "Margin"}`}
              icon={DollarSign}
            />
            <StatCard
              title={tProfit("profitMargin") || "Profit Margin"}
              value={`${(summary.profitMargin || 0).toFixed(2)}%`}
              subValue={tProfit("marginDescription") || "Overall Margin"}
              icon={Percent}
            />
          </div>

          {/* Main Financial Table */}
          <Card className="bg-card shadow-sm border-border/50 overflow-x-auto">
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs sm:text-sm sm:min-w-[600px] min-w-full">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left font-semibold py-3 px-4 sm:px-6 text-muted-foreground">{tProfit("account") || "Account"}</th>
                      <th className="text-right font-semibold py-3 px-4 sm:px-6 text-muted-foreground">{tProfit("total") || "Total"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Operating Income */}
                    <tr className="bg-muted/30">
                      <td colSpan={2} className="font-bold py-3 px-4 sm:px-6 text-sm sm:text-base text-foreground">{tProfit("operatingIncome") || "Operating Income"}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2.5 px-6 sm:px-10 text-muted-foreground">Invoices / Orders</td>
                      <td className="text-right py-2.5 px-4 sm:px-6 font-medium">{formatCurrency(summary.ordersRevenue || 0)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2.5 px-6 sm:px-10 text-muted-foreground">Counter Sales</td>
                      <td className="text-right py-2.5 px-4 sm:px-6 font-medium">{formatCurrency(summary.counterSalesRevenue || 0)}</td>
                    </tr>
                    <tr className="bg-muted/30 border-b">
                      <td className="font-bold py-3 px-4 sm:px-6 text-foreground">{tProfit("totalFor", { name: tProfit("operatingIncome") || "Operating Income" })}</td>
                      <td className="text-right font-bold py-3 px-4 sm:px-6">{formatCurrency(summary.totalRevenue)}</td>
                    </tr>

                    {/* Cost of Goods Sold */}
                    <tr className="bg-muted/30">
                      <td colSpan={2} className="font-bold py-3 px-4 sm:px-6 text-sm sm:text-base text-foreground mt-2">{tProfit("costOfGoodsSold") || "Cost of Goods Sold (COGS)"}</td>
                    </tr>
                    <tr className="bg-muted/30 border-b">
                      <td className="font-bold py-3 px-4 sm:px-6 text-foreground">{tProfit("totalFor", { name: tProfit("costOfGoodsSold") || "Cost of Goods Sold" })}</td>
                      <td className="text-right font-bold py-3 px-4 sm:px-6">{formatCurrency(summary.totalCOGS)}</td>
                    </tr>

                    {/* Gross Profit */}
                    <tr className="border-b-2 border-b-muted-foreground/30 bg-muted/40">
                      <td className="font-bold py-4 px-4 sm:px-6 text-sm sm:text-base">{tProfit("grossProfit") || "Gross Profit"}</td>
                      <td className="text-right font-bold py-4 px-4 sm:px-6 text-sm sm:text-base">{formatCurrency(summary.grossProfit)}</td>
                    </tr>

                    {/* Operating Expense */}
                    <tr className="bg-muted/30">
                      <td colSpan={2} className="font-bold py-3 px-4 sm:px-6 text-sm sm:text-base text-foreground mt-2">{tProfit("operatingExpense") || "Operating Expenses"}</td>
                    </tr>
                    {expensesByCategory.map((exp: any, idx: number) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2.5 px-6 sm:px-10 text-muted-foreground break-words whitespace-normal max-w-[150px] sm:max-w-none">{exp.category}</td>
                        <td className="text-right py-2.5 px-4 sm:px-6 font-medium">{formatCurrency(exp.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-b-muted-foreground/30 bg-muted/30">
                      <td className="font-bold py-3 px-4 sm:px-6 text-foreground border-t">{tProfit("totalFor", { name: tProfit("operatingExpense") || "Operating Expenses" })}</td>
                      <td className="text-right font-bold py-3 px-4 sm:px-6 border-t">{formatCurrency(summary.totalExpenses)}</td>
                    </tr>

                    {/* Operating Profit */}
                    <tr className="bg-muted/50 font-bold border-t-2 border-t-muted-foreground/40">
                      <td className="font-extrabold py-4 px-4 sm:px-6 text-base sm:text-lg text-foreground">{tProfit("operatingProfit") || "Operating Profit"}</td>
                      <td className="text-right font-extrabold py-4 px-4 sm:px-6 text-base sm:text-lg">{formatCurrency(summary.operatingProfit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* No Data State */}
          {summary.totalRevenue === 0 && summary.totalExpenses === 0 && (
            <Card className="bg-card shadow-sm border-border/50 mt-4">
              <CardContent className="py-8 sm:py-12 text-center">
                <p className="text-muted-foreground text-sm sm:text-base">{tProfit("noData") || "No data found for the selected period."}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="bg-card shadow-sm border-border/50">
          <CardContent className="py-8 sm:py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm sm:text-base">{tCommon("loading")}</p>
          </CardContent>
        </Card>
      )}

      {/* PDF Preview & Auto-Download Modal */}
      <ReportPdfModal
        isOpen={isExportingPdf}
        onOpenChange={setIsExportingPdf}
        title="PDF Report Preview"
        description="Preparing & downloading your A4 profitability report PDF..."
        reportRef={reportRef}
        width="700px"
        isPortrait={true}
      >
        {/* Reusable Global Report PDF Header with Branding, Meta & KPIs */}
        <ReportPdfHeader
          branding={branding}
          title="PROFITABILITY REPORT"
          fromDate={fromDate}
          toDate={toDate}
          kpis={pdfKpis}
        />

        {/* Financial Summary Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ backgroundColor: "#0f172a", color: "#ffffff" }}>
              <th style={{ width: "70%", padding: "7px 10px", textAlign: "left", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>Account Description</th>
              <th style={{ width: "30%", padding: "7px 10px", textAlign: "right", fontWeight: "700", textTransform: "uppercase", fontSize: "9px" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {/* Operating Income */}
            <tr style={{ backgroundColor: "#f1f5f9", fontWeight: "bold", borderBottom: "1px solid #cbd5e1" }}>
              <td style={{ padding: "8px 10px", color: "#0f172a", fontSize: "10px" }}>Operating Income</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}></td>
            </tr>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "6px 16px", color: "#475569" }}>Invoices / Orders</td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: "500", color: "#475569" }}>{formatCurrency(summary.ordersRevenue || 0)}</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={{ padding: "6px 16px", color: "#475569" }}>Counter Sales</td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: "500", color: "#475569" }}>{formatCurrency(summary.counterSalesRevenue || 0)}</td>
            </tr>
            <tr style={{ backgroundColor: "#f8fafc", fontWeight: "bold", borderBottom: "1px solid #cbd5e1" }}>
              <td style={{ padding: "6px 10px", color: "#0f172a" }}>Total Operating Income</td>
              <td style={{ padding: "6px 10px", textAlign: "right", color: "#0284c7" }}>{formatCurrency(summary.totalRevenue)}</td>
            </tr>

            {/* Cost of Goods Sold */}
            <tr style={{ backgroundColor: "#f1f5f9", fontWeight: "bold", borderBottom: "1px solid #cbd5e1" }}>
              <td style={{ padding: "8px 10px", color: "#0f172a", fontSize: "10px" }}>Cost of Goods Sold (COGS)</td>
              <td style={{ padding: "8px 10px", textAlign: "right", color: "#0f172a" }}>{formatCurrency(summary.totalCOGS)}</td>
            </tr>

            {/* Gross Profit */}
            <tr style={{ backgroundColor: "#e2e8f0", fontWeight: "bold", borderBottom: "2px solid #94a3b8" }}>
              <td style={{ padding: "8px 10px", color: "#0f172a", fontSize: "10px" }}>Gross Profit</td>
              <td style={{ padding: "8px 10px", textAlign: "right", color: "#0f172a", fontSize: "11px" }}>{formatCurrency(summary.grossProfit)}</td>
            </tr>

            {/* Operating Expenses */}
            <tr style={{ backgroundColor: "#f1f5f9", fontWeight: "bold", borderBottom: "1px solid #cbd5e1" }}>
              <td style={{ padding: "8px 10px", color: "#0f172a", fontSize: "10px" }}>Operating Expenses</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}></td>
            </tr>
            {expensesByCategory.map((exp: any, idx: number) => (
              <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                <td style={{ padding: "6px 16px", color: "#475569" }}>{exp.category}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: "600", color: "#0f172a" }}>{formatCurrency(exp.amount)}</td>
              </tr>
            ))}
            <tr style={{ backgroundColor: "#f8fafc", fontWeight: "bold", borderBottom: "1px solid #cbd5e1" }}>
              <td style={{ padding: "6px 10px", color: "#0f172a" }}>Total Operating Expenses</td>
              <td style={{ padding: "6px 10px", textAlign: "right", color: "#ef4444" }}>{formatCurrency(summary.totalExpenses)}</td>
            </tr>

            {/* Operating Profit */}
            <tr style={{ backgroundColor: "#0f172a", color: "#ffffff", fontWeight: "bold" }}>
              <td style={{ padding: "10px", fontSize: "11px", textTransform: "uppercase" }}>Net Operating Profit</td>
              <td style={{ padding: "10px", textAlign: "right", fontSize: "12px", color: "#38bdf8" }}>{formatCurrency(summary.operatingProfit)}</td>
            </tr>
          </tbody>
        </table>
      </ReportPdfModal>
    </div>
  );
}