"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useSession } from "next-auth/react";
import { SyncEngine } from "@/lib/sync/sync-engine";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const tCommon = useTranslations("common");
  const [isInitialSyncing, setIsInitialSyncing] = useState(false);

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

  // Initial Sync when user logs in and is authenticated
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const lastSync = typeof window !== 'undefined' ? localStorage.getItem('last_sync_timestamp') : null;
      
      if (!lastSync) {
        setIsInitialSyncing(true);
        SyncEngine.pullInitialData()
          .then(() => setIsInitialSyncing(false))
          .catch((error) => {
             console.error(error);
             setIsInitialSyncing(false);
          });
      } else {
        // Check if sync already happened recently or just trigger it in background
        SyncEngine.pullInitialData().catch(console.error);
      }
      
      // Also attempt to push any pending queues
      SyncEngine.pushQueue().catch(console.error);
      
      const handleOnline = () => {
        console.log("App is online! Pushing sync queue...");
        SyncEngine.pushQueue().catch(console.error);
      };
      
      window.addEventListener("online", handleOnline);
      return () => {
        window.removeEventListener("online", handleOnline);
      };
    }
  }, [status, session]);

  return <AdminLayout isInitialSyncing={isInitialSyncing}>{children}</AdminLayout>;
}
