// src/app/[locale]/admin/reports/sale-report/page.tsx
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
import { exportSaleReportToExcel } from "@/lib/excel";
import { formatCurrency, formatStatementDate } from "@/lib/utils";
import { toHTMLDateString } from "@/lib/date-utils";
import { useDebounce } from "@/hooks/use-debounce";
import { usePermissions } from "@/hooks/use-permissions";
import { SaleReportInvoice, SaleReportSummary } from "@/types/reports";
import { toast } from "sonner";
import { TrendingUp, CreditCard, AlertCircle, Package } from "lucide-react";

export default function SaleReportPage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const t = useTranslations("saleReportPage");
  const { can } = usePermissions();

  // Date States (defaults to thisMonth)
  const defaultDateRange = useMemo(() => getPresetDateRange("thisMonth"), []);
  const [fromDate, setFromDate] = useState<string>(defaultDateRange.fromDate);
  const [toDate, setToDate] = useState<string>(defaultDateRange.toDate);
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
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

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

  const handleResetFilters = () => {
    const range = getPresetDateRange("thisMonth");
    setActivePreset("thisMonth");
    setFromDate(range.fromDate);
    setToDate(range.toDate);
    setPaymentStatus("all");
    setSearchTerm("");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("invoice_date");
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
        "invoice_date",
        "date",
        "created_at",
        "total_amount",
        "paid_amount",
        "balance_due",
        "invoice_number",
      ].includes(key);
      setSortOrder(isDescDefault ? "desc" : "asc");
    }
    setCurrentPage(1);
  };

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (minAmount) count++;
    if (maxAmount) count++;
    if (sortBy !== "invoice_date" || sortOrder !== "desc") count++;
    return count;
  }, [minAmount, maxAmount, sortBy, sortOrder]);

  const sortOptions: ReportSortOption[] = useMemo(
    () => [
      { value: "invoice_date-desc", label: t("sortDateDesc") },
      { value: "invoice_date-asc", label: t("sortDateAsc") },
      { value: "invoice_number-desc", label: t("sortInvoiceDesc") },
      { value: "invoice_number-asc", label: t("sortInvoiceAsc") },
      { value: "customer_name-asc", label: t("sortCustomer") },
      { value: "total_amount-desc", label: t("sortAmountDesc") },
      { value: "total_amount-asc", label: t("sortAmountAsc") },
      { value: "paid_amount-desc", label: t("sortPaidDesc") },
      { value: "paid_amount-asc", label: t("sortPaidAsc") },
      { value: "balance_due-desc", label: t("sortBalanceDesc") },
      { value: "balance_due-asc", label: t("sortBalanceAsc") },
    ],
    [t]
  );

  const handleExportExcel = async () => {
    if (invoices.length === 0 || totalCount === 0) {
      toast.error(t("noData"));
      return;
    }
    try {
      setIsExportingExcel(true);
      const allData = await fetchReportData(-1);
      const invoicesToExport = allData?.invoices || invoices;
      if (!invoicesToExport || invoicesToExport.length === 0) {
        toast.error(t("noData"));
        return;
      }
      const summaryToExport = allData?.summary || summary;
      exportSaleReportToExcel(
        invoicesToExport,
        summaryToExport,
        `sale-report-${fromDate || "all"}-to-${toDate || "all"}.xlsx`
      );
    } catch (err) {
      console.error("Export Excel error:", err);
      toast.error(tCommon("exportError"));
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    if (invoices.length === 0 || totalCount === 0) {
      toast.error(t("noData"));
      return;
    }
    setIsExportingPdf(true);
    try {
      const fullData = await fetchReportData(-1);
      const itemsToExport = fullData?.invoices && fullData.invoices.length > 0 ? fullData.invoices : invoices;
      if (!itemsToExport || itemsToExport.length === 0) {
        toast.error(t("noData"));
        return;
      }
      setPdfInvoices(itemsToExport);

      await new Promise((resolve) => setTimeout(resolve, 400));
      if (!reportRef.current) return;

      await exportReportToPdf({
        element: reportRef.current,
        filename: `sale-report-${fromDate || "all"}_to_${toDate || "all"}.pdf`,
        watermarkText: tCommon("pdfWatermarkText"),
      });
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      toast.error(tCommon("exportError"));
    } finally {
      setIsExportingPdf(false);
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
        cell: (row) => formatStatementDate(row.invoice_date || row.created_at),
      },
      {
        id: "invoice_number",
        header: t("invoiceNo"),
        accessorKey: "invoice_number",
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
        render: (row) => formatStatementDate(row.invoice_date || row.created_at),
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
          can("reports", "export_sale_report") ? (
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
            title: t("totalSales"),
            value: formatCurrency(summary.totalSales),
            icon: <TrendingUp className="h-4 w-4 text-emerald-600" />,
            subValue: `${summary.totalInvoicesCount} ${t("totalInvoices")}`,
          },
          {
            title: t("totalReceived"),
            value: formatCurrency(summary.totalReceived),
            icon: <CreditCard className="h-4 w-4 text-emerald-600" />,
            subValue: `${summary.fullyPaidCount} ${t("paidInvoices")}`,
          },
          {
            title: t("balanceDue"),
            value: formatCurrency(summary.totalBalanceDue),
            icon: <AlertCircle className="h-4 w-4 text-rose-600" />,
            subValue: `${summary.unpaidCount + summary.partialCount} ${t("unpaidInvoices")}`,
            isExpense: summary.totalBalanceDue > 0,
          },
        ]}
      />

      {/* Main Data Table */}
      <DataTable<SaleReportInvoice>
        columns={columns}
        data={invoices}
        isLoading={loading}
        sortConfig={{ key: sortBy, direction: sortOrder }}
        onSort={handleSort}
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
          <ReportMobileCard
            number={row.invoice_number}
            partyName={row.customer_name}
            formattedDate={formatStatementDate(row.invoice_date || row.created_at)}
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
