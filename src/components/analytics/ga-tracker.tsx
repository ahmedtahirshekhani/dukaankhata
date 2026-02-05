"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageview } from "@/lib/analytics/gtag";

type Props = {
  measurementId: string;
};

function GATrackerContent({ measurementId }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!measurementId) return;
    const url = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
    // Send a page_view on the client whenever the route changes
    pageview(url);
    // We intentionally depend on both pathname and search params
    // so navigation updates trigger a new page_view
  }, [pathname, searchParams, measurementId]);

  return null;
}

export default function GATracker({ measurementId }: Props) {
  return (
    <Suspense fallback={null}>
      <GATrackerContent measurementId={measurementId} />
    </Suspense>
  );
}
