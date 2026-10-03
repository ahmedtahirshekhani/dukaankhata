"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import { PartyDropdown } from "@/components/dropdown/party-dropdown";
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
import { exportPurchaseReportToExcel } from "@/lib/excel";
import { formatCurrency } from "@/lib/utils";
import { toHTMLDateString, getDaysAgoHTMLDate, getTodayHTMLDate } from "@/lib/date-utils";
import { useDebounce } from "@/hooks/use-debounce";
import { usePermissions } from "@/hooks/use-permissions";
import { PurchaseReportBill, PurchaseReportSummary } from "@/types/reports";
import {
  ShoppingCart,
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

export default function PurchaseReportPage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const t = useTranslations("purchaseReportPage");
  const { can } = usePermissions();

  // Date States
  const [fromDate, setFromDate] = useState<string>(() => getDaysAgoHTMLDate(30));
  const [toDate, setToDate] = useState<string>(() => getTodayHTMLDate());
  const [activePreset, setActivePreset] = useState<string>("thisMonth");

  // Filter States
  const [selectedPartyId, setSelectedPartyId] = useState<string>("all");
  const [selectedPartyName, setSelectedPartyName] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearch = useDebounce(searchTerm, 400);

  // Advanced Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("bill_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Pagination & Data States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const [bills, setBills] = useState<PurchaseReportBill[]>([]);
  const [summary, setSummary] = useState<PurchaseReportSummary>({
    totalPurchases: 0,
    totalPaid: 0,
    totalBalanceDue: 0,
    totalBillsCount: 0,
    totalItemsPurchased: 0,
    averageBillValue: 0,
    fullyPaidCount: 0,
    unpaidCount: 0,
    partialCount: 0,
  });

  // Modal & Details States
  const [selectedBillForDetails, setSelectedBillForDetails] = useState<PurchaseReportBill | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfBills, setPdfBills] = useState<PurchaseReportBill[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  // Branding for PDF Report
  const [branding, setBranding] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    logo: null as string | null,
  });

  // Load Branding
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
    async (fetchAllForExport = false) => {
      try {
        if (!fetchAllForExport) setLoading(true);

        const params = new URLSearchParams();
        if (fromDate) params.set("fromDate", fromDate);
        if (toDate) params.set("toDate", toDate);
        if (selectedPartyId && selectedPartyId !== "all") params.set("partyId", selectedPartyId);
        if (paymentStatus && paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (minAmount) params.set("minAmount", minAmount);
        if (maxAmount) params.set("maxAmount", maxAmount);
        params.set("sortBy", sortBy);
        params.set("sortOrder", sortOrder);

        if (fetchAllForExport) {
          params.set("limit", "-1");
        } else {
          params.set("page", String(currentPage));
          params.set("limit", String(pageSize));
        }

        const res = await fetch(`/${locale}/api/reports/purchase-report?${params.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to fetch purchase report data");
        }

        const data = await res.json();

        if (fetchAllForExport) {
          return data;
        }

        setBills(data.bills || []);
        setSummary(
          data.summary || {
            totalPurchases: 0,
            totalPaid: 0,
            totalBalanceDue: 0,
            totalBillsCount: 0,
            totalItemsPurchased: 0,
            averageBillValue: 0,
            fullyPaidCount: 0,
            unpaidCount: 0,
            partialCount: 0,
          }
        );
        setTotalCount(data.pagination?.total || 0);
      } catch (error) {
        console.error("Error fetching purchase report:", error);
      } finally {
        if (!fetchAllForExport) setLoading(false);
      }
    },
    [
      fromDate,
      toDate,
      selectedPartyId,
      paymentStatus,
      debouncedSearch,
      minAmount,
      maxAmount,
      sortBy,
      sortOrder,
      currentPage,
      pageSize,
      locale,
    ]
  );

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Date Preset Handler
  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    const today = new Date();

    if (preset === "today") {
      const d = toHTMLDateString(today);
      setFromDate(d);
      setToDate(d);
    } else if (preset === "yesterday") {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const d = toHTMLDateString(yest);
      setFromDate(d);
      setToDate(d);
    } else if (preset === "thisWeek") {
      const dayOfWeek = today.getDay(); // 0 is Sun
      const start = new Date(today);
      start.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      setFromDate(toHTMLDateString(start));
      setToDate(toHTMLDateString(today));
    } else if (preset === "lastWeek") {
      const dayOfWeek = today.getDay();
      const end = new Date(today);
      end.setDate(today.getDate() - (dayOfWeek === 0 ? 7 : dayOfWeek));
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      setFromDate(toHTMLDateString(start));
      setToDate(toHTMLDateString(end));
    } else if (preset === "thisMonth") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(toHTMLDateString(start));
      setToDate(toHTMLDateString(today));
    } else if (preset === "lastMonth") {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setFromDate(toHTMLDateString(start));
      setToDate(toHTMLDateString(end));
    } else if (preset === "thisYear") {
      const start = new Date(today.getFullYear(), 0, 1);
      setFromDate(toHTMLDateString(start));
      setToDate(toHTMLDateString(today));
    } else if (preset === "allTime") {
      setFromDate("2020-01-01");
      setToDate(toHTMLDateString(today));
    }
    setCurrentPage(1);
  };

  const handleFromDateChange = (val: string) => {
    setFromDate(val);
    setActivePreset("");
    if (toDate && val > toDate) {
      setToDate(val);
    }
    setCurrentPage(1);
  };

  const handleToDateChange = (val: string) => {
    setActivePreset("");
    if (fromDate && val < fromDate) {
      setToDate(fromDate);
    } else {
      setToDate(val);
    }
    setCurrentPage(1);
  };

  // Reset Filters
  const handleResetFilters = () => {
    applyPreset("thisMonth");
    setSelectedPartyId("all");
    setSelectedPartyName("");
    setPaymentStatus("all");
    setSearchTerm("");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("bill_date");
    setSortOrder("asc");
    setCurrentPage(1);
  };

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (minAmount) count++;
    if (maxAmount) count++;
    if (sortBy !== "bill_date" || sortOrder !== "asc") count++;
    return count;
  }, [minAmount, maxAmount, sortBy, sortOrder]);

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const fullData = await fetchReportData(true);
      const exportBills = fullData?.bills || bills;
      const exportSummary = fullData?.summary || summary;
      exportPurchaseReportToExcel(exportBills, exportSummary);
    } catch (err) {
      console.error("Failed to export Excel:", err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Export to PDF
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const fullData = await fetchReportData(true);
      const itemsToExport = fullData?.bills && fullData.bills.length > 0 ? fullData.bills : bills;
      setPdfBills(itemsToExport);

      await new Promise((resolve) => setTimeout(resolve, 400));

      if (!reportRef.current) return;

      const mod = await import("html2pdf.js");
      const html2pdf = (mod as any).default || mod;

      await html2pdf()
        .set({
          margin: [6, 6, 16, 6],
          filename: `purchase-report-${fromDate}_to_${toDate}.pdf`,
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

  // Status Badge Helper
  const renderStatusBadge = (status: "paid" | "partial" | "unpaid", neutral = false) => {
    if (neutral) {
      return (
        <Badge variant="outline" className="border-border text-foreground bg-muted/40 text-[11px] font-medium gap-1 py-0.5">
          {status === "paid" && <CheckCircle2 className="h-3 w-3 text-foreground" />}
          {status === "partial" && <Clock className="h-3 w-3 text-foreground" />}
          {status === "unpaid" && <AlertCircle className="h-3 w-3 text-foreground" />}
          <span className="text-foreground">{t(status)}</span>
        </Badge>
      );
    }

    switch (status) {
      case "paid":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 text-[11px] font-medium gap-1 py-0.5">
            <CheckCircle2 className="h-3 w-3" />
            <span>{t("paid")}</span>
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 text-[11px] font-medium gap-1 py-0.5">
            <Clock className="h-3 w-3" />
            <span>{t("partial")}</span>
          </Badge>
        );
      case "unpaid":
      default:
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 text-[11px] font-medium gap-1 py-0.5">
            <AlertCircle className="h-3 w-3" />
            <span>{t("unpaid")}</span>
          </Badge>
        );
    }
  };

  // DataTable Columns
  const columns: ColumnDef<PurchaseReportBill>[] = useMemo(
    () => [
      {
        id: "bill_date",
        header: t("date"),
        accessorKey: "bill_date",
        sortable: true,
        className: "w-[100px] text-xs font-medium text-foreground",
        cell: (row) => {
          const d = row.bill_date || row.created_at;
          return d
            ? new Date(d).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "-";
        },
      },
      {
        id: "purchase_number",
        header: t("billNo"),
        accessorKey: "purchase_number",
        sortable: true,
        className: "w-[120px] font-semibold text-xs text-foreground",
        cell: (row) => (
          // View Modal trigger - To re-enable, uncomment the button below and remove the span:
          // <button
          //   type="button"
          //   onClick={() => setSelectedBillForDetails(row)}
          //   className="text-foreground hover:underline font-mono text-xs text-left font-semibold"
          // >
          //   {row.purchase_number || row.bill_number}
          // </button>
          <span className="font-mono text-xs font-semibold text-foreground">
            {row.purchase_number || row.bill_number}
          </span>
        ),
      },
      {
        id: "party_name",
        header: t("supplierName"),
        accessorKey: "party_name",
        sortable: true,
        className: "min-w-[100px] font-medium text-xs text-foreground",
        cell: (row) => row.party_name || "-",
      },
      {
        id: "items",
        header: t("items"),
        className: "w-[90px] text-center text-xs text-foreground",
        cell: (row) => (
          // View Modal trigger - To re-enable, uncomment the Button below and remove the div:
          // <Button
          //   variant="ghost"
          //   size="sm"
          //   onClick={() => setSelectedBillForDetails(row)}
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
        className: "w-[120px] text-right font-bold text-xs text-foreground",
        cell: (row) => formatCurrency(row.total_amount),
      },
      {
        id: "paid_amount",
        header: <div className="text-right text-foreground">{t("paidAmount")}</div>,
        accessorKey: "paid_amount",
        sortable: true,
        className: "w-[110px] text-right text-xs font-semibold text-foreground",
        cell: (row) => formatCurrency(row.paid_amount),
      },
      {
        id: "balance_due",
        header: <div className="text-right text-foreground">{t("balance")}</div>,
        accessorKey: "balance_due",
        sortable: true,
        className: "w-[110px] text-right text-xs font-semibold text-foreground",
        cell: (row) => formatCurrency(row.balance_due),
      },
      {
        id: "status",
        header: <div className="text-center text-foreground">{t("status")}</div>,
        className: "w-[100px] text-center text-foreground",
        cell: (row) => <div className="flex justify-center">{renderStatusBadge(row.status, true)}</div>,
      },
      // View Modal Actions column - To re-enable, uncomment below:
      // {
      //   id: "actions",
      //   header: "",
      //   className: "w-[50px] text-right text-foreground",
      //   cell: (row) => (
      //     <Button
      //       variant="ghost"
      //       size="icon"
      //       onClick={() => setSelectedBillForDetails(row)}
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
  const pdfColumns: PdfTableColumn<PurchaseReportBill>[] = useMemo(
    () => [
      {
        header: "#",
        align: "center",
        width: "35px",
        render: (_, idx) => idx + 1,
      },
      {
        header: t("date"),
        align: "left",
        width: "80px",
        render: (row) => {
          const d = row.bill_date || row.created_at;
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
        header: t("billNo"),
        align: "left",
        width: "100px",
        render: (row) => row.purchase_number || row.bill_number || "-",
      },
      {
        header: t("supplierName"),
        align: "left",
        width: "140px",
        render: (row) => row.party_name || "-",
      },
      {
        header: t("items"),
        align: "center",
        width: "50px",
        render: (row) => row.items_count || row.items?.length || 0,
      },
      {
        header: t("totalAmount"),
        align: "right",
        width: "90px",
        render: (row) => formatCurrency(row.total_amount),
      },
      {
        header: t("paidAmount"),
        align: "right",
        width: "85px",
        render: (row) => formatCurrency(row.paid_amount),
      },
      {
        header: t("balance"),
        align: "right",
        width: "85px",
        render: (row) => formatCurrency(row.balance_due),
      },
      {
        header: t("status"),
        align: "center",
        width: "70px",
        render: (row) => row.status.toUpperCase(),
      },
    ],
    [t]
  );

  const pdfKpis: ReportPdfKpi[] = useMemo(
    () => [
      {
        label: t("totalPurchases"),
        value: formatCurrency(summary.totalPurchases),
      },
      {
        label: t("totalPaid"),
        value: formatCurrency(summary.totalPaid),
      },
      {
        label: t("balanceDue"),
        value: formatCurrency(summary.totalBalanceDue),
        highlight: summary.totalBalanceDue > 0,
      },
      {
        label: t("totalBills"),
        value: String(summary.totalBillsCount),
      },
    ],
    [summary, t]
  );

  const pdfMetaItems: ReportPdfMetaItem[] = useMemo(() => {
    const meta: ReportPdfMetaItem[] = [];
    if (selectedPartyName && selectedPartyId !== "all") {
      meta.push({ label: t("supplier"), value: selectedPartyName });
    }
    if (paymentStatus && paymentStatus !== "all") {
      meta.push({ label: t("paymentStatus"), value: t(paymentStatus as any) || paymentStatus });
    }
    return meta;
  }, [selectedPartyName, selectedPartyId, paymentStatus, t]);

  const pdfFooterCells: PdfTableFooterCell[] = useMemo(
    () => [
      { content: "Total", colSpan: 5, align: "left" },
      { content: formatCurrency(summary.totalPurchases), align: "right" },
      { content: formatCurrency(summary.totalPaid), align: "right" },
      { content: formatCurrency(summary.totalBalanceDue), align: "right" },
      { content: "", align: "center" },
    ],
    [summary]
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Top Page Header */}
      <PageHeader
        backHref={`/${locale}/admin/reports`}
        title={t("title")}
        description={t("description")}
        actions={
          can("reports", "export_purchase_report") && bills.length > 0 ? (
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
                disabled={isExportingPdf || loading || bills.length === 0}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                {t("supplier")}:
              </label>
              <PartyDropdown
                value={selectedPartyId}
                onValueChange={(val, party) => {
                  setSelectedPartyId(val);
                  setSelectedPartyName(party?.name || "");
                  setCurrentPage(1);
                }}
                includeAllOption={true}
                allOptionLabel={t("allSuppliers")}
                enableSearch={true}
                placeholder={t("allSuppliers")}
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
                    <SelectItem value="bill_date-asc">{t("sortDateAsc")}</SelectItem>
                    <SelectItem value="bill_date-desc">{t("sortDateDesc")}</SelectItem>
                    <SelectItem value="total_amount-desc">{t("sortAmountDesc")}</SelectItem>
                    <SelectItem value="total_amount-asc">{t("sortAmountAsc")}</SelectItem>
                    <SelectItem value="balance_due-desc">{t("sortBalanceDesc")}</SelectItem>
                    <SelectItem value="party_name-asc">{t("sortSupplier")}</SelectItem>
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
          title={t("totalPurchases")}
          value={formatCurrency(summary.totalPurchases)}
          icon={<ShoppingCart className="h-4 w-4 text-cyan-600" />}
          subValue={`${summary.totalBillsCount} ${t("totalBills")}`}
          isLoading={loading}
        />

        <StatCard
          title={t("totalPaid")}
          value={formatCurrency(summary.totalPaid)}
          icon={<CreditCard className="h-4 w-4 text-emerald-600" />}
          subValue={`${summary.fullyPaidCount} ${t("paidBills")}`}
          isLoading={loading}
        />

        <StatCard
          title={t("balanceDue")}
          value={formatCurrency(summary.totalBalanceDue)}
          icon={<AlertCircle className="h-4 w-4 text-rose-600" />}
          subValue={`${summary.unpaidCount + summary.partialCount} ${t("unpaidBills")}`}
          isExpense={summary.totalBalanceDue > 0}
          isLoading={loading}
        />

        <StatCard
          title={t("totalItems")}
          value={summary.totalItemsPurchased.toLocaleString()}
          icon={<Package className="h-4 w-4 text-violet-600" />}
          subValue={`${t("avgBillValue")}: ${formatCurrency(summary.averageBillValue)}`}
          isLoading={loading}
        />
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={bills}
        isLoading={loading}
        pageSize={pageSize}
        currentPage={currentPage}
        totalCount={totalCount}
        onPageChange={(p) => setCurrentPage(p)}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setCurrentPage(1);
        }}
        emptyMessage={t("noData")}
        keyExtractor={(row) => row.id}
        renderMobileCard={(row) => (
          <div
            // View Modal trigger - To re-enable, uncomment the onClick below:
            // onClick={() => setSelectedBillForDetails(row)}
            className="p-3.5 border rounded-lg bg-card shadow-xs space-y-2.5 text-xs transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono font-bold text-foreground">{row.purchase_number || row.bill_number}</span>
                <p className="font-semibold text-foreground text-sm mt-0.5">{row.party_name}</p>
                <p className="text-[11px] text-foreground/75">
                  {row.bill_date || row.created_at
                    ? new Date(row.bill_date || row.created_at).toLocaleDateString("en-GB", {
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
          BILL DETAILS MODAL (VIEW MODAL)
          Currently commented out safely.
          To re-enable: Remove the `{/*` above <Dialog and `* /}` below </Dialog>
          ======================================================== */}
      {/*
      <Dialog
        open={Boolean(selectedBillForDetails)}
        onOpenChange={(open) => !open && setSelectedBillForDetails(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedBillForDetails && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-4">
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    <span>{t("billDetails")}</span>
                  </DialogTitle>
                  {renderStatusBadge(selectedBillForDetails.status)}
                </div>
                <DialogDescription className="text-xs text-muted-foreground text-left">
                  {t("billDetailsDescription")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">{t("billNo")}:</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedBillForDetails.purchase_number || selectedBillForDetails.bill_number}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">{t("date")}:</span>
                  <span className="font-medium text-foreground">
                    {selectedBillForDetails.created_at
                      ? new Date(selectedBillForDetails.created_at).toLocaleDateString("en-GB")
                      : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">{t("supplierName")}:</span>
                  <span className="font-bold text-foreground truncate block">
                    {selectedBillForDetails.party_name}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">{t("paymentMethod")}:</span>
                  <span className="font-medium text-foreground">
                    {selectedBillForDetails.payment_method_name || "-"}
                  </span>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-3 py-2 font-semibold text-foreground border-b flex justify-between items-center">
                    <span>{t("itemsList")}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedBillForDetails.items?.length || 0} items
                    </Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px]">
                        <TableHead className="h-8">#</TableHead>
                        <TableHead className="h-8">{t("productName")}</TableHead>
                        <TableHead className="h-8 text-center">{t("quantity")}</TableHead>
                        <TableHead className="h-8 text-right">{t("costPrice")}</TableHead>
                        <TableHead className="h-8 text-right">{t("amount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBillForDetails.items?.length ? (
                        selectedBillForDetails.items.map((item, idx) => (
                          <TableRow key={idx} className="text-xs">
                            <TableCell className="py-2 text-foreground">{idx + 1}</TableCell>
                            <TableCell className="py-2 font-medium text-foreground">{item.product_name}</TableCell>
                            <TableCell className="py-2 text-center text-foreground">{item.quantity}</TableCell>
                            <TableCell className="py-2 text-right text-foreground">{formatCurrency(item.cost_price)}</TableCell>
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
                      {formatCurrency(selectedBillForDetails.total_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between w-48 text-foreground">
                    <span className="text-muted-foreground">{t("paidAmount")}:</span>
                    <span className="font-semibold text-foreground">{formatCurrency(selectedBillForDetails.paid_amount)}</span>
                  </div>
                  <div className="flex justify-between w-48 font-bold border-t pt-1.5 text-foreground">
                    <span>{t("balance")}:</span>
                    <span>{formatCurrency(selectedBillForDetails.balance_due)}</span>
                  </div>
                </div>

                {selectedBillForDetails.description && (
                  <div className="p-2.5 rounded-md bg-muted/30 border text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground block mb-0.5">{t("note")}:</span>
                    {selectedBillForDetails.description}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setSelectedBillForDetails(null)}>
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
        description="Preparing & downloading your Purchase Report PDF..."
        reportRef={reportRef}
        width="1050px"
        isPortrait={false}
      >
        <ReportPdfHeader
          branding={branding}
          title="PURCHASE REPORT"
          fromDate={fromDate}
          toDate={toDate}
          metaItems={pdfMetaItems}
          kpis={pdfKpis}
        />

        <PdfTable
          columns={pdfColumns}
          data={pdfBills}
          footerCells={pdfFooterCells}
          emptyMessage={t("noData")}
        />
      </ReportPdfModal>
    </div>
  );
}
