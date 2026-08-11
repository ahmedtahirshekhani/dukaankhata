"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supportContacts } from "@/lib/contact-info";
import {
  Loader2Icon,
  TrendingDown,
  TrendingUp,
  Activity,
  File,
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { Switch } from "@/components/ui/switch";
import VyaparImportButton from "@/components/VyaparImportButton";
import BMBKImportButton from "@/components/BMBKImportButton";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { SummaryCarousel } from "@/components/summary-carousel";
import { Pagination } from "@/components/ui/pagination";
import { cn, maskInvoiceNo } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/db/offline-db";

type CounterRange =
  | "today"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "ytd";

const getStartOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const getEndOfDay = (date: Date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );

const getRangeTimestamps = (rangeKey: CounterRange) => {
  const now = new Date();
  let start = getStartOfDay(now);
  let end = getEndOfDay(now);

  switch (rangeKey) {
    case "today":
      start = getStartOfDay(now);
      end = getEndOfDay(now);
      break;
    case "thisWeek": {
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      start = getStartOfDay(now);
      start.setDate(start.getDate() - diffToMonday);
      end = getEndOfDay(now);
      break;
    }
    case "lastWeek": {
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      const thisWeekStart = getStartOfDay(now);
      thisWeekStart.setDate(thisWeekStart.getDate() - diffToMonday);
      start = new Date(thisWeekStart);
      start.setDate(start.getDate() - 7);
      end = getEndOfDay(
        new Date(
          thisWeekStart.getFullYear(),
          thisWeekStart.getMonth(),
          thisWeekStart.getDate() - 1,
        ),
      );
      break;
    }
    case "thisMonth":
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = getEndOfDay(now);
      break;
    case "lastMonth":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    case "ytd":
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = getEndOfDay(now);
      break;
  }

  return {
    fromDateTime: start.toISOString(),
    toDateTime: end.toISOString(),
  };
};

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    width="1em"
    height="1em"
    {...props}
  >
    <path d="M12.004 2C6.48 2 2 6.48 2 12c0 2.17.7 4.19 1.89 5.86L2.5 22.5l4.81-1.35c1.42.75 3.01 1.18 4.69 1.18 5.52 0 10-4.48 10-10S17.52 2 12.004 2zm5.72 13.91c-.24.67-1.19 1.25-1.92 1.34-.5.06-1.15.09-3.32-.82-2.77-1.17-4.52-4.06-4.66-4.25-.14-.19-1.12-1.49-1.12-2.84 0-1.35.7-2.01.95-2.29.25-.28.55-.35.74-.35.19 0 .38.01.55.02.18.01.42-.07.65.48.24.58.82 2.01.89 2.15.07.14.12.31.02.5-.1.19-.15.31-.31.5-.16.19-.34.42-.48.56-.16.16-.33.33-.14.65.19.32.85 1.4 1.83 2.27.84.75 1.55.98 1.87 1.12.32.14.51.12.7-.1.19-.22.82-.95 1.04-1.28.22-.33.44-.28.74-.17.3.11 1.91.9 2.23 1.06.32.16.53.24.61.38.08.14.08.8-.16 1.47z" />
  </svg>
);

