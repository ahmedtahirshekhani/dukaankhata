"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { formatCurrency, formatStatementDate, cn } from "@/lib/utils";
import { getDaysAgoHTMLDate, getTodayHTMLDate } from "@/lib/date-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Printer,
  Loader2,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Search,
  Building2,
} from "lucide-react";
import type { BankAccountItem } from "./bank-accounts-client";
import { ReportPdfHeader, ReportPdfKpi, ReportPdfMetaItem } from "@/components/reports/report-pdf-header";
import { ReportPdfModal } from "@/components/reports/report-pdf-modal";
import { PdfTable, PdfTableColumn } from "@/components/reports/pdf-table";

interface BankAccountStatementModalProps {
  bankAccount: BankAccountItem;
  locale: string;
  isOpen: boolean;
  onClose: () => void;
}

export function BankAccountStatementModal({
  bankAccount,
  locale,
  isOpen,
  onClose,
}: BankAccountStatementModalProps) {
  const t = useTranslations("accountStatement");
  const tBank = useTranslations("bankAccounts");
  const tCommon = useTranslations("common");

  const [fromDate, setFromDate] = useState<string>(() => getDaysAgoHTMLDate(30));
  const [toDate, setToDate] = useState<string>(() => getTodayHTMLDate());
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

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
            logo: data.companyLogo || null,
          });
        }
      } catch (err) {
        console.error("Failed to load branding", err);
      }
    };
    if (isOpen) {
      loadBranding();
    }
  }, [locale, isOpen]);

  const fetchStatement = useCallback(async () => {
    if (!bankAccount.id || !fromDate || !toDate) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        bankAccountId: bankAccount.id,
        fromDate,
        toDate,
      });
      const res = await fetch(`/${locale}/api/bank-accounts/statement?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setSummary(data.summary || null);
      } else {
        setTransactions([]);
        setSummary(null);
      }
    } catch (err) {
      console.error("Failed to fetch bank account statement:", err);
      setTransactions([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [bankAccount.id, fromDate, toDate, locale]);

  // Auto-fetch on opening modal
  useEffect(() => {
    if (isOpen && bankAccount.id) {
      fetchStatement();
    }
  }, [isOpen, bankAccount.id, fetchStatement]);

  const handleGenerateStatement = () => {
    if (fromDate && toDate) fetchStatement();
  };

  const handleExportPdf = useCallback(async () => {
    setExportingPdf(true);
    await new Promise((resolve) => setTimeout(resolve, 350));

    if (!reportRef.current) {
      setExportingPdf(false);
      return;
    }

    try {
      const opt = {
        margin: [6, 6, 6, 6],
        filename: `Statement_${bankAccount.bankName.replace(/\s+/g, "_")}_${fromDate}_to_${toDate}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          scrollY: 0,
          scrollX: 0,
          width: 1123,
          windowWidth: 1123,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" as const },
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
      setExportingPdf(false);
    }
  }, [bankAccount.bankName, fromDate, toDate, tCommon]);

  const getTypeLabel = useCallback(
    (row: any) => {
      const rawType = row.rawType;
      if (rawType === "order") return t("typeOrder") || "Sale Invoice";
      if (rawType === "payment_in") return t("typePaymentIn") || "Payment In";
      if (rawType === "payment_out") return t("typePaymentOut") || "Payment Out";
      if (rawType === "purchase_bill") return t("typePurchase") || "Purchase Bill";
      if (rawType === "sale_return") return t("typeSaleReturn") || "Sale Return";
      if (rawType === "expense") return t("typeExpense") || "Expense";
      if (rawType === "opening_balance") return t("typeOpeningBalance") || "Opening Balance";
      return row.type || "Transaction";
    },
    [t]
  );

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return transactions;
    const term = searchTerm.toLowerCase();
    return transactions.filter((t) => {
      return (
        t.description?.toLowerCase().includes(term) ||
        t.voucherNo?.toLowerCase().includes(term) ||
        t.type?.toLowerCase().includes(term) ||
        t.rawType?.toLowerCase().includes(term)
      );
    });
  }, [transactions, searchTerm]);

  // DataTable columns definition
  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        id: "dateTime",
        header: <span className="text-slate-900 font-bold">{t("date") || "Date"}</span>,
        accessorKey: "dateTime",
        className: "w-[105px] text-center text-xs text-slate-900 font-medium px-2",
        cell: (row) => <span className="text-slate-900 font-medium whitespace-nowrap">{formatStatementDate(row.dateTime)}</span>,
      },
      {
        id: "voucher",
        header: <span className="text-slate-900 font-bold">{t("voucher") || "Voucher #"}</span>,
        className: "w-[115px] text-center text-xs text-slate-900 font-medium px-2 max-w-[125px] break-all whitespace-normal",
        cell: (row) => <span className="text-slate-900 font-medium">{row.voucherNo || "-"}</span>,
      },
      {
        id: "type",
        header: <span className="text-slate-900 font-bold">{t("type") || "Type"}</span>,
        className: "w-[135px] text-center text-xs px-2",
        cell: (row) => (
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-900 border border-slate-300 shadow-2xs whitespace-nowrap">
            {getTypeLabel(row)}
          </span>
        ),
      },
      {
        id: "particulars",
        header: <span className="text-slate-900 font-bold">{t("particulars") || "Particulars"}</span>,
        className: "min-w-[180px] px-2",
        cell: (row) => (
          <div className="font-semibold text-xs text-slate-900">
            {row.description}
          </div>
        ),
      },
      {
        id: "debit",
        header: <div className="text-right text-slate-900 font-bold">{tBank("debitIn") || "Debit (In)"}</div>,
        className: "w-[110px] text-right text-xs text-slate-900 font-bold px-2",
        cell: (row) => (row.debit > 0 ? <span className="text-slate-900 font-bold whitespace-nowrap">{formatCurrency(row.debit)}</span> : <span className="text-slate-400">-</span>),
      },
      {
        id: "credit",
        header: <div className="text-right text-slate-900 font-bold">{tBank("creditOut") || "Credit (Out)"}</div>,
        className: "w-[110px] text-right text-xs text-slate-900 font-bold px-2",
        cell: (row) => (row.credit > 0 ? <span className="text-slate-900 font-bold whitespace-nowrap">{formatCurrency(row.credit)}</span> : <span className="text-slate-400">-</span>),
      },
      {
        id: "balance",
        header: <div className="text-right text-slate-900 font-bold">{t("balance") || "Balance"}</div>,
        className: "w-[125px] text-right text-xs font-bold px-2",
        cell: (row) => {
          const isCr = row.balance < 0;
          return (
            <span className="text-slate-900 font-bold whitespace-nowrap">
              {formatCurrency(Math.abs(row.balance))} {isCr ? "(Cr)" : "(Dr)"}
            </span>
          );
        },
      },
    ],
    [t, tBank, getTypeLabel]
  );

  // Mobile card rendering
  const renderMobileCard = useCallback(
    (txn: any) => {
      const isCr = txn.balance < 0;
      const isOpening = txn.rawType === "opening_balance" || txn.id === "opening_balance";
      return (
        <div className={cn(
          "border rounded-lg p-3.5 shadow-sm space-y-2 text-xs",
          isOpening ? "bg-slate-50 border-slate-300" : "bg-card border-slate-200"
        )}>
          <div className="flex justify-between items-center">
            <span className="text-slate-900 font-semibold">{formatStatementDate(txn.dateTime)}</span>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-900 border border-slate-300">
              {getTypeLabel(txn)} {txn.voucherNo && txn.voucherNo !== "-" ? `(${txn.voucherNo})` : ""}
            </span>
          </div>
          {txn.description && (
            <div className="font-semibold text-slate-900">{txn.description}</div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-slate-200">
            <div>
              {txn.debit > 0 ? (
                <span className="text-slate-900 font-bold">
                  {tBank("debitIn") || "Debit"}: {formatCurrency(txn.debit)}
                </span>
              ) : txn.credit > 0 ? (
                <span className="text-slate-900 font-bold">
                  {tBank("creditOut") || "Credit"}: {formatCurrency(txn.credit)}
                </span>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </div>
            <div className="text-right">
              <span className="text-slate-700 font-medium mr-1">{t("balance") || "Balance"}:</span>
              <span className="text-slate-900 font-bold">
                {formatCurrency(Math.abs(txn.balance))} {isCr ? "(Cr)" : "(Dr)"}
              </span>
            </div>
          </div>
        </div>
      );
    },
    [t, tBank, getTypeLabel]
  );

  const pdfKpis: ReportPdfKpi[] = useMemo(() => {
    if (!summary) return [];
    return [
      { label: t("openingBalance") || "Opening Balance", value: formatCurrency(summary.openingBalance) },
      { label: tBank("totalDebitIn") || "Total Debit (In)", value: formatCurrency(summary.totalIn) },
      { label: tBank("totalCreditOut") || "Total Credit (Out)", value: formatCurrency(summary.totalOut) },
      {
        label: t("closingBalance") || "Closing Balance",
        value: formatCurrency(summary.currentBalance),
        highlight: true,
      },
    ];
  }, [summary, t, tBank]);

  const pdfMetaItems: ReportPdfMetaItem[] = useMemo(() => {
    return [
      { label: "Account Name", value: bankAccount.bankName },
      { label: "Account Details", value: bankAccount.bankDetails || "-" },
    ];
  }, [bankAccount]);

  const pdfColumns: PdfTableColumn<any>[] = useMemo(
    () => [
      {
        id: "date",
        header: t("date") || "Date",
        width: "90px",
        align: "left",
        render: (row) => (
          <span className="font-medium whitespace-nowrap">
            {formatStatementDate(row.dateTime)}
          </span>
        ),
      },
      {
        id: "voucher",
        header: t("voucher") || "Voucher #",
        width: "90px",
        align: "center",
        render: (row) => row.voucherNo || "-",
      },
      {
        id: "type",
        header: t("type") || "Type",
        width: "100px",
        align: "center",
        render: (row) => getTypeLabel(row),
      },
      {
        id: "particulars",
        header: t("particulars") || "Particulars",
        align: "left",
        render: (row) => (
          <div className="font-semibold text-slate-900">{row.description}</div>
        ),
      },
      {
        id: "debitIn",
        header: tBank("debitIn") || "Debit (In)",
        width: "110px",
        align: "right",
        render: (row) => (row.debit > 0 ? formatCurrency(row.debit) : "-"),
      },
      {
        id: "creditOut",
        header: tBank("creditOut") || "Credit (Out)",
        width: "110px",
        align: "right",
        render: (row) => (row.credit > 0 ? formatCurrency(row.credit) : "-"),
      },
      {
        id: "balance",
        header: t("balance") || "Balance",
        width: "120px",
        align: "right",
        render: (row) => {
          const isCr = row.balance < 0;
          return (
            <span className="text-slate-900 font-bold">
              {formatCurrency(Math.abs(row.balance))} {isCr ? "(Cr)" : "(Dr)"}
            </span>
          );
        },
      },
    ],
    [t, tBank, getTypeLabel]
  );

  const handleFromDateChange = (val: string) => {
    setFromDate(val);
    if (toDate && val > toDate) {
      setToDate(val);
    }
  };

  const handleToDateChange = (val: string) => {
    if (fromDate && val < fromDate) {
      setToDate(fromDate);
    } else {
      setToDate(val);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[96vw] sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="relative flex flex-col items-center text-center pb-3 border-b border-border/60">
          <div className="flex flex-col items-center justify-center gap-1.5 w-full px-8">
            <div className="flex items-center justify-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Building2 className="h-4.5 w-4.5" />
              </div>
              <DialogTitle className="text-base sm:text-xl font-bold text-foreground text-center flex flex-wrap items-center justify-center gap-1.5">
                <span>{tBank("statementModalTitle") || "Bank Statement"}:</span>
                <span className="text-primary">{bankAccount.bankName}</span>
              </DialogTitle>
            </div>
            {bankAccount.bankDetails && (
              <p className="text-xs text-muted-foreground text-center max-w-lg truncate">
                {bankAccount.bankDetails}
              </p>
            )}
          </div>
          {hasSearched && transactions.length > 0 && (
            <div className="mt-2 sm:mt-0 sm:absolute sm:right-10 sm:top-1/2 sm:-translate-y-1/2">
              <Button
                size="sm"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="h-8 text-xs px-3 gap-1.5 bg-sky-500 hover:bg-sky-600 text-white shadow-none"
              >
                {exportingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                <span>{tCommon("downloadPdf") || "Download PDF"}</span>
              </Button>
            </div>
          )}
        </DialogHeader>

        {/* Date Filter Bar */}
        <Card className="border border-border/60 bg-card shadow-xs">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1 w-full space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("fromDate") || "From Date"}
                </Label>
                <DatePicker
                  value={fromDate}
                  max={toDate}
                  onChange={handleFromDateChange}
                  placeholder="DD-MM-YYYY"
                  className="h-9 text-xs sm:text-sm w-full"
                />
              </div>

              <div className="flex-1 w-full space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("toDate") || "To Date"}
                </Label>
                <DatePicker
                  value={toDate}
                  min={fromDate}
                  onChange={handleToDateChange}
                  placeholder="DD-MM-YYYY"
                  className="h-9 text-xs sm:text-sm w-full"
                />
              </div>

              <div className="w-full sm:w-auto shrink-0">
                <Button
                  onClick={handleGenerateStatement}
                  disabled={!fromDate || !toDate || loading}
                  className="w-full sm:w-auto h-9 px-5 text-xs sm:text-sm font-medium gap-1.5"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  <span>{t("generateStatement") || "Generate"}</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary KPI Cards with StatCard */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <StatCard
              title={t("openingBalance") || "Opening Balance"}
              value={formatCurrency(summary.openingBalance)}
              icon={DollarSign}
              isLoading={loading}
            />
            <StatCard
              title={tBank("totalDebitIn") || "Debit (In)"}
              value={formatCurrency(summary.totalIn)}
              icon={TrendingUp}
              isLoading={loading}
            />
            <StatCard
              title={tBank("totalCreditOut") || "Credit (Out)"}
              value={formatCurrency(summary.totalOut)}
              icon={TrendingDown}
              isLoading={loading}
            />
            <StatCard
              title={t("closingBalance") || "Closing Balance"}
              value={formatCurrency(summary.currentBalance)}
              icon={summary.currentBalance < 0 ? TrendingDown : TrendingUp}
              isLoading={loading}
            />
          </div>
        )}

        {/* Transactions Table using Reusable DataTable (no pagination as statement) */}
        {hasSearched && (
          <div className="space-y-3">
            <DataTable
              columns={columns}
              data={filteredTransactions}
              isLoading={loading}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder={t("searchTransactions") || "Search statement transactions..."}
              keyExtractor={(txn, idx) => String(txn.id || idx)}
              renderMobileCard={renderMobileCard}
              emptyMessage={t("noTransactions") || "No transactions found for the selected period."}
            />

            {/* Statement Grand Footer Summary */}
            {summary && transactions.length > 0 && (
              <Card className="border border-slate-200 bg-slate-50 p-4 shadow-sm rounded-xl">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold uppercase">
                  <span className="text-slate-800 font-bold text-[11px] tracking-wide">
                    Total Records: {transactions.length} Transactions
                  </span>
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                    <div>
                      <span className="text-slate-700 font-semibold">{tBank("totalDebitIn") || "Total Debit"}:</span>
                      <span className="ml-1.5 text-slate-900 font-bold">{formatCurrency(summary.totalIn)}</span>
                    </div>
                    <div>
                      <span className="text-slate-700 font-semibold">{tBank("totalCreditOut") || "Total Credit"}:</span>
                      <span className="ml-1.5 text-slate-900 font-bold">{formatCurrency(summary.totalOut)}</span>
                    </div>
                    <div className="pl-4 sm:border-l sm:border-slate-300">
                      <span className="text-slate-700 font-semibold">{t("closingBalance") || "Closing Balance"}:</span>
                      <span className="ml-1.5 text-slate-900 font-bold">
                        {formatCurrency(Math.abs(summary.currentBalance))} {summary.currentBalance < 0 ? "(Cr)" : "(Dr)"}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* PDF Preview & Download Modal */}
        <ReportPdfModal
          isOpen={exportingPdf}
          onOpenChange={setExportingPdf}
          title="Bank Statement PDF"
          description="Preparing & downloading your horizontal landscape bank statement PDF..."
          reportRef={reportRef}
          width="1123px"
          isPortrait={false}
        >
          <ReportPdfHeader
            branding={branding}
            title={tBank("statementModalTitle") || "BANK STATEMENT"}
            subtitle={bankAccount.bankName}
            fromDate={fromDate}
            toDate={toDate}
            metaItems={pdfMetaItems}
            kpis={pdfKpis}
          />

          <PdfTable
            columns={pdfColumns}
            data={transactions}
            emptyMessage={t("noTransactions") || "No transactions found"}
          />
        </ReportPdfModal>
      </DialogContent>
    </Dialog>
  );
}
