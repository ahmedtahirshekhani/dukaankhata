"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { supportContact } from "@/lib/constants";
import {
  Loader2Icon,
  TrendingDown,
  TrendingUp,
  Activity,
  File,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import VyaparImportButton from "@/components/VyaparImportButton";
import { Pagination } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function DashboardPage() {
  const tDash = useTranslations("dashboard");
  const tCust = useTranslations("customers");
  const router = useRouter();
  const params = useParams();
  const locale =
    typeof params?.locale === "string"
      ? params.locale
      : Array.isArray(params?.locale)
        ? params?.locale?.[0]
        : "en";

  const [loading, setLoading] = useState(true);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);

  const [totalBalance, setTotalBalance] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
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

  const currentMonthName = new Date().toLocaleDateString(locale, {
    month: "long",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Slider States
  const [scrollPosition, setScrollPosition] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const sliderRef = useRef<HTMLDivElement>(null);
  const mobileCardWidth = 284;
  const mobileCardGap = 16;
  const mobileCardStep = mobileCardWidth + mobileCardGap;

  useEffect(() => {
    const savedPrivacyMode = localStorage.getItem("dashboardPrivacyMode");
    if (savedPrivacyMode) {
      setIsPrivacyMode(JSON.parse(savedPrivacyMode));
    } else {
      setIsPrivacyMode(false);
      localStorage.setItem("dashboardPrivacyMode", JSON.stringify(false));
    }
  }, []);

  // Fetch summary on mount
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
        setTotalRevenue(dashboardData.totalRevenue || 0);
        setTotalExpenses(dashboardData.totalExpenses || 0);
      } catch (error) {
        console.error("Error fetching summary:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [locale, router]);

  // Fetch tab data when tab, page or pageSize changes
  useEffect(() => {
    const fetchTabData = async () => {
      setIsDataLoading(true);
      try {
        let endpoint = "";
        if (activeDashboardTab === "sales") endpoint = "/api/orders";
        else if (activeDashboardTab === "customers")
          endpoint = "/api/customers";
        else if (activeDashboardTab === "items") endpoint = "/api/products";

        const url = new URL(endpoint, window.location.origin);
        url.searchParams.append("page", currentPage.toString());
        url.searchParams.append("limit", pageSize.toString());

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Failed to fetch data");
        const data = await res.json();

        if (activeDashboardTab === "sales") {
          const orders = data.orders || [];
          const orderRows = orders.map((order: any, index: number) => {
            const total = Number(order?.total_amount || 0);
            const paid = Number(order?.payment?.paid_amount || 0);
            return {
              id: order?.id || String(index),
              invoiceNo: order?.invoice_no || `ORD-${order?.id || index}`,
              customerName: order?.customer?.name || "-",
              total,
              paid,
              balance: Math.max(0, total - paid),
              date:
                order?.sale_date || order?.created_at
                  ? new Date(
                      order?.sale_date || order?.created_at,
                    ).toLocaleDateString()
                  : "-",
            };
          });
          setSalesRows(orderRows);
        } else if (activeDashboardTab === "customers") {
          const customers = data.customers || [];
          const rows = customers.map((item: any, index: number) => ({
            id: item?.id || String(index),
            name: item?.name || "-",
            email: item?.email || "-",
            phone: item?.phone || "-",
            balance: Number(item?.balance || 0),
            status: item?.status || "active",
          }));
          setCustomerRows(rows);
        } else if (activeDashboardTab === "items") {
          const products = data.products || [];
          const pRows = products.map((item: any, index: number) => ({
            id: item?.id || String(index),
            name: item?.name || item?.title || "-",
            category: item?.category || "-",
            stock: Number(item?.stock || item?.quantity || 0),
            price: Number(item?.sell_price || item?.price || 0),
          }));
          setItemRows(pRows);
        }

        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      } catch (error) {
        console.error("Error fetching tab data:", error);
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchTabData();
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
        const incomeTotal = txs.reduce(
          (sum: number, t: any) =>
            t.type === "income" ? sum + Number(t.amount || 0) : sum,
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

  // Scroll handler for cards
  const handleScroll = useCallback(() => {
    if (sliderRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
      setScrollPosition(scrollLeft);
      setShowLeftArrow(scrollLeft > 20);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 20);
    }
  }, []);

  const scrollLeftCards = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -mobileCardStep, behavior: "smooth" });
    }
  };

  const scrollRightCards = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: mobileCardStep, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const slider = sliderRef.current;
    if (slider) {
      slider.addEventListener("scroll", handleScroll);
      setTimeout(handleScroll, 100);
      return () => slider.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    window.addEventListener("resize", handleScroll);
    window.addEventListener("orientationchange", handleScroll);
    return () => {
      window.removeEventListener("resize", handleScroll);
      window.removeEventListener("orientationchange", handleScroll);
    };
  }, [handleScroll]);

  // Summary Cards
  const summaryCards = useMemo(
    () => [
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
      },
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
      },
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
                <SelectTrigger className="w-28 h-7 text-[12px] bg-transparent shadow-none">
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
      },
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
                <SelectTrigger className="w-28 h-7 text-[12px] bg-transparent shadow-none">
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
      },
    ],
    [
      totalBalance,
      totalRevenue,
      totalExpenses,
      counterSales,
      counterExpenses,
      counterSalesRange,
      counterExpensesRange,
      currentMonthName,
      isPrivacyMode,
      isCounterSalesLoading,
      isCounterExpensesLoading,
      tDash,
    ],
  );

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2Icon className="mx-auto h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid flex-1 items-start gap-2 sm:gap-3 md:gap-4">
      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {tDash("analyticalDashboard") || "Analytics Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tDash("dashboardDescription") ||
              "Real-time insights and analytics of your business"}
          </p>
        </div>

        <div className="flex items-center justify-end gap-1.5 sm:gap-3 w-full sm:w-auto">
          <label htmlFor="privacy-toggle" className="text-xs sm:text-sm font-medium whitespace-nowrap">
            {isPrivacyMode ? tDash("privacyOn") : tDash("privacyOff")}
          </label>

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

          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2 justify-center" size="sm" variant="outline">
                <File className="w-4 h-4 sm:w-5 sm:h-5" /> Import Your Data
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import Your Data</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <VyaparImportButton />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Cards Slider Section - Mobile */}
      <div className="relative overflow-hidden md:hidden">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            onClick={scrollLeftCards}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white dark:bg-zinc-900 rounded-full shadow-md p-1.5 border border-border hover:bg-accent transition-all"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
        )}

        {/* Right Arrow */}
        {showRightArrow && (
          <button
            onClick={scrollRightCards}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white dark:bg-zinc-900 rounded-full shadow-md p-1.5 border border-border hover:bg-accent transition-all"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        )}

        {/* Cards Slider Track */}
        <div
          ref={sliderRef}
          className="flex overflow-x-auto scroll-smooth gap-4 pb-2 px-9 hide-scrollbar"
        >
          {summaryCards.map((card) => (
            <div
              key={card.key}
              className="flex-shrink-0"
              style={{ width: `${mobileCardWidth}px` }}
            >
              {card.node}
            </div>
          ))}
        </div>

        {/* Indicator Dots */}
        <div className="flex justify-center gap-1.5 mt-4">
          {summaryCards.map((_, idx) => {
            const currentIndex = Math.min(
              summaryCards.length - 1,
              Math.max(0, Math.round(scrollPosition / mobileCardStep))
            );
            const isActive = currentIndex === idx;

            return (
              <div
                key={idx}
                onClick={() => {
                  if (sliderRef.current) {
                    sliderRef.current.scrollTo({
                      left: idx * mobileCardStep,
                      behavior: "smooth",
                    });
                  }
                }}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  isActive
                    ? "w-6 bg-[#7CD2F1]"
                    : "w-1.5 bg-zinc-300 dark:bg-zinc-700"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Cards Grid Section - Desktop */}
      <div className="hidden md:grid auto-rows-max items-stretch gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {summaryCards.map((card) => (
          <div key={card.key}>{card.node}</div>
        ))}
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
        <CardHeader className="pb-2 p-3 sm:p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={activeDashboardTab === "customers" ? "default" : "outline"}
              onClick={() => setActiveDashboardTab("customers")}
            >
              {tDash("customers") || "Customers"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeDashboardTab === "sales" ? "default" : "outline"}
              onClick={() => setActiveDashboardTab("sales")}
            >
              {tDash("sales") || "Sales"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeDashboardTab === "items" ? "default" : "outline"}
              onClick={() => setActiveDashboardTab("items")}
            >
              {tDash("items") || "Items"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="p-3 pb-0">
          {activeDashboardTab === "customers" && (
            <div className="flex items-center gap-4 text-[10px] sm:text-xs border rounded-md px-3 py-1.5 bg-muted/30 w-fit">
              <span className="font-semibold text-muted-foreground">
                {tCust("legend")}:
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 border border-green-600" />
                <span className="font-medium text-green-700 dark:text-green-400">
                  {tCust("legendReceive")}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-red-600" />
                <span className="font-medium text-red-700 dark:text-red-400">
                  {tCust("legendPay")}
                </span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-2 sm:p-3 pt-3 relative">
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
                    <TableCell>{row.invoiceNo}</TableCell>
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
                    <TableCell>{row.status}</TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/${locale}/admin/customer-transactions/${row.id}`}>
                          {tDash("viewTransactions") || "View Transactions"}
                        </Link>
                      </Button>
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
                  "border rounded-lg p-4 shadow-sm cursor-pointer",
                  row.balance < 0 && "bg-red-100/70 dark:bg-red-950/50",
                  row.balance > 0 && "bg-green-100/70 dark:bg-green-950/50"
                )}
              >
                <h3 className="font-semibold text-base mb-2">{row.name}</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Email:</span> {row.email}</p>
                  <p><span className="text-muted-foreground">Phone:</span> {row.phone}</p>
                  <p><span className="text-muted-foreground">Balance:</span> {isPrivacyMode ? "***" : `PKR ${Math.round(row.balance).toLocaleString()}`}</p>
                </div>
              </div>
            ))}
            {activeDashboardTab === "customers" && customerRows.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No data</div>
            )}

            {activeDashboardTab === "sales" && salesRows.map((row) => (
              <div key={row.id} className="border rounded-lg p-4 shadow-sm">
                <div className="flex justify-between mb-2">
                  <h3 className="font-semibold">{row.invoiceNo}</h3>
                  <span className="text-xs text-muted-foreground">{row.date}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Customer:</span> {row.customerName}</p>
                  <p><span className="text-muted-foreground">Total:</span> {isPrivacyMode ? "***" : `PKR ${Math.round(row.total).toLocaleString()}`}</p>
                  <p><span className="text-muted-foreground">Paid:</span> {isPrivacyMode ? "***" : `PKR ${Math.round(row.paid).toLocaleString()}`}</p>
                  <p><span className="text-muted-foreground">Balance:</span> {isPrivacyMode ? "***" : `PKR ${Math.round(row.balance).toLocaleString()}`}</p>
                </div>
              </div>
            ))}
            {activeDashboardTab === "sales" && salesRows.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No data</div>
            )}

            {activeDashboardTab === "items" && itemRows.map((row) => (
              <div key={row.id} className="border rounded-lg p-4 shadow-sm">
                <h3 className="font-semibold mb-2">{row.name}</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Category:</span> {row.category}</p>
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
                    <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            isLoading={isDataLoading}
          />
        </CardFooter>
      </Card>

      <Card className="mt-10">
        <CardContent className="p-3 sm:p-4">
          <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 items-start sm:items-center text-xs sm:text-sm text-muted-foreground">
            <span className="font-medium">{tDash("needHelp") || "Need Help?"}</span>
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-3">
              <a href={`tel:${supportContact.phone.replace(/\s/g, "")}`} className="text-blue-600 hover:underline">
                Call
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// StatCard Component
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
    <Card className="flex h-full flex-col">
      <CardHeader className="flex min-h-[3.5rem] flex-row items-center justify-between pb-2 p-3 sm:p-4">
        <CardTitle className="truncate text-xs sm:text-sm font-medium">
          {title}
        </CardTitle>
        <div className={cn("flex shrink-0 items-center justify-center", !noIconBg && `p-2 rounded-lg ${bgColor}`)}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-[3.75rem] flex-1 flex-col justify-between p-3 pt-0 sm:p-4">
        <div className="flex items-center gap-2 text-2xl sm:text-3xl font-bold">
          {isPrivacy ? (
            <span className="text-muted-foreground">•••••</span>
          ) : (
            <>
              {currency && <span className="text-sm font-normal">{currency} </span>}
              {Math.floor(value).toLocaleString()}
            </>
          )}
          {isLoading && <Loader2Icon className="h-4 w-4 animate-spin" />}
        </div>
      </CardContent>
    </Card>
  );
}