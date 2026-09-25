"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { ArrowLeft, Loader2Icon, Receipt, ArrowRightLeft, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatStatementDate } from "@/lib/utils";

type StatementTransaction = {
  id: string;
  type: "order" | "payment_in" | "payment_out" | "purchase_bill" | "purchase_bill_payment" | "opening_balance" | "adjustment" | "sale_return";
  orderValue: number | null;
  paidAmount: number | null;
  orderId?: string | null;
  description?: string;
  qty?: number | null;
  unitPrice?: number | null;
  debit?: number;
  credit?: number;
  balance: number;
  amount: number;
  dateTime: string;
  items?: Array<{
    name: string;
    quantity: number;
    price?: number;
    amount?: number;
  }>;
};

type StatementSummary = {
  openingBalance: number;
  totalOrders: number;
  totalPurchaseBills?: number;
  totalPaymentsIn?: number;
  totalPaymentsOut?: number;
  totalPayments?: number;
  currentBalance: number;
};

type ReportMeta = {
  customerName?: string;
};

export default function CustomerTransactionsDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const tDash = useTranslations("dashboard");
  const tStatement = useTranslations("accountStatement");
  const customerId =
    typeof params?.customerId === "string"
      ? params.customerId
      : Array.isArray(params?.customerId)
        ? params.customerId[0]
        : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<StatementTransaction[]>([]);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [customerName, setCustomerName] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fromDate = "1970-01-01";
        const toDate = "2099-12-31"; // Ensure all future-dated transactions are included
        const params = new URLSearchParams({ customerId, fromDate, toDate });
        const res = await fetch(`/${locale}/api/account-statement?${params.toString()}`);
        if (!res.ok) {
          throw new Error(
            tDash("failedToFetchCustomerTransactions") ||
              tStatement("noTransactions")
          );
        }

        const data = await res.json();
        setTransactions(Array.isArray(data?.transactions) ? data.transactions : []);
        setSummary(data?.summary || null);
        setCustomerName((data?.reportMeta as ReportMeta | undefined)?.customerName || "");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : (tDash("failedToFetchCustomerTransactions") ||
              "Failed to fetch transactions")
        );
      } finally {
        setLoading(false);
      }
    };

    if (customerId) {
      fetchData();
    } else {
      setLoading(false);
      setError(tDash("invalidCustomer") || "Invalid customer");
    }
  }, [customerId, locale, tStatement, tDash]);

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return "text-emerald-700 font-bold";
    if (balance < 0) return "text-rose-700 font-bold";
    return "text-slate-900 font-bold";
  };

  const getTransactionType = useCallback((type: string) => {
    const types: Record<string, string> = {
      order: tStatement("typeOrder") || "Sale",
      order_return: tStatement("typeOrderReturn") || "Sale Return",
      payment_in: tStatement("typePaymentIn") || "Payment In",
      payment_out: tStatement("typePaymentOut") || "Payment Out",
      purchase_bill: tStatement("typePurchase") || "Purchase",
      purchase_bill_payment: tStatement("typePurchaseBillPayment") || "Purchase Payment",
      adjustment: tStatement("typeAdjustment") || "Adjustment",
      sale_return: tStatement("typeSaleReturn") || "Sale Return",
      opening_balance: tStatement("typeOpeningBalance") || "Opening Balance",
    };
    return types[type] || type;
  }, [tStatement]);

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

  const totalDebit = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
  }, [transactions]);

  const totalCredit = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
  }, [transactions]);

  // DataTable Columns Definition
  const columns: ColumnDef<StatementTransaction>[] = useMemo(
    () => [
      {
        id: "dateTime",
        accessorKey: "dateTime",
        header: <span className="text-slate-900 font-bold">{tStatement("date") || "Date"}</span>,
        className: "w-[105px] text-center text-xs text-slate-900 font-medium px-2",
        cell: (row) => <span className="text-slate-900 font-medium whitespace-nowrap">{formatStatementDate(row.dateTime)}</span>,
      },
      {
        id: "voucher",
        header: <span className="text-slate-900 font-bold">{tStatement("orderId") || "Voucher #"}</span>,
        className: "w-[120px] text-center text-xs text-slate-900 font-medium px-2 max-w-[130px] break-all whitespace-normal",
        cell: (row) => <span className="text-slate-900 font-medium">{row.orderId || "-"}</span>,
      },
      {
        id: "type",
        header: <span className="text-slate-900 font-bold">{tStatement("type") || "Type"}</span>,
        className: "w-[135px] text-center text-xs px-2",
        cell: (row) => (
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-900 border border-slate-300 shadow-2xs whitespace-nowrap">
            {getTransactionType(row.type)}
          </span>
        ),
      },
      {
        id: "description",
        header: <span className="text-slate-900 font-bold">{tStatement("description") || "Description"}</span>,
        className: "min-w-[200px] px-2",
        cell: (row) => {
          const hasItems = row.items && row.items.length > 0;
          return (
            <div>
              <div className="text-xs text-slate-900 font-semibold">{row.description}</div>
              {hasItems && (
                <div className="text-[11px] text-slate-800 font-medium mt-1 space-y-0.5 pl-2 border-l-2 border-slate-300">
                  {row.items?.map((item, itemIdx) => (
                    <div key={itemIdx}>
                      • {item.name}
                      <span className="ml-1 text-slate-500">(x{item.quantity})</span>
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
        header: <div className="text-right text-slate-900 font-bold">{tStatement("debit") || "Debit"}</div>,
        className: "w-[105px] text-right text-xs text-slate-900 font-bold px-2",
        cell: (row) => (row.debit ? <span className="text-slate-900 font-bold whitespace-nowrap">{formatCurrency(row.debit)}</span> : <span className="text-slate-400">-</span>),
      },
      {
        id: "credit",
        header: <div className="text-right text-slate-900 font-bold">{tStatement("credit") || "Credit"}</div>,
        className: "w-[105px] text-right text-xs text-slate-900 font-bold px-2",
        cell: (row) => (row.credit ? <span className="text-slate-900 font-bold whitespace-nowrap">{formatCurrency(row.credit)}</span> : <span className="text-slate-400">-</span>),
      },
      {
        id: "balance",
        header: <div className="text-right text-slate-900 font-bold">{tStatement("balance") || "Balance"}</div>,
        className: "w-[115px] text-right text-xs font-bold px-2",
        cell: (row) => (
          <span className={`${getBalanceColor(row.balance)} whitespace-nowrap`}>
            {formatCurrency(row.balance)}
          </span>
        ),
      },
    ],
    [tStatement, getTransactionType]
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
            isOpening ? "bg-slate-50 border-slate-300" : "border-slate-200"
          }`}
        >
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-900 font-semibold">
              {formatStatementDate(txn.dateTime)}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-900 border border-slate-300">
              {getTransactionType(txn.type)} {txn.orderId ? `(${txn.orderId})` : ""}
            </span>
          </div>

          <div className="text-xs text-slate-900">
            <div className="font-bold text-slate-900">{txn.description}</div>
            {hasItems && (
              <div className="text-[11px] text-slate-800 font-medium mt-1 space-y-0.5 pl-2 border-l-2 border-slate-300">
                {txn.items?.map((item, itemIdx) => (
                  <div key={itemIdx}>
                    • {item.name} <span className="text-slate-500">(x{item.quantity})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs">
            <div>
              {txn.debit ? (
                <span className="text-slate-900 font-bold">
                  {tStatement("debit") || "Debit"}: {formatCurrency(txn.debit)}
                </span>
              ) : txn.credit ? (
                <span className="text-slate-900 font-bold">
                  {tStatement("credit") || "Credit"}: {formatCurrency(txn.credit)}
                </span>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </div>
            <div>
              <span className="text-slate-700 font-medium mr-1">{tStatement("balance") || "Balance"}:</span>
              <span className={`font-bold ${getBalanceColor(txn.balance)}`}>
                {formatCurrency(txn.balance)}
              </span>
            </div>
          </div>
        </div>
      );
    },
    [tStatement, getTransactionType]
  );

  if (loading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <Loader2Icon className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="outline" className="w-fit" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tDash("back") || "Back"}
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {customerName || (tDash("customer") || "Customer")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            {tDash("customerTransactionsToDate") || "Party transactions to date"}
          </p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatCard
            title={`${tStatement("totalOrders") || "Total Orders"} + ${tStatement("openingBalance") || "Opening Balance"}`}
            value={formatCurrency((summary.totalOrders || 0) + (summary.openingBalance || 0))}
            icon={Receipt}
            isLoading={loading}
          />
          <StatCard
            title={tStatement("totalPayments") || "Total Payments"}
            value={formatCurrency((summary.totalPaymentsIn ?? summary.totalPayments ?? 0) - (summary.totalPaymentsOut ?? 0))}
            icon={ArrowRightLeft}
            isLoading={loading}
          />
          <StatCard
            title={tStatement("currentBalance") || "Current Balance"}
            value={formatCurrency(summary.currentBalance)}
            icon={summary.currentBalance > 0 ? TrendingUp : TrendingDown}
            isLoading={loading}
          />
        </div>
      )}

      <div className="flex flex-col gap-4">
        <DataTable
          columns={columns}
          data={filteredTransactions}
          isLoading={loading}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={tStatement("searchTransactions") || "Search transactions..."}
          keyExtractor={(txn, idx) => String(txn.id || idx)}
          renderMobileCard={renderMobileCard}
          emptyMessage={tStatement("noTransactions") || (tDash("noData") || "No transactions found")}
        />

        {/* Statement Grand Footer Summary */}
        {transactions.length > 0 && (
          <Card className="border border-slate-200 bg-slate-50 p-4 shadow-sm rounded-xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold uppercase">
              <span className="text-slate-800 font-bold text-[11px] tracking-wide">
                Total Records: {transactions.length} Transactions
              </span>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div>
                  <span className="text-slate-700 font-semibold">{tStatement("totalDebit") || "Total Debit"}:</span>
                  <span className="ml-1.5 text-slate-900 font-bold">{formatCurrency(totalDebit)}</span>
                </div>
                <div>
                  <span className="text-slate-700 font-semibold">{tStatement("totalCredit") || "Total Credit"}:</span>
                  <span className="ml-1.5 text-slate-900 font-bold">{formatCurrency(totalCredit)}</span>
                </div>
                <div className="pl-4 sm:border-l sm:border-slate-300">
                  <span className="text-slate-700 font-semibold">{tStatement("closingBalance") || "Closing Balance"}:</span>
                  <span className={`ml-1.5 ${getBalanceColor(summary?.currentBalance || 0)}`}>
                    {formatCurrency(summary?.currentBalance || 0)}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}