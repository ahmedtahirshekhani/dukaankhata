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
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  Package2Icon,
  SearchIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ShoppingCartIcon,
  UsersIcon,
  ShoppingBagIcon,
} from "lucide-react";

const pageNames: { [key: string]: string } = {
  "/admin": "Dashboard",
  "/admin/customers": "Customers",
  "/admin/products": "Products",
  "/admin/orders": "Orders",
  "/admin/pos": "Point of Sale",
  "/admin/cashier": "Cashier",
};

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4">
        <Link
          href="/admin"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Package2Icon className="h-6 w-6" />
          <span>DukaanKhata</span>
        </Link>
        <h1 className="text-xl font-bold">{pageNames[pathname]}</h1>
        <div className="relative ml-auto flex-1 md:grow-0">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
          />
        </div>
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
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-64">
        <aside className="fixed mt-[56px] inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background sm:flex">
          <nav className="flex flex-col gap-4 px-4 sm:py-5">
            <div>
              <Link
                href="/admin"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  pathname === "/admin"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutDashboardIcon className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="font-medium">Dashboard</span>
                  <span className="text-xs">View all metrics</span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href="/admin/cashier"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  pathname === "/admin/cashier"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-xs font-bold">PKR</span>
                <div className="flex flex-col">
                  <span className="font-medium">Cashier</span>
                  <span className="text-xs">Manage transactions</span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href="/admin/products"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  pathname === "/admin/products"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <PackageIcon className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="font-medium">Products</span>
                  <span className="text-xs">Manage inventory</span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href="/admin/customers"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  pathname === "/admin/customers"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UsersIcon className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="font-medium">Customers</span>
                  <span className="text-xs">View all customers</span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href="/admin/orders"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  pathname === "/admin/orders"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShoppingBagIcon className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="font-medium">Orders</span>
                  <span className="text-xs">View all orders</span>
                </div>
              </Link>
            </div>
            <div>
              <Link
                href="/admin/pos"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  pathname === "/admin/pos"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShoppingCartIcon className="h-5 w-5" />
                <div className="flex flex-col">
                  <span className="font-medium">Point of Sale</span>
                  <span className="text-xs">Create new orders</span>
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
