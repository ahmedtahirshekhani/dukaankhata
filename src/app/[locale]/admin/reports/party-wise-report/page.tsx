// src/app/[locale]/admin/reports/party-wise-report/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Package,
} from "lucide-react";
import { PartyDropdown } from "@/components/dropdown/party-dropdown";
import { ReportDatePresets, getPresetDateRange } from "@/components/reports/report-date-presets";
import { type ReportSortOption } from "@/components/reports/report-search-and-advanced-filters";
import { ReportFilterCard } from "@/components/reports/report-filter-card";
import { ReportKpiSummary, type ReportKpiCardItem } from "@/components/reports/report-kpi-summary";
import { ReportMobileCard } from "@/components/reports/report-mobile-card";
import { ReportExportActions } from "@/components/reports/report-export-actions";
import { ReportPdfModal } from "@/components/reports/report-pdf-modal";
import { toast } from "sonner";
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
import { exportReportToPdf } from "@/lib/report-pdf-generator";
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
  total_quantity?: number;
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
  const defaultDateRange = useMemo(() => getPresetDateRange("thisMonth"), []);
  const [fromDate, setFromDate] = useState<string>(defaultDateRange.fromDate);
  const [toDate, setToDate] = useState<string>(defaultDateRange.toDate);
  const [activePreset, setActivePreset] = useState<string>("thisMonth");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebounce(search, 400);

  // Advanced Filters & Sorting
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("total_amount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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
  const [modalSortBy, setModalSortBy] = useState<string>("date");
  const [modalSortOrder, setModalSortOrder] = useState<"asc" | "desc">("desc");

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

  // Preset Date Range Handler using Standard Component
  const handleSelectPreset = (preset: string, newFrom: string, newTo: string) => {
    setActivePreset(preset);
    setFromDate(newFrom);
    setToDate(newTo);
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
    const range = getPresetDateRange("thisMonth");
    setActivePreset("thisMonth");
    setFromDate(range.fromDate);
    setToDate(range.toDate);
    setSelectedPartyId("all");
    setSearch("");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("total_amount");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  // Table Column Header Sort Handler
  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      const isDescDefault = [
        "total_amount",
        "paid_amount",
        "balance_due",
        "transactions_count",
        "last_date",
      ].includes(key);
      setSortOrder(isDescDefault ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (minAmount) count++;
    if (maxAmount) count++;
    if (sortBy !== "total_amount" || sortOrder !== "desc") count++;
    return count;
  }, [minAmount, maxAmount, sortBy, sortOrder]);

  const sortOptions: ReportSortOption[] = useMemo(
    () => [
      { value: "total_amount-desc", label: t("sortAmountDesc") },
      { value: "total_amount-asc", label: t("sortAmountAsc") },
      { value: "party_name-asc", label: t("sortPartyAsc") },
      { value: "party_name-desc", label: t("sortPartyDesc") },
      { value: "paid_amount-desc", label: t("sortPaidDesc") },
      { value: "paid_amount-asc", label: t("sortPaidAsc") },
      { value: "balance_due-desc", label: t("sortBalanceDesc") },
      { value: "balance_due-asc", label: t("sortBalanceAsc") },
      { value: "transactions_count-desc", label: t("sortTransactionsDesc") },
      { value: "transactions_count-asc", label: t("sortTransactionsAsc") },
    ],
    [t]
  );

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
      if (minAmount) params.set("minAmount", minAmount);
      if (maxAmount) params.set("maxAmount", maxAmount);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("page", currentPage.toString());
      params.set("limit", pageSize.toString());

      const res = await fetch(`/${locale}/api/reports/party-wise-report?${params.toString()}`);
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
  }, [
    mode,
    fromDate,
    toDate,
    selectedPartyId,
    debouncedSearch,
    minAmount,
    maxAmount,
    sortBy,
    sortOrder,
    currentPage,
    pageSize,
    locale,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Party Transactions Drilldown Modal
  const handleOpenPartyTransactions = async (item: PartyWiseRowItem) => {
    setSelectedParty(item);
    setModalCurrentPage(1);
    setModalSearch("");
    setModalSortBy("date");
    setModalSortOrder("desc");
    setDetailsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("mode", mode);
      params.set("detailsPartyId", item.party_id);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);

      const res = await fetch(
        `/${locale}/api/reports/party-wise-report?${params.toString()}`
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

  // Modal Table Column Header Sort Handler
  const handleModalSort = (key: string) => {
    if (modalSortBy === key) {
      setModalSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setModalSortBy(key);
      const isDescDefault = ["date", "total_amount", "paid_amount", "balance_due"].includes(key);
      setModalSortOrder(isDescDefault ? "desc" : "asc");
    }
    setModalCurrentPage(1);
  };

  // Filtered, Sorted & Paginated Party Transactions for Drilldown Modal DataTable
  const sortedAndFilteredPartyTransactions = useMemo(() => {
    let result = partyTransactions;
    if (modalSearch) {
      const s = modalSearch.toLowerCase();
      result = result.filter((tx) => {
        const num = (isSaleMode ? (tx.invoice_number || tx.invoice_no) : tx.bill_number) || "";
        const status = tx.status || "";
        const method = tx.payment_method_name || "";
        return (
          num.toLowerCase().includes(s) ||
          status.toLowerCase().includes(s) ||
          method.toLowerCase().includes(s)
        );
      });
    }

    if (!modalSortBy) return result;

    return [...result].sort((a, b) => {
      let comparison = 0;
      switch (modalSortBy) {
        case "date": {
          const timeA = new Date(a.date).getTime() || 0;
          const timeB = new Date(b.date).getTime() || 0;
          comparison = timeA - timeB;
          break;
        }
        case "invoice_number":
        case "bill_number":
        case "transaction_number": {
          const numA = (isSaleMode ? (a.invoice_number || a.invoice_no) : a.bill_number) || "";
          const numB = (isSaleMode ? (b.invoice_number || b.invoice_no) : b.bill_number) || "";
          comparison = numA.localeCompare(numB, undefined, { numeric: true, sensitivity: "base" });
          break;
        }
        case "total_amount":
          comparison = (Number(a.total_amount) || 0) - (Number(b.total_amount) || 0);
          break;
        case "paid_amount":
          comparison = (Number(a.paid_amount) || 0) - (Number(b.paid_amount) || 0);
          break;
        case "balance_due":
          comparison = (Number(a.balance_due) || 0) - (Number(b.balance_due) || 0);
          break;
        case "status": {
          const statusA = a.status || "";
          const statusB = b.status || "";
          comparison = statusA.localeCompare(statusB);
          break;
        }
        case "items_count":
        case "quantity":
        case "total_quantity": {
          const qtyA = a.total_quantity ?? a.items_count ?? 0;
          const qtyB = b.total_quantity ?? b.items_count ?? 0;
          comparison = qtyA - qtyB;
          break;
        }
        default:
          comparison = 0;
      }
      return modalSortOrder === "asc" ? comparison : -comparison;
    });
  }, [partyTransactions, modalSearch, isSaleMode, modalSortBy, modalSortOrder]);

  const paginatedPartyTransactions = useMemo(() => {
    const start = (modalCurrentPage - 1) * modalPageSize;
    return sortedAndFilteredPartyTransactions.slice(start, start + modalPageSize);
  }, [sortedAndFilteredPartyTransactions, modalCurrentPage, modalPageSize]);

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
    if (data.length === 0) {
      toast.error(t("noData"));
      return;
    }
    try {
      setIsExportingExcel(true);
      const params = new URLSearchParams();
      params.set("mode", mode);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (selectedPartyId && selectedPartyId !== "all") params.set("partyId", selectedPartyId);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (minAmount) params.set("minAmount", minAmount);
      if (maxAmount) params.set("maxAmount", maxAmount);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("limit", "-1");

      const res = await fetch(`/${locale}/api/reports/party-wise-report?${params.toString()}`);
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
    if (data.length === 0) {
      toast.error(t("noData"));
      return;
    }
    setIsExportingPdf(true);
    try {
      const params = new URLSearchParams();
      params.set("mode", mode);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (selectedPartyId && selectedPartyId !== "all") params.set("partyId", selectedPartyId);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (minAmount) params.set("minAmount", minAmount);
      if (maxAmount) params.set("maxAmount", maxAmount);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("limit", "-1");

      const res = await fetch(`/${locale}/api/reports/party-wise-report?${params.toString()}`);
      let itemsToExport = data;
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          itemsToExport = json.data;
        }
      }
      setPdfData(itemsToExport);

      // Give React DOM time to render the reportRef container inside ReportPdfModal
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (!reportRef.current) return;

      await exportReportToPdf({
        element: reportRef.current,
        filename: `${mode === "sales" ? "sale" : "purchase"}-by-party-${fromDate || "all"}_to_${toDate || "all"}.pdf`,
        watermarkText: tCommon("pdfWatermarkText"),
      });
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error(tCommon("exportError"));
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
        id: isSaleMode ? "invoice_number" : "bill_number",
        header: isSaleMode ? t("invoiceNo") : t("billNo"),
        accessorKey: (isSaleMode ? "invoice_number" : "bill_number") as keyof PartyTransaction,
        sortable: true,
        className: "whitespace-nowrap font-mono font-semibold text-xs text-foreground",
        cell: (row) =>
          isSaleMode
            ? row.invoice_number || row.invoice_no || "-"
            : row.bill_number || "-",
      },
      {
        id: "quantity",
        header: t("quantity"),
        accessorKey: "total_quantity" as keyof PartyTransaction,
        sortable: true,
        className: "text-center text-xs text-foreground whitespace-nowrap",
        cell: (row) => {
          const qty = row.total_quantity ?? row.items_count ?? 0;
          return (
            <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-foreground">
              <Package className="h-3 w-3 text-foreground" />
              <span>{qty}</span>
            </div>
          );
        },
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
        accessorKey: "status",
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
      label: t("mode"),
      value: isSaleMode ? t("salesTab") : t("purchasesTab"),
    });
    if (selectedPartyId && selectedPartyId !== "all") {
      meta.push({ label: t("party"), value: selectedPartyId });
    }
    return meta;
  }, [isSaleMode, selectedPartyId, t]);

  const kpiItems: ReportKpiCardItem[] = useMemo(
    () => [
      {
        title: isSaleMode ? t("totalSales") : t("totalPurchases"),
        value: formatCurrency(summary.totalAmount),
        icon: isSaleMode ? (
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        ) : (
          <ShoppingCart className="h-4 w-4 text-cyan-600" />
        ),
        subValue: `${summary.totalTransactionsCount} ${isSaleMode ? t("invoicesCount") : t("billsCount")}`,
      },
      {
        title: isSaleMode ? t("receivedAmount") : t("paidAmount"),
        value: formatCurrency(summary.totalPaid),
        icon: <CreditCard className="h-4 w-4 text-blue-600" />,
        subValue: `${summary.totalAmount > 0 ? Math.round((summary.totalPaid / summary.totalAmount) * 100) : 0}% ${isSaleMode ? t("receivedAmount") : t("paidAmount")}`,
      },
      {
        title: t("balanceDue"),
        value: formatCurrency(summary.totalBalanceDue),
        icon: <AlertCircle className="h-4 w-4 text-rose-600" />,
        subValue: isSaleMode ? t("toReceive") : t("toPay"),
        isExpense: summary.totalBalanceDue > 0,
      },
      {
        title: t("totalParties"),
        value: String(summary.totalPartiesCount),
        icon: <Users className="h-4 w-4 text-violet-600" />,
        subValue: isSaleMode ? t("customersOnly") : t("suppliersOnly"),
      },
    ],
    [isSaleMode, summary, t]
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-10">
      {/* Top Page Header with Standard Export Actions */}
      <PageHeader
        backHref={`/${locale}/admin/reports`}
        title={t("title")}
        description={t("description")}
        actions={
          can("reports", "export_party_wise_sale_purchase_report") ? (
            <ReportExportActions
              onExportExcel={handleExportExcel}
              onExportPdf={handleExportPdf}
              isExportingExcel={isExportingExcel}
              isExportingPdf={isExportingPdf}
              excelLabel={t("exportExcel")}
              pdfLabel={t("downloadPdf")}
              disabled={loading}
            />
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

      {/* Date Presets Row (Standard Reusable Component) */}
      <ReportDatePresets
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
      />

      {/* Main Filters Card (Standard ReportFilterCard Component) */}
      <ReportFilterCard
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={handleFromDateChange}
        onToDateChange={handleToDateChange}
        fromDateLabel={t("fromDate")}
        toDateLabel={t("toDate")}
        primaryFilterSlot={
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
              showAddButton={false}
            />
          </div>
        }
        searchTerm={search}
        onSearchTermChange={(val) => {
          setSearch(val);
          setCurrentPage(1);
        }}
        searchPlaceholder={t("searchPlaceholder")}
        showAdvancedFilters={showAdvancedFilters}
        onToggleAdvancedFilters={() => setShowAdvancedFilters((prev) => !prev)}
        activeAdvancedFilterCount={activeAdvancedFilterCount}
        onResetFilters={handleResetFilters}
        minAmount={minAmount}
        onMinAmountChange={(val) => {
          setMinAmount(val);
          setCurrentPage(1);
        }}
        maxAmount={maxAmount}
        onMaxAmountChange={(val) => {
          setMaxAmount(val);
          setCurrentPage(1);
        }}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(field, order) => {
          setSortBy(field);
          setSortOrder(order);
          setCurrentPage(1);
        }}
        sortOptions={sortOptions}
        advancedLabels={{
          filters: t("filters"),
          resetFilters: t("resetFilters"),
          minAmount: t("minAmount"),
          maxAmount: t("maxAmount"),
          sortBy: t("sortBy"),
        }}
      />
      {/* KPI Cards (Standard ReportKpiSummary Component) */}
      <ReportKpiSummary
        items={kpiItems}
        isLoading={loading}
      />

      {/* Main Data Table */}
      <DataTable<PartyWiseRowItem>
        columns={columns}
        data={data}
        isLoading={loading}
        sortConfig={{ key: sortBy, direction: sortOrder }}
        onSort={handleSort}
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
          <ReportMobileCard
            partyName={row.party_name}
            phone={row.party_phone && row.party_phone !== "-" ? row.party_phone : undefined}
            badgeText={`${row.transactions_count} ${isSaleMode ? t("invoicesCount") : t("billsCount")}`}
            totalAmount={formatCurrency(row.total_amount)}
            totalAmountLabel={isSaleMode ? t("salesAmount") : t("purchasesAmount")}
            paidAmount={formatCurrency(row.paid_amount)}
            paidAmountLabel={isSaleMode ? t("receivedAmount") : t("paidAmount")}
            balanceDue={formatCurrency(row.balance_due)}
            balanceDueLabel={t("balanceDue")}
            highlightAmountClass={
              isSaleMode
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-cyan-600 dark:text-cyan-400"
            }
            onClick={() => handleOpenPartyTransactions(row)}
          />
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
            setModalSortBy("date");
            setModalSortOrder("desc");
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-5">
          {selectedParty && (
            <div className="flex flex-col gap-3">
              <DialogHeader className="pb-2 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span>{selectedParty.party_name}</span>
                  </DialogTitle>
                </div>
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
                sortConfig={{ key: modalSortBy, direction: modalSortOrder }}
                onSort={handleModalSort}
                currentPage={modalCurrentPage}
                pageSize={modalPageSize}
                totalCount={sortedAndFilteredPartyTransactions.length}
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
                renderMobileCard={(row: PartyTransaction) => (
                  <ReportMobileCard
                    number={isSaleMode ? (row.invoice_number || row.invoice_no) : row.bill_number}
                    partyName={selectedParty.party_name}
                    formattedDate={formatStatementDate(row.date)}
                    status={row.status}
                    statusLabel={t(row.status)}
                    itemsCount={row.total_quantity ?? row.items_count}
                    itemsLabel={t("quantity")}
                    totalAmount={formatCurrency(row.total_amount)}
                    totalAmountLabel={t("totalAmount")}
                    paidAmount={formatCurrency(row.paid_amount)}
                    paidAmountLabel={isSaleMode ? t("receivedAmount") : t("paidAmount")}
                    balanceDue={formatCurrency(row.balance_due)}
                    balanceDueLabel={t("balanceDue")}
                  />
                )}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PDF EXPORT MODAL */}
      <ReportPdfModal
        isOpen={isExportingPdf}
        onOpenChange={setIsExportingPdf}
        title={isSaleMode ? t("saleByPartyPdf") : t("purchaseByPartyPdf")}
        description={isSaleMode ? t("preparingSalePdf") : t("preparingPurchasePdf")}
        reportRef={reportRef}
        width="1050px"
        isPortrait={false}
      >
        <div className="space-y-5">
          <ReportPdfHeader
            branding={branding}
            title={isSaleMode ? t("saleReportPdfTitle") : t("purchaseReportPdfTitle")}
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
