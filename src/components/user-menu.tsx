'use client';

import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings } from 'lucide-react';

interface UserMenuProps {
  userName?: string;
  userEmail?: string;
  locale: string;
}

export function UserMenu({ userName, userEmail, locale }: UserMenuProps) {
  const router = useRouter();
  const t = useTranslations('common');
  const tAuth = useTranslations('auth');

  const handleLogout = async () => {
    await signOut({
      redirect: true,
      callbackUrl: `/${locale}/login`,
    });
  };

  // Settings removed
  const goToSettings = () => {
    router.push(`/${locale}/admin/settings`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold">
            {userName?.charAt(0).toUpperCase()}
          </div>
          <span className="hidden sm:inline text-sm">{userName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{userName}</p>
          <p className="text-xs text-gray-500">{userEmail}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={goToSettings} className="gap-2">
          <Settings className="w-4 h-4" />
          <span>{t('settings')}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="gap-2 text-red-600">
          <LogOut className="w-4 h-4" />
          <span>{t('logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
