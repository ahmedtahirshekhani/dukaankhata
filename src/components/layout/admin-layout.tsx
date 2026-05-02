
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
  FileText,
  ChevronLeft,
  ChevronRight,
  Home,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/language/language-switcher";
import { useUserProfile } from "@/hooks/use-user-profile";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations();
  const tNav = useTranslations("navigation");
  const { user } = useUserProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [salesExpanded, setSalesExpanded] = useState(false); // Changed to false
  const [purchaseExpanded, setPurchaseExpanded] = useState(false); // Changed to false
  const [companyName, setCompanyName] = useState<string>("");

  // Fetch company name from localStorage or session
  useEffect(() => {
    const savedCompanyName = localStorage.getItem("companyName");
    if (savedCompanyName) {
      setCompanyName(savedCompanyName);
    } else if (user?.company) {
      setCompanyName(user.company);
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

  // Remove locale and /admin from pathname to get current page
  const pathWithoutLocale = pathname.replace(`/${locale}`, "");
  const salesSubRoutes = [
    "/admin/invoice",
    "/admin/payment-in",
    "/admin/sale-return",
    "/admin/counter-sale",
    "/admin/quotations",
  ];
  const purchaseSubRoutes = [
    "/admin/purchase-bill",
    "/admin/payment-out",
  ];
  const isSalesSectionActive =
    pathWithoutLocale === "/admin/sales" || salesSubRoutes.includes(pathWithoutLocale);
  const isPurchaseSectionActive =
    pathWithoutLocale === "/admin/purchase" || purchaseSubRoutes.includes(pathWithoutLocale);

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

  const pageNames: { [key: string]: string } = {
    "/admin": tNav("dashboard"),
    "/admin/payment-in": tNav("paymentIn"),
    "/admin/sales": tNav("sales"),
    "/admin/sale-return": tNav("saleReturn"),
    "/admin/purchase": tNav("purchase"),
    "/admin/purchase-bill": tNav("purchaseBill"),
    "/admin/payment-out": tNav("paymentOut"),
    "/admin/expenses": tNav("expenses"),
    "/admin/customers": tNav("customers"),
    "/admin/products": tNav("products"),
    "/admin/orders": tNav("orders"),
    "/admin/invoice": tNav("invoice"),
    "/admin/counter-sale": tNav("counterSale"),
    "/admin/quotations": tNav("quotations"),
    "/admin/account-statement": tNav("accountStatement"),
    "/admin/ai-chat": tNav("aiChat"),
  };


  const handleLogout = async () => {
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
        <div className="ml-auto flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
                    href={`/${locale}/admin/quotations`}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/quotations" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/quotations"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("quotations")}
                  </Link>
                  <Link
                    href={`/${locale}/admin/invoice`}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/invoice" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/invoice"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("invoice")}
                  </Link>

                  <Link
                    href={`/${locale}/admin/payment-in`}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/payment-in" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/payment-in"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("paymentIn")}
                  </Link>
                  <Link
                    href={`/${locale}/admin/sale-return`}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/sale-return" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/sale-return"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("saleReturn")}
                  </Link>
                  <Link
                    href={`/${locale}/admin/counter-sale`}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/counter-sale" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/counter-sale"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("counterSale")}
                  </Link>
                </div>
              )}
            </div>

            {/* Purchase Section */}
            <div>
              <div className="flex items-stretch gap-1">
                <Link
                  href={`/${locale}/admin/purchase`}
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
                    href={`/${locale}/admin/purchase-bill`}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/purchase-bill" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/purchase-bill"
                        ? "bg-accent/80 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    {tNav("purchaseBill")}
                  </Link>
                  <Link
                    href={`/${locale}/admin/payment-out`}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/payment-out" ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-2 text-sm transition-all ${pathWithoutLocale === "/admin/payment-out"
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
                onClick={() => setSidebarOpen(false)}
                className={`${navItemBase} ${pathWithoutLocale === "/admin/expenses" ? navItemActive : navItemInactive
                  } ${navItemCompact}`}
                title={sidebarMinimized ? tNav("expenses") : ""}
              >
                <FileText className="h-5 w-5 flex-shrink-0 opacity-90" />
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

            {/* Cash & Bank / Account Statement */}
            <div>
              <Link
                href={`/${locale}/admin/account-statement`}
                onClick={() => setSidebarOpen(false)}
                className={`${navItemBase} ${pathWithoutLocale === "/admin/account-statement" ? navItemActive : navItemInactive
                  } ${navItemCompact}`}
                title={sidebarMinimized ? tNav("accountStatement") : ""}
              >
                <FileText className="h-5 w-5 flex-shrink-0 opacity-90" />
                <div
                  className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                >
                  <span className="font-medium leading-none">
                    {tNav("accountStatement")}
                  </span>
                  <span className="text-xs opacity-70 hidden md:block mt-0.5">
                    {tNav("accountStatementDescription")}
                  </span>
                </div>
              </Link>
            </div>

            {/* Reports - You may need to add a Reports link if needed */}

            {/* Backup/Restore - You may need to add this */}

            {/* Utilities - AI Chat */}
            <div>
              <Link
                href={`/${locale}/admin/ai-chat`}
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

            {/* Settings / Configuration - moved to bottom */}
            <div className="mt-auto">
              <Link
                href={`/${locale}/admin/configuration`}
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
          {children}
        </main>
      </div>
    </div>
  );
}