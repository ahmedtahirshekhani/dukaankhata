"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { formatCurrencyString, formatStatementDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, Loader2, FileText, ArrowRightLeft } from "lucide-react";
import type { BankAccountItem } from "./bank-accounts-client";

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

  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setFromDate(thirtyDaysAgo.toISOString().split("T")[0]);
  }, []);

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

  const handleGenerateStatement = () => {
    if (fromDate && toDate) fetchStatement();
  };

  const handleExportPdf = useCallback(async () => {
    setExportingPdf(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const element = reportRef.current;
      if (!element) return;
      const opt = {
        margin: [0.5, 0.5, 0.5, 0.5] as [number, number, number, number],
        filename: `Bank_Statement_${bankAccount.bankName.replace(/\s+/g, "_")}_${fromDate}_to_${toDate}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" as const },
      };
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("Failed to generate PDF", err);
    } finally {
      setExportingPdf(false);
    }
  }, [bankAccount.bankName, fromDate, toDate]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {tBank("statementModalTitle")}: {bankAccount.bankName}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-2">
            <Label>{t("fromDate")}</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("toDate")}</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button
              onClick={handleGenerateStatement}
              disabled={!fromDate || !toDate || loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("generateStatement")}
            </Button>
            {hasSearched && transactions.length > 0 && (
              <Button
                variant="outline"
                onClick={handleExportPdf}
                disabled={exportingPdf}
              >
                {exportingPdf ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                {tCommon("downloadPdf") || "Download PDF"}
              </Button>
            )}
          </div>
        </div>

        {hasSearched && (
          <div className="mt-4 border rounded-md" ref={reportRef}>
            {loading ? (
              <div className="flex justify-center items-center h-64 bg-white text-black">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="p-6 bg-white text-black">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold uppercase">{bankAccount.bankName}</h2>
                  <h3 className="text-lg font-semibold uppercase text-gray-600">{tBank("statementModalTitle")}</h3>
                  <p className="text-sm mt-1">
                    <strong>{t("date")}:</strong> {formatStatementDate(fromDate)} to {formatStatementDate(toDate)}
                  </p>
                  {bankAccount.bankDetails && (
                    <p className="text-sm mt-1 text-gray-500 whitespace-pre-wrap">{bankAccount.bankDetails}</p>
                  )}
                </div>

                {summary && (
                <div className="grid grid-cols-4 gap-4 mb-8">
                  <Card className="shadow-sm">
                    <CardHeader className="py-3 bg-gray-50 border-b rounded-t-lg">
                      <CardTitle className="text-sm text-gray-500 font-medium">{t("openingBalance")}</CardTitle>
                    </CardHeader>
                    <CardContent className="py-4">
                      <div className="text-xl font-bold">{formatCurrencyString(summary.openingBalance)}</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardHeader className="py-3 bg-blue-50 border-b border-blue-100 rounded-t-lg">
                      <CardTitle className="text-sm text-blue-700 font-medium">{tBank("totalDebitIn")}</CardTitle>
                    </CardHeader>
                    <CardContent className="py-4">
                      <div className="text-xl font-bold text-blue-700">+{formatCurrencyString(summary.totalIn)}</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardHeader className="py-3 bg-red-50 border-b border-red-100 rounded-t-lg">
                      <CardTitle className="text-sm text-red-700 font-medium">{tBank("totalCreditOut")}</CardTitle>
                    </CardHeader>
                    <CardContent className="py-4">
                      <div className="text-xl font-bold text-red-700">-{formatCurrencyString(summary.totalOut)}</div>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm border-primary">
                    <CardHeader className="py-3 bg-primary/5 border-b border-primary/10 rounded-t-lg">
                      <CardTitle className="text-sm text-primary font-bold">{t("closingBalance")}</CardTitle>
                    </CardHeader>
                    <CardContent className="py-4">
                      <div className={`text-xl font-bold ${summary.currentBalance < 0 ? 'text-red-600' : 'text-primary'}`}>
                        {formatCurrencyString(summary.currentBalance)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-100">
                    <TableRow>
                      <TableHead className="w-[120px] font-bold text-gray-700">{t("date")}</TableHead>
                      <TableHead className="font-bold text-gray-700">{t("particulars")}</TableHead>
                      <TableHead className="text-right font-bold text-gray-700">{tBank("debitIn")}</TableHead>
                      <TableHead className="text-right font-bold text-gray-700">{tBank("creditOut")}</TableHead>
                      <TableHead className="text-right font-bold text-gray-700">{t("balance")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24 text-gray-500">
                          {t("noTransactions")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map((t, idx) => (
                        <TableRow key={`${t.id}-${idx}`} className="hover:bg-gray-50">
                          <TableCell className="font-medium whitespace-nowrap">
                            {formatStatementDate(t.dateTime)}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-gray-900">{t.type}</div>
                            {t.description && (
                              <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium text-blue-600">
                            {t.debit > 0 ? formatCurrencyString(t.debit) : ""}
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {t.credit > 0 ? formatCurrencyString(t.credit) : ""}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${t.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatCurrencyString(Math.abs(t.balance))}
                            {t.balance < 0 ? ' (Dr)' : ' (Cr)'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
