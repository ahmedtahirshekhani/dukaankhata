
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2Icon, ArrowLeft } from "lucide-react";
import { formatCurrencyString, formatStatementDate } from "@/lib/utils";

type StatementTransaction = {
  id: string;
  type: "order" | "payment_in" | "opening_balance" | "adjustment";
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
};

type StatementSummary = {
  openingBalance: number;
  totalOrders: number;
  totalPayments: number;
  currentBalance: number;
};

type ReportMeta = {
  customerName?: string;
};

export default function CustomerTransactionsDetailPage() {
  const params = useParams();
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fromDate = "1970-01-01";
        const toDate = new Date().toISOString().split("T")[0];
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
        <Button asChild variant="outline" className="w-fit">
          <Link href={`/${locale}/admin`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tDash("backToDashboard") || "Back to Dashboard"}
          </Link>
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
    <div className="flex flex-col gap-4">
      <Button asChild variant="outline" className="w-fit">
        <Link href={`/${locale}/admin`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tDash("backToDashboard") || "Back to Dashboard"}
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold">{customerName || (tDash("customer") || "Customer")}</h1>
        <p className="text-sm text-muted-foreground">
          {tDash("customerTransactionsToDate") || "Customer transactions to date"}
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {tStatement("totalOrders")} + {tStatement("openingBalance")}
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
                {tStatement("totalPayments")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrencyString(summary.totalPayments)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {tStatement("currentBalance")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${summary.currentBalance > 0 ? "text-red-600" : "text-green-600"}`}>
                {formatCurrencyString(summary.currentBalance)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {/* Desktop Table View - hidden on mobile */}
          <div className="hidden md:block overflow-x-auto max-h-[28rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tStatement("date") || "Date"}</TableHead>
                  <TableHead>{tStatement("orderId") || "Order ID"}</TableHead>
                  <TableHead>{tStatement("description") || "Description"}</TableHead>
                  <TableHead className="text-right">{tStatement("amount") || "Amount"}</TableHead>
                  <TableHead className="text-right">{tStatement("debit") || "Debit"}</TableHead>
                  <TableHead className="text-right">{tStatement("credit") || "Credit"}</TableHead>
                  <TableHead className="text-right">{tStatement("balance") || "Balance"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {tStatement("noTransactions") || (tDash("noData") || "No data")}
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatStatementDate(row.dateTime)}</TableCell>
                      <TableCell>{row.orderId || "-"}</TableCell>
                      <TableCell>{row.description || "-"}</TableCell>
                      <TableCell className="text-right">{formatCurrencyString(Number(row.amount || 0))}</TableCell>
                      <TableCell className="text-right">{formatCurrencyString(Number(row.debit || 0))}</TableCell>
                      <TableCell className="text-right">{formatCurrencyString(Number(row.credit || 0))}</TableCell>
                      <TableCell className="text-right">
                        <span className={row.balance > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                          {formatCurrencyString(Number(row.balance || 0))}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View - visible only on mobile */}
          <div className="block md:hidden space-y-3 max-h-[28rem] overflow-y-auto">
            {transactions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {tStatement("noTransactions") || (tDash("noData") || "No data")}
              </div>
            ) : (
              transactions.map((row) => (
                <TransactionCard
                  key={row.id}
                  transaction={row}
                  tStatement={tStatement}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Mobile Card Component for Transaction Row
function TransactionCard({
  transaction,
  tStatement,
}: {
  transaction: StatementTransaction;
  tStatement: (key: string) => string;
}) {
  return (
    <div className="bg-card border rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground">
            {tStatement("date") || "Date"}
          </h3>
          <p className="text-base">{formatStatementDate(transaction.dateTime)}</p>
        </div>
        <div className="text-right">
          <h3 className="font-semibold text-sm text-muted-foreground">
            {tStatement("balance") || "Balance"}
          </h3>
          <p className={`text-base font-bold ${transaction.balance > 0 ? "text-red-600" : "text-green-600"}`}>
            {formatCurrencyString(Number(transaction.balance || 0))}
          </p>
        </div>
      </div>

      <div className="space-y-1.5 text-sm mt-3">
        {transaction.orderId && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{tStatement("orderId") || "Order ID"}:</span>
            <span>{transaction.orderId}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">{tStatement("description") || "Description"}:</span>
          <span className="text-right max-w-[60%] break-words">{transaction.description || "-"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{tStatement("amount") || "Amount"}:</span>
          <span>{formatCurrencyString(Number(transaction.amount || 0))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{tStatement("debit") || "Debit"}:</span>
          <span>{formatCurrencyString(Number(transaction.debit || 0))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{tStatement("credit") || "Credit"}:</span>
          <span>{formatCurrencyString(Number(transaction.credit || 0))}</span>
        </div>
      </div>
    </div>
  );
}