"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { formatCurrencyString } from "@/lib/utils";
import { FileText, Loader2, Calendar, RefreshCw } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  balance?: number;
}

interface Transaction {
  id: string;
  type: "order" | "payment_in";
  amount: number;
  balance: number;
  dateTime: string;
}

interface StatementSummary {
  totalOrders: number;
  totalPayments: number;
  currentBalance: number;
}

export default function AccountStatementPage() {
  const t = useTranslations("accountStatement");
  const locale = useLocale();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(true);

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
  }, [selectedCustomerId, fromDate, toDate, locale]);

  const handleCustomerSelect = (id: number | string) => {
    const custId = id.toString();
    setSelectedCustomerId(custId);
    const customer = customers.find((c) => c.id === custId);
    setSelectedCustomerName(customer?.name || "");
  };

  const handleGenerateStatement = () => {
    if (!selectedCustomerId || !fromDate || !toDate) return;
    setIsModalOpen(false);
    fetchStatement();
  };

  const handleReopenModal = () => {
    setIsModalOpen(true);
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  const isFormValid = selectedCustomerId && fromDate && toDate;

  return (
    <div className="space-y-4">
      {/* Filter Modal - Opens automatically on page load */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("title")}
            </DialogTitle>
            <DialogDescription>{t("modalDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label htmlFor="customer">{t("selectCustomer")}</Label>
              {customersLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
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

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
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
              <div className="space-y-2">
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
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleGenerateStatement}
              disabled={!isFormValid}
              className="w-full sm:w-auto"
            >
              {t("generateStatement")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Statement Results */}
      {!isModalOpen && (
        <>
          {/* Header with selected info and re-open button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{t("title")}</h2>
              {selectedCustomerName && (
                <p className="text-sm text-muted-foreground">
                  {t("customer")}: <strong>{selectedCustomerName}</strong>
                  {" | "}
                  {t("period")}: {fromDate} → {toDate}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleReopenModal}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t("changeFilters")}
            </Button>
          </div>

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
                        <TableHead>{t("amountReceived")}</TableHead>
                        <TableHead>{t("balance")}</TableHead>
                        <TableHead>{t("type")}</TableHead>
                        <TableHead>{t("dateTime")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="font-medium">
                            {formatCurrencyString(txn.amount)}
                          </TableCell>
                          <TableCell>
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
                            <Badge
                              variant={
                                txn.type === "order" ? "destructive" : "income"
                              }
                            >
                              {txn.type === "order"
                                ? t("typeOrder")
                                : t("typePaymentIn")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDateTime(txn.dateTime)}
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
                        <span className="font-medium">
                          {formatCurrencyString(txn.amount)}
                        </span>
                        <Badge
                          variant={
                            txn.type === "order" ? "destructive" : "income"
                          }
                        >
                          {txn.type === "order"
                            ? t("typeOrder")
                            : t("typePaymentIn")}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t("balance")}:
                        </span>
                        <span
                          className={
                            txn.balance > 0
                              ? "text-red-600 font-medium"
                              : "text-green-600 font-medium"
                          }
                        >
                          {formatCurrencyString(txn.balance)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(txn.dateTime)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
