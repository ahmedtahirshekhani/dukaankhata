// src/app/[locale]/admin/reports/receivable-summary/page.tsx
"use client";

import { useTranslations, useLocale } from "next-intl";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  FileDown,
  TrendingUp,
  TrendingDown,
  Loader2,
  Printer,
  UserCheck,
  Filter as FilterIcon,
  ArrowLeft,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { exportReceivableSummaryToExcel } from "@/lib/excel";
import { formatCurrency } from "@/lib/utils";
import {
  ReceivableDebtorItem,
  ReceivableSummaryStats,
} from "@/types/reports";
import {
  ReportPdfHeader,
  ReportPdfKpi,
  ReportPdfMetaItem,
} from "@/components/reports/report-pdf-header";
import { ReportPdfModal } from "@/components/reports/report-pdf-modal";
import { PdfTable, PdfTableColumn } from "@/components/reports/pdf-table";

export default function ReceivableSummaryPage() {
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const { can } = usePermissions();
  const tCommon = useTranslations("common");
  const tRec = useTranslations("receivableSummaryPage");

  // Localized title & descriptions with custom fallbacks
  const titleStr = tRec("title") || tNav("receivableSummary") || "Receivable Summary";
  const descStr = tRec("description") || "Summary of outstanding receivables";

  // Search and Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter States
  const [statusFilter, setStatusFilter] = useState("all");
  const [minBalance, setMinBalance] = useState("");
  const [maxBalance, setMaxBalance] = useState("");
  const debouncedMinBalance = useDebounce(minBalance, 500);
  const debouncedMaxBalance = useDebounce(maxBalance, 500);
  const [pdfDebtors, setPdfDebtors] = useState<ReceivableDebtorItem[]>([]);

  // States for API data
  const [debtors, setDebtors] = useState<ReceivableDebtorItem[]>([]);
  const [summary, setSummary] = useState<ReceivableSummaryStats>({
    totalReceivable: 0,
    totalDebtors: 0,
    maxReceivable: 0,
    avgReceivable: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Branding for PDF Export
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

  // Load Company Branding
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

  // Fetch report handler
  const fetchReceivableReport = useCallback(async (isExportMode = false) => {
    if (!isExportMode) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
    }

    const signal = !isExportMode ? abortControllerRef.current?.signal : undefined;

    try {
      if (!isExportMode) setLoading(true);

      const url = new URL("/api/reports/receivable-summary", window.location.origin);
      url.searchParams.set("page", String(isExportMode ? 1 : currentPage));
      url.searchParams.set("limit", String(isExportMode ? -1 : pageSize));

      if (debouncedSearchTerm) {
        url.searchParams.set("search", debouncedSearchTerm);
      }
      if (statusFilter && statusFilter !== "all") {
        url.searchParams.set("status", statusFilter);
      }
      if (debouncedMinBalance) {
        url.searchParams.set("minBalance", debouncedMinBalance);
      }
      if (debouncedMaxBalance) {
        url.searchParams.set("maxBalance", debouncedMaxBalance);
      }

      const res = await fetch(url.toString(), { signal });
      if (!res.ok) throw new Error("Failed to fetch receivable summary");

      const data = await res.json();

      if (isExportMode) {
        return data.debtors;
      } else {
        setDebtors(data.debtors || []);
        setSummary(data.summary || {});
        setTotalCount(data.pagination?.totalCount || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Error loading receivable summary:", err);
      }
    } finally {
      if (!isExportMode && !signal?.aborted) setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearchTerm, statusFilter, debouncedMinBalance, debouncedMaxBalance]);

  // Fetch whenever page or search/filter terms change
  useEffect(() => {
    fetchReceivableReport();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchReceivableReport]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, debouncedMinBalance, debouncedMaxBalance, pageSize]);

  // Excel Export Handler
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const allFilteredDebtors = await fetchReceivableReport(true);
      if (allFilteredDebtors && allFilteredDebtors.length > 0) {
        const filename = `receivable-summary-${new Date().toISOString().split("T")[0]}.xlsx`;
        exportReceivableSummaryToExcel(allFilteredDebtors, filename);
      }
    } catch (err) {
      console.error("Export to Excel failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // PDF Export Handler
  const handleExportPdf = useCallback(async () => {
    setIsExportingPdf(true);
    try {
      const allFilteredDebtors = await fetchReceivableReport(true);
      const itemsToExport = allFilteredDebtors && allFilteredDebtors.length > 0 ? allFilteredDebtors : debtors;
      setPdfDebtors(itemsToExport);

      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!reportRef.current) return;

      const mod = await import("html2pdf.js");
      const html2pdf = (mod as any).default || mod;

      await html2pdf()
        .set({
          margin: [6, 6, 6, 6],
          filename: `receivable-summary-${new Date().toISOString().split("T")[0]}.pdf`,
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
      console.error("PDF data fetch failed:", error);
    } finally {
      setIsExportingPdf(false);
    }
  }, [fetchReceivableReport, debtors, tCommon]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setMinBalance("");
    setMaxBalance("");
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(statusFilter !== "all" || minBalance !== "" || maxBalance !== "");

  const pdfKpis: ReportPdfKpi[] = useMemo(() => [
    { label: tRec("totalOutstanding") || "Total Outstanding", value: formatCurrency(summary.totalReceivable), highlight: true },
    { label: tRec("totalDebtors") || "Total Debtors", value: summary.totalDebtors || 0 },
    { label: tRec("avgOutstanding") || "Avg Outstanding", value: formatCurrency(summary.avgReceivable) },
    { label: tRec("maxReceivable") || "Max Receivable", value: formatCurrency(summary.maxReceivable) },
  ], [summary, tRec]);

  const pdfMetaItems: ReportPdfMetaItem[] = useMemo(() => [
    { label: "Status Filter", value: statusFilter === "all" ? "All Statuses" : statusFilter.toUpperCase() },
    { label: "Total Debtors", value: String(summary.totalDebtors || 0) },
    { label: "Generated", value: new Date().toLocaleDateString("en-GB") },
  ], [statusFilter, summary.totalDebtors]);

  const pdfColumns: PdfTableColumn<ReceivableDebtorItem>[] = useMemo(
    () => [
      {
        id: "name",
        header: tRec("partyName") || "Party Name",
        align: "left",
        render: (row) => <span className="font-bold text-slate-900">{row.name}</span>,
      },
      {
        id: "company",
        header: tRec("companyName") || "Company",
        width: "140px",
        align: "left",
        render: (row) => <span className="text-slate-600">{row.company_name || "-"}</span>,
      },
      {
        id: "contact",
        header: tRec("contactInformation") || "Contact",
        width: "150px",
        align: "left",
        render: (row) => <span className="text-slate-600">{row.phone || row.email || "-"}</span>,
      },
      {
        id: "balance",
        header: tRec("outstandingBalance") || "Outstanding",
        width: "130px",
        align: "right",
        render: (row) => (
          <span className="font-bold text-slate-900">
            {formatCurrency(row.balance || 0)}
          </span>
        ),
      },
      // {
      //   id: "status",
      //   header: tRec("status") || "Status",
      //   width: "90px",
      //   align: "center",
      //   render: (row) => (
      //     <span className="font-medium text-slate-700 capitalize">
      //       {row.status || "active"}
      //     </span>
      //   ),
      // },
    ],
    [tRec]
  );

  // DataTable columns definition
  const columns: ColumnDef<ReceivableDebtorItem>[] = useMemo(() => [
    {
      id: "name",
      header: tRec("partyName") || "Party Name",
      accessorKey: "name",
      sortable: true,
      className: "min-w-[180px] font-semibold text-foreground text-xs sm:text-sm",
      cell: (row) => row.name,
    },
    {
      id: "company_name",
      header: tRec("companyName") || "Company Name",
      accessorKey: "company_name",
      className: "w-[160px] text-xs text-muted-foreground",
      cell: (row) => row.company_name || "-",
    },
    {
      id: "contactInformation",
      header: tRec("contactInformation") || "Contact Information",
      className: "w-[160px] text-xs text-muted-foreground",
      cell: (row) => (
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {row.phone && <span>{row.phone}</span>}
          {row.email && <span className="text-muted-foreground/60">{row.email}</span>}
          {!row.phone && !row.email && <span>-</span>}
        </div>
      ),
    },
    {
      id: "balance",
      header: tRec("outstandingBalance") || "Outstanding Balance",
      accessorKey: "balance",
      sortable: true,
      className: "w-[180px] font-bold text-foreground text-xs sm:text-sm",
      cell: (row) => formatCurrency(row.balance || 0),
    },
    // {
    //   id: "status",
    //   header: tRec("status") || "Status",
    //   accessorKey: "status",
    //   className: "w-[120px] text-center",
    //   cell: (row) => {
    //     const isActive = row.status === "active";
    //     return (
    //       <span
    //         className={`inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${isActive
    //             ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
    //             : "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-400"
    //           }`}
    //       >
    //         {isActive ? tRec("active") || "Active" : tRec("inactive") || "Inactive"}
    //       </span>
    //     );
    //   },
    // },
  ], [tRec]);

  // Mobile card rendering
  const renderMobileCard = useCallback((debtor: ReceivableDebtorItem) => {
    const balance = debtor.balance || 0;
    const isActive = debtor.status === "active";
    const hasCompanyName = Boolean(
      debtor.company_name &&
      debtor.company_name.trim() !== "" &&
      debtor.company_name !== "-"
    );

    return (
      <div className="bg-card border rounded-lg p-3.5 shadow-sm space-y-2.5">
        <div className="flex justify-between items-start gap-2 border-b border-zinc-100 dark:border-zinc-800/60 pb-2">
          <h3 className="font-semibold text-sm text-foreground truncate max-w-[70%]">
            {debtor.name}
          </h3>
          {/* <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isActive
                ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                : "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
          >
            {isActive ? tRec("active") || "Active" : tRec("inactive") || "Inactive"}
          </span> */}
        </div>

        <div className="space-y-2 text-xs">
          {hasCompanyName && (
            <div className="flex justify-between items-center text-muted-foreground">
              <span>{tRec("companyName") || "Company"}:</span>
              <span className="font-medium text-foreground">{debtor.company_name}</span>
            </div>
          )}

          {(debtor.phone || debtor.email) && (
            <div className="flex justify-between items-center text-muted-foreground">
              <span>{tRec("contactInformation") || "Contact"}:</span>
              <span className="font-medium text-foreground">
                {debtor.phone || debtor.email || "-"}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-1.5 border-t border-zinc-100 dark:border-zinc-800/40">
            <span className="text-muted-foreground font-medium">{tRec("outstandingBalance") || "Outstanding"}:</span>
            <span className="font-bold text-foreground text-sm">
              {formatCurrency(balance)}
            </span>
          </div>
        </div>
      </div>
    );
  }, [tRec]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Reusable PageHeader */}
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="h-7 w-7 rounded-full">
              <Link href={`/${locale}/admin/reports`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <span className="text-xl font-bold">{titleStr}</span>
          </div>
        }
        description={descStr}
        actions={
          can("reports", "export_receivable_summary") ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={isExporting || debtors.length === 0}
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
                disabled={isExportingPdf || debtors.length === 0}
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

      {/* Summary KPI Grid with Reusable StatCards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={tRec("totalOutstanding") || "Total Outstanding"}
          value={formatCurrency(summary.totalReceivable)}
          subValue={tRec("totalOutstandingDesc")}
          icon={TrendingUp}
          isLoading={loading}
        />
        <StatCard
          title={tRec("totalDebtors") || "Total Debtors"}
          value={summary.totalDebtors || 0}
          subValue={tRec("totalDebtorsDesc")}
          icon={Users}
          isLoading={loading}
        />
        <StatCard
          title={tRec("avgOutstanding") || "Avg Outstanding"}
          value={formatCurrency(summary.avgReceivable)}
          subValue={tRec("avgOutstandingDesc")}
          icon={UserCheck}
          isLoading={loading}
        />
        <StatCard
          title={tRec("maxReceivable") || "Max Receivable"}
          value={formatCurrency(summary.maxReceivable)}
          subValue={tRec("maxReceivableDesc")}
          icon={TrendingDown}
          isLoading={loading}
        />
      </div>

      {/* Main DataTable Container */}
      <DataTable
        columns={columns}
        data={debtors}
        isLoading={loading}
        pageSize={pageSize}
        currentPage={currentPage}
        totalCount={totalCount}
        onPageChange={(p) => setCurrentPage(p)}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setCurrentPage(1);
        }}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={tRec("searchPlaceholder") || "Search parties..."}
        keyExtractor={(item) => String(item.id)}
        renderMobileCard={renderMobileCard}
        toolbarActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`gap-1 h-9 px-2.5 sm:px-3 text-xs shrink-0 ${hasActiveFilters ? "border-primary text-primary" : ""
                  }`}
              >
                <FilterIcon className="h-3.5 w-3.5" />
                <span>{tCommon("filter") || "Filter"}</span>
                {hasActiveFilters && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-3 space-y-3">
              {/* Status Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  {tRec("status") || "Status"}
                </Label>
                <Select
                  value={statusFilter}
                  onValueChange={(val) => setStatusFilter(val)}
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">{tRec("active") || "Active"}</SelectItem>
                    <SelectItem value="inactive">{tRec("inactive") || "Inactive"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Balance Range Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">
                  {tRec("outstandingBalance") || "Balance Range"}
                </Label>
                <div className="flex items-center gap-2">
                  <NumericInput
                    min="0"
                    placeholder="Min"
                    value={minBalance}
                    onChange={(e) => setMinBalance(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                  <span className="text-xs text-muted-foreground">-</span>
                  <NumericInput
                    min="0"
                    placeholder="Max"
                    value={maxBalance}
                    onChange={(e) => setMaxBalance(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="w-full h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 mt-1"
                >
                  {tCommon("clearFilters") || "Clear Filters"}
                </Button>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* PDF Preview & Auto-Download Dialog Modal */}
      <ReportPdfModal
        isOpen={isExportingPdf}
        onOpenChange={setIsExportingPdf}
        title="PDF Report Preview"
        description="Preparing & downloading your portrait receivable summary PDF..."
        reportRef={reportRef}
        width="794px"
        isPortrait={true}
      >
        <ReportPdfHeader
          branding={branding}
          title={titleStr}
          subtitle={descStr}
          fromDate="All Records"
          toDate={new Date().toISOString().split("T")[0]}
          metaItems={pdfMetaItems}
          kpis={pdfKpis}
        />

        {/* Reusable PDF Table */}
        <PdfTable
          columns={pdfColumns}
          data={pdfDebtors.length > 0 ? pdfDebtors : debtors}
          emptyMessage={tRec("noDebtors") || "No debtors found"}
        />
      </ReportPdfModal>
    </div>
  );
}

