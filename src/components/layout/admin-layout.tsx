
"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import {
  Package2Icon,
  LayoutDashboardIcon,
  PackageIcon,
  ShoppingCartIcon,
  ShoppingBagIcon,
  UsersIcon,
  LogOutIcon,
  Settings,
  Menu,
  X,
  MessageSquare,
  MessageCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  Home,
  Sparkles,
  BarChart,
  WifiOff,
  CheckCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/language/language-switcher";
import { useUserProfile } from "@/hooks/use-user-profile";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { useLiveQuery } from "dexie-react-hooks";
import { db, clearUserDatabase } from "@/lib/db/offline-db";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { toast } from "sonner";

export function AdminLayout({ children, isInitialSyncing = false }: { children: React.ReactNode, isInitialSyncing?: boolean }) {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations();
  const tCommon = useTranslations("common");
  const tNav = useTranslations("navigation");
  const { user } = useUserProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [salesExpanded, setSalesExpanded] = useState(false);
  const [purchaseExpanded, setPurchaseExpanded] = useState(false);
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const [companyName, setCompanyName] = useState<string>("");
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [showClearCacheDialog, setShowClearCacheDialog] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Feature Toggles
  const [enableCounterSale, setEnableCounterSale] = useState(false);
  const [enableAiChat, setEnableAiChat] = useState(false);
  const [enableWhatsApp, setEnableWhatsApp] = useState(false);

  // Offline and Syncing state tracking
  const syncStatus = useLiveQuery(
    async () => {
      const queue = await db.syncQueue.toArray();
      const pending = queue.filter(q => q.status === "pending" || q.status === "processing").length;
      const failed = queue.filter(q => q.status === "failed").length;
      return { pending, failed };
    },
    []
  );

  const pendingSyncCount = syncStatus?.pending || 0;
  const failedSyncCount = syncStatus?.failed || 0;

  const [isOnline, setIsOnlineState] = useState(true);

  const setIsOnline = (value: boolean) => {
    setIsOnlineState(value);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('appNetworkStatus', { detail: { isOnline: value } }));
    }
  };

  useEffect(() => {
    // Initial check
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Active Heartbeat for Realtime Internet Detection
    const pingInternet = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 sec timeout

        // Ping our own health API. If backend can't reach MongoDB, it returns 503
        const res = await fetch('/api/health?_=' + new Date().getTime(), {
          cache: 'no-store',
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        setIsOnline(res.ok); // Returns false if status is 503 (Offline / Backend down)
      } catch (e) {
        setIsOnline(false); // Throws if fetch completely fails (Network off)
      }
    };

    // Ping every 5 seconds for faster offline detection
    const interval = setInterval(pingInternet, 5000);
    pingInternet(); // Run once immediately

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Auto-sync pending operations when connection is restored
  useEffect(() => {
    if (isOnline) {
      const autoSync = async () => {
        // Revert any failed operations back to pending so SyncEngine can retry them
        await db.syncQueue.where('status').equals('failed').modify({ status: 'pending' });
        await SyncEngine.pushQueue();
      };
      autoSync();
    }
  }, [isOnline]);

  // Fetch company name from localStorage or session
  useEffect(() => {
    const savedCompanyName = localStorage.getItem("companyName");
    if (savedCompanyName) {
      setCompanyName(savedCompanyName);
    } else if (user?.company) {
      setCompanyName(user.company);
    }
  }, [user]);

  // Set Tenant Info for Offline Database Isolation
  useEffect(() => {
    if (user?.id && user?.company) {
      const currentInfoStr = localStorage.getItem("tenant_info");
      const newInfo = JSON.stringify({ userId: user.id, company: user.company });
      if (currentInfoStr !== newInfo) {
        localStorage.setItem("tenant_info", newInfo);
        // Reload to let offline-db.ts pick up the new dynamic database name
        window.location.reload();
      }
    }
  }, [user]);

  // Listen for company details updates
  useEffect(() => {
    const handleCompanyDetailsUpdate = (event: CustomEvent) => {
      const { companyName: updatedName } = event.detail;
      if (updatedName) {
        setCompanyName(updatedName);
      }
    };

    window.addEventListener(
      "companyDetailsUpdated",
      handleCompanyDetailsUpdate as EventListener,
    );

    return () => {
      window.removeEventListener(
        "companyDetailsUpdated",
        handleCompanyDetailsUpdate as EventListener,
      );
    };
  }, []);

  // Listen for feature toggle updates
  useEffect(() => {
    const loadFeatures = () => {
      if (typeof window !== "undefined") {
        const savedCounter = localStorage.getItem("setting_counterSale");
        if (savedCounter) setEnableCounterSale(savedCounter === "true");
        
        const savedAi = localStorage.getItem("setting_aiChat");
        if (savedAi) setEnableAiChat(savedAi === "true");
        
        const savedWa = localStorage.getItem("setting_wa");
        if (savedWa) setEnableWhatsApp(savedWa === "true");
      }
    };
    
    loadFeatures();

    window.addEventListener("featureSettingsUpdated", loadFeatures);
    return () => window.removeEventListener("featureSettingsUpdated", loadFeatures);
  }, []);

  // Remove locale and /admin from pathname to get current page
  const pathWithoutLocale = pathname.replace(`/${locale}`, "");
  const salesSubRoutes = [
    "/admin/sales/invoice",
    "/admin/sales/payment-in",
    "/admin/sales/sale-return",
    "/admin/sales/counter-sale",
    "/admin/sales/quotations",
  ];
  const purchaseSubRoutes = [
    "/admin/purchase/purchase-bill",
    "/admin/purchase/payment-out",
  ];
  const reportsSubRoutes = [
    "/admin/reports/account-statement",
    "/admin/reports/stock",
    "/admin/reports/receivable-summary",
    "/admin/reports/profitability",
  ];
  const isSalesSectionActive =
    pathWithoutLocale === "/admin/sales" || salesSubRoutes.includes(pathWithoutLocale);
  const isPurchaseSectionActive =
    pathWithoutLocale === "/admin/purchase" || purchaseSubRoutes.includes(pathWithoutLocale);
  const isReportsSectionActive =
    pathWithoutLocale === "/admin/reports" || reportsSubRoutes.includes(pathWithoutLocale);

  useEffect(() => {
    if (isSalesSectionActive) {
      setSalesExpanded(true);
    }
  }, [isSalesSectionActive]);

  useEffect(() => {
    if (isPurchaseSectionActive) {
      setPurchaseExpanded(true);
    }
  }, [isPurchaseSectionActive]);

  useEffect(() => {
    if (isReportsSectionActive) {
      setReportsExpanded(true);
    }
  }, [isReportsSectionActive]);

  const pageNames: { [key: string]: string } = {
    "/admin": tNav("dashboard"),
    "/admin/sales/payment-in": tNav("paymentIn"),
    "/admin/sales": tNav("sales"),
    "/admin/sales/sale-return": tNav("saleReturn"),
    "/admin/purchase": tNav("purchase"),
    "/admin/purchase/purchase-bill": tNav("purchaseBill"),
    "/admin/purchase/payment-out": tNav("paymentOut"),
    "/admin/expenses": tNav("expenses"),
    "/admin/customers": tNav("customers"),
    "/admin/products": tNav("products"),
    "/admin/orders": tNav("orders"),
    "/admin/sales/invoice": tNav("invoice"),
    "/admin/sales/counter-sale": tNav("counterSale"),
    "/admin/sales/quotations": tNav("quotations"),
    "/admin/reports/account-statement": tNav("accountStatement"),
    "/admin/reports/stock": tNav("stockReport"),
    "/admin/reports/receivable-summary": tNav("receivableSummary"),
    "/admin/reports/profitability": tNav("profitability"),
    "/admin/ai-chat": tNav("aiChat"),
  };

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (pendingSyncCount > 0 || failedSyncCount > 0) {
      setShowLogoutWarning(true);
      return;
    }
    await clearUserDatabase();
    await signOut({
      redirect: true,
      callbackUrl: `/${locale}/login`,
    });
  };

  const goToSettings = () => {
    router.push(`/${locale}/admin/settings`);
  };

  const navItemBase =
    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200";
  const navItemActive =
    "bg-accent/70 text-foreground ring-1 ring-border/60 shadow-sm";
  const navItemInactive =
    "text-foreground/70 hover:bg-accent/70 hover:text-foreground";
  const navItemCompact = sidebarMinimized ? "sm:justify-center sm:px-0" : "";

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 sm:gap-4 border-b bg-background px-3 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
        <Link
          href={`/${locale}/admin`}
          className="flex items-center gap-1 sm:gap-2 text-sm sm:text-lg font-semibold flex-shrink-0"
        >
          <Package2Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="hidden sm:inline">{t("common.appName")}</span>
        </Link>
        {companyName && (
          <div className="flex flex-1 justify-center items-center min-w-0">
            <span className="text-sm sm:text-lg font-bold text-foreground truncate">
              {companyName}
            </span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1 sm:gap-3 flex-shrink-0">

          {/* Offline / Sync Indicator Badge */}
          <div className="flex items-center">
            {!isOnline ? (
              <div className="flex items-center text-[10px] sm:text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-1.5 sm:px-2 py-1 rounded-md" title={tCommon("offlineTooltip")}>
                <WifiOff className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="ml-1 sm:ml-1.5 whitespace-nowrap hidden sm:inline">{tCommon("youAreOffline")}</span>
                <span className="ml-1 sm:ml-1.5 whitespace-nowrap sm:hidden">Offline</span>
              </div>
            ) : failedSyncCount > 0 ? (
              <div className="flex items-center text-[10px] sm:text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-1.5 sm:px-2 py-1 rounded-md" title={tCommon("syncFailedTooltip", { count: failedSyncCount })}>
                <WifiOff className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="ml-1 sm:ml-1.5 whitespace-nowrap hidden sm:inline">{tCommon("syncFailed")} ({failedSyncCount})</span>
                <span className="ml-1 sm:ml-1.5 whitespace-nowrap sm:hidden">Failed</span>
              </div>
            ) : pendingSyncCount > 0 ? (
              <div className="flex items-center text-[10px] sm:text-xs font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 sm:px-2 py-1 rounded-md" title={tCommon("syncingTooltip", { count: pendingSyncCount })}>
                <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                <span className="ml-1 sm:ml-1.5 whitespace-nowrap hidden sm:inline">{tCommon("syncing")} ({pendingSyncCount})</span>
                <span className="ml-1 sm:ml-1.5 whitespace-nowrap sm:hidden">Syncing</span>
              </div>
            ) : (
              <div className="flex items-center text-[10px] sm:text-xs font-semibold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 sm:px-2 py-1 rounded-md" title={tCommon("syncedTooltip")}>
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="ml-1 sm:ml-1.5 whitespace-nowrap hidden sm:inline">{tCommon("youAreOnline")}</span>
                <span className="ml-1 sm:ml-1.5 whitespace-nowrap sm:hidden">Online</span>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowClearCacheDialog(true)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 text-amber-700 hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          >
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline text-xs sm:text-sm">{tCommon("clearCache")}</span>
          </Button>
          <SubscriptionStatusBadge />
          <LanguageSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="overflow-hidden rounded-full"
              >
                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
                {user?.company && (
                  <p className="text-xs text-gray-500">{user.company}</p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={goToSettings}>
                <Settings className="mr-2 h-4 w-4" />
                {t("common.settings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOutIcon className="mr-2 h-4 w-4" />
                {t("common.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div
        className={`flex flex-col sm:gap-4 sm:py-4 transition-all ${sidebarMinimized ? "sm:pl-16 md:pl-16" : "sm:pl-48 md:pl-64"
          }`}
      >
        {sidebarOpen && (
          <div
            className="fixed inset-0 mt-14 z-10 bg-black/50 sm:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Floating Toggle Button */}
        <Button
          variant="outline"
          size="icon"
          className={`hidden sm:flex fixed top-16 z-50 h-8 w-8 items-center justify-center rounded-lg border-2 bg-background shadow-lg transition-all hover:bg-accent ${sidebarMinimized ? "left-[4.5rem]" : "left-[11rem] md:left-[15rem]"
            }`}
          onClick={() => setSidebarMinimized(!sidebarMinimized)}
        >
          {sidebarMinimized ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>

        <aside
          className={`fixed top-14 inset-y-0 left-0 z-40 flex-col border-r border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-all flex ${sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
            } ${sidebarMinimized ? "sm:w-16 md:w-16" : "w-64 sm:w-48 md:w-64"}`}
        >
          <nav
            className={`flex h-full overflow-y-auto flex-col gap-1.5 py-3 md:py-4 ${sidebarMinimized ? "sm:px-1 md:px-1" : "px-2 md:px-3"
              }`}
          >
            {/* Home */}
            <div>
              <Link
                href={`/${locale}/admin/welcome`}
                prefetch={false}
                onClick={() => setSidebarOpen(false)}
                className={`${navItemBase} ${pathWithoutLocale === "/admin/welcome" ? navItemActive : navItemInactive
                  } ${navItemCompact}`}
                title={sidebarMinimized ? t("common.welcome") : ""}
              >
                <Home className="h-5 w-5 flex-shrink-0 opacity-90" />
                <div
                  className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                >
                  <span className="font-medium leading-none">{t("common.welcome")}</span>
                  <span className="text-xs opacity-70 hidden md:block mt-0.5">{t("common.appName")}</span>
                </div>
              </Link>
            </div>

            {/* Dashboard */}
            <div>
              <Link
                href={`/${locale}/admin`}
                prefetch={false}
                onClick={() => setSidebarOpen(false)}
                className={`${navItemBase} ${pathWithoutLocale === "/admin" ? navItemActive : navItemInactive
                  } ${navItemCompact}`}
                title={sidebarMinimized ? tNav("dashboard") : ""}
              >
                <LayoutDashboardIcon className="h-5 w-5 flex-shrink-0 opacity-90" />
                <div
                  className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                >
                  <span className="font-medium leading-none">
                    {tNav("dashboard")}
                  </span>
                  <span className="text-xs opacity-70 hidden md:block mt-0.5">
                    {tNav("dashboardDescription")}
                  </span>
                </div>
              </Link>
            </div>

            {/* Parties / Customers */}
            <div>
              <Link
                href={`/${locale}/admin/customers`}
                prefetch={false}
                onClick={() => setSidebarOpen(false)}
                className={`${navItemBase} ${pathWithoutLocale === "/admin/customers" ? navItemActive : navItemInactive
                  } ${navItemCompact}`}
                title={sidebarMinimized ? tNav("customers") : ""}
              >
                <UsersIcon className="h-5 w-5 flex-shrink-0 opacity-90" />
                <div
                  className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                >
                  <span className="font-medium leading-none">
                    {tNav("customers")}
                  </span>
                  <span className="text-xs opacity-70 hidden md:block mt-0.5">
                    {tNav("customersDescription")}
                  </span>
                </div>
              </Link>
            </div>

            {/* Items / Products */}
            <div>
              <Link
                href={`/${locale}/admin/products`}
                prefetch={false}
                onClick={() => setSidebarOpen(false)}
                className={`${navItemBase} ${pathWithoutLocale === "/admin/products" ? navItemActive : navItemInactive
                  } ${navItemCompact}`}
                title={sidebarMinimized ? tNav("products") : ""}
              >
                <PackageIcon className="h-5 w-5 flex-shrink-0 opacity-90" />
                <div
                  className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                >
                  <span className="font-medium leading-none">
                    {tNav("products")}
                  </span>
                  <span className="text-xs opacity-70 hidden md:block mt-0.5">
                    {tNav("productsDescription")}
                  </span>
                </div>
              </Link>
            </div>

            {/* Sale Section */}
            <div>
              <div className="flex items-stretch gap-1">
                <Link
                  href={`/${locale}/admin/sales`}
                  prefetch={false}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={pathWithoutLocale === "/admin/sales" ? "page" : undefined}
                  className={`${navItemBase} flex-1 ${isSalesSectionActive ? navItemActive : navItemInactive
                    } ${navItemCompact}`}
                  title={sidebarMinimized ? tNav("sales") : ""}
                >
                  <ShoppingCartIcon className="h-5 w-5 flex-shrink-0 opacity-90" />
                  <div
                    className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                  >
                    <span className="font-medium leading-none">
                      {tNav("sales")}
                    </span>
                    <span className="text-xs opacity-70 hidden md:block mt-0.5">
                      {tNav("salesDescription")}
                    </span>
                  </div>
                </Link>

                {!sidebarMinimized && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-auto px-2 rounded-xl border border-transparent ${isSalesSectionActive
                      ? "text-primary hover:bg-primary/10"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                      }`}
                    aria-label={salesExpanded ? "Collapse sales menu" : "Expand sales menu"}
                    aria-expanded={salesExpanded}
                    onClick={() => setSalesExpanded((prev) => !prev)}
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${salesExpanded ? "rotate-90" : ""}`}
                    />
                  </Button>
                )}
              </div>

              {!sidebarMinimized && salesExpanded && (
                <div className="ml-5 mt-1 border-l border-border/70 pl-3 flex flex-col gap-1">
                  <Link
                    href={`/${locale}/admin/sales/quotations`}
                    prefetch={false}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/sales/quotations" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/sales/quotations"
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("quotations")}
                  </Link>
                  <Link
                    href={`/${locale}/admin/sales/invoice`}
                    prefetch={false}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/sales/invoice" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/sales/invoice"
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("invoice")}
                  </Link>

                  <Link
                    href={`/${locale}/admin/sales/payment-in`}
                    prefetch={false}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/sales/payment-in" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/sales/payment-in"
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("paymentIn")}
                  </Link>
                  <Link
                    href={`/${locale}/admin/sales/sale-return`}
                    prefetch={false}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/sales/sale-return" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/sales/sale-return"
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("saleReturn")}
                  </Link>
                  {enableCounterSale && (
                    <Link
                      href={`/${locale}/admin/sales/counter-sale`}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={pathWithoutLocale === "/admin/sales/counter-sale" ? "page" : undefined}
                      className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/sales/counter-sale"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                    >
                      {tNav("counterSale")}
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Purchase Section */}
            <div>
              <div className="flex items-stretch gap-1">
                <Link
                  href={`/${locale}/admin/purchase`}
                  prefetch={false}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={pathWithoutLocale === "/admin/purchase" ? "page" : undefined}
                  className={`${navItemBase} flex-1 ${isPurchaseSectionActive ? navItemActive : navItemInactive
                    } ${navItemCompact}`}
                  title={sidebarMinimized ? tNav("purchase") : ""}
                >
                  <ShoppingBagIcon className="h-5 w-5 flex-shrink-0 opacity-90" />
                  <div
                    className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                  >
                    <span className="font-medium leading-none">
                      {tNav("purchase")}
                    </span>
                    <span className="text-xs opacity-70 hidden md:block mt-0.5">
                      {tNav("purchaseDescription")}
                    </span>
                  </div>
                </Link>

                {!sidebarMinimized && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-auto px-2 rounded-xl border border-transparent ${isPurchaseSectionActive
                      ? "text-primary hover:bg-primary/10"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                      }`}
                    aria-label={purchaseExpanded ? "Collapse purchase menu" : "Expand purchase menu"}
                    aria-expanded={purchaseExpanded}
                    onClick={() => setPurchaseExpanded((prev) => !prev)}
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${purchaseExpanded ? "rotate-90" : ""}`}
                    />
                  </Button>
                )}
              </div>

              {!sidebarMinimized && purchaseExpanded && (
                <div className="ml-5 mt-1 border-l border-border/70 pl-3 flex flex-col gap-1">
                  <Link
                    href={`/${locale}/admin/purchase/purchase-bill`}
                    prefetch={false}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/purchase/purchase-bill" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/purchase/purchase-bill"
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("purchaseBill")}
                  </Link>
                  <Link
                    href={`/${locale}/admin/purchase/payment-out`}
                    prefetch={false}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/purchase/payment-out" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/purchase/payment-out"
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("paymentOut")}
                  </Link>
                </div>
              )}
            </div>

            {/* Expenses */}
            <div>
              <Link
                href={`/${locale}/admin/expenses`}
                prefetch={false}
                onClick={() => setSidebarOpen(false)}
                className={`${navItemBase} ${pathWithoutLocale === "/admin/expenses" ? navItemActive : navItemInactive
                  } ${navItemCompact}`}
                title={sidebarMinimized ? tNav("expenses") : ""}
              >
                <Sparkles className="h-5 w-5 flex-shrink-0 opacity-90" />
                <div
                  className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                >
                  <span className="font-medium leading-none">
                    {tNav("expenses")}
                  </span>
                  <span className="text-xs opacity-70 hidden md:block mt-0.5">
                    {tNav("expensesDescription")}
                  </span>
                </div>
              </Link>
            </div>

            {/* Reports Section */}
            <div>
              <div className="flex items-stretch gap-1">
                <Link
                  href={`/${locale}/admin/reports`}
                  prefetch={false}
                  onClick={() => setSidebarOpen(false)}
                  className={`${navItemBase} flex-1 ${isReportsSectionActive ? navItemActive : navItemInactive
                    } ${navItemCompact}`}
                  title={sidebarMinimized ? tNav("reports") : ""}
                >
                  <BarChart className="h-5 w-5 flex-shrink-0 opacity-90" />
                  <div
                    className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                  >
                    <span className="font-medium leading-none">
                      {tNav("reports")}
                    </span>
                    <span className="text-xs opacity-70 hidden md:block mt-0.5">
                      {tNav("reportsDescription")}
                    </span>
                  </div>
                </Link>

                {!sidebarMinimized && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-auto px-2 rounded-xl border border-transparent ${isReportsSectionActive
                      ? "text-primary hover:bg-primary/10"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                      }`}
                    aria-label={reportsExpanded ? "Collapse reports menu" : "Expand reports menu"}
                    aria-expanded={reportsExpanded}
                    onClick={() => setReportsExpanded((prev) => !prev)}
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${reportsExpanded ? "rotate-90" : ""}`}
                    />
                  </Button>
                )}
              </div>

              {!sidebarMinimized && reportsExpanded && (
                <div className="ml-5 mt-1 border-l border-border/70 pl-3 flex flex-col gap-1">
                  <Link
                    href={`/${locale}/admin/reports/account-statement`}
                    prefetch={false}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/reports/account-statement" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/reports/account-statement"
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("accountStatement")}
                  </Link>
                  <Link
                    href={`/${locale}/admin/reports/stock`}
                    prefetch={false}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/reports/stock" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/reports/stock"
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("stockReport")}
                  </Link>
                  <Link
                    href={`/${locale}/admin/reports/receivable-summary`}
                    prefetch={false}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/reports/receivable-summary" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/reports/receivable-summary"
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("receivableSummary")}
                  </Link>
                  <Link
                    href={`/${locale}/admin/reports/profitability`}
                    prefetch={false}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/reports/profitability" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/reports/profitability"
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("profitability")}
                  </Link>
                </div>
              )}
            </div>

            {/* Reports - You may need to add a Reports link if needed */}

            {/* Backup/Restore - You may need to add this */}

            {/* Utilities - AI Chat */}
            {enableAiChat && (
              <div>
                <Link
                  href={`/${locale}/admin/ai-chat`}
                  prefetch={false}
                  onClick={() => setSidebarOpen(false)}
                  className={`${navItemBase} ${pathWithoutLocale === "/admin/ai-chat" ? navItemActive : navItemInactive
                    } ${navItemCompact}`}
                  title={sidebarMinimized ? tNav("aiChat") : ""}
                >
                  <MessageSquare className="h-5 w-5 flex-shrink-0 opacity-90" />
                  <div
                    className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                  >
                    <span className="font-medium leading-none">
                      {tNav("aiChat")}
                    </span>
                    <span className="text-xs opacity-70 hidden md:block mt-0.5">
                      {tNav("aiChatDescription")}
                    </span>
                  </div>
                </Link>
              </div>
            )}

            {/* WhatsApp Integration */}
            {enableWhatsApp && (
              <div>
                <Link
                  href={`/${locale}/admin/whatsapp-integration`}
                  onClick={() => setSidebarOpen(false)}
                  className={`${navItemBase} ${pathWithoutLocale === "/admin/whatsapp-integration" ? navItemActive : navItemInactive
                    } ${navItemCompact}`}
                  title={sidebarMinimized ? "WhatsApp" : ""}
                >
                  <MessageCircle className="h-5 w-5 flex-shrink-0 opacity-90" />
                  <div
                    className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                  >
                    <span className="font-medium leading-none">
                      WhatsApp
                    </span>
                    <span className="text-xs opacity-70 hidden md:block mt-0.5">
                      Connect WhatsApp
                    </span>
                  </div>
                </Link>
              </div>
            )}

            {/* Settings / Configuration - moved to bottom */}
            <div className="mt-auto">
              <Link
                href={`/${locale}/admin/configuration`}
                prefetch={false}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 transition-colors ${pathWithoutLocale === "/admin/configuration"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
                  } ${sidebarMinimized ? "sm:justify-center sm:px-0" : ""}`}
                title={sidebarMinimized ? tNav("configuration") : ""}
              >
                <Settings className="h-5 w-5 flex-shrink-0" />
                <div
                  className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                >
                  <span className="font-medium text-xs md:text-sm">
                    {tNav("configuration")}
                  </span>
                  <span className="text-xs opacity-70 hidden md:block">
                    {tNav("configurationDescription")}
                  </span>
                </div>
              </Link>
            </div>
          </nav>
        </aside>
        <main
          className={`flex-1 p-3 sm:p-4 md:px-6 md:py-0 transition-all ${sidebarMinimized ? "sm:pl-16 md:pl-16" : ""
            }`}
        >
          {isClearingCache || isInitialSyncing ? (
            <div className="flex flex-col items-center justify-center h-[80vh]">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <h2 className="text-xl font-semibold">{tCommon("syncingData") || "Syncing Data..."}</h2>
              <p className="text-muted-foreground mt-2 text-sm">{tCommon("pleaseWait") || "Please wait while we set up your offline database."}</p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      <ConfirmDialog
        open={showLogoutWarning}
        onOpenChange={setShowLogoutWarning}
        title={tCommon("logoutWarningTitle")}
        description={tCommon("logoutWarningDesc")}
        confirmLabel={tCommon("understood")}
        onConfirm={() => setShowLogoutWarning(false)}
        variant="warning"
      />

      <ConfirmDialog
        open={showClearCacheDialog}
        onOpenChange={setShowClearCacheDialog}
        title={tCommon("clearCache")}
        description={tCommon("clearCacheWarning")}
        confirmLabel={isClearingCache ? tCommon("clearingCache") : tCommon("confirm")}
        onConfirm={async () => {
          setIsClearingCache(true);
          setShowClearCacheDialog(false);
          try {
            await SyncEngine.clearCacheAndResync();
            
            if (typeof window !== 'undefined') {
              toast.success(tCommon("cacheClearedSuccess"));
            }
            
            setIsClearingCache(false);
          } catch (error) {
            console.error(error);
            setIsClearingCache(false);
          }
        }}
        variant="destructive"
      />
    </div>
  );
}