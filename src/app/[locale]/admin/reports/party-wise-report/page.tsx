// src/app/[locale]/admin/reports/party-wise-report/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  TrendingUp,
  ShoppingCart,
  FileSpreadsheet,
  Printer,
  Loader2,
  Search,
  RotateCcw,
  Eye,
  Phone,
  Calendar,
  AlertCircle,
  CreditCard,
  DollarSign,
  X,
} from "lucide-react";
import { PartyDropdown } from "@/components/dropdown/party-dropdown";
import { StatCard } from "@/components/dashboard/stat-card";
import { ReportPdfModal } from "@/components/reports/report-pdf-modal";
import {
  ReportPdfHeader,
  type ReportPdfKpi,
  type ReportPdfMetaItem,
} from "@/components/reports/report-pdf-header";
import { PdfTable, type PdfTableColumn } from "@/components/reports/pdf-table";
import { formatCurrency, formatStatementDate, cn } from "@/lib/utils";
import { toHTMLDateString, getDaysAgoHTMLDate, getTodayHTMLDate } from "@/lib/date-utils";
import { useDebounce } from "@/hooks/use-debounce";
import { usePermissions } from "@/hooks/use-permissions";
import { exportPartyWiseByModeToExcel } from "@/lib/excel";
import { PartyWiseRowItem, PartyWiseTabSummary } from "@/types/reports";

type Mode = "sales" | "purchases";

interface PartyTransaction {
  id: string;
  invoice_number?: string;
  invoice_no?: string;
  bill_number?: string;
  date: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: "paid" | "partial" | "unpaid";
  payment_method_name: string;
  items_count: number;
}

