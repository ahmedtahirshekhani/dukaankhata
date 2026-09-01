
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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  Receipt,
  BarChart,
  WifiOff,
  CheckCircle,
  RefreshCw,
  Loader2,
  Star,
  Users,
  Store,
  Search,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/language/language-switcher";
import { useUserProfile } from "@/hooks/use-user-profile";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { signOut } from "next-auth/react";
import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { useLiveQuery } from "dexie-react-hooks";
import { db, clearUserDatabase } from "@/lib/db/offline-db";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { toast } from "sonner";
import { proAccessPaymentInfo } from "@/lib/contact-info";
import { QuickActions } from "@/components/layout/quick-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// useSearchParams() opts the whole route out of static prerendering unless
// isolated behind its own Suspense boundary — without this, every page that
// renders AdminLayout (i.e. all /admin/* routes) fails `next build`.
function SignupHighlightWatcher({ onSignup }: { onSignup: () => void }) {
  const searchParams = useSearchParams();
  const triggeredRef = useRef(false);

  useEffect(() => {
    if (searchParams && searchParams.get("signup") === "true" && !triggeredRef.current) {
      triggeredRef.current = true;
      onSignup();
    }
  }, [searchParams, onSignup]);

  return null;
}

export function AdminLayout({ children, isInitialSyncing = false }: { children: React.ReactNode, isInitialSyncing?: boolean }) {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations();
  const tCommon = useTranslations("common");
  const tNav = useTranslations("navigation");
  const { user, updateSession } = useUserProfile();
  const { hasModuleAccess, can, isLoading: isPermissionsLoading } = usePermissions();
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const showSidebarSkeleton = !isMounted || isPermissionsLoading || isInitialSyncing || !user;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [highlightHamburger, setHighlightHamburger] = useState(false);

  const handleSignupHighlight = useCallback(() => {
    setHighlightHamburger(true);
  }, []);

  useEffect(() => {
    if (highlightHamburger) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [highlightHamburger]);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [salesExpanded, setSalesExpanded] = useState(true);
  const [purchaseExpanded, setPurchaseExpanded] = useState(true);
  const [reportsExpanded, setReportsExpanded] = useState(true);
  const [companyName, setCompanyName] = useState<string>("");
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [showClearCacheDialog, setShowClearCacheDialog] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [blockedSubscriptionData, setBlockedSubscriptionData] = useState<any>(null);
  const [showBlockedCard, setShowBlockedCard] = useState(false);

  // Feature Toggles
  const [enableCounterSale, setEnableCounterSale] = useState(false);
  const [enableAiChat, setEnableAiChat] = useState(false);
  const [enableWhatsApp, setEnableWhatsApp] = useState(false);

  // Sub-menu Permission Checks
  const hasSalesSub = can('sales', 'view_quotations') || can('sales', 'view_invoice') || can('sales', 'view_payment_in') || can('sales', 'view_sale_return') || (enableCounterSale && can('sales', 'view_counter_sale'));
  const hasPurchaseSub = can('purchase', 'view_purchase_bill') || can('purchase', 'view_payment_out');
  const hasReportsSub = can('reports', 'view_account_statement') || can('reports', 'view_stock') || can('reports', 'view_receivable_summary') || can('reports', 'view_profitability');

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

  // Fetch company name from session or offline cache
  useEffect(() => {
    if (user?.id) {
      const cachedCompanyName = typeof window !== "undefined" ? localStorage.getItem(`companyName_${user.id}`) : null;
      if (cachedCompanyName) {
        setCompanyName(cachedCompanyName);
      } else if (user?.company) {
        setCompanyName(user.company);
      }
    }
  }, [user]);

  // Set Tenant Info for Offline Database Isolation
  useEffect(() => {
    if (user?.id) {
      const currentInfoStr = localStorage.getItem("tenant_info");
      let currentUserId = null;
      try {
        if (currentInfoStr) {
          currentUserId = JSON.parse(currentInfoStr).userId;
        }
      } catch (e) {}

      if (currentUserId !== user.id) {
        localStorage.setItem("tenant_info", JSON.stringify({ userId: user.id }));
        // Only reload if we are switching from another user
        if (currentUserId !== null) {
          window.location.reload();
        }
      }
    }
  }, [user?.id]);

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

  useEffect(() => {
    const handleBlocked = (event: any) => {
      setBlockedSubscriptionData(event.detail);
      if (localStorage.getItem("hasSeenBlockedCard_" + event.detail?.userId) === "true" || localStorage.getItem("hasSeenBlockedCard") === "true") {
        setShowBlockedCard(true);
      }
    };
    window.addEventListener("subscriptionLoginBlocked", handleBlocked);
    return () => window.removeEventListener("subscriptionLoginBlocked", handleBlocked);
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
    "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-200";
  const navItemActive =
    "bg-accent/70 text-foreground ring-1 ring-border/60 shadow-sm";
  const navItemInactive =
    "text-foreground/70 hover:bg-accent/70 hover:text-foreground";
  const navItemCompact = sidebarMinimized ? "sm:justify-center sm:px-0" : "";

  return (
    <div 
      className="flex min-h-screen w-full flex-col bg-muted/40"
      onClickCapture={(e) => {
        if (blockedSubscriptionData && !showBlockedCard) {
          e.preventDefault();
          e.stopPropagation();
          setShowBlockedCard(true);
          localStorage.setItem("hasSeenBlockedCard_" + blockedSubscriptionData.userId, "true");
          localStorage.setItem("hasSeenBlockedCard", "true");
        }
      }}
    >
      {blockedSubscriptionData && !showBlockedCard && (
        <div className="fixed inset-0 z-[9999] cursor-pointer" title="Click anywhere to continue" />
      )}
      <Suspense fallback={null}>
        <SignupHighlightWatcher onSignup={handleSignupHighlight} />
      </Suspense>
      <header className={`sticky top-0 flex h-12 items-center gap-1.5 sm:gap-3 border-b bg-background px-2.5 sm:px-4 ${highlightHamburger ? "z-50" : "z-30"}`}>
        <div className="relative sm:hidden">
          {highlightHamburger && (
            <>
              {/* Screen locking premium dark overlay with blur */}
              <div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1.5px] cursor-default pointer-events-auto transition-all duration-300"
              />
              
              {/* Guidance Speech Bubble / Card */}
              <div className="absolute top-14 left-0 z-50 flex flex-col items-start w-64 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
                {/* Prominent Arrow pointing up to the menu button */}
                <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[14px] border-b-background dark:border-b-card ml-2.5 drop-shadow-[0_-2px_2px_rgba(0,0,0,0.08)]" />
                
                {/* Card body */}
                <div className="bg-background dark:bg-card text-card-foreground px-3.5 py-2.5 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.15)] border border-border flex flex-col items-start whitespace-nowrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-500 mb-0.5">Welcome</span>
                  <span className="text-sm font-bold text-foreground">Click the button to see more features</span>
                </div>
              </div>
            </>
          )}
          {highlightHamburger && (
            <span className="absolute inset-0 rounded-lg bg-primary/25 animate-ping opacity-75 pointer-events-none z-45" />
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 sm:h-8 sm:w-8 relative z-50 transition-all duration-300 ${
              highlightHamburger 
                ? "bg-background text-primary shadow-lg shadow-primary/40 ring-2 ring-primary" 
                : ""
            }`}
            onClick={() => {
              setSidebarOpen(!sidebarOpen);
              setHighlightHamburger(false);
              
              // Clear the signup parameter from the URL if it is present
              const params = new URLSearchParams(window.location.search);
              if (params.has("signup")) {
                params.delete("signup");
                const newQuery = params.toString();
                router.replace(pathname + (newQuery ? `?${newQuery}` : ""));
              }
            }}
          >
            {sidebarOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
        </div>
        <Link
          href={`/${locale}/admin`}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold flex-shrink-0"
        >
          <Image
            src="/images/DukaanKhataLogo.svg"
            alt="DukaanKhata Logo"
            width={28}
            height={28}
            className="h-6 w-6 sm:h-7 sm:w-7 object-contain"
          />
          <span className="hidden sm:inline font-bold text-xs sm:text-sm">{t("common.appName")}</span>
        </Link>
        {companyName && (
          <div className="flex flex-1 justify-center items-center min-w-0">
            <span className="text-xs sm:text-sm font-bold tracking-tight text-foreground truncate">
              {companyName}
            </span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 flex-shrink-0">

          {/* Offline / Sync Indicator Badge */}
          <div className="flex items-center">
            {!isOnline ? (
              <span title={tCommon("offlineTooltip")}>
                <WifiOff className="w-4 h-4 text-red-500" />
              </span>
            ) : failedSyncCount > 0 ? (
              <div className="flex items-center text-[10px] font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-md" title={tCommon("syncFailedTooltip", { count: failedSyncCount })}>
                <WifiOff className="w-3 h-3" />
                <span className="ml-1 whitespace-nowrap hidden sm:inline">{tCommon("syncFailed")} ({failedSyncCount})</span>
                <span className="ml-1 whitespace-nowrap sm:hidden">Failed</span>
              </div>
            ) : pendingSyncCount > 0 ? (
              <div className="flex items-center text-[10px] font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md" title={tCommon("syncingTooltip", { count: pendingSyncCount })}>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span className="ml-1 whitespace-nowrap hidden sm:inline">{tCommon("syncing")} ({pendingSyncCount})</span>
                <span className="ml-1 whitespace-nowrap sm:hidden">Syncing</span>
              </div>
            ) : null}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowClearCacheDialog(true)}
            className="flex items-center gap-1 h-7 sm:h-7 px-2 text-[11px] sm:text-xs text-amber-700 hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tCommon("clearCache")}</span>
          </Button>
          <SubscriptionStatusBadge />
          <LanguageSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8 overflow-hidden rounded-full p-0"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm">
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
        className={`flex flex-col sm:gap-4 sm:py-4 transition-all ${sidebarMinimized ? "sm:pl-16 md:pl-16" : "sm:pl-44 md:pl-52"
          }`}
      >
        {sidebarOpen && (
          <div
            className="fixed inset-0 mt-12 z-10 bg-black/50 sm:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Floating Toggle Button */}
        <Button
          variant="outline"
          size="icon"
          className={`hidden sm:flex fixed top-14 z-50 h-7 w-7 items-center justify-center rounded-md border bg-background shadow-md transition-all hover:bg-accent ${sidebarMinimized ? "left-[4.25rem]" : "left-[10.25rem] md:left-[12.25rem]"
            }`}
          onClick={() => setSidebarMinimized(!sidebarMinimized)}
        >
          {sidebarMinimized ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </Button>

        <aside
          className={`fixed top-12 inset-y-0 left-0 z-40 flex-col border-r border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-all flex ${sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
            } ${sidebarMinimized ? "sm:w-16 md:w-16" : "w-60 sm:w-44 md:w-52"}`}
        >
          <nav
            className={`flex h-full overflow-y-auto flex-col gap-1 py-2 md:py-3 ${sidebarMinimized ? "sm:px-1 md:px-1" : "px-2 md:px-2.5"
              }`}
          >
            {/* Workspace Switcher at the very top */}
            <WorkspaceSwitcher sidebarMinimized={sidebarMinimized} activeCompanyName={companyName} onClose={() => setSidebarOpen(false)} />

            {showSidebarSkeleton ? (
              <div className="space-y-2 py-2 px-1">
                {Array.from({ length: 14 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className={cn(
                      "h-7 rounded-lg",
                      sidebarMinimized ? "w-7 mx-auto" : "w-full"
                    )}
                  />
                ))}
              </div>
            ) : (
              <>
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
                <Home className="h-3.5 w-3.5 flex-shrink-0 opacity-90" />
                <span className={`font-medium truncate ${sidebarMinimized ? "sm:hidden" : ""}`}>
                  {t("common.welcome")}
                </span>
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
                <LayoutDashboardIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-90" />
                <span className={`font-medium truncate ${sidebarMinimized ? "sm:hidden" : ""}`}>
                  {tNav("dashboard")}
                </span>
              </Link>
            </div>

            {/* Utilities - AI Chat */}
            {enableAiChat && hasModuleAccess("ai_chat") && (
              <div>
                <Link
                  href={`/${locale}/admin/ai-chat`}
                  prefetch={false}
                  onClick={() => setSidebarOpen(false)}
                  className={`${navItemBase} ${pathWithoutLocale === "/admin/ai-chat" ? navItemActive : navItemInactive
                    } ${navItemCompact}`}
                  title={sidebarMinimized ? tNav("aiChat") : ""}
                >
                  <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 opacity-90" />
                  <span className={`font-medium truncate ${sidebarMinimized ? "sm:hidden" : ""}`}>
                    {tNav("aiChat")}
                  </span>
                  {!sidebarMinimized && (
                    <span
                      title="Dukaan Chat AI"
                      className="ml-auto flex-shrink-0"
                    >
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500 drop-shadow-sm animate-pulse" />
                    </span>
                  )}
                </Link>
              </div>
            )}


            {/* Parties / Customers */}
            {hasModuleAccess("customers") && (
            <div>
              <Link
                href={`/${locale}/admin/customers`}
                prefetch={false}
                onClick={() => setSidebarOpen(false)}
                className={`${navItemBase} ${pathWithoutLocale === "/admin/customers" ? navItemActive : navItemInactive
                  } ${navItemCompact}`}
                title={sidebarMinimized ? tNav("customers") : ""}
              >
                <UsersIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-90" />
                <span className={`font-medium truncate ${sidebarMinimized ? "sm:hidden" : ""}`}>
                  {tNav("customers")}
                </span>
              </Link>
            </div>
            )}

            {/* Items / Products */}
            {hasModuleAccess("products") && (
            <div>
              <Link
                href={`/${locale}/admin/products`}
                prefetch={false}
                onClick={() => setSidebarOpen(false)}
                className={`${navItemBase} ${pathWithoutLocale === "/admin/products" ? navItemActive : navItemInactive
                  } ${navItemCompact}`}
                title={sidebarMinimized ? tNav("products") : ""}
              >
                <PackageIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-90" />
                <span className={`font-medium truncate ${sidebarMinimized ? "sm:hidden" : ""}`}>
                  {tNav("products")}
                </span>
              </Link>
            </div>
            )}

            {/* Sale Section */}
            {hasModuleAccess("sales") && (
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
                  <ShoppingCartIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-90" />
                  <span className={`font-medium truncate ${sidebarMinimized ? "sm:hidden" : ""}`}>
                    {tNav("sales")}
                  </span>
                </Link>

                {!sidebarMinimized && hasSalesSub && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-auto px-1.5 rounded-lg border border-transparent ${isSalesSectionActive
                      ? "text-primary hover:bg-primary/10"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                      }`}
                    aria-label={salesExpanded ? "Collapse sales menu" : "Expand sales menu"}
                    aria-expanded={salesExpanded}
                    onClick={() => setSalesExpanded((prev) => !prev)}
                  >
                    <ChevronRight
                      className={`h-3 w-3 transition-transform ${salesExpanded ? "rotate-90" : ""}`}
                    />
                  </Button>
                )}
              </div>

              {!sidebarMinimized && salesExpanded && (
                <div className="ml-4 mt-0.5 border-l border-border/70 pl-2.5 flex flex-col gap-0.5">
                  {can('sales', 'view_quotations') && (
                    <Link
                      href={`/${locale}/admin/sales/quotations`}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={pathWithoutLocale === "/admin/sales/quotations" ? "page" : undefined}
                      className={`rounded-md px-2 py-0.5 text-[11px] transition-all ${pathWithoutLocale === "/admin/sales/quotations"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                    >
                      {tNav("quotations")}
                    </Link>
                  )}
                  {can('sales', 'view_invoice') && (
                    <Link
                      href={`/${locale}/admin/sales/invoice`}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={pathWithoutLocale === "/admin/sales/invoice" ? "page" : undefined}
                      className={`rounded-md px-2 py-0.5 text-[11px] transition-all ${pathWithoutLocale === "/admin/sales/invoice"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                    >
                      {tNav("invoice")}
                    </Link>
                  )}

                  {can('sales', 'view_payment_in') && (
                    <Link
                      href={`/${locale}/admin/sales/payment-in`}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={pathWithoutLocale === "/admin/sales/payment-in" ? "page" : undefined}
                      className={`rounded-md px-2 py-0.5 text-[11px] transition-all ${pathWithoutLocale === "/admin/sales/payment-in"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                    >
                      {tNav("paymentIn")}
                    </Link>
                  )}
                  {can('sales', 'view_sale_return') && (
                    <Link
                      href={`/${locale}/admin/sales/sale-return`}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={pathWithoutLocale === "/admin/sales/sale-return" ? "page" : undefined}
                      className={`rounded-md px-2 py-0.5 text-[11px] transition-all ${pathWithoutLocale === "/admin/sales/sale-return"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                    >
                      {tNav("saleReturn")}
                    </Link>
                  )}
                  {enableCounterSale && can('sales', 'view_counter_sale') && (
                    <Link
                      href={`/${locale}/admin/sales/counter-sale`}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={pathWithoutLocale === "/admin/sales/counter-sale" ? "page" : undefined}
                      className={`rounded-md px-2 py-0.5 text-[11px] transition-all ${pathWithoutLocale === "/admin/sales/counter-sale"
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
            )}

            {/* Purchase Section */}
            {hasModuleAccess("purchase") && (
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
                  <ShoppingBagIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-90" />
                  <span className={`font-medium truncate ${sidebarMinimized ? "sm:hidden" : ""}`}>
                    {tNav("purchase")}
                  </span>
                </Link>

                {!sidebarMinimized && hasPurchaseSub && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-auto px-1.5 rounded-lg border border-transparent ${isPurchaseSectionActive
                      ? "text-primary hover:bg-primary/10"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                      }`}
                    aria-label={purchaseExpanded ? "Collapse purchase menu" : "Expand purchase menu"}
                    aria-expanded={purchaseExpanded}
                    onClick={() => setPurchaseExpanded((prev) => !prev)}
                  >
                    <ChevronRight
                      className={`h-3 w-3 transition-transform ${purchaseExpanded ? "rotate-90" : ""}`}
                    />
                  </Button>
                )}
              </div>

              {!sidebarMinimized && purchaseExpanded && (
                <div className="ml-4 mt-0.5 border-l border-border/70 pl-2.5 flex flex-col gap-0.5">
                  {can('purchase', 'view_purchase_bill') && (
                    <Link
                      href={`/${locale}/admin/purchase/purchase-bill`}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={pathWithoutLocale === "/admin/purchase/purchase-bill" ? "page" : undefined}
                      className={`rounded-md px-2 py-0.5 text-[11px] transition-all ${pathWithoutLocale === "/admin/purchase/purchase-bill"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                    >
                      {tNav("purchaseBill")}
                    </Link>
                  )}
                  {can('purchase', 'view_payment_out') && (
                    <Link
                      href={`/${locale}/admin/purchase/payment-out`}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={pathWithoutLocale === "/admin/purchase/payment-out" ? "page" : undefined}
                      className={`rounded-md px-2 py-0.5 text-[11px] transition-all ${pathWithoutLocale === "/admin/purchase/payment-out"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                    >
                      {tNav("paymentOut")}
                    </Link>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Expenses */}
            {hasModuleAccess("expenses") && (
            <div>
              <Link
                href={`/${locale}/admin/expenses`}
                prefetch={false}
                onClick={() => setSidebarOpen(false)}
                className={`${navItemBase} ${pathWithoutLocale === "/admin/expenses" ? navItemActive : navItemInactive
                  } ${navItemCompact}`}
                title={sidebarMinimized ? tNav("expenses") : ""}
              >
                <Receipt className="h-3.5 w-3.5 flex-shrink-0 opacity-90" />
                <span className={`font-medium truncate ${sidebarMinimized ? "sm:hidden" : ""}`}>
                  {tNav("expenses")}
                </span>
              </Link>
            </div>
            )}

            {/* Bank Accounts */}
            {hasModuleAccess("payment_methods") && (
            <div>
              <Link
                href={`/${locale}/admin/bank-accounts`}
                prefetch={false}
                onClick={() => setSidebarOpen(false)}
                className={`${navItemBase} ${pathWithoutLocale === "/admin/bank-accounts" ? navItemActive : navItemInactive
                  } ${navItemCompact}`}
                title={sidebarMinimized ? tNav("bankAccounts") : ""}
              >
                <Store className="h-3.5 w-3.5 flex-shrink-0 opacity-90" />
                <span className={`font-medium truncate ${sidebarMinimized ? "sm:hidden" : ""}`}>
                  {tNav("bankAccounts")}
                </span>
              </Link>
            </div>
            )}

            {/* Reports Section */}
            {hasModuleAccess("reports") && (
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
                  <BarChart className="h-3.5 w-3.5 flex-shrink-0 opacity-90" />
                  <span className={`font-medium truncate ${sidebarMinimized ? "sm:hidden" : ""}`}>
                    {tNav("reports")}
                  </span>
                </Link>

                {!sidebarMinimized && hasReportsSub && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-auto px-1.5 rounded-lg border border-transparent ${isReportsSectionActive
                      ? "text-primary hover:bg-primary/10"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                      }`}
                    aria-label={reportsExpanded ? "Collapse reports menu" : "Expand reports menu"}
                    aria-expanded={reportsExpanded}
                    onClick={() => setReportsExpanded((prev) => !prev)}
                  >
                    <ChevronRight
                      className={`h-3 w-3 transition-transform ${reportsExpanded ? "rotate-90" : ""}`}
                    />
                  </Button>
                )}
              </div>

              

              {!sidebarMinimized && reportsExpanded && (
                <div className="ml-4 mt-0.5 border-l border-border/70 pl-2.5 flex flex-col gap-0.5">
                  {can('reports', 'view_account_statement') && (
                    <Link
                      href={`/${locale}/admin/reports/account-statement`}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={pathWithoutLocale === "/admin/reports/account-statement" ? "page" : undefined}
                      className={`rounded-md px-2 py-0.5 text-[11px] transition-all ${pathWithoutLocale === "/admin/reports/account-statement"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                    >
                      {tNav("accountStatement")}
                    </Link>
                  )}
                  {can('reports', 'view_stock') && (
                    <Link
                      href={`/${locale}/admin/reports/stock`}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={pathWithoutLocale === "/admin/reports/stock" ? "page" : undefined}
                      className={`rounded-md px-2 py-0.5 text-[11px] transition-all ${pathWithoutLocale === "/admin/reports/stock"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                    >
                      {tNav("stockReport")}
                    </Link>
                  )}
                  {can('reports', 'view_receivable_summary') && (
                    <Link
                      href={`/${locale}/admin/reports/receivable-summary`}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={pathWithoutLocale === "/admin/reports/receivable-summary" ? "page" : undefined}
                      className={`rounded-md px-2 py-0.5 text-[11px] transition-all ${pathWithoutLocale === "/admin/reports/receivable-summary"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                    >
                      {tNav("receivableSummary")}
                    </Link>
                  )}
                  {can('reports', 'view_profitability') && (
                    <Link
                      href={`/${locale}/admin/reports/profitability`}
                      prefetch={false}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={pathWithoutLocale === "/admin/reports/profitability" ? "page" : undefined}
                      className={`rounded-md px-2 py-0.5 text-[11px] transition-all ${pathWithoutLocale === "/admin/reports/profitability"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                    >
                      {tNav("profitability")}
                    </Link>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Backup/Restore - You may need to add this */}

            {/* WhatsApp Integration */}
            {enableWhatsApp && hasModuleAccess("whatsapp") && (
              <div>
                <Link
                  href={`/${locale}/admin/whatsapp-integration`}
                  onClick={() => setSidebarOpen(false)}
                  className={`${navItemBase} ${pathWithoutLocale === "/admin/whatsapp-integration" ? navItemActive : navItemInactive
                    } ${navItemCompact}`}
                  title={sidebarMinimized ? "WhatsApp" : ""}
                >
                  <MessageCircle className="h-3.5 w-3.5 flex-shrink-0 opacity-90" />
                  <span className={`font-medium truncate ${sidebarMinimized ? "sm:hidden" : ""}`}>
                    {tNav("whatsapp")}
                  </span>
                </Link>
              </div>
            )}

            {/* Staff Management - Protected by module access */}
            {hasModuleAccess("staff") && (
              <div>
                <Link
                  href={`/${locale}/admin/staff`}
                  onClick={() => setSidebarOpen(false)}
                  className={`${navItemBase} ${pathWithoutLocale === "/admin/staff" ? navItemActive : navItemInactive
                    } ${navItemCompact}`}
                  title={sidebarMinimized ? "Staff" : ""}
                >
                  <Users className="h-3.5 w-3.5 flex-shrink-0 opacity-90" />
                  <span className={`font-medium truncate ${sidebarMinimized ? "sm:hidden" : ""}`}>
                    {tNav("staffManagement")}
                  </span>
                </Link>
              </div>
            )}
              </>
            )}
          </nav>
        </aside>
        <main
          className={`flex-1 p-3 sm:p-4 md:px-6 md:pt-12 md:pb-6 transition-all relative ${sidebarMinimized ? "sm:pl-16 md:pl-16" : ""
            }`}
        >
          {/* Quick Actions Sub-Header */}
          {!blockedSubscriptionData && (
            <div className={`hidden md:flex items-center justify-end bg-background/95 backdrop-blur-sm border-b px-6 py-1.5 fixed top-12 right-0 z-20 transition-all ${sidebarMinimized ? "left-16" : "left-52"}`}>
              <QuickActions />
            </div>
          )}
          {blockedSubscriptionData && showBlockedCard ? (
            <div className="flex flex-col items-center justify-center min-h-[80vh]">
              <div className="max-w-[520px] w-full bg-card border border-border shadow-md rounded-xl overflow-hidden flex flex-col">
                <div className="p-6 border-b border-border bg-muted/30">
                  <h2 className="text-xl font-bold text-foreground">
                    Subscription Blocked
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your access has been blocked. Please renew your subscription to continue using the application.
                  </p>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                  <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
                    <p className="font-semibold text-foreground border-b border-border/50 pb-2">
                      Subscription Details
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="font-medium capitalize">{blockedSubscriptionData.plan || 'N/A'}</span>
                      
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-medium capitalize text-red-500 font-bold">{blockedSubscriptionData.status?.replace('_', ' ') || 'N/A'}</span>
                      
                      {blockedSubscriptionData.expiryDate && (
                        <>
                          <span className="text-muted-foreground">Expiry Date</span>
                          <span className="font-medium">{new Date(blockedSubscriptionData.expiryDate).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
                    <p className="font-semibold text-foreground border-b border-border/50 pb-2">
                      {proAccessPaymentInfo.provider}
                    </p>
                    <p className="text-muted-foreground">{proAccessPaymentInfo.provider}</p>
                    <p className="font-medium text-foreground">{proAccessPaymentInfo.accountNumber}</p>
                    <p className="text-muted-foreground">{proAccessPaymentInfo.accountHolder}</p>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
                    <p className="font-semibold text-foreground">WhatsApp Payment Proof</p>
                    <p className="text-muted-foreground">
                      Please send the payment receipt screenshot to our WhatsApp number: {proAccessPaymentInfo.proofWhatsappDisplay}
                    </p>
                  </div>
                </div>

                <div className="p-6 border-t border-border bg-muted/30 flex gap-3 justify-end items-center">
                  <Button variant="outline" onClick={() => {
                    import("@/lib/db/offline-db").then(m => m.clearUserDatabase()).then(() => signOut({ callbackUrl: `/${locale}/login` }));
                  }}>
                    Logout
                  </Button>
                  <Button asChild>
                    <a href={proAccessPaymentInfo.proofWhatsappHref} target="_blank" rel="noreferrer">
                      Open WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ) : isClearingCache || isInitialSyncing ? (
            <div className="flex flex-col items-center justify-center h-[80vh]">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <h2 className="text-xl font-semibold">{tCommon("syncingData") || "Syncing Data..."}</h2>
              <p className="text-muted-foreground mt-2 text-sm">{tCommon("pleaseWait") || "Please wait while we set up your offline database."}</p>
            </div>
          ) : (
            <>
              
              {children}
            </>
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