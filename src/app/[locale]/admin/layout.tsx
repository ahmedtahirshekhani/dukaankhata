"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";
import { useSession } from "next-auth/react";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();

  useEffect(() => {
    const checkUser = async () => {
      const user = session?.user as { id: string } | null;
      
      if (status !== "loading" && !user) {
        // Redirect to login with current locale
        const locale = pathname.split('/')[1] || 'en';
        router.push(`/${locale}/login`);
      }
    };
    checkUser();
  }, [router, pathname, session, status]);

  return <AdminLayout>{children}</AdminLayout>;
}
