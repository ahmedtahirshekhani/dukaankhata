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
import { Loader2Icon, TrendingUp } from "lucide-react";
import {
  Pie,
  PieChart,
  CartesianGrid,
  XAxis,
  Bar,
  BarChart,
  Line,
  LineChart,
  Legend,
} from "recharts";

export default function Page() {
  const t = useTranslations();
  const tDash = useTranslations("dashboard");
  const router = useRouter();
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : Array.isArray(params?.locale) ? params?.locale?.[0] : "en";
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [revenueTrend, setRevenueTrend] = useState<{ date: string; revenue: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number; revenue: number }[]>([]);
  const [paymentDistribution, setPaymentDistribution] = useState({});
  const [ordersByStatus, setOrdersByStatus] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          revenueRes,
          expensesRes,
          profitRes,
          revenueTrendRes,
          topProductsRes,
          paymentDistRes,
          ordersStatusRes
        ] = await Promise.all([
          fetch('/api/admin/revenue/total'),
          fetch('/api/admin/expenses/total'),
          fetch('/api/admin/profit/total'),
          fetch('/api/admin/revenue/trend'),
          fetch('/api/admin/products/top'),
          fetch('/api/admin/payments/distribution'),
          fetch('/api/admin/orders/status')
        ]);

        // If any request returned 401, redirect to locale-aware login page
        const responses = [
          revenueRes,
          expensesRes,
          profitRes,
          revenueTrendRes,
          topProductsRes,
          paymentDistRes,
          ordersStatusRes,
        ];
        if (responses.some((res) => res.status === 401)) {
          router.replace(`/${locale}/login`);
          return;
        }

        const revenue = await revenueRes.json();
        const expenses = await expensesRes.json();
        const profit = await profitRes.json();
        const revenueTrendData = await revenueTrendRes.json();
        const topProductsData = await topProductsRes.json();
        const paymentDistData = await paymentDistRes.json();
        const ordersStatusData = await ordersStatusRes.json();

        setTotalRevenue(revenue.totalRevenue);
        setTotalExpenses(expenses.totalExpenses);
        setTotalProfit(profit.totalProfit);
        setRevenueTrend(revenueTrendData.revenueTrend || []);
        setTopProducts(topProductsData.topProducts || []);
        setPaymentDistribution(paymentDistData.paymentDistribution || {});
        setOrdersByStatus(ordersStatusData.ordersByStatus || {});
      } catch (error) {
        console.error('Error fetching data:', error);
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
      <div className="grid auto-rows-max items-stretch gap-2 sm:gap-3 md:gap-4 grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4">
            <CardTitle className="text-[10px] leading-tight sm:text-sm font-medium">{tDash("totalRevenue")}</CardTitle>
            <span className="hidden sm:inline text-xs font-medium text-muted-foreground">PKR</span>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 flex-1 flex items-end">
            <div className="flex flex-col">
              <span className="text-[10px] sm:hidden text-muted-foreground mb-1">Rs.</span>
              <div className="text-xl sm:text-2xl font-bold">
                <span className="hidden sm:inline">Rs. </span>{Math.floor(totalRevenue)}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4">
            <CardTitle className="text-[10px] leading-tight sm:text-sm font-medium">
              {tDash("totalExpenses")}
            </CardTitle>
            <span className="hidden sm:inline text-xs font-medium text-muted-foreground">PKR</span>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 flex-1 flex items-end">
            <div className="flex flex-col">
              <span className="text-[10px] sm:hidden text-muted-foreground mb-1">Rs.</span>
              <div className="text-xl sm:text-2xl font-bold">
                <span className="hidden sm:inline">Rs. </span>{Math.floor(totalExpenses)}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4">
            <CardTitle className="text-[10px] leading-tight sm:text-sm font-medium">{tDash("totalProfit")}</CardTitle>
            <span className="hidden sm:inline text-xs font-medium text-muted-foreground">PKR</span>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 flex-1 flex items-end">
            <div className="flex flex-col">
              <span className="text-[10px] sm:hidden text-muted-foreground mb-1">Rs.</span>
              <div className="text-xl sm:text-2xl font-bold">
                <span className="hidden sm:inline">Rs. </span>{Math.floor(totalProfit)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4">
            <CardTitle className="text-[10px] leading-tight sm:text-sm font-medium">
              {tDash("revenueTrend")}
            </CardTitle>
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-2 sm:p-3 md:p-4 pt-0 flex-1 flex items-center justify-center overflow-hidden">
            <LinechartChart data={revenueTrend} className="w-full h-48 sm:h-44 md:h-48" />
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4">
            <CardTitle className="text-[10px] leading-tight sm:text-sm font-medium">
              {tDash("topProducts")}
            </CardTitle>
            <BarChartIcon className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-2 sm:p-3 md:p-4 pt-0 flex-1 flex items-center justify-center overflow-hidden">
            <BarchartChart data={topProducts} className="w-full h-48 sm:h-44 md:h-48" />
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4">
            <CardTitle className="text-[10px] leading-tight sm:text-sm font-medium">
              {tDash("paymentMethods")}
            </CardTitle>
            <PieChartIcon className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-2 sm:p-3 md:p-4 pt-0 flex-1 flex items-center justify-center overflow-hidden">
            <PiechartcustomChart data={paymentDistribution} className="w-full h-48 sm:h-44 md:h-48" />
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-4">
            <CardTitle className="text-[10px] leading-tight sm:text-sm font-medium">{tDash("orderStatus")}</CardTitle>
            <PieChartIcon className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-2 sm:p-3 md:p-4 pt-0 flex-1 flex items-center justify-center overflow-hidden">
            <PiechartcustomChart data={ordersByStatus} className="w-full h-48 sm:h-44 md:h-48" />
          </CardContent>
        </Card>
      </div>
      {/* Support contact on dashboard footer */}
      <Card className="mt-10">
        <CardContent className="p-3 sm:p-4">
          <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 items-start sm:items-center text-xs sm:text-sm text-muted-foreground">
            <span className="font-medium">{tDash("needHelp")}</span>
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2 sm:gap-3">
              <a href={`mailto:${supportContact.email}`} className="text-blue-600 hover:underline" aria-label={`Email ${supportContact.email}`}>
                Email
              </a>
              <span className="hidden sm:inline text-muted-foreground">|</span>
              <a href={`tel:${supportContact.phone.replace(/\s/g, "")}`} className="text-blue-600 hover:underline" aria-label={`Call ${supportContact.phone}`}>
                Call
              </a>
              <span className="hidden sm:inline text-muted-foreground">|</span>
              <a
                href={`https://wa.me/${supportContact.whatsapp.replace(/[^\d]/g, "")}`}
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

function BarchartChart({ data, ...props }: { data: any[] } & React.HTMLAttributes<HTMLDivElement>) {
  const chartConfig = {
    quantity: {
      label: "Quantity",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig;
  
  return (
    <div {...props}>
      <ChartContainer config={chartConfig}>
        <BarChart accessibilityLayer data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            tickMargin={5}
            axisLine={false}
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => value.slice(0, 8)}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dashed" />}
          />
          <Legend wrapperStyle={{ fontSize: '10px' }} />
          <Bar dataKey="quantity" fill="var(--color-quantity)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}



function LinechartChart({ data, ...props }: { data: any[] } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props}>
      <ChartContainer
        config={{
          revenue: {
            label: "Revenue",
            color: "hsl(var(--chart-1))",
          },
        }}
      >
        <LineChart
          accessibilityLayer
          data={data}
          margin={{
            left: -20,
            right: 5,
            top: 5,
            bottom: 5,
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={5}
            tick={{ fontSize: 9 }}
            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Legend wrapperStyle={{ fontSize: '10px' }} />
          <Line
            dataKey="revenue"
            type="monotone"
            stroke="var(--color-revenue)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
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

function PiechartcustomChart({ data, ...props }: { data: Record<string, number> } & React.HTMLAttributes<HTMLDivElement>) {
  const chartData = Object.entries(data).map(([category, value]) => ({
    category,
    value,
    fill: `var(--color-${category})`,
  }));

  const chartConfig = Object.fromEntries(
    Object.keys(data).map((category, index) => [
      category,
      {
        label: category,
        color: `hsl(var(--chart-${index + 1}))`,
      },
    ])
  ) as ChartConfig;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <div {...props}>
      <ChartContainer config={chartConfig}>
        <PieChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Legend 
            wrapperStyle={{ fontSize: isMobile ? '10px' : '11px', paddingTop: '8px' }} 
            iconSize={isMobile ? 10 : 12}
            layout={isMobile ? "horizontal" : "horizontal"}
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="category"
            outerRadius={isMobile ? 45 : 70}
            label={false}
          />
        </PieChart>
      </ChartContainer>
    </div>
  );
}

