"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supportContacts } from "@/lib/contact-info";
import { File } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { Switch } from "@/components/ui/switch";
import VyaparImportButton from "@/components/VyaparImportButton";
import { ErrorDialog } from "@/components/dialogs/error-dialog";
import { SummaryCarousel } from "@/components/summary-carousel";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db/offline-db";
import {
  useDashboardData,
  CounterRange,
} from "@/lib/hooks/useDashboardData";
import { DataTable } from "@/components/ui/data-table";
import { sendWhatsAppReminder } from "@/lib/whatsapp";
import { PageHeader } from "@/components/layout/page-header";
import { useDashboardTableLayout } from "@/components/dashboard/dashboard-table-layout";
import { useDashboardSummaryCards } from "@/components/dashboard/dashboard-summary-cards";
import { DashboardTabSwitcher } from "@/components/dashboard/dashboard-tab-switcher";

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

  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [enableCounterSale, setEnableCounterSale] = useState(false);

  const [counterSalesRange, setCounterSalesRange] =
    useState<CounterRange>("today");
  const [counterExpensesRange, setCounterExpensesRange] =
    useState<CounterRange>("today");
  const [importOpen, setImportOpen] = useState(false);

  // Offline-first Reactive Dashboard Summary Hook
  const dashboardStats = useDashboardData(
    counterSalesRange,
    counterExpensesRange
  );

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
  const [totalCount, setTotalCount] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const [errorDialog, setErrorDialog] = useState({
    open: false,
    title: "",
    message: "",
    isSuccess: false,
  });

  const handleWhatsAppClick = (customer: {
    name: string;
    phone: string;
    balance: number;
  }) => {
    sendWhatsAppReminder(customer, {
      locale,
      currencySymbol: tCust("currencySymbol") || "Rs.",
      onError: (msg) => {
        setErrorDialog({
          open: true,
          title: locale === "ur" ? "فون نمبر شامل کریں" : "Add Phone Number",
          message: msg,
          isSuccess: false,
        });
      },
    });
  };

  // Modular Table Layout Hook
  const {
    customerColumns,
    salesColumns,
    itemColumns,
    renderCustomerMobileCard,
    renderSalesMobileCard,
    renderItemMobileCard,
  } = useDashboardTableLayout({
    tDash,
    tInvoice,
    locale,
    isPrivacyMode,
    handleWhatsAppClick,
    router,
  });

  // Modular Summary Cards Hook
  const summaryCards = useDashboardSummaryCards({
    dashboardStats,
    counterSalesRange,
    counterExpensesRange,
    setCounterSalesRange,
    setCounterExpensesRange,
    isPrivacyMode,
    enableCounterSale,
    currentMonthName,
    canViewCustomers,
    canViewSales,
    canViewPurchases,
    canViewExpenses,
    tDash,
  });

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
    return () =>
      window.removeEventListener("featureSettingsUpdated", loadFeatures);
  }, []);

  // Fetch tab data when tab, page or pageSize changes
  useEffect(() => {
    const fetchTabData = async () => {
      setIsDataLoading(true);
      try {
        if (activeDashboardTab === "sales") {
          const offset = (currentPage - 1) * pageSize;
          const orders = await db.orders
            .orderBy("created_at")
            .reverse()
            .offset(offset)
            .limit(pageSize)
            .toArray();
          const totalCount = await db.orders.count();

          // Populate customers
          const ordersWithCustomers = await Promise.all(
            orders.map(async (order) => {
              if (order.customer_id) {
                const customer = await db.parties.get(
                  order.customer_id.toString()
                );
                return { ...order, customer };
              }
              return order;
            })
          );

          const orderRows = ordersWithCustomers.map(
            (order: any, index: number) => {
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
                        order?.sale_date || order?.created_at
                      ).toLocaleDateString()
                    : "-",
              };
            }
          );

          setSalesRows(orderRows);
          setTotalCount(totalCount);
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
          setIsDataLoading(false);
          return;
        }

        if (activeDashboardTab === "customers") {
          const allCustomers = await db.parties.toArray();

          // Filter inactive and deleted customers
          const list = allCustomers.filter(
            (p) => p.status !== "inactive" && p.is_delete !== 1
          );

          // Sort by absolute balance in descending order, then take top 10
          const sortedCustomers = list
            .sort(
              (a, b) => Math.abs(b.balance || 0) - Math.abs(a.balance || 0)
            )
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

  // Reset page when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeDashboardTab]);

  const tabSwitcher = (
    <DashboardTabSwitcher
      activeTab={activeDashboardTab}
      onTabChange={setActiveDashboardTab}
      canViewCustomers={canViewCustomers}
      canViewSales={canViewSales}
      canViewProducts={canViewProducts}
      tDash={tDash}
    />
  );

  return (
    <div className="flex-1 space-y-4 w-full mx-auto animate-in fade-in duration-300">
      {/* Standardized PageHeader Component */}
      <PageHeader
        title={tDash("analyticalDashboard") || "Dashboard"}
        description={tDash("dashboardDescription") || "Your business insights overview"}
        actions={
          <>
            <div className="flex items-center gap-2">
              <label
                htmlFor="privacy-toggle"
                className="text-[10px] sm:text-sm font-medium whitespace-nowrap leading-none"
              >
                {isPrivacyMode ? tDash("privacyOn") : tDash("privacyOff")}
              </label>
              <div className="flex items-center scale-[0.8] sm:scale-100 origin-right h-7">
                <Switch
                  id="privacy-toggle"
                  checked={isPrivacyMode}
                  onCheckedChange={() => {
                    const newPrivacyMode = !isPrivacyMode;
                    setIsPrivacyMode(newPrivacyMode);
                    localStorage.setItem(
                      "dashboardPrivacyMode",
                      JSON.stringify(newPrivacyMode)
                    );
                  }}
                  className="h-5 w-9 sm:h-6 sm:w-11"
                />
              </div>
            </div>

            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button
                  className="flex items-center gap-1 sm:gap-2 justify-center h-7 px-2 py-1 text-[10px] sm:h-8 sm:px-3 sm:text-xs"
                  size="sm"
                  variant="outline"
                >
                  <File className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Import Your Data</span>
                  <span className="inline sm:hidden">Import</span>
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
          </>
        }
      />

      {/* Summary Cards Carousel */}
      <div className="min-w-0 max-w-full">
        <SummaryCarousel
          cards={summaryCards.map((c) => (
            <React.Fragment key={c.key}>{c.node}</React.Fragment>
          ))}
          itemClassName="basis-[45%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5"
          isLoading={dashboardStats.isLoading}
        />
      </div>

      {/* Dashboard Tabs Section Header */}
      <div className="mt-4">
        <h2 className="text-lg sm:text-xl font-semibold">
          {tDash("dashboardSections") || "Dashboard Sections"}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {tDash("dashboardSectionsDescription") ||
            "Switch between customer transactions, sales, and items"}
        </p>
      </div>

      {/* Unified Reusable DataTable Integration */}
      {activeDashboardTab === "customers" && (
        <DataTable
          columns={customerColumns}
          data={customerRows}
          isLoading={isDataLoading}
          keyExtractor={(row) => row.id}
          renderMobileCard={renderCustomerMobileCard}
          rowClassName={(row) =>
            cn(
              row.balance < 0 && "bg-red-100/70 dark:bg-red-950/50",
              row.balance > 0 && "bg-green-100/70 dark:bg-green-950/50"
            )
          }
          toolbarActions={tabSwitcher}
          currentPage={1}
          pageSize={10}
          totalCount={customerRows.length}
        />
      )}

      {activeDashboardTab === "sales" && (
        <DataTable
          columns={salesColumns}
          data={salesRows}
          isLoading={isDataLoading}
          keyExtractor={(row) => row.id}
          renderMobileCard={renderSalesMobileCard}
          toolbarActions={tabSwitcher}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      )}

      {activeDashboardTab === "items" && (
        <DataTable
          columns={itemColumns}
          data={itemRows}
          isLoading={isDataLoading}
          keyExtractor={(row) => row.id}
          renderMobileCard={renderItemMobileCard}
          toolbarActions={tabSwitcher}
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      )}

      <Card className="mt-10">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            <span className="font-medium text-muted-foreground shrink-0">
              {tDash("needHelp") || "Need Help with DukaanKhata? Reach out:"}
            </span>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {supportContacts.map((c) => (
                <span key={c.name} className="flex items-center gap-1">
                  <span className="text-muted-foreground">{c.name}:</span>
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {c.display}
                  </a>
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