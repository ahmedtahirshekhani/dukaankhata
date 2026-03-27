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
          <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
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
        </CardContent>
      </Card>
    </div>
  );
}
