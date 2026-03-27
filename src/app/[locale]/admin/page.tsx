"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supportContact } from "@/lib/constants";
import { Loader2Icon, TrendingDown, TrendingUp, Activity } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function Page() {
  const tDash = useTranslations("dashboard");
  const router = useRouter();
  const params = useParams();
  const locale =
    typeof params?.locale === "string"
      ? params.locale
      : Array.isArray(params?.locale)
      ? params?.locale?.[0]
      : "en";

  const [loading, setLoading] = useState(true);
  const [isPrivacyMode, setIsPrivacyMode] = useState(true);

  const [totalBalance, setTotalBalance] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

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

  useEffect(() => {
    const savedPrivacyMode = localStorage.getItem("dashboardPrivacyMode");
    if (savedPrivacyMode) {
      setIsPrivacyMode(JSON.parse(savedPrivacyMode));
    } else {
      setIsPrivacyMode(true);
      localStorage.setItem("dashboardPrivacyMode", JSON.stringify(true));
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashboardRes, ordersRes, customersRes, productsRes] = await Promise.all([
          fetch("/api/admin/dashboard/summary"),
          fetch("/api/orders"),
          fetch("/api/customers"),
          fetch("/api/products"),
        ]);

        if (dashboardRes.status === 401) {
          router.replace(`/${locale}/login`);
          return;
        }

        const dashboardData = await dashboardRes.json();
        setTotalBalance(dashboardData.totalBalance || 0);
        setTotalRevenue(dashboardData.totalRevenue || 0);
        setTotalExpenses(dashboardData.totalExpenses || 0);

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          const orderRows = Array.isArray(ordersData)
            ? ordersData.map((order: any, index: number) => {
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
              })
            : [];
          setSalesRows(orderRows);
        }

        if (customersRes.ok) {
          const customersData = await customersRes.json();
          const rows = Array.isArray(customersData)
            ? customersData.map((item: any, index: number) => ({
                id: item?.id || String(index),
                name: item?.name || "-",
                email: item?.email || "-",
                phone: item?.phone || "-",
                balance: Number(item?.balance || 0),
                status: item?.status || "active",
              }))
            : [];
          setCustomerRows(rows);
        }

        if (productsRes.ok) {
          const productsData = await productsRes.json();
          const pRows = Array.isArray(productsData)
            ? productsData.map((item: any, index: number) => ({
                id: item?.id || String(index),
                name: item?.name || item?.title || "-",
                category: item?.category || "-",
                stock: Number(item?.stock || item?.quantity || 0),
                price: Number(item?.sell_price || item?.price || 0),
              }))
            : [];
          setItemRows(pRows);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [locale, router]);

  if (loading) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Loader2Icon className="mx-auto h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid flex-1 items-start gap-2 sm:gap-3 md:gap-4">
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

      <div className="grid auto-rows-max items-stretch gap-2 sm:gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={tDash("totalBalanceYoullGet") || "Total Balance (You'll get)"}
          value={totalBalance}
          icon={<Activity className="w-4 h-4 sm:w-5 sm:h-5" />}
          isPrivacy={isPrivacyMode}
          currency="PKR"
        />

        <StatCard
          title={`${tDash("sales") || "Sales"} (${currentMonthName})`}
          value={totalRevenue}
          icon={<TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />}
          isPrivacy={isPrivacyMode}
          currency="PKR"
        />

        <StatCard
          title={`${tDash("totalExpenses") || "Total Expense"} (${currentMonthName})`}
          value={totalExpenses}
          icon={<TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />}
          isPrivacy={isPrivacyMode}
          currency="PKR"
          isExpense
        />
      </div>

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
        <CardContent className="p-2 sm:p-3 pt-3">
          <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
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
                {activeDashboardTab === "sales" &&
                  (salesRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground text-center">
                        {tDash("noData") || "No data"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    salesRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.invoiceNo}</TableCell>
                        <TableCell>{row.customerName}</TableCell>
                        <TableCell>
                          {isPrivacyMode
                            ? "***"
                            : `PKR ${Math.round(row.total).toLocaleString()}`}
                        </TableCell>
                        <TableCell>
                          {isPrivacyMode
                            ? "***"
                            : `PKR ${Math.round(row.paid).toLocaleString()}`}
                        </TableCell>
                        <TableCell>
                          {isPrivacyMode
                            ? "***"
                            : `PKR ${Math.round(row.balance).toLocaleString()}`}
                        </TableCell>
                        <TableCell>{row.date}</TableCell>
                      </TableRow>
                    ))
                  ))}

                {activeDashboardTab === "customers" &&
                  (customerRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground text-center">
                        {tDash("noData") || "No data"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{row.phone}</TableCell>
                        <TableCell>
                          {isPrivacyMode
                            ? "***"
                            : `PKR ${Math.round(row.balance).toLocaleString()}`}
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
                    ))
                  ))}

                {activeDashboardTab === "items" &&
                  (itemRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground text-center">
                        {tDash("noData") || "No data"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    itemRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.category}</TableCell>
                        <TableCell>{row.stock}</TableCell>
                        <TableCell>
                          {isPrivacyMode
                            ? "***"
                            : `PKR ${Math.round(row.price).toLocaleString()}`}
                        </TableCell>
                      </TableRow>
                    ))
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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

function StatCard({
  title,
  value,
  icon,
  isPrivacy,
  currency,
  isExpense,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  isPrivacy: boolean;
  currency?: string;
  isExpense?: boolean;
}) {
  const bgColor = isExpense ? "bg-red-500/10" : "bg-blue-500/10";

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
              {Math.floor(value).toLocaleString()}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
