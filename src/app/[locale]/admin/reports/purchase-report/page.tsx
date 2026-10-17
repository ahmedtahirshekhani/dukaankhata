"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { ReportPdfModal } from "@/components/reports/report-pdf-modal";
import { ReportPdfHeader, ReportPdfKpi, ReportPdfMetaItem } from "@/components/reports/report-pdf-header";
import { PdfTable, PdfTableColumn, PdfTableFooterCell } from "@/components/reports/pdf-table";
import { ReportDatePresets, getPresetDateRange } from "@/components/reports/report-date-presets";
import { ReportSortOption } from "@/components/reports/report-search-and-advanced-filters";
import { ReportFilterCard } from "@/components/reports/report-filter-card";
import { ReportExportActions } from "@/components/reports/report-export-actions";
import { ReportKpiSummary } from "@/components/reports/report-kpi-summary";
import { ReportStatusBadge } from "@/components/reports/report-status-badge";
import { ReportMobileCard } from "@/components/reports/report-mobile-card";
import { exportReportToPdf } from "@/lib/report-pdf-generator";
import { exportPurchaseReportToExcel } from "@/lib/excel";
import { formatCurrency, formatStatementDate } from "@/lib/utils";
import { toHTMLDateString } from "@/lib/date-utils";
import { useDebounce } from "@/hooks/use-debounce";
import { usePermissions } from "@/hooks/use-permissions";
import { PurchaseReportBill, PurchaseReportSummary } from "@/types/reports";
import { toast } from "sonner";
import {
  ShoppingCart,
  CreditCard,
  AlertCircle,
  Eye,
  Receipt,
  Package,
} from "lucide-react";

