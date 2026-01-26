"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageview } from "@/lib/gtag";

type Props = {
  measurementId: string;
};

export default function GATracker({ measurementId }: Props) {
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
