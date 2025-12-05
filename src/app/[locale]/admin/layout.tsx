"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminLayout } from "@/components/admin-layout";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Redirect to login with current locale
        const locale = pathname.split('/')[1] || 'en';
        router.push(`/${locale}/login`);
      }
    };
    checkUser();
  }, [router, supabase.auth, pathname]);

  return <AdminLayout>{children}</AdminLayout>;
}