export default function PurchaseReportPage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const t = useTranslations("purchaseReportPage");
  const { can } = usePermissions();

  // Date States (defaults to thisMonth)
  const defaultDateRange = useMemo(() => getPresetDateRange("thisMonth"), []);
  const [fromDate, setFromDate] = useState<string>(defaultDateRange.fromDate);
  const [toDate, setToDate] = useState<string>(defaultDateRange.toDate);
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
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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

  // Date Preset Handler using Standard Component
  const handleSelectPreset = (preset: string, newFrom: string, newTo: string) => {
    setActivePreset(preset);
    setFromDate(newFrom);
    setToDate(newTo);
    setCurrentPage(1);
  };

  const handleFromDateChange = (val: string) => {
    setFromDate(val);
    setActivePreset("custom");
    if (toDate && val > toDate) {
      setToDate(val);
    }
    setCurrentPage(1);
  };

  const handleToDateChange = (val: string) => {
    setActivePreset("custom");
    if (fromDate && val < fromDate) {
      setToDate(fromDate);
    } else {
      setToDate(val);
    }
    setCurrentPage(1);
  };

  // Reset Filters
  const handleResetFilters = () => {
    const range = getPresetDateRange("thisMonth");
    setActivePreset("thisMonth");
    setFromDate(range.fromDate);
    setToDate(range.toDate);
    setSelectedPartyId("all");
    setSelectedPartyName("");
    setPaymentStatus("all");
    setSearchTerm("");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("bill_date");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  // Table Column Header Sort Handler
  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      // For financial/date metrics, default first click to "desc" (highest / latest first)
      const isDescDefault = [
        "bill_date",
        "date",
        "created_at",
        "total_amount",
        "paid_amount",
        "balance_due",
        "purchase_number",
      ].includes(key);
      setSortOrder(isDescDefault ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (minAmount) count++;
    if (maxAmount) count++;
    if (sortBy !== "bill_date" || sortOrder !== "desc") count++;
    return count;
  }, [minAmount, maxAmount, sortBy, sortOrder]);

  const sortOptions: ReportSortOption[] = useMemo(
    () => [
      { value: "bill_date-desc", label: t("sortDateDesc") },
      { value: "bill_date-asc", label: t("sortDateAsc") },
      { value: "purchase_number-desc", label: t("sortBillDesc") },
      { value: "purchase_number-asc", label: t("sortBillAsc") },
      { value: "party_name-asc", label: t("sortSupplier") },
      { value: "total_amount-desc", label: t("sortAmountDesc") },
      { value: "total_amount-asc", label: t("sortAmountAsc") },
      { value: "paid_amount-desc", label: t("sortPaidDesc") },
      { value: "paid_amount-asc", label: t("sortPaidAsc") },
      { value: "balance_due-desc", label: t("sortBalanceDesc") },
      { value: "balance_due-asc", label: t("sortBalanceAsc") },
    ],
    [t]
  );

  // Export to Excel
  const handleExportExcel = async () => {
    if (bills.length === 0 || totalCount === 0) {
      toast.error(t("noData"));
      return;
    }
    try {
      setIsExportingExcel(true);
      const fullData = await fetchReportData(true);
      const exportBills = fullData?.bills || bills;
      if (!exportBills || exportBills.length === 0) {
        toast.error(t("noData"));
        return;
      }
      const exportSummary = fullData?.summary || summary;
      exportPurchaseReportToExcel(exportBills, exportSummary);
    } catch (err) {
      console.error("Failed to export Excel:", err);
      toast.error(tCommon("exportError") || "Export failed");
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Export to PDF
  const handleExportPdf = async () => {
    if (bills.length === 0 || totalCount === 0) {
      toast.error(t("noData"));
      return;
    }
    setIsExportingPdf(true);
    try {
      const fullData = await fetchReportData(true);
      const itemsToExport = fullData?.bills && fullData.bills.length > 0 ? fullData.bills : bills;
      if (!itemsToExport || itemsToExport.length === 0) {
        toast.error(t("noData"));
        return;
      }
      setPdfBills(itemsToExport);

      await new Promise((resolve) => setTimeout(resolve, 400));
      if (!reportRef.current) return;

      await exportReportToPdf({
        element: reportRef.current,
        filename: `purchase-report-${fromDate}_to_${toDate}.pdf`,
        watermarkText: tCommon("pdfWatermarkText"),
      });
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      toast.error(tCommon("exportError") || "Failed to generate PDF");
    } finally {
      setIsExportingPdf(false);
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
        className: "whitespace-nowrap text-xs font-medium text-foreground",
        cell: (row) => formatStatementDate(row.bill_date || row.created_at),
      },
      {
        id: "purchase_number",
        header: t("billNo"),
        accessorKey: "purchase_number",
        className: "whitespace-nowrap font-semibold text-xs text-foreground",
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
        className: "font-medium text-xs text-foreground",
        cell: (row) => row.party_name || "-",
      },
      {
        id: "quantity",
        header: t("quantity"),
        className: "text-center text-xs text-foreground whitespace-nowrap",
        cell: (row) => {
          const totalQty =
            row.total_quantity ??
            row.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) ??
            row.items_count ??
            0;
          return (
            <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-foreground">
              <Package className="h-3 w-3 text-foreground" />
              <span>{totalQty}</span>
            </div>
          );
        },
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
        cell: (row) => (
          <div className="flex justify-center">
            <ReportStatusBadge status={row.status} label={t(row.status)} isTable={true} />
          </div>
        ),
      },
    ],
    [t]
  );

  // PDF Columns & KPIs
  const pdfColumns: PdfTableColumn<PurchaseReportBill>[] = useMemo(
    () => [
      {
        header: t("date"),
        align: "left",
        width: "90px",
        render: (row) => formatStatementDate(row.bill_date || row.created_at),
      },
      {
        header: t("billNo"),
        align: "left",
        width: "110px",
        render: (row) => row.purchase_number || row.bill_number || "-",
      },
      {
        header: t("supplierName"),
        align: "left",
        width: "160px",
        render: (row) => row.party_name || "-",
      },
      {
        header: t("quantity"),
        align: "center",
        width: "55px",
        render: (row) =>
          row.total_quantity ??
          row.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) ??
          row.items_count ??
          0,
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
        label: t("totalPurchases"),
        value: formatCurrency(summary.totalPurchases),
        subValue: `${summary.totalBillsCount} ${t("totalBills")}`,
      },
      {
        label: t("totalPaid"),
        value: formatCurrency(summary.totalPaid),
        subValue: `${summary.fullyPaidCount} ${t("paidBills")}`,
      },
      {
        label: t("balanceDue"),
        value: formatCurrency(summary.totalBalanceDue),
        subValue: `${summary.unpaidCount + summary.partialCount} ${t("unpaidBills")}`,
        highlight: summary.totalBalanceDue > 0,
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
      { content: tCommon("total") || "Total", colSpan: 4, align: "left" },
      { content: formatCurrency(summary.totalPurchases), align: "right" },
      { content: formatCurrency(summary.totalPaid), align: "right" },
      { content: formatCurrency(summary.totalBalanceDue), align: "right" },
      { content: "", align: "center" },
    ],
    [summary, tCommon]
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Top Page Header */}
      <PageHeader
        backHref={`/${locale}/admin/reports`}
        title={t("title")}
        description={t("description")}
        actions={
          can("reports", "export_purchase_report") ? (
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

      {/* Date Presets Row (Standard Reusable Component) */}
      <ReportDatePresets
        activePreset={activePreset}
        onSelectPreset={handleSelectPreset}
      />

      {/* Main Filters Card (Standard Component) */}
      <ReportFilterCard
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={handleFromDateChange}
        onToDateChange={handleToDateChange}
        fromDateLabel={t("fromDate")}
        toDateLabel={t("toDate")}
        paymentStatus={paymentStatus}
        onPaymentStatusChange={(val) => {
          setPaymentStatus(val);
          setCurrentPage(1);
        }}
        paymentStatusLabel={t("paymentStatus")}
        allStatusesLabel={t("allStatuses")}
        paidLabel={t("paid")}
        partialLabel={t("partial")}
        unpaidLabel={t("unpaid")}
        searchTerm={searchTerm}
        onSearchTermChange={(val) => {
          setSearchTerm(val);
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

      {/* KPI Summary StatCards (3 Cards) */}
      <ReportKpiSummary
        isLoading={loading}
        items={[
          {
            title: t("totalPurchases"),
            value: formatCurrency(summary.totalPurchases),
            icon: <ShoppingCart className="h-4 w-4 text-cyan-600" />,
            subValue: `${summary.totalBillsCount} ${t("totalBills")}`,
          },
          {
            title: t("totalPaid"),
            value: formatCurrency(summary.totalPaid),
            icon: <CreditCard className="h-4 w-4 text-emerald-600" />,
            subValue: `${summary.fullyPaidCount} ${t("paidBills")}`,
          },
          {
            title: t("balanceDue"),
            value: formatCurrency(summary.totalBalanceDue),
            icon: <AlertCircle className="h-4 w-4 text-rose-600" />,
            subValue: `${summary.unpaidCount + summary.partialCount} ${t("unpaidBills")}`,
            isExpense: summary.totalBalanceDue > 0,
          },
        ]}
      />

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={bills}
        isLoading={loading}
        sortConfig={{ key: sortBy, direction: sortOrder }}
        onSort={handleSort}
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
          <ReportMobileCard
            number={row.purchase_number || row.bill_number}
            partyName={row.party_name}
            formattedDate={formatStatementDate(row.bill_date || row.created_at)}
            status={row.status}
            statusLabel={t(row.status)}
            itemsCount={
              row.total_quantity ??
              row.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) ??
              row.items_count ??
              0
            }
            itemsLabel={t("quantity")}
            totalAmount={formatCurrency(row.total_amount)}
            totalAmountLabel={t("totalAmount")}
            paidAmount={formatCurrency(row.paid_amount)}
            paidAmountLabel={t("paidAmount")}
            balanceDue={formatCurrency(row.balance_due)}
            balanceDueLabel={t("balance")}
          />
        )}
      />

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
