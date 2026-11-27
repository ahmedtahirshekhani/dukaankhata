"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { formatCurrency, formatStatementDate, cn } from "@/lib/utils";
import { getDaysAgoHTMLDate, getTodayHTMLDate, parsePKTDateBoundary } from "@/lib/date-utils";
import { db } from "@/lib/db/offline-db";
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

  const generateOfflineStatementData = useCallback(
    async (bAccount: BankAccountItem, fromStr: string, toStr: string) => {
      const targetId = String(bAccount.id || "").trim();
      const targetName = (bAccount.bankName || "").toLowerCase().trim();
      const isCash =
        targetId === "cash" ||
        targetName.includes("cash") ||
        Boolean((bAccount as any).is_default);
      const isCheque = targetId === "cheque" || targetName.includes("cheque");

      const matchMethod = (val?: any, accName?: any) => {
        if (accName && String(accName).toLowerCase().trim() === targetName) return true;
        const str = String(val || "").trim();
        if (!str) return isCash;
        if (str === targetId) return true;
        if (targetName && str.toLowerCase() === targetName) return true;
        if (isCash && (str.toLowerCase() === "cash" || str.toLowerCase().includes("cash"))) return true;
        if (isCheque && str.toLowerCase() === "cheque") return true;
        return false;
      };

      const [
        partyTransactions,
        orders,
        purchaseBills,
        saleReturns,
        expenses,
        vendorTransactions,
        cashAdjustments,
      ] = await Promise.all([
        db.party_transactions.toArray(),
        db.orders.toArray(),
        db.purchase_bills.toArray(),
        db.sale_return_transactions.toArray(),
        db.expenses.toArray(),
        db.vendor_transactions.toArray(),
        db.cash_adjustments.toArray(),
      ]);

      const allTxns: any[] = [];

      partyTransactions.forEach((t: any) => {
        if (matchMethod(t.paymentMethodId || t.payment_method_id, t.paymentMethodName || t.account_name)) {
          const amount = Number(t.paymentAmount || t.payment_amount || t.amount || 0);
          if (amount > 0) {
            const isPaymentOut = t.type === "payment-out";
            const voucherNo = t.paymentNumber || t.payment_number || t.voucher_no || null;
            const txnDate = t.date || t.payment_date || t.created_at;
            allTxns.push({
              id: String(t.id || t._id),
              type: isPaymentOut ? "Payment Out" : "Payment In",
              rawType: isPaymentOut ? "payment_out" : "payment_in",
              voucherNo,
              description: t.description || (isPaymentOut ? "Payment to party" : "Payment from party"),
              amount,
              direction: isPaymentOut ? "OUT" : "IN",
              dateTime: new Date(txnDate || Date.now()).toISOString(),
            });
          }
        }
      });

      (vendorTransactions || []).forEach((t: any) => {
        if (matchMethod(t.paymentMethodId || t.payment_method_id, t.paymentMethodName || t.account_name)) {
          const amount = Number(t.paymentAmount || t.payment_amount || t.amount || 0);
          if (amount > 0) {
            const isPaymentOut = t.type === "payment-out" || !t.type;
            const voucherNo = t.paymentNumber || t.payment_number || t.voucher_no || null;
            const txnDate = t.date || t.payment_date || t.created_at;
            allTxns.push({
              id: String(t.id || t._id),
              type: isPaymentOut ? "Payment Out" : "Payment In",
              rawType: isPaymentOut ? "payment_out" : "payment_in",
              voucherNo,
              description: t.description || (isPaymentOut ? "Payment to vendor" : "Payment from vendor"),
              amount,
              direction: isPaymentOut ? "OUT" : "IN",
              dateTime: new Date(txnDate || Date.now()).toISOString(),
            });
          }
        }
      });

      orders.forEach((o: any) => {
        const method = o.payment?.method || o.payment_method_id || o.paymentMethodId;
        if (matchMethod(method)) {
          const paidAmount = Number(o.payment?.paid_amount || o.paid_amount || o.paidAmount || 0);
          if (paidAmount > 0) {
            const voucherNo = o.invoice_no || o.order_number || null;
            const orderDate = o.sale_date || o.order_date || o.date || o.payment?.paid_date || o.created_at;
            allTxns.push({
              id: String(o.id || o._id),
              type: "Sale Invoice",
              rawType: "order",
              voucherNo,
              description: "Sale Invoice",
              amount: paidAmount,
              direction: "IN",
              dateTime: new Date(orderDate || Date.now()).toISOString(),
            });
          }
        }
      });

      purchaseBills.forEach((p: any) => {
        const method = p.payment?.method || p.payment_method_id || p.paymentMethodId;
        if (matchMethod(method)) {
          const paidAmount = Number(p.payment?.paid_amount || p.paid_amount || p.paidAmount || 0);
          if (paidAmount > 0) {
            const voucherNo = p.bill_no || p.purchase_number || null;
            const pbDate = p.payment?.paid_date || p.purchase_date || p.bill_date || p.date || p.created_at;
            allTxns.push({
              id: String(p.id || p._id),
              type: "Purchase Bill",
              rawType: "purchase_bill",
              voucherNo,
              description: "Purchase Bill",
              amount: paidAmount,
              direction: "OUT",
              dateTime: new Date(pbDate || Date.now()).toISOString(),
            });
          }
        }
      });

      saleReturns.forEach((s: any) => {
        const method = s.paymentMethodId || s.payment_method_id;
        if (matchMethod(method)) {
          const paidAmount = Number(s.paidAmount || s.paid_amount || 0);
          if (paidAmount > 0) {
            const voucherNo = s.return_number || null;
            const srDate = s.date || s.return_date || s.created_at;
            allTxns.push({
              id: String(s.id || s._id),
              type: "Sale Return",
              rawType: "sale_return",
              voucherNo,
              description: "Sale Return Refund",
              amount: paidAmount,
              direction: "OUT",
              dateTime: new Date(srDate || Date.now()).toISOString(),
            });
          }
        }
      });

      expenses.forEach((e: any) => {
        const method = e.paymentMethodId || e.payment_method_id;
        if (matchMethod(method)) {
          const amount = Number(e.amount || 0);
          if (amount > 0) {
            const voucherNo = e.expense_number || e.expense_no || null;
            const expDate = e.date || e.expense_date || e.created_at;
            allTxns.push({
              id: String(e.id || e._id),
              type: "Expense",
              rawType: "expense",
              voucherNo,
              description: e.category || e.description || "Expense",
              amount,
              direction: "OUT",
              dateTime: new Date(expDate || Date.now()).toISOString(),
            });
          }
        }
      });

      cashAdjustments.forEach((ca: any) => {
        if (ca.is_deleted || ca.isDeleted || ca.is_delete === 1) return;
        if (matchMethod(ca.payment_method_id || ca.paymentMethodId, ca.account_name)) {
          const amount = Number(ca.amount || 0);
          if (amount > 0) {
            const isReduce = ca.type === "reduce";
            const voucherNo = ca.ref_no || null;
            const caDate = ca.date || ca.created_at;
            const desc = ca.reason
              ? `Cash Adjustment: ${ca.reason}`
              : isReduce
                ? "Cash Adjustment (Reduce)"
                : "Cash Adjustment (Add)";
            allTxns.push({
              id: String(ca.id || ca._id),
              type: isReduce ? "Cash Adjustment (-)" : "Cash Adjustment (+)",
              rawType: "cash_adjustment",
              voucherNo,
              description: desc,
              amount,
              direction: isReduce ? "OUT" : "IN",
              dateTime: new Date(caDate || Date.now()).toISOString(),
            });
          }
        }
      });

      allTxns.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

      const from = parsePKTDateBoundary(fromStr, false);
      const to = parsePKTDateBoundary(toStr, true);

      let currentBalance = Number(bAccount.openingBalance) || 0;
      let periodOpeningBalance = currentBalance;
      let totalIn = 0;
      let totalOut = 0;
      const filteredTransactions: any[] = [];

      for (const t of allTxns) {
        const tDate = new Date(t.dateTime);
        const isBeforeFrom = from ? tDate < from : false;
        const isInRange = (!from || tDate >= from) && (!to || tDate <= to);

        if (t.direction === "IN") {
          currentBalance += t.amount;
          if (isBeforeFrom) {
            periodOpeningBalance += t.amount;
          } else if (isInRange) {
            totalIn += t.amount;
          }
        } else {
          currentBalance -= t.amount;
          if (isBeforeFrom) {
            periodOpeningBalance -= t.amount;
          } else if (isInRange) {
            totalOut += t.amount;
          }
        }

        if (isInRange) {
          filteredTransactions.push({
            ...t,
            balance: currentBalance,
            debit: t.direction === "IN" ? t.amount : 0,
            credit: t.direction === "OUT" ? t.amount : 0,
          });
        }
      }

      filteredTransactions.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

      const openingBalanceRecord = {
        id: "opening_balance",
        type: "Opening Balance",
        rawType: "opening_balance",
        voucherNo: "-",
        description: "Opening Balance",
        amount: Math.abs(periodOpeningBalance),
        direction: periodOpeningBalance >= 0 ? "IN" : "OUT",
        debit: periodOpeningBalance > 0 ? periodOpeningBalance : 0,
        credit: periodOpeningBalance < 0 ? Math.abs(periodOpeningBalance) : 0,
        balance: periodOpeningBalance,
        dateTime: from ? from.toISOString() : new Date().toISOString(),
      };

      const summary = {
        openingBalance: periodOpeningBalance,
        totalIn,
        totalOut,
        currentBalance,
      };

      return {
        transactions: [openingBalanceRecord, ...filteredTransactions],
        summary,
      };
    },
    []
  );

  const fetchStatement = useCallback(async () => {
    if (!bankAccount.id || !fromDate || !toDate) return;

    setLoading(true);
    setHasSearched(true);
    try {
      let serverSuccess = false;
      let serverTxns: any[] = [];
      let serverSummary: any = null;

      try {
        const params = new URLSearchParams({
          bankAccountId: bankAccount.id,
          fromDate,
          toDate,
        });
        const res = await fetch(`/${locale}/api/bank-accounts/statement?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          serverTxns = data.transactions || [];
          serverSummary = data.summary || null;
          serverSuccess = true;
        }
      } catch (networkErr) {
        console.warn("Server statement fetch failed, falling back to local database:", networkErr);
      }

      // If server returned real entries (> 1 items because index 0 is virtual opening balance), use server
      if (serverSuccess && serverTxns.length > 1) {
        setTransactions(serverTxns);
        setSummary(serverSummary);
      } else {
        // Fallback to local Dexie database
        const offlineResult = await generateOfflineStatementData(bankAccount, fromDate, toDate);
        if (offlineResult.transactions.length > 1 || !serverSuccess) {
          setTransactions(offlineResult.transactions);
          setSummary(offlineResult.summary);
        } else {
          setTransactions(serverTxns);
          setSummary(serverSummary);
        }
      }
    } catch (err) {
      console.error("Failed to generate bank account statement:", err);
      try {
        const offlineResult = await generateOfflineStatementData(bankAccount, fromDate, toDate);
        setTransactions(offlineResult.transactions);
        setSummary(offlineResult.summary);
      } catch {
        setTransactions([]);
        setSummary(null);
      }
    } finally {
      setLoading(false);
    }
  }, [bankAccount, fromDate, toDate, locale, generateOfflineStatementData]);

  // Reset state when modal opens/closes without auto-generating
  useEffect(() => {
    if (!isOpen) {
      setTransactions([]);
      setSummary(null);
      setHasSearched(false);
      setSearchTerm("");
    }
  }, [isOpen]);

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
        margin: [6, 6, 16, 6],
        filename: `Statement_${bankAccount.bankName.replace(/\s+/g, "_")}_${fromDate}_to_${toDate}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          scrollY: 0,
          scrollX: 0,
          windowWidth: 700,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
        pagebreak: {
          mode: ["css", "legacy"],
          avoid: ["tr", "tbody tr", ".pdf-avoid-break"]
        },
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
            pdf.setFont("helvetica", "italic");
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184);
            pdf.text(
              tCommon("pdfWatermarkText"),
              105,
              290,
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
        width: "75px",
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
        width: "80px",
        align: "center",
        render: (row) => row.voucherNo || "-",
      },
      {
        id: "type",
        header: t("type") || "Type",
        width: "75px",
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
        width: "80px",
        align: "right",
        render: (row) => (row.debit > 0 ? formatCurrency(row.debit) : "-"),
      },
      {
        id: "creditOut",
        header: tBank("creditOut") || "Credit (Out)",
        width: "80px",
        align: "right",
        render: (row) => (row.credit > 0 ? formatCurrency(row.credit) : "-"),
      },
      {
        id: "balance",
        header: t("balance") || "Balance",
        width: "95px",
        align: "right",
        render: (row) => {
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
          description="Preparing & downloading your bank statement PDF..."
          reportRef={reportRef}
          width="700px"
          isPortrait={true}
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
