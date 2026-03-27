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
  UsersIcon,
  ShoppingBagIcon,
  LogOutIcon,
  Settings,
  Menu,
  X,
  MessageSquare,
  FileText,
  ChevronLeft,
  ChevronRight,
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
  const [salesExpanded, setSalesExpanded] = useState(true);
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
  ];
  const isSalesSectionActive =
    pathWithoutLocale === "/admin/sales" || salesSubRoutes.includes(pathWithoutLocale);

  useEffect(() => {
    if (isSalesSectionActive) {
      setSalesExpanded(true);
    }
  }, [isSalesSectionActive]);

  const pageNames: { [key: string]: string } = {
    "/admin": tNav("dashboard"),
    "/admin/payment-in": tNav("paymentIn"),
    "/admin/sales": tNav("sales"),
    "/admin/sale-return": tNav("saleReturn"),
    "/admin/expenses": tNav("expenses"),
    "/admin/customers": tNav("customers"),
    "/admin/products": tNav("products"),
    "/admin/orders": tNav("orders"),
    "/admin/invoice": tNav("invoice"),
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
        className={`flex flex-col sm:gap-4 sm:py-4 transition-all ${
          sidebarMinimized ? "sm:pl-16 md:pl-16" : "sm:pl-48 md:pl-64"
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
          className={`hidden sm:flex fixed top-16 z-50 h-8 w-8 items-center justify-center rounded-lg border-2 bg-background shadow-lg transition-all hover:bg-accent ${
            sidebarMinimized ? "left-[4.5rem]" : "left-[11rem] md:left-[15rem]"
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
          className={`fixed top-14 inset-y-0 left-0 z-40 flex-col border-r bg-background transition-all flex ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
          } ${sidebarMinimized ? "sm:w-16 md:w-16" : "w-64 sm:w-48 md:w-64"}`}
        >
          <nav
            className={`flex h-full overflow-y-auto flex-col gap-2 md:gap-4 py-3 md:py-5 ${
              sidebarMinimized ? "sm:px-1 md:px-1" : "px-2 md:px-4"
            }`}
          >
            <div>
              <Link
                href={`/${locale}/admin`}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 transition-colors ${
                  pathWithoutLocale === "/admin"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } ${sidebarMinimized ? "sm:justify-center sm:px-0" : ""}`}
                title={sidebarMinimized ? tNav("dashboard") : ""}
              >
                <LayoutDashboardIcon className="h-5 w-5 flex-shrink-0" />
                <div
                  className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                >
                  <span className="font-medium text-xs md:text-sm">
                    {tNav("dashboard")}
                  </span>
                  <span className="text-xs opacity-70 hidden md:block">
                    {tNav("dashboardDescription")}
                  </span>
                </div>
              </Link>
            </div>
            <div>
              <div className="flex items-stretch gap-1">
                <Link
                  href={`/${locale}/admin/sales`}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={pathWithoutLocale === "/admin/sales" ? "page" : undefined}
                  className={`flex flex-1 items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 transition-colors ${
                    isSalesSectionActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  } ${sidebarMinimized ? "sm:justify-center sm:px-0" : ""}`}
                  title={sidebarMinimized ? tNav("sales") : ""}
                >
                  <ShoppingCartIcon className="h-5 w-5 flex-shrink-0" />
                  <div
                    className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                  >
                    <span className="font-medium text-xs md:text-sm">
                      {tNav("sales")}
                    </span>
                    <span className="text-xs opacity-70 hidden md:block">
                      {tNav("salesDescription")}
                    </span>
                  </div>
                </Link>

                {!sidebarMinimized && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-auto px-2 rounded-lg ${
                      isSalesSectionActive
                        ? "text-primary-foreground hover:bg-primary/90"
                        : "text-muted-foreground hover:text-foreground"
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
                <div className="ml-7 mt-1 border-l pl-2 flex flex-col gap-1">
                  <Link
                    href={`/${locale}/admin/invoice`}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/invoice" ? "page" : undefined}
                    className={`rounded-md px-2 py-1 text-xs md:text-sm transition-colors ${
                      pathWithoutLocale === "/admin/invoice"
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tNav("invoice")}
                  </Link>
                  <Link
                    href={`/${locale}/admin/payment-in`}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/payment-in" ? "page" : undefined}
                    className={`rounded-md px-2 py-1 text-xs md:text-sm transition-colors ${
                      pathWithoutLocale === "/admin/payment-in"
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tNav("paymentIn")}
                  </Link>
                  <Link
                    href={`/${locale}/admin/sale-return`}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={pathWithoutLocale === "/admin/sale-return" ? "page" : undefined}
                    className={`rounded-md px-2 py-1 text-xs md:text-sm transition-colors ${
                      pathWithoutLocale === "/admin/sale-return"
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tNav("saleReturn")}
                  </Link>
                </div>
              )}
            </div>
            <div>
              <Link
                href={`/${locale}/admin/products`}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 transition-colors ${
                  pathWithoutLocale === "/admin/products"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } ${sidebarMinimized ? "sm:justify-center sm:px-0" : ""}`}
                title={sidebarMinimized ? tNav("products") : ""}
              >
                <PackageIcon className="h-5 w-5 flex-shrink-0" />
                <div
                  className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                >
                  <span className="font-medium text-xs md:text-sm">
                    {tNav("products")}
                  </span>
                  <span className="text-xs opacity-70 hidden md:block">
                    {tNav("productsDescription")}
                  </span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href={`/${locale}/admin/expenses`}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 transition-colors ${
                  pathWithoutLocale === "/admin/expenses"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } ${sidebarMinimized ? "sm:justify-center sm:px-0" : ""}`}
                title={sidebarMinimized ? tNav("expenses") : ""}
              >
                <FileText className="h-5 w-5 flex-shrink-0" />
                <div
                  className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                >
                  <span className="font-medium text-xs md:text-sm">
                    {tNav("expenses")}
                  </span>
                  <span className="text-xs opacity-70 hidden md:block">
                    {tNav("expensesDescription")}
                  </span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href={`/${locale}/admin/customers`}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 transition-colors ${
                  pathWithoutLocale === "/admin/customers"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } ${sidebarMinimized ? "sm:justify-center sm:px-0" : ""}`}
                title={sidebarMinimized ? tNav("customers") : ""}
              >
                <UsersIcon className="h-5 w-5 flex-shrink-0" />
                <div
                  className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                >
                  <span className="font-medium text-xs md:text-sm">
                    {tNav("customers")}
                  </span>
                  <span className="text-xs opacity-70 hidden md:block">
                    {tNav("customersDescription")}
                  </span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href={`/${locale}/admin/orders`}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 transition-colors ${
                  pathWithoutLocale === "/admin/orders"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } ${sidebarMinimized ? "sm:justify-center sm:px-0" : ""}`}
                title={sidebarMinimized ? tNav("orders") : ""}
              >
                <ShoppingBagIcon className="h-5 w-5 flex-shrink-0" />
                <div
                  className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                >
                  <span className="font-medium text-xs md:text-sm">
                    {tNav("orders")}
                  </span>
                  <span className="text-xs opacity-70 hidden md:block">
                    {tNav("ordersDescription")}
                  </span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href={`/${locale}/admin/account-statement`}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 transition-colors ${
                  pathWithoutLocale === "/admin/account-statement"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } ${sidebarMinimized ? "sm:justify-center sm:px-0" : ""}`}
                title={sidebarMinimized ? tNav("accountStatement") : ""}
              >
                <FileText className="h-5 w-5 flex-shrink-0" />
                <div
                  className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                >
                  <span className="font-medium text-xs md:text-sm">
                    {tNav("accountStatement")}
                  </span>
                  <span className="text-xs opacity-70 hidden md:block">
                    {tNav("accountStatementDescription")}
                  </span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href={`/${locale}/admin/ai-chat`}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 transition-colors ${
                  pathWithoutLocale === "/admin/ai-chat"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } ${sidebarMinimized ? "sm:justify-center sm:px-0" : ""}`}
                title={sidebarMinimized ? tNav("aiChat") : ""}
              >
                <MessageSquare className="h-5 w-5 flex-shrink-0" />
                <div
                  className={`flex flex-col min-w-0 ${sidebarMinimized ? "sm:hidden" : ""}`}
                >
                  <span className="font-medium text-xs md:text-sm">
                    {tNav("aiChat")}
                  </span>
                  <span className="text-xs opacity-70 hidden md:block">
                    {tNav("aiChatDescription")}
                  </span>
                </div>
              </Link>
            </div>
            <div className="mt-auto">
              <Link
                href={`/${locale}/admin/configuration`}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 md:gap-3 rounded-lg px-2 md:px-3 py-2 transition-colors ${
                  pathWithoutLocale === "/admin/configuration"
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
          className={`flex-1 p-3 sm:p-4 md:px-6 md:py-0 transition-all ${
            sidebarMinimized ? "sm:pl-16 md:pl-16" : ""
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
