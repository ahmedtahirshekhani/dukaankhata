"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pushPageView } from "@/lib/gtm";

type Props = {
  gtmId: string;
};

/**
 * GTM Tracker Component
 *
 * Sends page view events to GTM on route changes.
 * Works alongside GA4's GATracker component to provide comprehensive analytics.
 *
 * - Tracks page_view events when routes change
 * - All tracking is guarded and respects GTM_ID configuration
 *
 * Note: User authentication tracking is handled separately via GTMUserTracker
 * to avoid SessionProvider dependency issues in the root layout.
 */
export default function GTMTracker({ gtmId }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views on navigation
  useEffect(() => {
    if (!gtmId) return;
    const url = `${pathname}${
      searchParams?.toString() ? `?${searchParams.toString()}` : ""
    }`;
    const pageTitle = document.title || "Page";
    pushPageView(pageTitle, url);
  }, [pathname, searchParams, gtmId]);

  return null;
}
