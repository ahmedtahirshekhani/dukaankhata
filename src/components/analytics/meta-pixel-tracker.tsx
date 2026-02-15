"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Declare fbq global type
declare global {
  function fbq(
    action: string,
    event: string,
    data?: Record<string, unknown>
  ): void;
}

type Props = {
  pixelId: string;
};

function MetaPixelTrackerContent({ pixelId }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pixelId || typeof window === "undefined") return;

    // Initialize Meta Pixel if not already initialized
    if (typeof fbq !== "undefined") {
      fbq("init", pixelId);
      fbq("track", "PageView");
    }

    // Track page views on route changes
    const handleRouteChange = () => {
      if (typeof fbq !== "undefined") {
        fbq("track", "PageView");
      }
    };

    handleRouteChange();
  }, [pathname, searchParams, pixelId]);

  return null;
}

export default function MetaPixelTracker({ pixelId }: Props) {
  return (
    <Suspense fallback={null}>
      <MetaPixelTrackerContent pixelId={pixelId} />
    </Suspense>
  );
}
