"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { supportContact } from "@/lib/constants";
import {
  ChartTooltipContent,
  ChartTooltip,
  ChartContainer,
  ChartConfig,
} from "@/components/ui/chart";
import {
  Loader2Icon,
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  Activity,
} from "lucide-react";
import {
  Pie,
  PieChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Line,
  LineChart,
  Legend,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Area,
  AreaChart,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { Switch } from "@/components/ui/switch";

export default function Page() {
  const t = useTranslations();
  const tDash = useTranslations("dashboard");
  const router = useRouter();
  const params = useParams();
  const locale =
    typeof params?.locale === "string"
      ? params.locale
      : Array.isArray(params?.locale)
        ? params?.locale?.[0]
        : "en";
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [revenueTrend, setRevenueTrend] = useState<
    { date: string; revenue: number }[]
  >([]);
  const [topProducts, setTopProducts] = useState<
    { name: string; quantity: number; revenue: number }[]
  >([]);
  const [cashflow, setCashflow] = useState<
    { date: string; income: number; expense: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [growthRate, setGrowthRate] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [avgDailyRevenue, setAvgDailyRevenue] = useState(0);

  // Load privacy preference from localStorage on mount
  useEffect(() => {
    const savedPrivacyMode = localStorage.getItem("dashboardPrivacyMode");
    if (savedPrivacyMode) {
      setIsPrivacyMode(JSON.parse(savedPrivacyMode));
    }
  }, []);

  // Save privacy preference to localStorage
  const handlePrivacyToggle = () => {
    const newPrivacyMode = !isPrivacyMode;
    setIsPrivacyMode(newPrivacyMode);
    localStorage.setItem(
      "dashboardPrivacyMode",
      JSON.stringify(newPrivacyMode),
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Single API call to get all dashboard data
        const dashboardRes = await fetch("/api/admin/dashboard/summary");

        if (dashboardRes.status === 401) {
          router.replace(`/${locale}/login`);
          return;
        }

        const dashboardData = await dashboardRes.json();

        // Update all state from single API response
        setTotalRevenue(dashboardData.totalRevenue || 0);
        setTotalExpenses(dashboardData.totalExpenses || 0);
        setTotalProfit(dashboardData.totalProfit || 0);
        setRevenueTrend(dashboardData.revenueTrend || []);
        setTopProducts(dashboardData.topProducts || []);
        setCashflow(dashboardData.cashflow || []);
        setGrowthRate(dashboardData.growthRate || 0);
        setTotalOrders(dashboardData.totalOrders || 0);
        setAvgDailyRevenue(dashboardData.avgDailyRevenue || 0);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2Icon className="mx-auto h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid flex-1 items-start gap-2 sm:gap-3 md:gap-4">
      {/* Header with Privacy Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {tDash("analyticalDashboard") || "Analytics Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tDash("dashboardDescription") || "Real-time insights and analytics of your business"}
          </p>
        </div>
        <div className="flex items-center justify-end gap-1.5 sm:gap-3 w-full sm:w-auto">
          <label
            htmlFor="privacy-toggle"
            className="text-xs sm:text-sm font-medium whitespace-nowrap"
          >
            {isPrivacyMode ? tDash("privacyOn") : tDash("privacyOff")}
          </label>
          <Switch
            id="privacy-toggle"
            checked={isPrivacyMode}
            onCheckedChange={() => {
              const newPrivacyMode = !isPrivacyMode;
              setIsPrivacyMode(newPrivacyMode);
              localStorage.setItem(
                "dashboardPrivacyMode",
                JSON.stringify(newPrivacyMode),
              );
            }}
            className="h-5 w-9 sm:h-6 sm:w-11"
            title={isPrivacyMode ? tDash("showNumbers") : tDash("hideNumbers")}
          />
        </div>
      </div>

      {/* KPI Cards - Top Metrics */}
      <div className="grid auto-rows-max items-stretch gap-2 sm:gap-3 md:gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue Card */}
        <StatCard
          title={tDash("totalRevenue") || "Total Revenue"}
          value={totalRevenue}
          icon={<span className="text-xs sm:text-sm font-bold">PKR</span>}
          isPrivacy={isPrivacyMode}
          trend={growthRate}
          trendLabel={tDash("growthRate") || "30-Day Growth"}
          trendTooltip={tDash("growthRateTooltip") || "Compared to previous 30 days"}
          currency="PKR"
        />

        {/* Total Expenses Card */}
        <StatCard
          title={tDash("totalExpenses") || "Total Expenses"}
          value={totalExpenses}
          icon={<TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />}
          isPrivacy={isPrivacyMode}
          currency="PKR"
          isExpense
        />

        {/* Total Profit Card */}
        <StatCard
          title={tDash("totalProfit") || "Total Profit"}
          value={totalProfit}
          icon={<TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />}
          isPrivacy={isPrivacyMode}
          currency="PKR"
          isProfit
        />

        {/* Profit Margin Card */}
        <StatCard
          title={tDash("profitMargin") || "Profit Margin"}
          value={
            totalRevenue > 0
              ? ((totalProfit / totalRevenue) * 100).toFixed(1)
              : 0
          }
          icon={<Activity className="w-4 h-4 sm:w-5 sm:h-5" />}
          isPrivacy={isPrivacyMode}
          isSuffix="%"
        />
      </div>

      {/* Charts Grid - Row 1 */}
      <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Revenue Trend Chart */}
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4">
            <div>
              <CardTitle className="text-sm sm:text-base font-medium">
                {tDash("revenueTrend") || "Revenue Trend"}
              </CardTitle>
              <CardDescription className="text-xs">
                {tDash("last30Days") || "Last 30 days"}
              </CardDescription>
            </div>
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-2 sm:p-3 pt-0 flex-1 min-h-[220px] sm:min-h-[260px]">
            <LinechartChart
              data={revenueTrend}
              className="w-full h-full"
            />
          </CardContent>
        </Card>

        {/* Cash Flow Chart */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4">
            <div>
              <CardTitle className="text-sm sm:text-base font-medium">
                {tDash("cashFlow") || "Cash Flow"}
              </CardTitle>
              <CardDescription className="text-xs">
                {tDash("incomVsExpense") || "Income vs Expense"}
              </CardDescription>
            </div>
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-2 sm:p-3 pt-0 flex-1 min-h-[220px] sm:min-h-[260px]">
            <CashFlowChart data={cashflow} className="w-full h-full" />
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid - Row 2: Top Products */}
      <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Top Products */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4">
            <div>
              <CardTitle className="text-sm sm:text-base font-medium">
                {tDash("topProducts") || "Top Products"}
              </CardTitle>
              <CardDescription className="text-xs">
                {tDash("byRevenue") || "By revenue"}
              </CardDescription>
            </div>
            <Package className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-2 sm:p-3 pt-0 flex-1 min-h-[200px] sm:min-h-[240px]">
            <BarchartChart
              data={topProducts}
              className="w-full h-full"
            />
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2 p-3 sm:p-4">
            <CardTitle className="text-sm sm:text-base font-medium">
              {tDash("quickStats") || "Quick Stats"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 flex-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs sm:text-sm font-medium">
                    {tDash("totalOrders") || "Total Orders"}
                  </span>
                </div>
                <span className="text-sm sm:text-base font-bold">
                  {isPrivacyMode ? "***" : totalOrders.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs sm:text-sm font-medium">
                    {tDash("avgDailyRevenue") || "Avg Daily Revenue"}
                  </span>
                </div>
                <span className="text-sm sm:text-base font-bold">
                  {isPrivacyMode ? "***" : `PKR ${Math.round(avgDailyRevenue).toLocaleString()}`}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  {growthRate >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  )}
                  <span className="text-xs sm:text-sm font-medium">
                    {tDash("growthRate") || "30-Day Growth"}
                  </span>
                </div>
                <span className={`text-sm sm:text-base font-bold ${growthRate >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {isPrivacyMode ? "***" : `${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(1)}%`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Support contact on dashboard footer */}
      <Card className="mt-10">
        <CardContent className="p-3 sm:p-4">
          <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 items-start sm:items-center text-xs sm:text-sm text-muted-foreground">
            <span className="font-medium">{tDash("needHelp") || "Need Help?"}</span>
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-3">
              <a
                href={`mailto:${supportContact.email}`}
                className="text-blue-600 hover:underline"
                aria-label={`Email ${supportContact.email}`}
              >
                Email
              </a>
              <span className="hidden sm:inline text-muted-foreground">|</span>
              <a
                href={`tel:${supportContact.phone.replace(/\s/g, "")}`}
                className="text-blue-600 hover:underline"
                aria-label={`Call ${supportContact.phone}`}
              >
                Call
              </a>
              <span className="hidden sm:inline text-muted-foreground">|</span>
              <a
                href={`https://wa.me/${supportContact.whatsapp.replace(
                  /[^\d]/g,
                  "",
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
                aria-label={`WhatsApp ${supportContact.whatsapp}`}
              >
                WhatsApp
              </a>
              <span className="hidden sm:inline text-muted-foreground">|</span>
              <a
                href={supportContact.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate"
                aria-label={`LinkedIn ${supportContact.linkedin}`}
              >
                LinkedIn
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon,
  isPrivacy,
  trend,
  trendLabel,
  trendTooltip,
  currency,
  isExpense,
  isProfit,
  isSuffix,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  isPrivacy: boolean;
  trend?: number;
  trendLabel?: string;
  trendTooltip?: string;
  currency?: string;
  isExpense?: boolean;
  isProfit?: boolean;
  isSuffix?: string;
}) {
  const isPositiveTrend = typeof trend === "number" && trend > 0;
  const bgColor = isProfit
    ? "bg-green-500/10"
    : isExpense
      ? "bg-red-500/10"
      : "bg-blue-500/10";
  const textColor = isProfit
    ? "text-green-600"
    : isExpense
      ? "text-red-600"
      : "text-blue-600";

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4">
        <CardTitle className="text-xs sm:text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${bgColor}`}>{icon}</div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0 flex-1 flex flex-col justify-between">
        <div className="text-2xl sm:text-3xl font-bold">
          {isPrivacy ? (
            <span className="text-muted-foreground">•••••</span>
          ) : (
            <>
              {currency && <span className="text-sm font-normal">{currency} </span>}
              {typeof value === "number"
                ? Math.floor(value).toLocaleString()
                : value}
              {isSuffix}
            </>
          )}
        </div>
        {typeof trend === "number" && (
          <div className="mt-2">
            <div className={`flex items-center gap-1 text-xs font-medium ${isPositiveTrend ? "text-green-600" : "text-red-600"}`}>
              {isPositiveTrend ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {isPrivacy ? "***" : `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}%`}
              {trendLabel && (
                <span className="text-muted-foreground ml-1">({trendLabel})</span>
              )}
            </div>
            {trendTooltip && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {trendTooltip}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BarChartIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  );
}

function BarchartChart({
  data,
  ...props
}: { data: any[] } & React.HTMLAttributes<HTMLDivElement>) {
  const chartConfig = {
    quantity: {
      label: "Units Sold",
      color: "hsl(217 91% 60%)",
    },
    revenue: {
      label: "Revenue (PKR)",
      color: "hsl(142 76% 36%)",
    },
    percentage: {
      label: "% of Total",
      color: "hsl(45 93% 47%)",
    },
  } satisfies ChartConfig;

  if (!data || data.length === 0) {
    return (
      <div {...props} className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No products data available
      </div>
    );
  }

  return (
    <div {...props}>
      <ChartContainer config={chartConfig} className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 10, left: 60, bottom: 5 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              type="number"
              tick={{ fontSize: 9 }}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
            />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              tickMargin={4}
              axisLine={false}
              tick={{ fontSize: 10 }}
              width={55}
              tickFormatter={(value) => value.length > 10 ? `${value.slice(0, 10)}..` : value}
            />
            <Tooltip
              contentStyle={{ fontSize: "12px", padding: "8px" }}
              formatter={(value: number) => [`PKR ${value.toLocaleString()}`, "Revenue"]}
            />
            <Legend
              wrapperStyle={{ fontSize: "10px", paddingTop: "4px" }}
              iconType="rect"
              iconSize={8}
              verticalAlign="bottom"
              height={24}
            />
            <Bar
              dataKey="revenue"
              fill="var(--color-revenue)"
              radius={[0, 3, 3, 0]}
              name="Revenue (PKR)"
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

function LinechartChart({
  data,
  ...props
}: { data: any[] } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props}>
      <ChartContainer
        config={{
          revenue: {
            label: "Daily Revenue",
            color: "hsl(217 91% 60%)",
          },
          cumulative: {
            label: "Cumulative",
            color: "hsl(142 76% 36%)",
          },
        }}
        className="h-full w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ left: 0, right: 5, top: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tick={{ fontSize: 9 }}
              interval="preserveStartEnd"
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
            />
            <YAxis
              tick={{ fontSize: 9 }}
              width={35}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
            />
            <Tooltip
              contentStyle={{ fontSize: "12px", padding: "8px" }}
              formatter={(value: number, name: string) => [
                `PKR ${value.toLocaleString()}`,
                name === "revenue" ? "Daily Revenue" : "Cumulative"
              ]}
              labelFormatter={(label) => new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            />
            <Legend
              wrapperStyle={{ fontSize: "10px", paddingTop: "4px" }}
              iconType="circle"
              iconSize={8}
              verticalAlign="bottom"
              height={24}
            />
            <Area
              dataKey="cumulative"
              type="monotone"
              fill="var(--color-cumulative)"
              fillOpacity={0.15}
              stroke="var(--color-cumulative)"
              strokeWidth={1.5}
              name="Cumulative"
            />
            <Line
              dataKey="revenue"
              type="monotone"
              stroke="var(--color-revenue)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              name="Daily Revenue"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

// Cash Flow Chart
function CashFlowChart({
  data,
  ...props
}: { data: any[] } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props}>
      <ChartContainer
        config={{
          income: {
            label: "Income",
            color: "hsl(142 76% 36%)",
          },
          expense: {
            label: "Expense",
            color: "hsl(0 84% 60%)",
          },
          net: {
            label: "Net",
            color: "hsl(217 91% 60%)",
          },
        }}
        className="h-full w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ left: 0, right: 5, top: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tick={{ fontSize: 9 }}
              interval="preserveStartEnd"
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
            />
            <YAxis
              tick={{ fontSize: 9 }}
              width={35}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
            />
            <Tooltip
              contentStyle={{ fontSize: "12px", padding: "8px" }}
              formatter={(value: number, name: string) => [
                `PKR ${value.toLocaleString()}`,
                name === "income" ? "Income" : name === "expense" ? "Expense" : "Net Cash Flow"
              ]}
              labelFormatter={(label) => new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            />
            <Legend
              wrapperStyle={{ fontSize: "10px", paddingTop: "4px" }}
              iconType="rect"
              iconSize={8}
              verticalAlign="bottom"
              height={24}
            />
            <Bar dataKey="income" fill="var(--color-income)" radius={[2, 2, 0, 0]} name="Income" />
            <Bar dataKey="expense" fill="var(--color-expense)" radius={[2, 2, 0, 0]} name="Expense" />
            <Line
              dataKey="net"
              type="monotone"
              stroke="var(--color-net)"
              strokeWidth={2}
              dot={false}
              name="Net"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

function PieChartIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}

const PIE_COLORS = [
  "hsl(217 91% 60%)",   // Blue
  "hsl(142 76% 36%)",   // Green
  "hsl(0 84% 60%)",     // Red
  "hsl(45 93% 47%)",    // Yellow
  "hsl(280 68% 60%)",   // Purple
  "hsl(199 89% 48%)",   // Cyan
  "hsl(25 95% 53%)",    // Orange
  "hsl(330 81% 60%)",   // Pink
];

function PiechartcustomChart({
  data,
  title,
  ...props
}: { data: Record<string, number>; title?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Calculate total for percentages
  const total = Object.values(data).reduce((sum, val) => sum + val, 0);

  const chartData = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .map(([category, value], index) => ({
      category,
      value,
      percentage: total > 0 ? ((value / total) * 100).toFixed(1) : 0,
      fill: PIE_COLORS[index % PIE_COLORS.length],
    }));

  const chartConfig = Object.fromEntries(
    chartData.map((item, index) => [
      item.category,
      {
        label: `${item.category} (${item.percentage}%)`,
        color: PIE_COLORS[index % PIE_COLORS.length],
      },
    ]),
  ) as ChartConfig;

  if (chartData.length === 0) {
    return (
      <div {...props} className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  return (
    <div {...props}>
      <ChartContainer config={chartConfig} className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{ fontSize: "12px", padding: "8px" }}
              formatter={(value: number, name: string) => [
                `PKR ${value.toLocaleString()} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
                name
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: "10px", paddingTop: "4px" }}
              iconSize={8}
              iconType="circle"
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              formatter={(value) => {
                const item = chartData.find((d) => d.category === value);
                const shortName = value.length > 10 ? `${value.slice(0, 10)}..` : value;
                return `${shortName} (${item?.percentage || 0}%)`;
              }}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="category"
              cx="50%"
              cy="40%"
              innerRadius={isMobile ? 20 : 30}
              outerRadius={isMobile ? 45 : 60}
              paddingAngle={2}
              label={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
