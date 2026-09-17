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

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) return transactions;
    const term = searchTerm.toLowerCase();
    return transactions.filter((t) => {
      return (
        t.description?.toLowerCase().includes(term) ||
        t.type?.toLowerCase().includes(term)
      );
    });
  }, [transactions, searchTerm]);

  // DataTable columns definition
  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        id: "dateTime",
        header: t("date") || "Date",
        accessorKey: "dateTime",
        className: "w-[120px] text-xs text-muted-foreground",
        cell: (row) => formatStatementDate(row.dateTime),
      },
      {
        id: "particulars",
        header: t("particulars") || "Particulars",
        className: "min-w-[200px]",
        cell: (row) => (
          <div>
            <div className="font-semibold text-xs text-foreground">{row.type}</div>
            {row.description && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {row.description}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "debit",
        header: tBank("debitIn") || "Debit (In)",
        className: "w-[140px] text-right font-semibold text-foreground text-xs",
        cell: (row) => (row.debit > 0 ? formatCurrency(row.debit) : "-"),
      },
      {
        id: "credit",
        header: tBank("creditOut") || "Credit (Out)",
        className: "w-[140px] text-right font-semibold text-foreground text-xs",
        cell: (row) => (row.credit > 0 ? formatCurrency(row.credit) : "-"),
      },
      {
        id: "balance",
        header: t("balance") || "Balance",
        className: "w-[150px] text-right font-bold text-xs",
        cell: (row) => (
          <span className={row.balance < 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-foreground font-bold"}>
            {formatCurrency(Math.abs(row.balance))}
            {row.balance < 0 ? " (Dr)" : " (Cr)"}
          </span>
        ),
      },
    ],
    [t, tBank]
  );

  // Mobile card rendering
  const renderMobileCard = useCallback((txn: any) => {
    const isDr = txn.balance < 0;
    return (
      <div className="bg-card border rounded-lg p-3.5 shadow-sm space-y-2 text-xs">
        <div className="flex justify-between items-center text-muted-foreground">
          <span className="font-medium">{formatStatementDate(txn.dateTime)}</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
            {txn.type}
          </span>
        </div>
        {txn.description && (
          <div className="font-medium text-foreground">{txn.description}</div>
        )}
        <div className="flex justify-between items-center pt-2 border-t border-border/60">
          <div>
            {txn.debit > 0 ? (
              <span className="text-foreground font-semibold">
                Debit: {formatCurrency(txn.debit)}
              </span>
            ) : txn.credit > 0 ? (
              <span className="text-foreground font-semibold">
                Credit: {formatCurrency(txn.credit)}
              </span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
          <div className="text-right">
            <span className="text-muted-foreground mr-1">{t("balance")}:</span>
            <span className={`font-bold ${isDr ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
              {formatCurrency(Math.abs(txn.balance))} {isDr ? "(Dr)" : "(Cr)"}
            </span>
          </div>
        </div>
      </div>
    );
  }, [t]);

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
        width: "110px",
        align: "left",
        render: (row) => (
          <span className="font-medium whitespace-nowrap">
            {formatStatementDate(row.dateTime)}
          </span>
        ),
      },
      {
        id: "particulars",
        header: t("particulars") || "Particulars",
        align: "left",
        render: (row) => (
          <div>
            <div className="font-semibold text-slate-900">{row.type}</div>
            {row.description && (
              <div className="text-[9.5px] text-slate-600 mt-0.5">{row.description}</div>
            )}
          </div>
        ),
      },
      {
        id: "debitIn",
        header: tBank("debitIn") || "Debit (In)",
        width: "130px",
        align: "right",
        render: (row) => (row.debit > 0 ? formatCurrency(row.debit) : "-"),
      },
      {
        id: "creditOut",
        header: tBank("creditOut") || "Credit (Out)",
        width: "130px",
        align: "right",
        render: (row) => (row.credit > 0 ? formatCurrency(row.credit) : "-"),
      },
      {
        id: "balance",
        header: t("balance") || "Balance",
        width: "140px",
        align: "right",
        render: (row) => {
          const isDr = row.balance < 0;
          return (
            <span className={cn("font-bold", isDr ? "text-red-700" : "text-slate-900")}>
              {formatCurrency(Math.abs(row.balance))} {isDr ? "(Dr)" : "(Cr)"}
            </span>
          );
        },
      },
    ],
    [t, tBank]
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
      <DialogContent className="max-w-5xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold text-foreground">
            <Building2 className="h-5 w-5 text-primary" />
            <span>{tBank("statementModalTitle")}: {bankAccount.bankName}</span>
          </DialogTitle>
          {hasSearched && transactions.length > 0 && (
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
          )}
        </DialogHeader>

        {/* Date Filter Bar */}
        <Card className="border border-border/60 bg-card shadow-xs">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-end gap-3">
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
