"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  SearchIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ShoppingCartIcon,
  UsersIcon,
  ShoppingBagIcon,
  LogOutIcon,
} from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations();
  const tNav = useTranslations("navigation");

  // Remove locale and /admin from pathname to get current page
  const pathWithoutLocale = pathname.replace(`/${locale}`, "");

  const pageNames: { [key: string]: string } = {
    "/admin": tNav("dashboard"),
    "/admin/customers": tNav("customers"),
    "/admin/products": tNav("products"),
    "/admin/orders": tNav("orders"),
    "/admin/pos": tNav("pos"),
    "/admin/cashier": tNav("cashier"),
  };

  const handleLogout = () => {
    router.push(`/${locale}/login`);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4">
        <Link
          href={`/${locale}/admin`}
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Package2Icon className="h-6 w-6" />
          <span>{t("common.appName")}</span>
        </Link>
        <h1 className="text-xl font-bold">{pageNames[pathWithoutLocale] || "Dashboard"}</h1>
        <div className="relative ml-auto flex-1 md:grow-0">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("common.search")}
            className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
          />
        </div>
        <LanguageSwitcher />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="overflow-hidden rounded-full"
            >
              <Image
                src="/placeholder-user.jpg"
                width={36}
                height={36}
                alt="Avatar"
                className="overflow-hidden rounded-full"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("common.settings")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOutIcon className="mr-2 h-4 w-4" />
              {t("common.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-64">
        <aside className="fixed mt-[56px] inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background sm:flex">
          <nav className="flex flex-col gap-4 px-4 sm:py-5">
            <div>
              <Link
                href={`/${locale}/admin`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  pathWithoutLocale === "/admin"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutDashboardIcon className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="font-medium">{tNav("dashboard")}</span>
                  <span className="text-xs opacity-70">{tNav("dashboardDescription")}</span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href={`/${locale}/admin/cashier`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  pathWithoutLocale === "/admin/cashier"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-xs font-bold">PKR</span>
                <div className="flex flex-col">
                  <span className="font-medium">{tNav("cashier")}</span>
                  <span className="text-xs opacity-70">{tNav("cashierDescription")}</span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href={`/${locale}/admin/products`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  pathWithoutLocale === "/admin/products"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <PackageIcon className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="font-medium">{tNav("products")}</span>
                  <span className="text-xs opacity-70">{tNav("productsDescription")}</span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href={`/${locale}/admin/customers`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  pathWithoutLocale === "/admin/customers"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UsersIcon className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="font-medium">{tNav("customers")}</span>
                  <span className="text-xs opacity-70">{tNav("customersDescription")}</span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href={`/${locale}/admin/orders`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  pathWithoutLocale === "/admin/orders"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShoppingBagIcon className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="font-medium">{tNav("orders")}</span>
                  <span className="text-xs opacity-70">{tNav("ordersDescription")}</span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href={`/${locale}/admin/pos`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  pathWithoutLocale === "/admin/pos"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShoppingCartIcon className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="font-medium">{tNav("pos")}</span>
                  <span className="text-xs opacity-70">{tNav("posDescription")}</span>
                </div>
              </Link>
            </div>
          </nav>
        </aside>
        <main className="flex-1 p-4 sm:px-6 sm:py-0">{children}</main>
      </div>
    </div>
  );
}