export default function PartyWiseReportPage() {
  const t = useTranslations("partyWiseReportPage");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { can } = usePermissions();
  const reportRef = useRef<HTMLDivElement>(null);

  // Mode: "sales" (Sale by Party) | "purchases" (Purchase by Party)
  const [mode, setMode] = useState<Mode>("sales");

  // Filters (Default to 'thisMonth' like purchase-report and sale-report)
  const [fromDate, setFromDate] = useState<string>(() => {
    const now = new Date();
    return toHTMLDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [toDate, setToDate] = useState<string>(() => getTodayHTMLDate());
  const [activePreset, setActivePreset] = useState<string>("thisMonth");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebounce(search, 400);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<PartyWiseRowItem[]>([]);
  const [summary, setSummary] = useState<PartyWiseTabSummary>({
    totalAmount: 0,
    totalPaid: 0,
    totalBalanceDue: 0,
    totalPartiesCount: 0,
    totalTransactionsCount: 0,
  });

  // Drilldown Party Details Modal State
  const [selectedParty, setSelectedParty] = useState<PartyWiseRowItem | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [partyTransactions, setPartyTransactions] = useState<PartyTransaction[]>([]);
  const [modalCurrentPage, setModalCurrentPage] = useState<number>(1);
  const [modalPageSize, setModalPageSize] = useState<number>(5);
  const [modalSearch, setModalSearch] = useState<string>("");

  // Export States
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfData, setPdfData] = useState<PartyWiseRowItem[]>([]);

  // Branding for PDF
  const [branding, setBranding] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    logo: null as string | null,
  });

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const res = await fetch(`/${locale}/api/configuration/assets`);
        if (res.ok) {
          const bData = await res.json();
          setBranding({
            name: bData.companyName || "",
            address: bData.companyAddress || "",
            phone: bData.companyPhone || "",
            email: bData.companyEmail || "",
            logo: bData.logoUrl || null,
          });
        }
      } catch (err) {
        console.error("Failed to load branding assets:", err);
      }
    };
    loadBranding();
  }, [locale]);

  // Date Presets Helper (Consistent with purchase-report & sale-report)
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

  // Reset Filters (Default to 'thisMonth')
  const handleResetFilters = () => {
    const now = new Date();
    setFromDate(toHTMLDateString(new Date(now.getFullYear(), now.getMonth(), 1)));
    setToDate(getTodayHTMLDate());
    setSelectedPartyId("all");
    setSearch("");
    setActivePreset("thisMonth");
    setCurrentPage(1);
  };

  // Fetch Report Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("mode", mode);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (selectedPartyId && selectedPartyId !== "all") params.set("partyId", selectedPartyId);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("page", currentPage.toString());
      params.set("limit", pageSize.toString());

      const res = await fetch(`/api/reports/party-wise-report?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch report data");

      const json = await res.json();
      setData(json.data || []);
      if (json.summary) setSummary(json.summary);
      if (json.pagination) setTotalCount(json.pagination.total || 0);
    } catch (error) {
      console.error("Error fetching party-wise report:", error);
    } finally {
      setLoading(false);
    }
  }, [mode, fromDate, toDate, selectedPartyId, debouncedSearch, currentPage, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Party Transactions Drilldown Modal
  const handleOpenPartyTransactions = async (item: PartyWiseRowItem) => {
    setSelectedParty(item);
    setModalCurrentPage(1);
    setModalSearch("");
    setDetailsLoading(true);
    try {
      const res = await fetch(
        `/api/reports/party-wise-report?mode=${mode}&detailsPartyId=${item.party_id}`
      );
      if (res.ok) {
        const json = await res.json();
        setPartyTransactions(json.data || []);
      }
    } catch (err) {
      console.error("Error loading party transactions:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const isSaleMode = mode === "sales";

  // Filtered & Paginated Party Transactions for Drilldown Modal DataTable
  const filteredPartyTransactions = useMemo(() => {
    if (!modalSearch) return partyTransactions;
    const s = modalSearch.toLowerCase();
    return partyTransactions.filter((tx) => {
      const num = (isSaleMode ? tx.invoice_number : tx.bill_number) || "";
      const status = tx.status || "";
      const method = tx.payment_method_name || "";
      return (
        num.toLowerCase().includes(s) ||
        status.toLowerCase().includes(s) ||
        method.toLowerCase().includes(s)
      );
    });
  }, [partyTransactions, modalSearch, isSaleMode]);

  const paginatedPartyTransactions = useMemo(() => {
    const start = (modalCurrentPage - 1) * modalPageSize;
    return filteredPartyTransactions.slice(start, start + modalPageSize);
  }, [filteredPartyTransactions, modalCurrentPage, modalPageSize]);

  // Status Badge Helper
  const renderStatusBadge = (status: "paid" | "partial" | "unpaid") => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
            {t("paid")}
          </span>
        );
      case "partial":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            {t("partial")}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
            {t("unpaid")}
          </span>
        );
    }
  };

  // Excel Export
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const params = new URLSearchParams();
      params.set("mode", mode);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (selectedPartyId && selectedPartyId !== "all") params.set("partyId", selectedPartyId);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("limit", "-1");

      const res = await fetch(`/api/reports/party-wise-report?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        exportPartyWiseByModeToExcel(json.data || data, json.summary || summary, mode);
      } else {
        exportPartyWiseByModeToExcel(data, summary, mode);
      }
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // PDF Export Trigger
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const params = new URLSearchParams();
      params.set("mode", mode);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (selectedPartyId && selectedPartyId !== "all") params.set("partyId", selectedPartyId);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("limit", "-1");

      const res = await fetch(`/api/reports/party-wise-report?${params.toString()}`);
      let itemsToExport = data;
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          itemsToExport = json.data;
        }
      }
      setPdfData(itemsToExport);

      // Give React DOM time to render the reportRef container inside ReportPdfModal
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (!reportRef.current) return;

      const mod = await import("html2pdf.js");
      const html2pdf = (mod as any).default || mod;

      await html2pdf()
        .set({
          margin: [6, 6, 16, 6],
          filename: `${mode === "sales" ? "sale" : "purchase"}-by-party-${fromDate || "all"}_to_${toDate || "all"}.pdf`,
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
      console.error("PDF export error:", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Table Columns Definition (Decent & Compact)
  const columns: ColumnDef<PartyWiseRowItem>[] = useMemo(
    () => [
      {
        id: "party_name",
        header: t("partyName"),
        accessorKey: "party_name",
        sortable: true,
        className: "whitespace-nowrap font-medium text-xs text-foreground",
        cell: (row) => (
          <div className="py-0.5">
            <span className="font-semibold text-foreground text-xs block leading-tight">{row.party_name}</span>
            {row.party_phone && row.party_phone !== "-" && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Phone className="h-2.5 w-2.5" />
                {row.party_phone}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "total_amount",
        header: isSaleMode ? t("salesAmount") : t("purchasesAmount"),
        accessorKey: "total_amount",
        sortable: true,
        className: `whitespace-nowrap text-xs text-right font-bold ${
          isSaleMode ? "text-emerald-600 dark:text-emerald-400" : "text-cyan-600 dark:text-cyan-400"
        }`,
        cell: (row) => formatCurrency(row.total_amount),
      },
      {
        id: "paid_amount",
        header: isSaleMode ? t("receivedAmount") : t("paidAmount"),
        accessorKey: "paid_amount",
        sortable: true,
        className: "whitespace-nowrap text-xs text-right font-medium text-foreground",
        cell: (row) => formatCurrency(row.paid_amount),
      },
      {
        id: "balance_due",
        header: t("balanceDue"),
        accessorKey: "balance_due",
        sortable: true,
        className: "whitespace-nowrap text-xs text-right font-bold text-rose-600 dark:text-rose-400",
        cell: (row) => formatCurrency(row.balance_due),
      },
      {
        id: "transactions_count",
        header: isSaleMode ? t("invoicesCount") : t("billsCount"),
        accessorKey: "transactions_count",
        sortable: true,
        className: "whitespace-nowrap text-xs text-center text-muted-foreground",
        cell: (row) => (
          <span className="inline-block px-2 py-0.5 text-[11px] rounded bg-muted/60 font-medium">
            {row.transactions_count || 0}
          </span>
        ),
      },
      {
        id: "actions",
        header: t("actions"),
        sortable: false,
        className: "whitespace-nowrap text-xs text-center",
        cell: (row) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenPartyTransactions(row)}
            className="h-7 px-2 text-[11px] text-primary hover:text-primary/80 gap-1 font-medium hover:bg-primary/10"
          >
            <Eye className="h-3 w-3" />
            <span>{t("viewDetails")}</span>
          </Button>
        ),
      },
    ],
    [isSaleMode, t]
  );

  // Modal DataTable Columns
  const modalColumns: ColumnDef<PartyTransaction>[] = useMemo(
    () => [
      {
        id: "date",
        header: t("date"),
        accessorKey: "date",
        sortable: true,
        className: "whitespace-nowrap text-xs font-medium text-foreground",
        cell: (row) => formatStatementDate(row.date),
      },
      {
        id: "transaction_number",
        header: isSaleMode ? t("invoiceNo") : t("billNo"),
        sortable: true,
        className: "whitespace-nowrap font-mono font-semibold text-xs text-foreground",
        cell: (row) =>
          isSaleMode
            ? row.invoice_number || row.invoice_no || "-"
            : row.bill_number || "-",
      },
      {
        id: "total_amount",
        header: t("totalAmount"),
        accessorKey: "total_amount",
        sortable: true,
        className: "whitespace-nowrap text-xs text-right font-semibold",
        cell: (row) => formatCurrency(row.total_amount),
      },
      {
        id: "paid_amount",
        header: isSaleMode ? t("receivedAmount") : t("paidAmount"),
        accessorKey: "paid_amount",
        sortable: true,
        className: "whitespace-nowrap text-xs text-right font-medium text-muted-foreground",
        cell: (row) => formatCurrency(row.paid_amount),
      },
      {
        id: "balance_due",
        header: t("balanceDue"),
        accessorKey: "balance_due",
        sortable: true,
        className: "whitespace-nowrap text-xs text-right font-bold text-rose-600 dark:text-rose-400",
        cell: (row) => formatCurrency(row.balance_due),
      },
      {
        id: "status",
        header: t("status"),
        sortable: true,
        className: "whitespace-nowrap text-xs text-center",
        cell: (row) => renderStatusBadge(row.status),
      },
    ],
    [isSaleMode, t]
  );

  // PDF Columns
  const pdfColumns: PdfTableColumn<PartyWiseRowItem>[] = useMemo(
    () => [
      {
        header: t("partyName"),
        align: "left",
        width: "180px",
        render: (row: PartyWiseRowItem) => row.party_name,
      },
      {
        header: t("phone"),
        align: "left",
        width: "110px",
        render: (row: PartyWiseRowItem) => row.party_phone || "-",
      },
      {
        header: isSaleMode ? t("salesAmount") : t("purchasesAmount"),
        align: "right",
        width: "120px",
        render: (row: PartyWiseRowItem) => formatCurrency(row.total_amount),
      },
      {
        header: isSaleMode ? t("receivedAmount") : t("paidAmount"),
        align: "right",
        width: "110px",
        render: (row: PartyWiseRowItem) => formatCurrency(row.paid_amount),
      },
      {
        header: t("balanceDue"),
        align: "right",
        width: "110px",
        render: (row: PartyWiseRowItem) => formatCurrency(row.balance_due),
      },
      {
        header: isSaleMode ? t("invoicesCount") : t("billsCount"),
        align: "center",
        width: "80px",
        render: (row: PartyWiseRowItem) => row.transactions_count || 0,
      },
    ],
    [isSaleMode, t]
  );

  const pdfKpis: ReportPdfKpi[] = useMemo(
    () => [
      {
        label: isSaleMode ? t("totalSales") : t("totalPurchases"),
        value: formatCurrency(summary.totalAmount),
        subValue: `${summary.totalTransactionsCount} ${isSaleMode ? t("invoicesCount") : t("billsCount")}`,
      },
      {
        label: isSaleMode ? t("receivedAmount") : t("paidAmount"),
        value: formatCurrency(summary.totalPaid),
      },
      {
        label: t("balanceDue"),
        value: formatCurrency(summary.totalBalanceDue),
        highlight: summary.totalBalanceDue > 0,
      },
      {
        label: t("totalParties"),
        value: String(summary.totalPartiesCount),
      },
    ],
    [isSaleMode, summary, t]
  );

  const pdfMetaItems: ReportPdfMetaItem[] = useMemo(() => {
    const meta: ReportPdfMetaItem[] = [];
    meta.push({
      label: "Mode",
      value: isSaleMode ? t("salesTab") : t("purchasesTab"),
    });
    if (selectedPartyId && selectedPartyId !== "all") {
      meta.push({ label: t("party"), value: selectedPartyId });
    }
    return meta;
  }, [isSaleMode, selectedPartyId, t]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-10">
      {/* Top Page Header with Standard Export Actions */}
      <PageHeader
        backHref={`/${locale}/admin/reports`}
        title={t("title")}
        description={t("description")}
        actions={
          can("reports", "export_party_wise_sale_purchase_report") && data.length > 0 ? (
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
                disabled={isExportingPdf || loading || data.length === 0}
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

      {/* Mode Switcher Tabs (Sale by Party / Purchase by Party) */}
      <div className="flex items-center justify-start gap-2">
        <div className="inline-flex items-center p-1 bg-muted/80 rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => {
              setMode("sales");
              setCurrentPage(1);
            }}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all",
              isSaleMode
                ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-sm border border-border/40 font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            )}
          >
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t("salesTab")}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("purchases");
              setCurrentPage(1);
            }}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all",
              !isSaleMode
                ? "bg-background text-cyan-600 dark:text-cyan-400 shadow-sm border border-border/40 font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            )}
          >
            <ShoppingCart className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span>{t("purchasesTab")}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Compact StatCards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <StatCard
          title={isSaleMode ? t("totalSales") : t("totalPurchases")}
          value={formatCurrency(summary.totalAmount)}
          icon={
            isSaleMode ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <ShoppingCart className="h-4 w-4 text-cyan-600" />
            )
          }
          subValue={`${summary.totalTransactionsCount} ${isSaleMode ? t("invoicesCount") : t("billsCount")}`}
          isLoading={loading}
        />

        <StatCard
          title={isSaleMode ? t("receivedAmount") : t("paidAmount")}
          value={formatCurrency(summary.totalPaid)}
          icon={<CreditCard className="h-4 w-4 text-blue-600" />}
          isLoading={loading}
        />

        <StatCard
          title={t("balanceDue")}
          value={formatCurrency(summary.totalBalanceDue)}
          icon={<AlertCircle className="h-4 w-4 text-rose-600" />}
          subValue={isSaleMode ? "To Receive" : "To Pay"}
          isExpense={summary.totalBalanceDue > 0}
          isLoading={loading}
        />

        <StatCard
          title={t("totalParties")}
          value={summary.totalPartiesCount}
          icon={<Users className="h-4 w-4 text-violet-600" />}
          subValue={isSaleMode ? "Customers" : "Suppliers"}
          isLoading={loading}
        />
      </div>

      {/* Date Presets Row (Just like purchase & sale report) */}
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
            {/* From Date */}
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

            {/* To Date */}
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

            {/* Party Dropdown */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {t("party")}:
              </label>
              <PartyDropdown
                value={selectedPartyId}
                onValueChange={(val: string) => {
                  setSelectedPartyId(val || "all");
                  setCurrentPage(1);
                }}
                includeAllOption={true}
                allOptionLabel={t("allParties")}
                enableSearch={true}
                placeholder={t("allParties")}
                className="w-full h-8 text-xs"
              />
            </div>
          </div>

          {/* Row 2: Search and Reset */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-border/40">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t("searchPlaceholder")}
                className="h-8 text-xs pl-8 pr-7 w-full"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
        </CardContent>
      </Card>

      {/* Main Data Table */}
      <DataTable<PartyWiseRowItem>
        columns={columns}
        data={data}
        isLoading={loading}
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={(p: number) => setCurrentPage(p)}
        onPageSizeChange={(s: number) => {
          setPageSize(s);
          setCurrentPage(1);
        }}
        emptyMessage={t("noData")}
        keyExtractor={(row: PartyWiseRowItem) => row.party_id}
        className="border border-border/50 bg-card shadow-xs"
        renderMobileCard={(row: PartyWiseRowItem) => (
          <div
            onClick={() => handleOpenPartyTransactions(row)}
            className="p-3 border rounded-lg bg-card shadow-xs space-y-2 text-xs cursor-pointer hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-foreground text-xs">{row.party_name}</p>
                {row.party_phone && row.party_phone !== "-" && (
                  <p className="text-[11px] text-muted-foreground">{row.party_phone}</p>
                )}
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
                {row.transactions_count} {isSaleMode ? t("invoicesCount") : t("billsCount")}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px]">
                  {isSaleMode ? t("salesAmount") : t("purchasesAmount")}
                </span>
                <span
                  className={`font-bold ${
                    isSaleMode
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-cyan-600 dark:text-cyan-400"
                  }`}
                >
                  {formatCurrency(row.total_amount)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">
                  {isSaleMode ? t("receivedAmount") : t("paidAmount")}
                </span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(row.paid_amount)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground block text-[10px]">
                  {t("balanceDue")}
                </span>
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {formatCurrency(row.balance_due)}
                </span>
              </div>
            </div>
          </div>
        )}
      />

      {/* Table Summary Bottom Bar (Compact Vyapar Style) */}
      {!loading && data.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-muted/40 border border-border/50 rounded-lg text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t("summary")}:</span>
            <span className="font-semibold text-foreground">
              {summary.totalPartiesCount} {t("parties")}
            </span>
            <span className="text-muted-foreground text-[11px]">
              ({summary.totalTransactionsCount} {isSaleMode ? t("invoicesCount") : t("billsCount")})
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <div>
              <span className="text-muted-foreground mr-1.5">
                {isSaleMode ? t("salesAmount") : t("purchasesAmount")}:
              </span>
              <span
                className={cn(
                  "font-bold",
                  isSaleMode
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-cyan-600 dark:text-cyan-400"
                )}
              >
                {formatCurrency(summary.totalAmount)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground mr-1.5">
                {isSaleMode ? t("receivedAmount") : t("paidAmount")}:
              </span>
              <span className="font-semibold text-foreground">
                {formatCurrency(summary.totalPaid)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground mr-1.5">{t("balanceDue")}:</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(summary.totalBalanceDue)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* PARTY TRANSACTIONS DRILLDOWN MODAL */}
      <Dialog
        open={Boolean(selectedParty)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedParty(null);
            setModalSearch("");
            setModalCurrentPage(1);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-5">
          {selectedParty && (
            <div className="flex flex-col gap-3">
              <DialogHeader className="pb-2 border-b border-border/40">
                <div className="flex items-center justify-between pr-4">
                  <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>{selectedParty.party_name}</span>
                  </DialogTitle>
                  {selectedParty.party_phone && selectedParty.party_phone !== "-" && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                      <Phone className="h-3 w-3" />
                      {selectedParty.party_phone}
                    </span>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground text-left pt-0.5">
                  {isSaleMode ? "All invoices for this customer" : "All bills from this supplier"}
                </DialogDescription>
              </DialogHeader>

              {/* Party Summary Pills */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 bg-muted/40 rounded-lg">
                  <span className="text-[10px] text-muted-foreground block">
                    {isSaleMode ? t("salesAmount") : t("purchasesAmount")}
                  </span>
                  <span
                    className={`font-bold text-xs sm:text-sm ${
                      isSaleMode
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-cyan-600 dark:text-cyan-400"
                    }`}
                  >
                    {formatCurrency(selectedParty.total_amount)}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    {selectedParty.transactions_count} {isSaleMode ? t("invoicesCount") : t("billsCount")}
                  </span>
                </div>

                <div className="p-2.5 bg-muted/40 rounded-lg">
                  <span className="text-[10px] text-muted-foreground block">
                    {isSaleMode ? t("receivedAmount") : t("paidAmount")}
                  </span>
                  <span className="font-bold text-foreground text-xs sm:text-sm">
                    {formatCurrency(selectedParty.paid_amount)}
                  </span>
                </div>

                <div className="p-2.5 bg-muted/40 rounded-lg">
                  <span className="text-[10px] text-muted-foreground block">
                    {t("balanceDue")}
                  </span>
                  <span className="font-bold text-xs sm:text-sm text-rose-600 dark:text-rose-400">
                    {formatCurrency(selectedParty.balance_due)}
                  </span>
                </div>
              </div>

              {/* DataTable inside Modal */}
              <DataTable<PartyTransaction>
                columns={modalColumns}
                data={paginatedPartyTransactions}
                isLoading={detailsLoading}
                currentPage={modalCurrentPage}
                pageSize={modalPageSize}
                totalCount={filteredPartyTransactions.length}
                onPageChange={(p: number) => setModalCurrentPage(p)}
                onPageSizeChange={(s: number) => {
                  setModalPageSize(s);
                  setModalCurrentPage(1);
                }}
                searchTerm={modalSearch}
                onSearchChange={(term: string) => {
                  setModalSearch(term);
                  setModalCurrentPage(1);
                }}
                searchPlaceholder={isSaleMode ? t("searchSalesPlaceholder") : t("searchPurchasesPlaceholder")}
                emptyMessage={t("noData")}
                keyExtractor={(row: PartyTransaction) => row.id}
                className="border border-border/50 shadow-none p-2 sm:p-3"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PDF EXPORT MODAL */}
      <ReportPdfModal
        isOpen={isExportingPdf}
        onOpenChange={setIsExportingPdf}
        title={isSaleMode ? "Sale by Party PDF" : "Purchase by Party PDF"}
        description={`Preparing ${isSaleMode ? "Sale by Party" : "Purchase by Party"} Report PDF...`}
        reportRef={reportRef}
        width="1050px"
        isPortrait={false}
      >
        <div className="space-y-5">
          <ReportPdfHeader
            branding={branding}
            title={isSaleMode ? "SALE BY PARTY REPORT" : "PURCHASE BY PARTY REPORT"}
            fromDate={fromDate}
            toDate={toDate}
            metaItems={pdfMetaItems}
            kpis={pdfKpis}
          />

          <PdfTable<PartyWiseRowItem>
            columns={pdfColumns}
            data={pdfData}
            emptyMessage={t("noData")}
          />
        </div>
      </ReportPdfModal>
    </div>
  );
}
