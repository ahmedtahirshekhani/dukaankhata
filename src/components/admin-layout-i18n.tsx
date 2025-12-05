'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  Package2Icon,
  SearchIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ShoppingCartIcon,
  UsersIcon,
  ShoppingBagIcon,
  LogOutIcon,
  SettingsIcon,
} from 'lucide-react';
import { LanguageSwitcher } from './language-switcher';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations();

  // Remove locale from pathname for comparison
  const pathWithoutLocale = pathname.slice(locale.length + 1);

  const navItems = [
    {
      href: 'admin',
      label: t('navigation.dashboard'),
      icon: LayoutDashboardIcon,
    },
    {
      href: 'admin/products',
      label: t('navigation.products'),
      icon: PackageIcon,
    },
    {
      href: 'admin/customers',
      label: t('navigation.customers'),
      icon: UsersIcon,
    },
    {
      href: 'admin/orders',
      label: t('navigation.orders'),
      icon: ShoppingCartIcon,
    },
    {
      href: 'admin/pos',
      label: t('navigation.pos'),
      icon: ShoppingBagIcon,
    },
    {
      href: 'admin/cashier',
      label: t('navigation.cashier'),
      icon: ShoppingCartIcon,
    },
  ];

  const currentPageLabel = navItems.find(
    (item) => `/${item.href}` === pathWithoutLocale
  )?.label;

  const handleLogout = async () => {
    router.push(`/${locale}/login`);
  };

  return (
    <div className={`flex min-h-screen w-full flex-col bg-muted/40`}>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4">
        <Link
          href={`/${locale}/admin`}
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Package2Icon className="h-6 w-6" />
          <span>{t('common.appName')}</span>
        </Link>

        <h1 className="text-xl font-bold">{currentPageLabel}</h1>

        <div className="relative ml-auto flex-1 md:grow-0">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('common.search')}
            className="w-full rounded-lg bg-background pl-8 md:w-200"
          />
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="overflow-hidden rounded-full"
              >
                <Image
                  src="/fonts/google-sans-flex/profile.jpg"
                  width={36}
                  height={36}
                  alt="User Avatar"
                  className="overflow-hidden rounded-full"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('common.settings')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOutIcon className="mr-2 h-4 w-4" />
                {t('common.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="hidden w-64 border-r bg-background md:block">
          <div className="space-y-2 py-4">
            {navItems.map((item) => {
              const href = `/${locale}/${item.href}`;
              const isActive = `/${item.href}` === pathWithoutLocale;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-primary'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