export default function DashboardPage() {
  const tDash = useTranslations("dashboard");
  const tCust = useTranslations("customers");
  const tInvoice = useTranslations("invoice");
  const router = useRouter();
  const params = useParams();
  const { hasModuleAccess } = usePermissions();
  const canViewCustomers = hasModuleAccess("customers");
  const canViewSales = hasModuleAccess("sales");
  const canViewProducts = hasModuleAccess("products");
  const canViewPurchases = hasModuleAccess("purchase");
  const canViewExpenses = hasModuleAccess("expenses");
  const locale =
    typeof params?.locale === "string"
      ? params.locale
      : Array.isArray(params?.locale)
        ? params?.locale?.[0]
        : "en";

  const [loading, setLoading] = useState(true);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [enableCounterSale, setEnableCounterSale] = useState(false);

  const [totalBalance, setTotalBalance] = useState(0);
  const [totalPayable, setTotalPayable] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [counterSales, setCounterSales] = useState(0);
  const [counterExpenses, setCounterExpenses] = useState(0);
  const [isCounterSalesLoading, setIsCounterSalesLoading] = useState(false);
  const [isCounterExpensesLoading, setIsCounterExpensesLoading] =
    useState(false);
  const [counterSalesRange, setCounterSalesRange] =
    useState<CounterRange>("today");
  const [counterExpensesRange, setCounterExpensesRange] =
    useState<CounterRange>("today");
  const [importOpen, setImportOpen] = useState(false);

  const [salesRows, setSalesRows] = useState<
    Array<{
      id: string;
      invoiceNo: string;
      customerName: string;
      total: number;
      paid: number;
      balance: number;
      date: string;
    }>
  >([]);

  const [customerRows, setCustomerRows] = useState<
    Array<{
      id: string;
      name: string;
      email: string;
      phone: string;
      balance: number;
      status: string;
    }>
  >([]);

  const [itemRows, setItemRows] = useState<
    Array<{
      id: string;
      name: string;
      category: string;
      stock: number;
      price: number;
    }>
  >([]);

  const [activeDashboardTab, setActiveDashboardTab] = useState<
    "customers" | "sales" | "items"
  >("customers");

  useEffect(() => {
    if (activeDashboardTab === "customers" && !canViewCustomers) {
      if (canViewSales) setActiveDashboardTab("sales");
      else if (canViewProducts) setActiveDashboardTab("items");
    } else if (activeDashboardTab === "sales" && !canViewSales) {
      if (canViewCustomers) setActiveDashboardTab("customers");
      else if (canViewProducts) setActiveDashboardTab("items");
    } else if (activeDashboardTab === "items" && !canViewProducts) {
      if (canViewCustomers) setActiveDashboardTab("customers");
      else if (canViewSales) setActiveDashboardTab("sales");
    }
  }, [canViewCustomers, canViewSales, canViewProducts, activeDashboardTab]);

  const dateLocale = locale === "ru" ? "en" : locale;
  const currentMonthName = new Date().toLocaleDateString(dateLocale, {
    month: "long",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const [errorDialog, setErrorDialog] = useState({
    open: false,
    title: "",
    message: "",
    isSuccess: false,
  });

  const handleWhatsAppClick = (customer: { name: string; phone: string; balance: number }) => {
    const cleanPhone = (customer.phone || "").replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 5) {
      const baseMsg = tInvoice("whatsappNumberUnavailable") || "No WhatsApp number available for this customer.";
      const instructMsg = locale === "ur" 
        ? "\n\nبراہ کرم اس گاہک کا فون نمبر درج کریں۔ آپ Customers سیکشن میں جا کر تبدیل کریں (Edit) بٹن پر کلک کر کے نمبر شامل کر سکتے ہیں۔"
        : locale === "ru"
        ? "\n\nIs customer ka phone number add karain. Aap Customers section mein Edit button par click kar ke number add kar sakte hain."
        : "\n\nPlease add a phone number for this customer. You can navigate to the Customers section and edit the customer to add their number.";
      
      setErrorDialog({
        open: true,
        title: locale === "ur" ? "فون نمبر شامل کریں" : "Add Phone Number",
        message: baseMsg + instructMsg,
        isSuccess: false,
      });
      return;
    }

    let whatsappPhone = "";
    if (cleanPhone.startsWith("0")) {
      whatsappPhone = `92${cleanPhone.slice(1)}`;
    } else if (cleanPhone.startsWith("92")) {
      whatsappPhone = cleanPhone;
    } else if (cleanPhone.length === 10) {
      whatsappPhone = `92${cleanPhone}`;
    } else {
      whatsappPhone = cleanPhone;
    }

    const currency = tCust("currencySymbol") || "Rs.";
    const roundedBalance = Math.round(customer.balance || 0);
    
    // Select translation message based on current locale
    let message = "";
    if (locale === "ur") {
      message = `السلام علیکم ${customer.name}،\n\nبراہ کرم اپنا بقایا بیلنس ${currency} ${roundedBalance} بھیج دیں۔\n\nشکریہ!`;
    } else if (locale === "ru") {
      message = `Assalam o Alaikum ${customer.name},\n\nFriendly reminder: Please clear your outstanding balance of ${currency} ${roundedBalance}.\n\nShukriya!`;
    } else {
      message = `Dear ${customer.name},\n\nThis is a friendly reminder to please clear your outstanding balance of ${currency} ${roundedBalance}.\n\nThank you!`;
    }

    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };


  useEffect(() => {
    const savedPrivacyMode = localStorage.getItem("dashboardPrivacyMode");
    if (savedPrivacyMode) {
      setIsPrivacyMode(JSON.parse(savedPrivacyMode));
    } else {
      setIsPrivacyMode(false);
      localStorage.setItem("dashboardPrivacyMode", JSON.stringify(false));
    }

    const loadFeatures = () => {
      const savedCounter = localStorage.getItem("setting_counterSale");
      if (savedCounter) setEnableCounterSale(savedCounter === "true");
    };
    
    loadFeatures();

    window.addEventListener("featureSettingsUpdated", loadFeatures);
    return () => window.removeEventListener("featureSettingsUpdated", loadFeatures);
  }, []);

  // Fetch summary on mount, and refresh once pending offline writes (e.g. a newly
  // created invoice's balance update) have actually synced to the server.
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch("/api/admin/dashboard/summary");
        if (res.status === 401) {
          router.replace(`/${locale}/login`);
          return;
        }
        const dashboardData = await res.json();
        setTotalBalance(dashboardData.totalBalance || 0);
        setTotalPayable(dashboardData.totalPayable || 0);
        setTotalRevenue(dashboardData.totalRevenue || 0);
        setTotalPurchases(dashboardData.totalPurchases || 0);
        setTotalExpenses(dashboardData.totalExpenses || 0);
      } catch (error) {
        console.error("Error fetching summary:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();

    window.addEventListener("focus", fetchSummary);
    window.addEventListener("initialSyncComplete", fetchSummary);
    window.addEventListener("syncComplete", fetchSummary);

    return () => {
      window.removeEventListener("focus", fetchSummary);
      window.removeEventListener("initialSyncComplete", fetchSummary);
      window.removeEventListener("syncComplete", fetchSummary);
    };
  }, [locale, router]);

  // Fetch tab data when tab, page or pageSize changes
  useEffect(() => {
    const fetchTabData = async () => {
      setIsDataLoading(true);
      try {
        if (activeDashboardTab === "sales") {
            const offset = (currentPage - 1) * pageSize;
            const orders = await db.orders.orderBy('created_at').reverse().offset(offset).limit(pageSize).toArray();
            const totalCount = await db.orders.count();
            
            // Populate customers
            const ordersWithCustomers = await Promise.all(
              orders.map(async (order) => {
                if (order.customer_id) {
                  const customer = await db.parties.get(order.customer_id.toString());
                  return { ...order, customer };
                }
                return order;
              })
            );

            const orderRows = ordersWithCustomers.map((order: any, index: number) => {
              const total = Number(order?.total_amount || 0);
              const paid = Number(order?.payment?.paid_amount || 0);
              return {
                id: order?.id || String(index),
                invoiceNo: order?.invoice_no || `ORD-${order?.id || index}`,
                customerName: order?.customer?.name || "-",
                total,
                paid,
                balance: Math.max(0, total - paid),
                date: order?.sale_date || order?.created_at
                  ? new Date(order?.sale_date || order?.created_at).toLocaleDateString()
                  : "-",
              };
            });
            
            setSalesRows(orderRows);
            setTotalCount(totalCount);
            setTotalPages(Math.ceil(totalCount / pageSize));
            setIsDataLoading(false);
            return;
        }
        
        if (activeDashboardTab === "items") {
            const offset = (currentPage - 1) * pageSize;
            const allProducts = await db.products.toArray();
            allProducts.sort((a, b) => {
              const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
              const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
              return dateB - dateA;
            });
            const products = allProducts.slice(offset, offset + pageSize);
            const totalCount = allProducts.length;
            
            const pRows = products.map((item: any, index: number) => ({
                id: item?.id || String(index),
                name: item?.name || item?.title || "-",
                category: item?.category || "-",
                stock: Number(item?.stock || item?.quantity || 0),
                price: Number(item?.sell_price || item?.price || 0),
            }));
            
            setItemRows(pRows);
            setTotalCount(totalCount);
            setTotalPages(Math.ceil(totalCount / pageSize));
            setIsDataLoading(false);
            return;
        }

        if (activeDashboardTab === "customers") {
            const allCustomers = await db.parties.toArray();
            
            // Filter inactive and deleted customers
            const list = allCustomers.filter(p => p.status !== "inactive" && p.is_delete !== 1);
            
            // Sort by absolute balance in descending order, then take top 10
            const sortedCustomers = list
                .sort((a, b) => Math.abs(b.balance || 0) - Math.abs(a.balance || 0))
                .slice(0, 10);
                
            const rows = sortedCustomers.map((item: any, index: number) => ({
                id: item?.id || String(index),
                name: item?.name || "-",
                email: item?.email || "-",
                phone: item?.phone || "-",
                balance: Number(item?.balance || 0),
                status: item?.status || "Active",
            }));
            
            setCustomerRows(rows);
            setTotalCount(rows.length);
            setTotalPages(1);
            setIsDataLoading(false);
            return;
        }

        setIsDataLoading(false);
      } catch (error) {
        console.error("Error fetching tab data:", error);
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchTabData();
    
    window.addEventListener("focus", fetchTabData);
    window.addEventListener("initialSyncComplete", fetchTabData);
    window.addEventListener("syncComplete", fetchTabData);
    
    return () => {
      window.removeEventListener("focus", fetchTabData);
      window.removeEventListener("initialSyncComplete", fetchTabData);
      window.removeEventListener("syncComplete", fetchTabData);
    };
  }, [activeDashboardTab, currentPage, pageSize, locale]);

  // Fetch counter sales total for selected range
  useEffect(() => {
    const fetchSales = async () => {
      setIsCounterSalesLoading(true);
      try {
        const params = new URLSearchParams({
          all: "true",
          ...getRangeTimestamps(counterSalesRange),
        });
        const res = await fetch(`/api/transactions?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        const txs = data.data || [];
        // Exclude transactions generated from invoice/order payments (they carry an order_id) —
        // Counter Sale is a standalone feature and should not include invoicing payments.
        const incomeTotal = txs.reduce(
          (sum: number, t: any) =>
            t.type === "income" && !t.order_id
              ? sum + Number(t.amount || 0)
              : sum,
          0,
        );
        setCounterSales(Math.round(incomeTotal * 100) / 100);
      } catch (err) {
        console.error("Error fetching counter sales:", err);
      } finally {
        setIsCounterSalesLoading(false);
      }
    };
    fetchSales();
  }, [counterSalesRange]);

  // Fetch counter expenses total for selected range
  useEffect(() => {
    const fetchExpenses = async () => {
      setIsCounterExpensesLoading(true);
      try {
        const params = new URLSearchParams({
          all: "true",
          ...getRangeTimestamps(counterExpensesRange),
        });
        const res = await fetch(`/api/transactions?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        const txs = data.data || [];
        const expenseTotal = txs.reduce(
          (sum: number, t: any) =>
            t.type === "expense" ? sum + Number(t.amount || 0) : sum,
          0,
        );
        setCounterExpenses(Math.round(expenseTotal * 100) / 100);
      } catch (err) {
        console.error("Error fetching counter expenses:", err);
      } finally {
        setIsCounterExpensesLoading(false);
      }
    };
    fetchExpenses();
  }, [counterExpensesRange]);

  // Reset page when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeDashboardTab]);

  // Summary Cards
  const summaryCards = useMemo(
    () => [
      ...(canViewCustomers ? [
        {
          key: "balance",
          node: (
            <StatCard
              title={tDash("totalBalanceYoullGet") || "Total Balance (You'll get)"}
              value={totalBalance}
              icon={<Activity className="w-4 h-4 sm:w-5 sm:h-5" />}
              isPrivacy={isPrivacyMode}
              currency="PKR"
            />
          ),
        },
        {
          key: "payable",
          node: (
            <StatCard
              title={tDash("totalPayable")}
              value={totalPayable}
              icon={<TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />}
              isPrivacy={isPrivacyMode}
              currency="PKR"
              isExpense
            />
          ),
        }
      ] : []),
      ...(canViewSales ? [
        {
          key: "sales",
          node: (
            <StatCard
              title={`${tDash("sales") || "Sales"} (${currentMonthName})`}
              value={totalRevenue}
              icon={<TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />}
              isPrivacy={isPrivacyMode}
              currency="PKR"
            />
          ),
        }
      ] : []),
      ...(canViewPurchases ? [
        {
          key: "purchases",
          node: (
            <StatCard
              title={`${tDash("purchases")} (${currentMonthName})`}
              value={totalPurchases}
              icon={<TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />}
              isPrivacy={isPrivacyMode}
              currency="PKR"
              isExpense
            />
          ),
        }
      ] : []),
      ...(canViewExpenses ? [
        {
          key: "expenses",
          node: (
            <StatCard
              title={`${tDash("totalExpenses") || "Total Expense"} (${currentMonthName})`}
              value={totalExpenses}
              icon={<TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />}
              isPrivacy={isPrivacyMode}
              currency="PKR"
              isExpense
            />
          ),
        }
      ] : []),
      ...(canViewSales ? [
        {
          key: "counter-sales",
          node: (
            <StatCard
              title={tDash("counterSales") || "Counter Sales"}
              value={counterSales}
              icon={
                <Select
                  value={counterSalesRange}
                  onValueChange={(v) => {
                    setIsCounterSalesLoading(true);
                    setCounterSalesRange(v as CounterRange);
                  }}
                >
                  <SelectTrigger className="w-20 h-6 text-[10px] bg-transparent shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="thisWeek">This Week</SelectItem>
                    <SelectItem value="lastWeek">Last Week</SelectItem>
                    <SelectItem value="thisMonth">This Month</SelectItem>
                    <SelectItem value="lastMonth">Last Month</SelectItem>
                    <SelectItem value="ytd">Year to date</SelectItem>
                  </SelectContent>
                </Select>
              }
              isPrivacy={isPrivacyMode}
              currency="PKR"
              isLoading={isCounterSalesLoading}
              noIconBg
            />
          ),
        }
      ] : []),
      ...(canViewExpenses ? [
        {
          key: "counter-expenses",
          node: (
            <StatCard
              title={tDash("counterExpenses") || "Counter Expenses"}
              value={counterExpenses}
              icon={
                <Select
                  value={counterExpensesRange}
                  onValueChange={(v) => {
                    setIsCounterExpensesLoading(true);
                    setCounterExpensesRange(v as CounterRange);
                  }}
                >
                  <SelectTrigger className="w-20 h-6 text-[10px] bg-transparent shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="thisWeek">This Week</SelectItem>
                    <SelectItem value="lastWeek">Last Week</SelectItem>
                    <SelectItem value="thisMonth">This Month</SelectItem>
                    <SelectItem value="lastMonth">Last Month</SelectItem>
                    <SelectItem value="ytd">Year to date</SelectItem>
                  </SelectContent>
                </Select>
              }
              isPrivacy={isPrivacyMode}
              currency="PKR"
              isExpense
              isLoading={isCounterExpensesLoading}
              noIconBg
            />
          ),
        }
      ] : []),
    ],
    [
      totalBalance,
      totalPayable,
      totalRevenue,
      totalPurchases,
      totalExpenses,
      counterSales,
      counterExpenses,
      counterSalesRange,
      counterExpensesRange,
      currentMonthName,
      isPrivacyMode,
      isCounterExpensesLoading,
      tDash,
      enableCounterSale,
      canViewCustomers,
      canViewSales,
      canViewPurchases,
      canViewExpenses,
    ],
  ).filter(card => {
    if (!enableCounterSale) {
      return card.key !== "counter-sales" && card.key !== "counter-expenses";
    }
    return true;
  });

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2Icon className="mx-auto h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header Section */}
      <div className="flex flex-col gap-1 mb-2 w-full">
        {/* Row 1: Heading and Actions */}
        <div className="flex flex-row items-center justify-between w-full gap-2">
          <h1 className="text-xl sm:text-3xl font-bold truncate">
            {tDash("analyticalDashboard") || "Dashboard"}
          </h1>
          
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <label htmlFor="privacy-toggle" className="text-[10px] sm:text-sm font-medium whitespace-nowrap leading-none">
              {isPrivacyMode ? tDash("privacyOn") : tDash("privacyOff")}
            </label>

            <div className="flex items-center scale-[0.8] sm:scale-100 origin-right h-7">
              <Switch
                id="privacy-toggle"
                checked={isPrivacyMode}
                onCheckedChange={() => {
                  const newPrivacyMode = !isPrivacyMode;
                  setIsPrivacyMode(newPrivacyMode);
                  localStorage.setItem("dashboardPrivacyMode", JSON.stringify(newPrivacyMode));
                }}
                className="h-5 w-9 sm:h-6 sm:w-11"
              />
            </div>

            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-1 sm:gap-2 justify-center h-7 px-2 py-1 text-[10px] sm:h-8 sm:px-3 sm:text-xs" size="sm" variant="outline">
                  <File className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Import Your Data</span>
                  <span className="inline sm:hidden">Import</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Import Your Data</DialogTitle>
                </DialogHeader>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <VyaparImportButton />
                  <BMBKImportButton />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Row 2: Description */}
        <p className="text-[11px] sm:text-sm text-muted-foreground break-words">
          {tDash("dashboardDescription") || "Your business insights overview"}
        </p>
      </div>

      {/* Summary Cards Carousel */}
      <div className="min-w-0 max-w-full">
        <SummaryCarousel
          cards={summaryCards.map(c => <React.Fragment key={c.key}>{c.node}</React.Fragment>)}
          itemClassName="basis-[45%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5"
        />
      </div>

      {/* Dashboard Tabs Section */}
      <div className="mt-2">
        <h2 className="text-lg sm:text-xl font-semibold">
          {tDash("dashboardSections") || "Dashboard Sections"}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {tDash("dashboardSectionsDescription") ||
            "Switch between customer transactions, sales, and items"}
        </p>
      </div>

      <Card>
        <CardHeader className="p-3 sm:p-4 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {canViewCustomers && (
              <Button
                type="button"
                size="sm"
                variant={activeDashboardTab === "customers" ? "default" : "outline"}
                onClick={() => setActiveDashboardTab("customers")}
              >
                {tDash("customers") || "Customers"}
              </Button>
            )}
            {canViewSales && (
              <Button
                type="button"
                size="sm"
                variant={activeDashboardTab === "sales" ? "default" : "outline"}
                onClick={() => setActiveDashboardTab("sales")}
              >
                {tDash("sales") || "Sales"}
              </Button>
            )}
            {canViewProducts && (
              <Button
                type="button"
                size="sm"
                variant={activeDashboardTab === "items" ? "default" : "outline"}
                onClick={() => setActiveDashboardTab("items")}
              >
                {tDash("items") || "Items"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-3 pt-1 sm:pt-3 relative">
          {isDataLoading && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 backdrop-blur-[2px]">
              <Loader2Icon className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto max-h-[28rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {activeDashboardTab === "sales" && (
                    <>
                      <TableHead>{tDash("invoiceNo") || "Invoice No"}</TableHead>
                      <TableHead>{tDash("customer") || "Customer"}</TableHead>
                      <TableHead>{tDash("total") || "Total"}</TableHead>
                      <TableHead>{tDash("paid") || "Paid"}</TableHead>
                      <TableHead>{tDash("balance") || "Balance"}</TableHead>
                      <TableHead>{tDash("date") || "Date"}</TableHead>
                    </>
                  )}
                  {activeDashboardTab === "customers" && (
                    <>
                      <TableHead>{tDash("name") || "Name"}</TableHead>
                      <TableHead>{tDash("email") || "Email"}</TableHead>
                      <TableHead>{tDash("phone") || "Phone"}</TableHead>
                      <TableHead>{tDash("balance") || "Balance"}</TableHead>
                      <TableHead>{tDash("status") || "Status"}</TableHead>
                      <TableHead>{tDash("actions") || "Actions"}</TableHead>
                    </>
                  )}
                  {activeDashboardTab === "items" && (
                    <>
                      <TableHead>{tDash("name") || "Name"}</TableHead>
                      <TableHead>{tDash("category") || "Category"}</TableHead>
                      <TableHead>{tDash("stock") || "Stock"}</TableHead>
                      <TableHead>{tDash("price") || "Price"}</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeDashboardTab === "sales" && salesRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                      {tDash("noData") || "No data"}
                    </TableCell>
                  </TableRow>
                )}
                {activeDashboardTab === "sales" && salesRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-medium">
                          {maskInvoiceNo(row.invoiceNo)}
                        </span>
                        <span className="bg-[hsl(var(--soft-gray-bg))] text-[10px] text-muted-foreground px-1.5 py-0.5 rounded">
                          {row.invoiceNo}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>
                      {isPrivacyMode ? "***" : `PKR ${Math.round(row.total).toLocaleString()}`}
                    </TableCell>
                    <TableCell>
                      {isPrivacyMode ? "***" : `PKR ${Math.round(row.paid).toLocaleString()}`}
                    </TableCell>
                    <TableCell>
                      {isPrivacyMode ? "***" : `PKR ${Math.round(row.balance).toLocaleString()}`}
                    </TableCell>
                    <TableCell>{row.date}</TableCell>
                  </TableRow>
                ))}

                {activeDashboardTab === "customers" && customerRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                      {tDash("noData") || "No data"}
                    </TableCell>
                  </TableRow>
                )}
                {activeDashboardTab === "customers" && customerRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      row.balance < 0 && "bg-red-100/70 dark:bg-red-950/50",
                      row.balance > 0 && "bg-green-100/70 dark:bg-green-950/50"
                    )}
                  >
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.phone}</TableCell>
                    <TableCell>
                      {isPrivacyMode ? "***" : `PKR ${Math.round(row.balance).toLocaleString()}`}
                    </TableCell>
                    <TableCell className="capitalize">{row.status}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/${locale}/admin/customer-transactions/${row.id}`}>
                            {tDash("viewTransactions") || "View Transactions"}
                          </Link>
                        </Button>
                        {row.balance > 0 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/30"
                            onClick={() => handleWhatsAppClick(row)}
                          >
                            <WhatsAppIcon className="w-4.5 h-4.5" />
                            <span className="sr-only">Send on WhatsApp</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {activeDashboardTab === "items" && itemRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground text-center">
                      {tDash("noData") || "No data"}
                    </TableCell>
                  </TableRow>
                )}
                {activeDashboardTab === "items" && itemRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>{row.stock}</TableCell>
                    <TableCell>
                      {isPrivacyMode ? "***" : `PKR ${Math.round(row.price).toLocaleString()}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-3 max-h-[28rem] overflow-y-auto">
            {activeDashboardTab === "customers" && customerRows.map((row) => (
              <div
                key={row.id}
                onClick={() => router.push(`/${locale}/admin/customer-transactions/${row.id}`)}
                className={cn(
                  "border rounded-lg p-4 shadow-sm cursor-pointer relative",
                  row.balance < 0 && "bg-red-100/70 dark:bg-red-950/50",
                  row.balance > 0 && "bg-green-100/70 dark:bg-green-950/50"
                )}
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-base mb-1">{row.name}</h3>
                  {row.balance > 0 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWhatsAppClick(row);
                      }}
                    >
                      <WhatsAppIcon className="w-4.5 h-4.5" />
                      <span className="sr-only">Send on WhatsApp</span>
                    </Button>
                  )}
                </div>
                <div className="text-sm">
                  <p><span className="text-muted-foreground">Balance:</span> {isPrivacyMode ? "***" : `PKR ${Math.round(row.balance).toLocaleString()}`}</p>
                </div>
              </div>
            ))}
            {activeDashboardTab === "customers" && customerRows.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No data</div>
            )}

            {activeDashboardTab === "sales" && salesRows.map((row) => (
              <div key={row.id} className="border rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col items-start gap-0.5">
                    <h3 className="font-semibold">{maskInvoiceNo(row.invoiceNo)}</h3>
                    <span className="bg-[hsl(var(--soft-gray-bg))] text-[10px] text-muted-foreground px-1.5 py-0.5 rounded">
                      {row.invoiceNo}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">{row.date}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Customer:</span> {row.customerName}</p>
                  <p><span className="text-muted-foreground">Total:</span> {isPrivacyMode ? "***" : `PKR ${Math.round(row.total).toLocaleString()}`}</p>
                  <div className="flex justify-between items-center gap-2">
                    <p><span className="text-muted-foreground">Paid:</span> {isPrivacyMode ? "***" : `PKR ${Math.round(row.paid).toLocaleString()}`}</p>
                    <p><span className="text-muted-foreground">Balance:</span> {isPrivacyMode ? "***" : `PKR ${Math.round(row.balance).toLocaleString()}`}</p>
                  </div>
                </div>
              </div>
            ))}
            {activeDashboardTab === "sales" && salesRows.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No data</div>
            )}

            {activeDashboardTab === "items" && itemRows.map((row) => (
              <div key={row.id} className="border rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2 gap-2">
                  <h3 className="font-semibold truncate">{row.name}</h3>
                  <span className="text-xs text-muted-foreground shrink-0">{row.category}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <p><span className="text-muted-foreground">Stock:</span> {row.stock}</p>
                  <p><span className="text-muted-foreground">Price:</span> {isPrivacyMode ? "***" : `PKR ${Math.round(row.price).toLocaleString()}`}</p>
                </div>
              </div>
            ))}
            {activeDashboardTab === "items" && itemRows.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No data</div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col md:flex-row justify-between items-center px-4 py-3 border-t gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <div className="text-sm text-muted-foreground">
              {totalCount} Total
            </div>
            <div className="flex items-center gap-2">
              {activeDashboardTab !== "customers" && (
                <>
                  <span className="text-sm text-muted-foreground">Rows per page</span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(parseInt(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 50, 100].map((size) => (
                        <SelectItem key={size} value={size.toString()}> {size} </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>
          {activeDashboardTab !== "customers" && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              isLoading={isDataLoading}
            />
          )}
        </CardFooter>
      </Card>

      <Card className="mt-10">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            <span className="font-medium text-muted-foreground shrink-0">{tDash("needHelp") || "Need Help with DukaanKhata? Reach out:"}</span>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {supportContacts.map((c) => (
                <span key={c.name} className="flex items-center gap-1">
                  <span className="text-muted-foreground">{c.name}:</span>
                  <a href={c.href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">{c.display}</a>
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
        title={errorDialog.title}
        message={errorDialog.message}
        isSuccess={errorDialog.isSuccess}
      />
    </div>
  );
}


function StatCard({
  title,
  value,
  icon,
  isPrivacy,
  currency,
  isExpense,
  noIconBg,
  isLoading,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  isPrivacy: boolean;
  currency?: string;
  isExpense?: boolean;
  noIconBg?: boolean;
  isLoading?: boolean;
}) {
  const bgColor = noIconBg
    ? ""
    : isExpense
      ? "bg-red-500/10"
      : "bg-blue-500/10";

  return (
    <Card className="flex flex-col p-2.5 sm:p-3 gap-1.5">
      <div className="flex items-start justify-between gap-1">
        <p className="text-[11px] sm:text-xs font-medium leading-tight line-clamp-3 text-muted-foreground">
          {title}
        </p>
        <div className={cn("flex shrink-0 items-center justify-center", !noIconBg && `p-1 rounded-md ${bgColor}`)}>
          {icon}
        </div>
      </div>
      <div className="flex items-center gap-1 font-bold text-sm sm:text-base leading-tight">
        {isPrivacy ? (
          <span className="text-muted-foreground">•••••</span>
        ) : (
          <>
            {currency && <span className="text-[10px] font-normal text-muted-foreground">{currency} </span>}
            {Math.floor(value).toLocaleString()}
          </>
        )}
        {isLoading && <Loader2Icon className="h-3 w-3 animate-spin" />}
      </div>
    </Card>
  );
}