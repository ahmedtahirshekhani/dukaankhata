// src/app/[locale]/admin/reports/sale-report/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReportPdfModal } from "@/components/reports/report-pdf-modal";
import { ReportPdfHeader, ReportPdfKpi, ReportPdfMetaItem } from "@/components/reports/report-pdf-header";
import { PdfTable, PdfTableColumn, PdfTableFooterCell } from "@/components/reports/pdf-table";
import { exportSaleReportToExcel } from "@/lib/excel";
import { formatCurrency } from "@/lib/utils";
import { toHTMLDateString, getDaysAgoHTMLDate, getTodayHTMLDate } from "@/lib/date-utils";
import { useDebounce } from "@/hooks/use-debounce";
import { usePermissions } from "@/hooks/use-permissions";
import { SaleReportInvoice, SaleReportSummary } from "@/types/reports";
import {
  TrendingUp,
  CreditCard,
  AlertCircle,
  Package,
  FileSpreadsheet,
  Printer,
  Loader2,
  Search,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Eye,
  CheckCircle2,
  Clock,
  X,
  Receipt,
} from "lucide-react";

export default function SaleReportPage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const t = useTranslations("saleReportPage");
  const { can } = usePermissions();

  // Date States
  const [fromDate, setFromDate] = useState<string>(() => getDaysAgoHTMLDate(30));
  const [toDate, setToDate] = useState<string>(() => getTodayHTMLDate());
  const [activePreset, setActivePreset] = useState<string>("thisMonth");

  // Filter States
  const [paymentStatus, setPaymentStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearch = useDebounce(searchTerm, 400);

  // Advanced Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("invoice_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Active advanced filters counter
  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (minAmount) count++;
    if (maxAmount) count++;
    if (sortBy !== "invoice_date" || sortOrder !== "asc") count++;
    return count;
  }, [minAmount, maxAmount, sortBy, sortOrder]);

  // Pagination & Data States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const [invoices, setInvoices] = useState<SaleReportInvoice[]>([]);
  const [summary, setSummary] = useState<SaleReportSummary>({
    totalSales: 0,
    totalReceived: 0,
    totalBalanceDue: 0,
    totalInvoicesCount: 0,
    totalItemsSold: 0,
    averageInvoiceValue: 0,
    fullyPaidCount: 0,
    unpaidCount: 0,
    partialCount: 0,
  });

  // Modal & Details States
  const [selectedInvoiceForDetails, setSelectedInvoiceForDetails] = useState<SaleReportInvoice | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfInvoices, setPdfInvoices] = useState<SaleReportInvoice[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  // Branding for PDF Report
  const [branding, setBranding] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    logo: null as string | null,
  });

  // Load Branding Assets
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
            logo: data.logoUrl || null,
          });
        }
      } catch (err) {
        console.error("Failed to load branding assets:", err);
      }
    };
    loadBranding();
  }, [locale]);

  // Fetch Report Data
  const fetchReportData = useCallback(
    async (overrideLimit?: number) => {
      try {
        if (!overrideLimit) setLoading(true);

        const params = new URLSearchParams();
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);
        if (paymentStatus && paymentStatus !== "all") {
          params.set("paymentStatus", paymentStatus);
        }
        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }
        if (minAmount) params.set("minAmount", minAmount);
        if (maxAmount) params.set("maxAmount", maxAmount);
        if (sortBy) params.set("sortBy", sortBy);
        if (sortOrder) params.set("sortOrder", sortOrder);

        const limitToUse = overrideLimit !== undefined ? overrideLimit : pageSize;
        const pageToUse = overrideLimit !== undefined ? 1 : currentPage;

        params.set("page", pageToUse.toString());
        params.set("limit", limitToUse.toString());

        const res = await fetch(`/${locale}/api/reports/sale-report?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to fetch sale report");
        }

        const data = await res.json();

        if (overrideLimit === -1) {
          return data;
        }

        setInvoices(data.invoices || []);
        setSummary(
          data.summary || {
            totalSales: 0,
            totalReceived: 0,
            totalBalanceDue: 0,
            totalInvoicesCount: 0,
            totalItemsSold: 0,
            averageInvoiceValue: 0,
            fullyPaidCount: 0,
            unpaidCount: 0,
            partialCount: 0,
          }
        );
        setTotalCount(data.pagination?.total || 0);
      } catch (error) {
        console.error("Error fetching sale report:", error);
      } finally {
        if (!overrideLimit) setLoading(false);
      }
    },
    [
      locale,
      fromDate,
      toDate,
      paymentStatus,
      debouncedSearch,
      minAmount,
      maxAmount,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
    ]
  );

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Preset Date Range Helper
  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    const now = new Date();

    switch (preset) {
      case "today": {
        const today = toHTMLDateString(now);
        setFromDate(today);
        setToDate(today);
        break;
      }
      case "yesterday": {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        const yDate = toHTMLDateString(y);
        setFromDate(yDate);
        setToDate(yDate);
        break;
      }
      case "thisWeek": {
        const first = new Date(now);
        const day = first.getDay();
        const diff = first.getDate() - day + (day === 0 ? -6 : 1);
        first.setDate(diff);
        setFromDate(toHTMLDateString(first));
        setToDate(toHTMLDateString(now));
        break;
      }
      case "lastWeek": {
        const lastSun = new Date(now);
        const day = lastSun.getDay();
        const diffToLastSun = day === 0 ? 7 : day;
        lastSun.setDate(now.getDate() - diffToLastSun);
        const lastMon = new Date(lastSun);
        lastMon.setDate(lastSun.getDate() - 6);
        setFromDate(toHTMLDateString(lastMon));
        setToDate(toHTMLDateString(lastSun));
        break;
      }
      case "thisMonth": {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        setFromDate(toHTMLDateString(firstDay));
        setToDate(toHTMLDateString(now));
        break;
      }
      case "lastMonth": {
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        setFromDate(toHTMLDateString(firstDayLastMonth));
        setToDate(toHTMLDateString(lastDayLastMonth));
        break;
      }
      case "thisYear": {
        const firstDayYear = new Date(now.getFullYear(), 0, 1);
        setFromDate(toHTMLDateString(firstDayYear));
        setToDate(toHTMLDateString(now));
        break;
      }
      case "allTime": {
        setFromDate("");
        setToDate("");
        break;
      }
    }
    setCurrentPage(1);
  };

  const handleFromDateChange = (date: string) => {
    setFromDate(date);
    setActivePreset("custom");
    setCurrentPage(1);
  };

  const handleToDateChange = (date: string) => {
    setToDate(date);
    setActivePreset("custom");
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    applyPreset("thisMonth");
    setPaymentStatus("all");
    setSearchTerm("");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("invoice_date");
    setSortOrder("asc");
    setCurrentPage(1);
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const allData = await fetchReportData(-1);
      const invoicesToExport = allData?.invoices || invoices;
      const summaryToExport = allData?.summary || summary;
      exportSaleReportToExcel(
        invoicesToExport,
        summaryToExport,
        `sale-report-${fromDate || "all"}-to-${toDate || "all"}.xlsx`
      );
    } catch (err) {
      console.error("Export Excel error:", err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const fullData = await fetchReportData(-1);
      const itemsToExport = fullData?.invoices && fullData.invoices.length > 0 ? fullData.invoices : invoices;
      setPdfInvoices(itemsToExport);

      await new Promise((resolve) => setTimeout(resolve, 400));

      if (!reportRef.current) return;

      const mod = await import("html2pdf.js");
      const html2pdf = (mod as any).default || mod;

      await html2pdf()
        .set({
          margin: [6, 6, 16, 6],
          filename: `sale-report-${fromDate || "all"}_to_${toDate || "all"}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            scrollY: 0,
            scrollX: 0,
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "landscape",
          },
          pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".pdf-avoid-break"] },
        })
        .from(reportRef.current)
        .toPdf()
        .get("pdf")
        .then((pdf: any) => {
          const totalPages = pdf.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFont("helvetica", "italic");
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184);
            pdf.text(
              tCommon("pdfWatermarkText") || "",
              297 / 2,
              210 - 5,
              { align: "center" }
            );
          }
        })
        .save();
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Status Badge Rendering Helper (neutral & consistent styling)
  const renderStatusBadge = (status: "paid" | "partial" | "unpaid", isTable: boolean = false) => {
    const baseClasses = isTable
      ? "text-[11px] font-semibold px-2 py-0.5 rounded-full border"
      : "text-xs font-semibold px-2.5 py-0.5 rounded-full border";

    switch (status) {
      case "paid":
        return (
          <span
            className={`${baseClasses} bg-zinc-100 text-foreground border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700`}
          >
            {t("paid")}
          </span>
        );
      case "partial":
        return (
          <span
            className={`${baseClasses} bg-zinc-100 text-foreground border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700`}
          >
            {t("partial")}
          </span>
        );
      case "unpaid":
        return (
          <span
            className={`${baseClasses} bg-zinc-100 text-foreground border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700`}
          >
            {t("unpaid")}
          </span>
        );
      default:
        return null;
    }
  };

  // Table Columns Definition (Flexible natural layout, uniform text-foreground)
  const columns: ColumnDef<SaleReportInvoice>[] = useMemo(
    () => [
      {
        id: "invoice_date",
        header: t("date"),
        accessorKey: "invoice_date",
        sortable: true,
        className: "whitespace-nowrap text-xs text-foreground",
        cell: (row) => {
          const d = row.invoice_date || row.created_at;
          return d
            ? new Date(d).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : "-";
        },
      },
      {
        id: "invoice_number",
        header: t("invoiceNo"),
        accessorKey: "invoice_number",
        sortable: true,
        className: "whitespace-nowrap font-mono text-xs font-semibold text-foreground",
        cell: (row) => (
          // View Modal trigger - To re-enable, uncomment the button below and remove the span:
          // <button
          //   type="button"
          //   onClick={() => setSelectedInvoiceForDetails(row)}
          //   className="text-foreground hover:underline font-mono text-xs text-left font-semibold"
          // >
          //   {row.invoice_number}
          // </button>
          <span className="font-mono text-xs font-semibold text-foreground">
            {row.invoice_number}
          </span>
        ),
      },
      {
        id: "customer_name",
        header: t("customerName"),
        accessorKey: "customer_name",
        sortable: true,
        className: "font-medium text-xs text-foreground",
        cell: (row) => row.customer_name || "-",
      },
      {
        id: "items",
        header: t("items"),
        className: "text-center text-xs text-foreground whitespace-nowrap",
        cell: (row) => (
          // View Modal trigger - To re-enable, uncomment the Button below and remove the div:
          // <Button
          //   variant="ghost"
          //   size="sm"
          //   onClick={() => setSelectedInvoiceForDetails(row)}
          //   className="h-6 px-2 text-[11px] font-medium gap-1 hover:bg-accent text-foreground"
          // >
          //   <Package className="h-3 w-3 text-foreground" />
          //   <span className="text-foreground">{row.items_count || row.items?.length || 0}</span>
          // </Button>
          <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-foreground">
            <Package className="h-3 w-3 text-foreground" />
            <span>{row.items_count || row.items?.length || 0}</span>
          </div>
        ),
      },
      {
        id: "total_amount",
        header: <div className="text-right text-foreground">{t("totalAmount")}</div>,
        accessorKey: "total_amount",
        sortable: true,
        className: "text-right font-bold text-xs text-foreground whitespace-nowrap",
        cell: (row) => formatCurrency(row.total_amount),
      },
      {
        id: "paid_amount",
        header: <div className="text-right text-foreground">{t("paidAmount")}</div>,
        accessorKey: "paid_amount",
        sortable: true,
        className: "text-right text-xs font-semibold text-foreground whitespace-nowrap",
        cell: (row) => formatCurrency(row.paid_amount),
      },
      {
        id: "balance_due",
        header: <div className="text-right text-foreground">{t("balance")}</div>,
        accessorKey: "balance_due",
        sortable: true,
        className: "text-right text-xs font-semibold text-foreground whitespace-nowrap",
        cell: (row) => formatCurrency(row.balance_due),
      },
      {
        id: "status",
        header: <div className="text-center text-foreground">{t("status")}</div>,
        className: "text-center text-foreground whitespace-nowrap",
        cell: (row) => <div className="flex justify-center">{renderStatusBadge(row.status, true)}</div>,
      },
      // View Modal Actions column - To re-enable, uncomment below:
      // {
      //   id: "actions",
      //   header: "",
      //   className: "text-right text-foreground whitespace-nowrap",
      //   cell: (row) => (
      //     <Button
      //       variant="ghost"
      //       size="icon"
      //       onClick={() => setSelectedInvoiceForDetails(row)}
      //       className="h-7 w-7 text-foreground hover:bg-accent"
      //       title={t("viewDetails")}
      //     >
      //       <Eye className="h-4 w-4 text-foreground" />
      //     </Button>
      //   ),
      // },
    ],
    [t]
  );

  // PDF Columns & KPIs
  const pdfColumns: PdfTableColumn<SaleReportInvoice>[] = useMemo(
    () => [
      {
        header: t("date"),
        align: "left",
        width: "90px",
        render: (row) => {
          const d = row.invoice_date || row.created_at;
          return d
            ? new Date(d).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : "-";
        },
      },
      {
        header: t("invoiceNo"),
        align: "left",
        width: "110px",
        render: (row) => row.invoice_number || "-",
      },
      {
        header: t("customerName"),
        align: "left",
        width: "160px",
        render: (row) => row.customer_name || "-",
      },
      {
        header: t("items"),
        align: "center",
        width: "55px",
        render: (row) => row.items_count || row.items?.length || 0,
      },
      {
        header: t("totalAmount"),
        align: "right",
        width: "100px",
        render: (row) => formatCurrency(row.total_amount),
      },
      {
        header: t("paidAmount"),
        align: "right",
        width: "95px",
        render: (row) => formatCurrency(row.paid_amount),
      },
      {
        header: t("balance"),
        align: "right",
        width: "95px",
        render: (row) => formatCurrency(row.balance_due),
      },
      {
        header: t("status"),
        align: "center",
        width: "80px",
        render: (row) => (
          <span
            style={{
              display: "inline-block",
              padding: "1px 6px",
              borderRadius: "12px",
              fontSize: "9px",
              fontWeight: 600,
              border: "1px solid #cbd5e1",
              backgroundColor: "#f1f5f9",
              color: "#0f172a",
            }}
          >
            {t(row.status)}
          </span>
        ),
      },
    ],
    [t]
  );

  const pdfKpis: ReportPdfKpi[] = useMemo(
    () => [
      {
        label: t("totalSales"),
        value: formatCurrency(summary.totalSales),
        subValue: `${summary.totalInvoicesCount} ${t("totalInvoices")}`,
      },
      {
        label: t("totalReceived"),
        value: formatCurrency(summary.totalReceived),
        subValue: `${summary.fullyPaidCount} ${t("paidInvoices")}`,
      },
      {
        label: t("balanceDue"),
        value: formatCurrency(summary.totalBalanceDue),
        subValue: `${summary.unpaidCount + summary.partialCount} ${t("unpaidInvoices")}`,
        highlight: summary.totalBalanceDue > 0,
      },
      {
        label: t("totalItems"),
        value: summary.totalItemsSold.toLocaleString(),
        subValue: `${t("avgInvoiceValue")}: ${formatCurrency(summary.averageInvoiceValue)}`,
      },
    ],
    [summary, t]
  );

  const pdfMetaItems: ReportPdfMetaItem[] = useMemo(() => {
    const meta: ReportPdfMetaItem[] = [];
    if (paymentStatus && paymentStatus !== "all") {
      meta.push({ label: t("paymentStatus"), value: t(paymentStatus as any) || paymentStatus });
    }
    return meta;
  }, [paymentStatus, t]);

  const pdfFooterCells: PdfTableFooterCell[] = useMemo(
    () => [
      { content: tCommon("total"), colSpan: 4, align: "left" },
      { content: formatCurrency(summary.totalSales), align: "right" },
      { content: formatCurrency(summary.totalReceived), align: "right" },
      { content: formatCurrency(summary.totalBalanceDue), align: "right" },
      { content: "", align: "center" },
    ],
    [summary, tCommon]
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Page Header */}
      <PageHeader
        backHref={`/${locale}/admin/reports`}
        title={t("title")}
        description={t("description")}
        actions={
          can("reports", "export_sale_report") && invoices.length > 0 ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={isExportingExcel || loading}
                className="h-8 text-xs px-2.5 gap-1.5 flex-1 sm:flex-initial"
              >
                {isExportingExcel ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                )}
                <span>{t("exportExcel")}</span>
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={handleExportPdf}
                disabled={isExportingPdf || loading || invoices.length === 0}
                className="h-8 text-xs px-2.5 gap-1.5 flex-1 sm:flex-initial bg-sky-600 hover:bg-sky-700 text-white"
              >
                {isExportingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                <span>{t("downloadPdf")}</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Date Presets Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: "today", label: tCommon("today") || "Today" },
          { key: "yesterday", label: tCommon("yesterday") || "Yesterday" },
          { key: "thisWeek", label: tCommon("thisWeek") || "This Week" },
          { key: "lastWeek", label: tCommon("lastWeek") || "Last Week" },
          { key: "thisMonth", label: tCommon("thisMonth") || "This Month" },
          { key: "lastMonth", label: tCommon("lastMonth") || "Last Month" },
          { key: "thisYear", label: tCommon("thisYear") || "This Year" },
          { key: "allTime", label: tCommon("allTime") || "All Time" },
        ].map((preset) => (
          <Button
            key={preset.key}
            variant={activePreset === preset.key ? "default" : "outline"}
            size="sm"
            onClick={() => applyPreset(preset.key)}
            className="h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Main Filters Card */}
      <Card className="border border-border/50 bg-card shadow-sm">
        <CardContent className="p-3.5 sm:p-4 space-y-3">
          {/* Row 1: Primary Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t("fromDate")}:
              </label>
              <DatePicker
                value={fromDate}
                max={toDate}
                onChange={handleFromDateChange}
                className="w-full h-8 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t("toDate")}:
              </label>
              <DatePicker
                value={toDate}
                min={fromDate}
                onChange={handleToDateChange}
                className="w-full h-8 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t("paymentStatus")}:
              </label>
              <Select
                value={paymentStatus}
                onValueChange={(val) => {
                  setPaymentStatus(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t("allStatuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allStatuses")}</SelectItem>
                  <SelectItem value="paid">{t("paid")}</SelectItem>
                  <SelectItem value="partial">{t("partial")}</SelectItem>
                  <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Search and Advanced Toggle */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-border/40">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t("searchPlaceholder")}
                className="h-8 text-xs pl-8 pr-7 w-full"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant={showAdvancedFilters || activeAdvancedFilterCount > 0 ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                className="h-8 text-xs px-2.5 gap-1.5"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>{t("filters")}</span>
                {activeAdvancedFilterCount > 0 && (
                  <span className="flex items-center justify-center h-4 w-4 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
                    {activeAdvancedFilterCount}
                  </span>
                )}
                {showAdvancedFilters ? (
                  <ChevronUp className="h-3.5 w-3.5 ml-0.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground gap-1"
                title={t("resetFilters")}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("resetFilters")}</span>
              </Button>
            </div>
          </div>

          {/* Expandable Advanced Filters */}
          {showAdvancedFilters && (
            <div className="p-3 rounded-lg bg-muted/40 border border-border/50 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  {t("minAmount")}:
                </label>
                <Input
                  type="number"
                  value={minAmount}
                  onChange={(e) => {
                    setMinAmount(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="0"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  {t("maxAmount")}:
                </label>
                <Input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => {
                    setMaxAmount(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="e.g. 100000"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  {t("sortBy")}:
                </label>
                <Select
                  value={`${sortBy}-${sortOrder}`}
                  onValueChange={(val) => {
                    const [field, order] = val.split("-");
                    setSortBy(field);
                    setSortOrder(order as "asc" | "desc");
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={t("sortBy")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice_date-asc">{t("sortDateAsc")}</SelectItem>
                    <SelectItem value="invoice_date-desc">{t("sortDateDesc")}</SelectItem>
                    <SelectItem value="total_amount-desc">{t("sortAmountDesc")}</SelectItem>
                    <SelectItem value="total_amount-asc">{t("sortAmountAsc")}</SelectItem>
                    <SelectItem value="balance_due-desc">{t("sortBalanceDesc")}</SelectItem>
                    <SelectItem value="customer_name-asc">{t("sortCustomer")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Summary StatCards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title={t("totalSales")}
          value={formatCurrency(summary.totalSales)}
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
          subValue={`${summary.totalInvoicesCount} ${t("totalInvoices")}`}
          isLoading={loading}
        />

        <StatCard
          title={t("totalReceived")}
          value={formatCurrency(summary.totalReceived)}
          icon={<CreditCard className="h-4 w-4 text-emerald-600" />}
          subValue={`${summary.fullyPaidCount} ${t("paidInvoices")}`}
          isLoading={loading}
        />

        <StatCard
          title={t("balanceDue")}
          value={formatCurrency(summary.totalBalanceDue)}
          icon={<AlertCircle className="h-4 w-4 text-rose-600" />}
          subValue={`${summary.unpaidCount + summary.partialCount} ${t("unpaidInvoices")}`}
          isExpense={summary.totalBalanceDue > 0}
          isLoading={loading}
        />

        <StatCard
          title={t("totalItems")}
          value={summary.totalItemsSold.toLocaleString()}
          icon={<Package className="h-4 w-4 text-violet-600" />}
          subValue={`${t("avgInvoiceValue")}: ${formatCurrency(summary.averageInvoiceValue)}`}
          isLoading={loading}
        />
      </div>

      {/* Main Data Table */}
      <DataTable<SaleReportInvoice>
        columns={columns}
        data={invoices}
        isLoading={loading}
        pageSize={pageSize}
        currentPage={currentPage}
        totalCount={totalCount}
        onPageChange={(p: number) => setCurrentPage(p)}
        onPageSizeChange={(s: number) => {
          setPageSize(s);
          setCurrentPage(1);
        }}
        emptyMessage={t("noData")}
        keyExtractor={(row: SaleReportInvoice) => row.id}
        renderMobileCard={(row: SaleReportInvoice) => (
          <div
            // View Modal trigger - To re-enable, uncomment the onClick below:
            // onClick={() => setSelectedInvoiceForDetails(row)}
            className="p-3.5 border rounded-lg bg-card shadow-xs space-y-2.5 text-xs transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono font-bold text-foreground">{row.invoice_number}</span>
                <p className="font-semibold text-foreground text-sm mt-0.5">{row.customer_name}</p>
                <p className="text-[11px] text-foreground/75">
                  {row.invoice_date || row.created_at
                    ? new Date(row.invoice_date || row.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "-"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {renderStatusBadge(row.status, true)}
                <span className="text-[11px] text-foreground">
                  {row.items_count} {t("items")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px]">{t("totalAmount")}</span>
                <span className="font-bold text-foreground">{formatCurrency(row.total_amount)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">{t("paidAmount")}</span>
                <span className="font-semibold text-foreground">{formatCurrency(row.paid_amount)}</span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground block text-[10px]">{t("balance")}</span>
                <span className="font-bold text-foreground">{formatCurrency(row.balance_due)}</span>
              </div>
            </div>
          </div>
        )}
      />

      {/* ========================================================
          INVOICE DETAILS MODAL (VIEW MODAL)
          Currently commented out safely.
          To re-enable: Remove the `{/*` above <Dialog and `* /}` below </Dialog>
          ======================================================== */}
      {/*
      <Dialog
        open={Boolean(selectedInvoiceForDetails)}
        onOpenChange={(open) => !open && setSelectedInvoiceForDetails(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedInvoiceForDetails && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-4">
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    <span>{t("invoiceDetails")}</span>
                  </DialogTitle>
                  {renderStatusBadge(selectedInvoiceForDetails.status)}
                </div>
                <DialogDescription className="text-xs text-muted-foreground text-left">
                  {t("invoiceDetailsDescription")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">{t("invoiceNo")}:</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedInvoiceForDetails.invoice_number}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">{t("date")}:</span>
                  <span className="font-medium text-foreground">
                    {selectedInvoiceForDetails.invoice_date || selectedInvoiceForDetails.created_at
                      ? new Date(
                          selectedInvoiceForDetails.invoice_date || selectedInvoiceForDetails.created_at
                        ).toLocaleDateString("en-GB")
                      : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">{t("customerName")}:</span>
                  <span className="font-bold text-foreground truncate block">
                    {selectedInvoiceForDetails.customer_name}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">{t("paymentMethod")}:</span>
                  <span className="font-medium text-foreground">
                    {selectedInvoiceForDetails.payment_method_name || "-"}
                  </span>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-3 py-2 font-semibold text-foreground border-b flex justify-between items-center">
                    <span>{t("itemsList")}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedInvoiceForDetails.items?.length || 0} items
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px]">
                        <TableHead className="h-8">#</TableHead>
                        <TableHead className="h-8">{t("productName")}</TableHead>
                        <TableHead className="h-8 text-center">{t("quantity")}</TableHead>
                        <TableHead className="h-8 text-right">{t("unitPrice")}</TableHead>
                        <TableHead className="h-8 text-right">{t("amount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoiceForDetails.items?.length ? (
                        selectedInvoiceForDetails.items.map((item, idx) => (
                          <TableRow key={idx} className="text-xs">
                            <TableCell className="py-2 text-foreground">{idx + 1}</TableCell>
                            <TableCell className="py-2 font-medium text-foreground">{item.product_name}</TableCell>
                            <TableCell className="py-2 text-center text-foreground">{item.quantity}</TableCell>
                            <TableCell className="py-2 text-right text-foreground">{formatCurrency(item.unit_price)}</TableCell>
                            <TableCell className="py-2 text-right font-semibold text-foreground">
                              {formatCurrency(item.amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                            {t("noData")}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="p-3 rounded-lg bg-card border flex flex-col items-end gap-1.5 text-xs text-foreground">
                  <div className="flex justify-between w-48 text-foreground">
                    <span className="text-muted-foreground">{t("totalAmount")}:</span>
                    <span className="font-bold text-foreground">
                      {formatCurrency(selectedInvoiceForDetails.total_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between w-48 text-foreground">
                    <span className="text-muted-foreground">{t("paidAmount")}:</span>
                    <span className="font-semibold text-foreground">{formatCurrency(selectedInvoiceForDetails.paid_amount)}</span>
                  </div>
                  <div className="flex justify-between w-48 font-bold border-t pt-1.5 text-foreground">
                    <span>{t("balance")}:</span>
                    <span>{formatCurrency(selectedInvoiceForDetails.balance_due)}</span>
                  </div>
                </div>

                {selectedInvoiceForDetails.notes && (
                  <div className="p-2.5 rounded-md bg-muted/30 border text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground block mb-0.5">{t("note")}:</span>
                    {selectedInvoiceForDetails.notes}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setSelectedInvoiceForDetails(null)}>
                  {tCommon("cancel") || "Close"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      */}

      {/* PDF Export Modal */}
      <ReportPdfModal
        isOpen={isExportingPdf}
        onOpenChange={setIsExportingPdf}
        title="PDF Report Preview"
        description="Preparing & downloading your Sale Report PDF..."
        reportRef={reportRef}
        width="1050px"
        isPortrait={false}
      >
        <ReportPdfHeader
          branding={branding}
          title="SALE REPORT"
          fromDate={fromDate}
          toDate={toDate}
          metaItems={pdfMetaItems}
          kpis={pdfKpis}
        />

        <PdfTable
          columns={pdfColumns}
          data={pdfInvoices}
          footerCells={pdfFooterCells}
          emptyMessage={t("noData")}
        />
      </ReportPdfModal>
    </div>
  );
}
