"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { FileText, Loader2, Calendar, Search } from "lucide-react";

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
  type: "order" | "payment_in" | "opening_balance";
  orderValue: number | null;
  paidAmount: number | null;
  balance: number;
  dateTime: string;
  paidDate: string | null;
}

interface StatementSummary {
  openingBalance: number;
  totalOrders: number;
  totalPayments: number;
  currentBalance: number;
}

export default function AccountStatementPage() {
  const t = useTranslations("accountStatement");
  const locale = useLocale();

  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const [selectedCustomerOpeningBalance, setSelectedCustomerOpeningBalance] = useState<number>(0);
  const [customersLoading, setCustomersLoading] = useState(false);

  // Date range
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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
        openingBalance: selectedCustomerOpeningBalance.toString(),
        currentDate: new Date().toISOString().split("T")[0],
      });
      const res = await fetch(
        `/${locale}/api/account-statement?${params.toString()}`,
      );
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setSummary(data.summary || null);
      } else {
        console.error("Failed to fetch statement");
        setTransactions([]);
        setSummary(null);
      }
    } catch (err) {
      console.error("Failed to fetch account statement:", err);
      setTransactions([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerId, selectedCustomerOpeningBalance, fromDate, toDate, locale]);

  const handleCustomerSelect = (id: number | string) => {
    const custId = id.toString();
    setSelectedCustomerId(custId);
    const customer = customers.find((c) => c.id === custId);
    setSelectedCustomerName(customer?.name || "");
    setSelectedCustomerOpeningBalance(customer?.opening_balance ?? 0);
  };

  const handleGenerateStatement = () => {
    if (!isFormValid) return;
    fetchStatement();
  };

  const isFormValid = useMemo(
    () => selectedCustomerId && fromDate && toDate,
    [selectedCustomerId, fromDate, toDate]
  );

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("totalOrders")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatCurrencyString(summary.totalOrders)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("totalPayments")}
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
          <CardContent className="p-0">
            {/* Desktop Table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead className="text-right">{t("orderValue")}</TableHead>
                    <TableHead className="text-right">{t("paidAmount")}</TableHead>
                    <TableHead className="text-right">{t("paidDate")}</TableHead>
                    <TableHead className="text-right">{t("balance")}</TableHead>
                    <TableHead>{t("type")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="text-muted-foreground">
                        {formatStatementDateTime(txn.dateTime)}
                      </TableCell>
                      <TableCell className="text-right">
                        {txn.type === "opening_balance"
                          ? "-"
                          : txn.orderValue !== null
                            ? formatCurrencyString(txn.orderValue)
                            : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {txn.type === "opening_balance"
                          ? "-"
                          : txn.paidAmount !== null
                            ? formatCurrencyString(txn.paidAmount)
                            : "-"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {txn.type === "opening_balance"
                          ? "-"
                          : txn.paidDate
                            ? formatStatementDate(txn.paidDate)
                            : "-"}
                      </TableCell>
                      <TableCell className="text-right">
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
                      <TableCell>
                        {txn.type === "opening_balance" ? (
                          <Badge variant="outline">{t("openingBalance")}</Badge>
                        ) : (
                          <Badge
                            variant={
                              txn.type === "order" ? "destructive" : "income"
                            }
                          >
                            {txn.type === "order"
                              ? t("typeOrder")
                              : t("typePaymentIn")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden divide-y">
              {transactions.map((txn) => (
                <div key={txn.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {formatStatementDateTime(txn.dateTime)}
                    </span>
                    {txn.type === "opening_balance" ? (
                      <Badge variant="outline">{t("openingBalance")}</Badge>
                    ) : (
                      <Badge
                        variant={
                          txn.type === "order" ? "destructive" : "income"
                        }
                      >
                        {txn.type === "order"
                          ? t("typeOrder")
                          : t("typePaymentIn")}
                      </Badge>
                    )}
                  </div>
                  {txn.type !== "opening_balance" && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t("orderValue")}:
                        </span>
                        <span className="font-medium">
                          {txn.orderValue !== null
                            ? formatCurrencyString(txn.orderValue)
                            : "-"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t("paidAmount")}:
                        </span>
                        <span className="font-medium">
                          {txn.paidAmount !== null
                            ? formatCurrencyString(txn.paidAmount)
                            : "-"}
                        </span>
                      </div>
                    </>
                  )}
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
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
