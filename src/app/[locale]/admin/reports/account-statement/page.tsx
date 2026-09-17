"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatStatementDate } from "@/lib/utils";
import { toHTMLDateString, getDaysAgoHTMLDate, getTodayHTMLDate } from "@/lib/date-utils";
import {
  FileText,
  Loader2,
  Calendar,
  Search,
  Printer,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  ArrowRightLeft,
  ArrowLeft,
} from "lucide-react";
import { PartyDropdown } from "@/components/dropdown/party-dropdown";
import {
  StatementTransaction,
  StatementSummary,
  StatementReportMeta as ReportMeta,
} from "@/types/reports";
import { ReportPdfHeader, ReportPdfKpi, ReportPdfMetaItem } from "@/components/reports/report-pdf-header";
import { ReportPdfModal } from "@/components/reports/report-pdf-modal";

export default function AccountStatementPage() {
  const t = useTranslations("accountStatement");
  const tNav = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { can } = usePermissions();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>(() => getDaysAgoHTMLDate(30));
  const [toDate, setToDate] = useState<string>(() => getTodayHTMLDate());
  const [transactions, setTransactions] = useState<StatementTransaction[]>([]);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [reportMeta, setReportMeta] = useState<ReportMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [branding, setBranding] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    logo: null as string | null,
  });

  // Fetch branding
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

  const fetchStatement = useCallback(async () => {
    if (!selectedCustomerId || !fromDate || !toDate) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        customerId: selectedCustomerId,
        fromDate,
        toDate,
      });
      const res = await fetch(
        `/${locale}/api/account-statement?${params.toString()}`,
      );
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setSummary(data.summary || null);
        setReportMeta(data.reportMeta || null);
      } else {
        setTransactions([]);
        setSummary(null);
        setReportMeta(null);
      }
    } catch (err) {
      console.error("Failed to fetch account statement:", err);
      setTransactions([]);
      setSummary(null);
      setReportMeta(null);
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerId, fromDate, toDate, locale]);

  const handleGenerateStatement = () => {
    if (!isFormValid) return;
    fetchStatement();
  };

  const isFormValid = useMemo(
    () => Boolean(selectedCustomerId && fromDate && toDate),
    [selectedCustomerId, fromDate, toDate]
  );

  const handleExportPdf = useCallback(async () => {
    setExportingPdf(true);

    // Give React time to mount the Dialog and reportRef container in DOM
    await new Promise((resolve) => setTimeout(resolve, 350));

    if (!reportRef.current) {
        setExportingPdf(false);
        return;
    }

    const pdfHeader = reportRef.current.querySelector(".pdf-header") as HTMLElement;
    try {
      if (pdfHeader) pdfHeader.style.display = "block";

      // Force columns to show for PDF capture
      if (reportRef.current) {
        reportRef.current.classList.add("is-exporting");
      }

      // Reset scroll for all horizontal scroll containers inside reportRef
      const scrollContainers = reportRef.current.querySelectorAll(".overflow-x-auto");
      scrollContainers.forEach((el: any) => {
        el.scrollLeft = 0;
      });

      const opt = {
        margin: [4, 4, 4, 4],
        filename: `Statement-${reportMeta?.customerName || "Customer"}-${reportMeta?.fromDate || fromDate}-to-${reportMeta?.toDate || toDate}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollY: 0,
          scrollX: 0,
          windowWidth: 1200,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "landscape",
        },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };

      const mod = await import("html2pdf.js");
      const html2pdf = (mod as any).default || mod;

      await html2pdf()
        .set(opt)
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
              297 / 2,
              210 - 4,
              { align: "center" }
            );
          }
        })
        .save();
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    } finally {
      if (pdfHeader) pdfHeader.style.display = "none";
      if (reportRef.current) {
        reportRef.current.classList.remove("is-exporting");
      }
      setExportingPdf(false);
    }
  }, [reportMeta, fromDate, toDate, tCommon]);

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return "text-red-600";
    if (balance < 0) return "text-green-600";
    return "text-gray-600";
  };

  const getTransactionType = (type: string) => {
    const types: Record<string, string> = {
      order: t("typeOrder"),
      order_return: t("typeOrderReturn"),
      payment_in: t("typePaymentIn"),
      payment_out: t("typePaymentOut"),
      purchase_bill: t("typePurchase"),
      purchase_bill_payment: t("typePurchaseBillPayment"),
      adjustment: t("typeAdjustment"),
      sale_return: t("typeSaleReturn"),
      opening_balance: t("typeOpeningBalance"),
    };
    return types[type] || type;
  };

  const totalDebit = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
  const totalCredit = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);

  const [searchTerm, setSearchTerm] = useState("");

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return transactions;
    const term = searchTerm.toLowerCase();
    return transactions.filter((t) => {
      return (
        t.description?.toLowerCase().includes(term) ||
        t.orderId?.toLowerCase().includes(term) ||
        t.type?.toLowerCase().includes(term) ||
        t.items?.some((item) => item.name?.toLowerCase().includes(term))
      );
    });
  }, [transactions, searchTerm]);

  // DataTable Columns Definition
  const columns: ColumnDef<StatementTransaction>[] = useMemo(
    () => [
      {
        id: "dateTime",
        accessorKey: "dateTime",
        header: t("date") || "Date",
        className: "w-[110px] text-center text-xs text-muted-foreground",
        cell: (row) => formatStatementDate(row.dateTime),
      },
      {
        id: "voucher",
        header: t("voucher") || "Voucher #",
        className: "w-[90px] text-center text-xs text-muted-foreground max-w-[100px] break-all whitespace-normal",
        cell: (row) => row.orderId || "-",
      },
      {
        id: "type",
        header: t("type") || "Type",
        className: "w-[100px] text-center text-xs",
        cell: (row) => (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground">
            {getTransactionType(row.type)}
          </span>
        ),
      },
      {
        id: "description",
        header: t("descriptionItems") || "Description / Items",
        className: "min-w-[220px]",
        cell: (row) => {
          const hasItems = row.items && row.items.length > 0;
          return (
            <div>
              <div className="text-xs text-foreground font-medium">{row.description}</div>
              {hasItems && (
                <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
                  {row.items?.map((item, itemIdx) => (
                    <div key={itemIdx}>
                      • {item.name}
                      <span className="ml-1 text-muted-foreground/60">(x{item.quantity})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "debit",
        header: <div className="text-right">{t("debit") || "Debit"}</div>,
        className: "w-[110px] text-right text-xs text-foreground font-medium",
        cell: (row) => (row.debit ? formatCurrency(row.debit) : "-"),
      },
      {
        id: "credit",
        header: <div className="text-right">{t("credit") || "Credit"}</div>,
        className: "w-[110px] text-right text-xs text-foreground font-medium",
        cell: (row) => (row.credit ? formatCurrency(row.credit) : "-"),
      },
      {
        id: "balance",
        header: <div className="text-right">{t("balance") || "Balance"}</div>,
        className: "w-[120px] text-right text-xs font-semibold",
        cell: (row) => (
          <span className={getBalanceColor(row.balance)}>
            {formatCurrency(row.balance)}
          </span>
        ),
      },
    ],
    [t]
  );

  // Responsive Mobile Card Renderer
  const renderMobileCard = useCallback(
    (txn: StatementTransaction) => {
      const isOpening = txn.id === "opening_balance";
      const hasItems = txn.items && txn.items.length > 0;
      return (
        <div
          key={txn.id}
          className={`bg-card border rounded-lg p-3.5 shadow-sm space-y-2 ${
            isOpening ? "bg-muted/30 border-primary/20" : "border-border/60"
          }`}
        >
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-medium">
              {formatStatementDate(txn.dateTime)}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground">
              {getTransactionType(txn.type)} {txn.orderId ? `(${txn.orderId})` : ""}
            </span>
          </div>

          <div className="text-xs text-foreground">
            <div className="font-medium">{txn.description}</div>
            {hasItems && (
              <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5 pl-2 border-l-2 border-border">
                {txn.items?.map((item, itemIdx) => (
                  <div key={itemIdx}>
                    • {item.name} <span className="text-muted-foreground/60">(x{item.quantity})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-border/60 text-xs">
            <div>
              {txn.debit ? (
                <span className="text-foreground font-semibold">
                  {t("debit") || "Debit"}: {formatCurrency(txn.debit)}
                </span>
              ) : txn.credit ? (
                <span className="text-foreground font-semibold">
                  {t("credit") || "Credit"}: {formatCurrency(txn.credit)}
                </span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground font-medium mr-1">{t("balance")}:</span>
              <span className={`font-semibold ${getBalanceColor(txn.balance)}`}>
                {formatCurrency(txn.balance)}
              </span>
            </div>
          </div>
        </div>
      );
    },
    [t]
  );

  const pdfKpis: ReportPdfKpi[] = useMemo(() => {
    if (!summary) return [];
    return [
      { label: t("openingBalance") || "Opening Balance", value: formatCurrency(summary.openingBalance) },
      {
        label: t("netOrders") || "Net Orders",
        value: formatCurrency((summary.totalOrders || 0) - (summary.totalPurchaseBills || 0)),
      },
      {
        label: t("netPayments") || "Net Payments",
        value: formatCurrency((summary.totalPaymentsIn || 0) - (summary.totalPaymentsOut || 0)),
      },
      { label: t("totalDebit") || "Total Debit", value: formatCurrency(totalDebit) },
      { label: t("totalCredit") || "Total Credit", value: formatCurrency(totalCredit) },
      {
        label: t("closingBalance") || "Closing Balance",
        value: formatCurrency(summary.currentBalance),
        highlight: true,
      },
    ];
  }, [summary, totalDebit, totalCredit, t]);

  const pdfMetaItems: ReportPdfMetaItem[] = useMemo(() => {
    if (!reportMeta) return [];
    return [
      { label: t("customer") || "Party", value: reportMeta.customerName },
      { label: "Party ID", value: reportMeta.customerId || "-" },
    ];
  }, [reportMeta, t]);

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
            <span className="text-xl font-bold">{t("title") || "Party Statement"}</span>
          </div>
        }
        description={t("modalDescription") || "Generate party statement for date range"}
        actions={
          can("reports", "export_account_statement") && transactions.length > 0 ? (
            <Button
              size="sm"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="h-7 text-[11px] px-2 gap-1 bg-sky-500 hover:bg-sky-600 text-white shadow-none"
            >
              {exportingPdf ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Printer className="h-3 w-3" />
              )}
              <span>{t("downloadPdf") || "Download PDF"}</span>
            </Button>
          ) : undefined
        }
      />

      {/* Filter Section */}
      <Card className="border border-border/50 shadow-sm bg-card overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row items-end gap-3 sm:gap-4">
            {/* Party Selection */}
            <div className="flex-1 w-full space-y-1.5">
              <Label className="text-xs sm:text-sm font-medium text-muted-foreground">
                {t("selectCustomer") || "Party"}
              </Label>
              <PartyDropdown
                value={selectedCustomerId}
                onValueChange={(val, party) => {
                  setSelectedCustomerId(val);
                  setSelectedCustomerName(party?.name || "");
                }}
                placeholder={t("selectCustomerPlaceholder") || "Select Party"}
                className="w-full bg-background border-input h-9 sm:h-10 rounded-md text-xs sm:text-sm"
                filterActiveOnly={true}
                enableSearch={true}
              />
            </div>

            {/* Date Range: From: & To: side-by-side */}
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              {/* From Date */}
              <div className="flex-1 md:w-40 space-y-1">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{tCommon("from") || "From"}:</span>
                </Label>
                <DatePicker
                  value={fromDate}
                  onChange={(val) => setFromDate(val)}
                  placeholder="DD-MM-YYYY"
                  className="h-9 sm:h-10 text-xs sm:text-sm"
                />
              </div>

              {/* To Date */}
              <div className="flex-1 md:w-40 space-y-1">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{tCommon("to") || "To"}:</span>
                </Label>
                <DatePicker
                  value={toDate}
                  onChange={(val) => setToDate(val)}
                  placeholder="DD-MM-YYYY"
                  className="h-9 sm:h-10 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Generate Button */}
            <div className="w-full md:w-auto shrink-0">
              <Button
                onClick={handleGenerateStatement}
                disabled={!isFormValid || loading}
                className="w-full md:w-auto font-medium h-9 sm:h-10 px-5 sm:px-6 rounded-md transition-colors flex items-center justify-center gap-2 shadow-sm text-xs sm:text-sm"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span>{t("generateStatement") || "Generate"}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards with Reusable StatCards */}
      {summary && (
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={t("openingBalance") || "Opening Balance"}
            value={formatCurrency(summary.openingBalance)}
            icon={DollarSign}
            isLoading={loading}
          />
          <StatCard
            title={t("netOrders") || "Net Orders"}
            value={formatCurrency((summary.totalOrders || 0) - (summary.totalPurchaseBills || 0))}
            icon={Receipt}
            isLoading={loading}
          />
          <StatCard
            title={t("netPayments") || "Net Payments"}
            value={formatCurrency((summary.totalPaymentsIn || 0) - (summary.totalPaymentsOut || 0))}
            icon={ArrowRightLeft}
            isLoading={loading}
          />
          <StatCard
            title={t("currentBalance") || "Current Balance"}
            value={formatCurrency(summary.currentBalance)}
            icon={summary.currentBalance > 0 ? TrendingUp : TrendingDown}
            isLoading={loading}
          />
        </div>
      )}

      {/* Transactions Section using Reusable DataTable */}
      {hasSearched || transactions.length > 0 ? (
        <div className="flex flex-col gap-4">
          <DataTable
            columns={columns}
            data={filteredTransactions}
            isLoading={loading}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder={t("searchTransactions") || "Search transactions..."}
            keyExtractor={(txn, idx) => String(txn.id || idx)}
            renderMobileCard={renderMobileCard}
            emptyMessage={t("noTransactions") || "No transactions found for the selected period."}
          />

          {/* Statement Grand Footer Summary */}
          {transactions.length > 0 && (
            <Card className="border border-border/60 bg-muted/30 p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold uppercase">
                <span className="text-muted-foreground font-semibold text-[11px]">
                  Total Records: {transactions.length} Transactions
                </span>
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  <div>
                    <span className="text-muted-foreground">{t("totalDebit") || "Total Debit"}:</span>
                    <span className="ml-1.5 text-foreground">{formatCurrency(totalDebit)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t("totalCredit") || "Total Credit"}:</span>
                    <span className="ml-1.5 text-foreground">{formatCurrency(totalCredit)}</span>
                  </div>
                  <div className="pl-4 sm:border-l sm:border-border/60">
                    <span className="text-muted-foreground">{t("closingBalance") || "Closing Balance"}:</span>
                    <span className={`ml-1.5 ${getBalanceColor(summary?.currentBalance || 0)}`}>
                      {formatCurrency(summary?.currentBalance || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      ) : null}

          {/* PDF Preview & Auto-Download Dialog Modal */}
          <ReportPdfModal
            isOpen={exportingPdf}
            onOpenChange={setExportingPdf}
            title="PDF Report Preview"
            description="Preparing & downloading your Landscape account statement PDF..."
            reportRef={reportRef}
            width="1123px"
            isPortrait={false}
          >
            <ReportPdfHeader
              branding={branding}
              title={t("title") || "PARTY STATEMENT"}
              fromDate={reportMeta?.fromDate || fromDate}
              toDate={reportMeta?.toDate || toDate}
              metaItems={pdfMetaItems}
              kpis={pdfKpis}
            />

            {/* Main Table */}
            <Card className="border-none shadow-none bg-white overflow-hidden">
              <div className="overflow-x-auto md:overflow-visible [.is-exporting_&]:overflow-visible">
                <Table className="min-w-[800px] md:min-w-full">
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-100 [.is-exporting_&]:bg-[#0f172a] [.is-exporting_&]:border-[#0f172a]">
                      <TableHead className="w-[100px] text-center text-xs text-gray-900 font-extrabold uppercase [.is-exporting_&]:text-white">{t("date")}</TableHead>
                      <TableHead className="w-[80px] text-center text-xs text-gray-900 font-extrabold uppercase [.is-exporting_&]:text-white">{t("voucher")}</TableHead>
                      <TableHead className="w-[80px] text-center text-xs text-gray-900 font-extrabold uppercase [.is-exporting_&]:text-white">{t("type")}</TableHead>
                      <TableHead className="min-w-[200px] text-xs text-gray-900 font-extrabold uppercase [.is-exporting_&]:text-white">{t("descriptionItems")}</TableHead>
                      {/* These columns are hidden in UI but show in PDF */}
                      <TableHead className="w-[60px] text-center text-xs text-gray-900 font-extrabold uppercase hidden [.is-exporting_&]:table-cell print:table-cell [.is-exporting_&]:text-white">{t("qty")}</TableHead>
                      <TableHead className="w-[80px] text-right text-xs text-gray-900 font-extrabold uppercase hidden [.is-exporting_&]:table-cell print:table-cell [.is-exporting_&]:text-white">{t("rate")}</TableHead>
                      <TableHead className="w-[90px] text-right text-xs text-gray-900 font-extrabold uppercase hidden [.is-exporting_&]:table-cell print:table-cell [.is-exporting_&]:text-white">{t("amount")}</TableHead>
                      <TableHead className="w-[100px] text-right text-xs text-gray-900 font-extrabold uppercase [.is-exporting_&]:text-white">{t("debit")}</TableHead>
                      <TableHead className="w-[100px] text-right text-xs text-gray-900 font-extrabold uppercase [.is-exporting_&]:text-white">{t("credit")}</TableHead>
                      <TableHead className="w-[110px] text-right text-xs text-gray-900 font-extrabold uppercase [.is-exporting_&]:text-white">{t("balance")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((txn, idx) => {
                      const hasItems = txn.items && txn.items.length > 0;
                      const isOpening = txn.id === "opening_balance";
                      return (
                        <TableRow
                          key={txn.id}
                          className={`${isOpening ? "bg-blue-50/30" : ""} ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"} border-b border-gray-100`}
                        >
                          <TableCell className="text-center py-2.5 text-xs text-gray-900 font-medium">
                            {formatStatementDate(txn.dateTime)}
                          </TableCell>
                          <TableCell className="text-center py-2.5 text-xs text-gray-900 font-medium max-w-[100px] break-all whitespace-normal">
                            {txn.orderId || "-"}
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            <span className="text-xs text-gray-900 font-medium">
                              {getTransactionType(txn.type)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="text-xs text-gray-900 font-medium">
                              {txn.description}
                            </div>
                            {hasItems && (
                              <div className="text-[10px] text-gray-800 font-medium mt-1 space-y-0.5">
                                {txn.items?.map((item, itemIdx) => (
                                  <div key={itemIdx}>
                                    • {item.name}
                                    {/* Show quantity inline only in UI, not in separate column */}
                                    <span className="inline md:inline [.is-exporting_&]:hidden print:hidden ml-1">
                                      (x{item.quantity})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          {/* PDF-only columns - show quantity, rate, amount in separate lines for PDF */}
                          <TableCell className="text-center py-2.5 text-xs text-gray-900 font-medium hidden [.is-exporting_&]:table-cell print:table-cell">
                            {hasItems ? (
                              <div className="space-y-0.5">
                                {txn.items?.map((item, itemIdx) => (
                                  <div key={itemIdx}>{item.quantity}</div>
                                ))}
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right py-2.5 text-xs text-gray-900 font-medium hidden [.is-exporting_&]:table-cell print:table-cell">
                            {hasItems ? (
                              <div className="space-y-0.5">
                                {txn.items?.map((item, itemIdx) => (
                                  <div key={itemIdx}>{formatCurrency(item.price)}</div>
                                ))}
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right py-2.5 text-xs text-gray-900 font-medium hidden [.is-exporting_&]:table-cell print:table-cell">
                            {hasItems ? (
                              <div className="space-y-0.5">
                                {txn.items?.map((item, itemIdx) => (
                                  <div key={itemIdx}>{formatCurrency(item.amount)}</div>
                                ))}
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right py-2.5 text-xs text-gray-900 font-semibold">
                            {txn.debit ? formatCurrency(txn.debit) : "-"}
                          </TableCell>
                          <TableCell className="text-right py-2.5 text-xs text-gray-900 font-semibold">
                            {txn.credit ? formatCurrency(txn.credit) : "-"}
                          </TableCell>
                          <TableCell className="text-right py-2.5 text-xs font-bold text-gray-900">
                            <span className={getBalanceColor(txn.balance)}>
                              {formatCurrency(txn.balance)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Footer Summary */}
              <div className="border-t border-gray-100 bg-gray-50/30 p-3">
                <div className="flex justify-end gap-6 text-xs font-bold uppercase">
                  <div>
                    <span className="text-gray-400">{t("totalDebit")}:</span>
                    <span className="ml-2 text-gray-900">
                      {formatCurrency(totalDebit)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">{t("totalCredit")}:</span>
                    <span className="ml-2 text-gray-900">
                      {formatCurrency(totalCredit)}
                    </span>
                  </div>
                  <div className="pl-4 border-l border-gray-200">
                    <span className="text-gray-400">{t("closingBalance")}:</span>
                    <span className={`ml-2 ${getBalanceColor(summary?.currentBalance || 0)}`}>
                      {formatCurrency(summary?.currentBalance || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </ReportPdfModal>
    </div>
  );
}
