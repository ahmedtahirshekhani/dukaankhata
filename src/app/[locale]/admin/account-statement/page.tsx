"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyString, formatStatementDateTime, formatStatementDate } from "@/lib/utils";
import { FileText, Loader2, Calendar, Search, Download } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  balance?: number;
  opening_balance?: number;
}

interface Transaction {
  id: string;
  type: "order" | "payment_in" | "payment_out" | "opening_balance" | "adjustment";
  orderValue: number | null;
  paidAmount: number | null;
  orderId?: string | null;
  description?: string;
  qty?: number | null;
  unitPrice?: number | null;
  amount?: number;
  debit?: number;
  credit?: number;
  balance: number;
  dateTime: string;
  paidDate: string | null;
}

interface StatementSummary {
  openingBalance: number;
  totalOrders: number;
  totalPayments: number;
  totalPaymentsIn?: number;
  totalPaymentsOut?: number;
  currentBalance: number;
  grandTotal?: number;
}

interface ReportMeta {
  title: string;
  fromDate: string;
  toDate: string;
  reportDate: string;
  reportTime: string;
  companyName: string;
  companyAddress: string;
  companyLogo?: string | null;
  customerId: string;
  customerName: string;
}

export default function AccountStatementPage() {
  const t = useTranslations("accountStatement");
  const locale = useLocale();

  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const [customersLoading, setCustomersLoading] = useState(false);

  // Date range
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [reportMeta, setReportMeta] = useState<ReportMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      setCustomersLoading(true);
      try {
        const res = await fetch(`/${locale}/api/customers`);
        if (res.ok) {
          const data = await res.json();
          setCustomers(data);
        }
      } catch (err) {
        console.error("Failed to fetch customers:", err);
      } finally {
        setCustomersLoading(false);
      }
    };
    fetchCustomers();
  }, [locale]);

  // Set default fromDate to 30 days ago
  useEffect(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    setFromDate(thirtyDaysAgo.toISOString().split("T")[0]);
  }, []);

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
        console.error("Failed to fetch statement");
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

  const handleCustomerSelect = (id: number | string) => {
    const custId = id.toString();
    setSelectedCustomerId(custId);
    const customer = customers.find((c) => c.id === custId);
    setSelectedCustomerName(customer?.name || "");
  };

  const handleGenerateStatement = () => {
    if (!isFormValid) return;
    fetchStatement();
  };

  const isFormValid = useMemo(
    () => selectedCustomerId && fromDate && toDate,
    [selectedCustomerId, fromDate, toDate]
  );

  const grandTotal = useMemo(() => {
    return transactions.reduce((sum, txn) => sum + Number(txn.amount || 0), 0);
  }, [transactions]);

  const handleExportPdf = useCallback(async () => {
    if (!reportRef.current) return;
    setExportingPdf(true);
    try {
      // Show header for PDF export
      const headerDiv = reportRef.current.querySelector(".pdf-header") as HTMLElement;
      if (headerDiv) {
        headerDiv.style.display = "block";
      }

      const mod = await import("html2pdf.js");
      const html2pdf = (mod as any).default || mod;
      await html2pdf()
        .set({
          margin: 8,
          filename: `account-ledger-${reportMeta?.customerId || "customer"}-${reportMeta?.fromDate || ""}-to-${reportMeta?.toDate || ""}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        })
        .from(reportRef.current)
        .save();

      // Hide header again after PDF is generated
      if (headerDiv) {
        headerDiv.style.display = "none";
      }
    } finally {
      setExportingPdf(false);
    }
  }, [reportMeta]);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("modalDescription")}
        </p>
      </div>

      {/* Inline Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            {/* Customer Selection */}
            <div className="sm:col-span-4 space-y-2">
              <Label htmlFor="customer">{t("selectCustomer")}</Label>
              {customersLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground h-10">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("loadingCustomers")}
                </div>
              ) : (
                <Combobox
                  items={customers.map((c) => ({
                    id: c.id,
                    name: c.name,
                    description: c.phone || c.email || "",
                  }))}
                  placeholder={t("selectCustomerPlaceholder")}
                  onSelect={handleCustomerSelect}
                  value={selectedCustomerName}
                />
              )}
            </div>

            {/* From Date */}
            <div className="sm:col-span-3 space-y-2">
              <Label htmlFor="fromDate">
                <Calendar className="inline h-4 w-4 mr-1" />
                {t("fromDate")}
              </Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                max={toDate}
              />
            </div>

            {/* To Date */}
            <div className="sm:col-span-3 space-y-2">
              <Label htmlFor="toDate">
                <Calendar className="inline h-4 w-4 mr-1" />
                {t("toDate")}
              </Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                min={fromDate}
              />
            </div>

            {/* Generate Button */}
            <div className="sm:col-span-2">
              <Button
                onClick={handleGenerateStatement}
                disabled={!isFormValid || loading}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {t("generateStatement")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("totalOrders")} + {t("openingBalance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrencyString(summary.totalOrders + summary.openingBalance)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("totalPaymentsIn")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrencyString(summary.totalPaymentsIn || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("totalPaymentsOut")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrencyString(summary.totalPaymentsOut || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("currentBalance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${summary.currentBalance > 0 ? "text-red-600" : "text-green-600"}`}
              >
                {formatCurrencyString(summary.currentBalance)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {transactions.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleExportPdf} disabled={exportingPdf}>
            {exportingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Print PDF
          </Button>
        </div>
      )}

      {/* Transactions Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">
            {t("loadingTransactions")}
          </span>
        </div>
      ) : hasSearched && transactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t("noTransactions")}</p>
          </CardContent>
        </Card>
      ) : transactions.length > 0 ? (
        <Card>
          <CardContent className="p-0" ref={reportRef}>
            <div style={{ display: "none" }} className="pdf-header p-8 border-b space-y-4">
              {/* Company Header Section */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  {reportMeta?.companyLogo && (
                    <div className="mb-4">
                      <img
                        src={reportMeta.companyLogo}
                        alt="Company Logo"
                        className="h-16 w-auto"
                      />
                    </div>
                  )}
                  <h2 className="text-3xl font-bold leading-tight mb-2">{reportMeta?.companyName || "Company"}</h2>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p>{reportMeta?.companyAddress || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Report Title */}
              <div className="border-t border-b py-3 mb-4">
                <h3 className="text-2xl font-bold text-center">{reportMeta?.title || "Account Statement"}</h3>
              </div>

              {/* Report Details Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 font-medium">From Date</p>
                  <p className="font-semibold">{reportMeta?.fromDate || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-600 font-medium">To Date</p>
                  <p className="font-semibold">{reportMeta?.toDate || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-600 font-medium">Report Date</p>
                  <p className="font-semibold">{reportMeta?.reportDate || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-600 font-medium">Report Time</p>
                  <p className="font-semibold">{reportMeta?.reportTime || "-"}</p>
                </div>
              </div>

              {/* Customer Details Section */}
              <div className="border-t pt-3 mt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 font-medium">Customer ID</p>
                    <p className="font-semibold">{reportMeta?.customerId || "-"}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Customer Name</p>
                    <p className="font-semibold">{reportMeta?.customerName || "-"}</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto p-5">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="w-24 px-1 py-1">{t("date")}</TableHead>
                    <TableHead className="w-20 px-1 py-1">Order Id</TableHead>
                    <TableHead className="w-28 px-1 py-1">Description</TableHead>
                    <TableHead className="text-right w-12 px-1 py-1">Qty</TableHead>
                    <TableHead className="text-right w-20 px-1 py-1">Unit Price</TableHead>
                    <TableHead className="text-right w-20 px-1 py-1">Amount</TableHead>
                    <TableHead className="text-right w-20 px-1 py-1">Debit</TableHead>
                    <TableHead className="text-right w-20 px-1 py-1">Credit</TableHead>
                    <TableHead className="text-right w-24 px-1 py-1">{t("balance")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {transactions.map((txn) => (
                    <TableRow key={txn.id} className="h-8">
                      <TableCell className="text-muted-foreground px-1 py-1 whitespace-nowrap">
                        {formatStatementDate(txn.dateTime)}
                      </TableCell>
                      <TableCell className="px-1 py-1 truncate">{txn.orderId || "-"}</TableCell>
                      <TableCell className="px-1 py-1 truncate">{txn.description || "-"}</TableCell>
                      <TableCell className="text-right px-1 py-1">{txn.qty ?? "-"}</TableCell>
                      <TableCell className="text-right px-1 py-1 whitespace-nowrap">{txn.unitPrice !== null && txn.unitPrice !== undefined ? formatCurrencyString(txn.unitPrice) : "-"}</TableCell>
                      <TableCell className="text-right px-1 py-1 whitespace-nowrap">{formatCurrencyString(Number(txn.amount || 0))}</TableCell>
                      <TableCell className="text-right px-1 py-1 whitespace-nowrap">{formatCurrencyString(Number(txn.debit || 0))}</TableCell>
                      <TableCell className="text-right px-1 py-1 whitespace-nowrap">{formatCurrencyString(Number(txn.credit || 0))}</TableCell>
                      <TableCell className="text-right px-1 py-1 whitespace-nowrap">
                        <span
                          className={
                            txn.balance > 0
                              ? "text-red-600 font-medium"
                              : "text-green-600 font-medium"
                          }
                        >
                          {formatCurrencyString(txn.balance)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="h-8 bg-muted/50">
                    <TableCell colSpan={5} className="font-bold text-right px-1 py-1">Grand Total</TableCell>
                    <TableCell className="text-right font-bold px-1 py-1 whitespace-nowrap">{formatCurrencyString(grandTotal)}</TableCell>
                    <TableCell className="text-right font-bold px-1 py-1 whitespace-nowrap">{formatCurrencyString(transactions.reduce((sum, txn) => sum + Number(txn.debit || 0), 0))}</TableCell>
                    <TableCell className="text-right font-bold px-1 py-1 whitespace-nowrap">{formatCurrencyString(transactions.reduce((sum, txn) => sum + Number(txn.credit || 0), 0))}</TableCell>
                    <TableCell className="text-right font-bold px-1 py-1 whitespace-nowrap">{formatCurrencyString(summary?.currentBalance || 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden divide-y">
              {transactions.map((txn) => (
                <div key={txn.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {formatStatementDate(txn.dateTime)}
                    </span>
                    <Badge variant="outline">{txn.type}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Order ID:</span><span>{txn.orderId || "-"}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Description:</span><span>{txn.description || "-"}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Qty:</span><span>{txn.qty ?? "-"}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Unit Price:</span><span>{txn.unitPrice !== null && txn.unitPrice !== undefined ? formatCurrencyString(txn.unitPrice) : "-"}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Amount:</span><span>{formatCurrencyString(Number(txn.amount || 0))}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Debit:</span><span>{formatCurrencyString(Number(txn.debit || 0))}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Credit:</span><span>{formatCurrencyString(Number(txn.credit || 0))}</span></div>
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">
                      {t("balance")}:
                    </span>
                    <span
                      className={
                        txn.balance > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }
                    >
                      {formatCurrencyString(txn.balance)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="p-4">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>Grand Total</span>
                  <span>{formatCurrencyString(grandTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
