"use client";

import { ReactNode, useEffect, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PostHogProvider } from "posthog-js/react";
import posthog from "posthog-js";
import { useUserProfile } from "@/hooks/use-user-profile";
import {
  captureEvent,
  getPosthogClient,
  identifyUser,
  isPosthogEnabled,
  resetPosthog,
} from "@/lib/posthog-client";

function IdentifyUser({ client }: { client: typeof posthog }) {
  const { user, status } = useUserProfile();

  useEffect(() => {
    if (!client) {
      return;
    }

    if (user?.id) {
      identifyUser(user.id, {
        email: user.email,
        name: user.name,
        company: user.company,
      });
      return;
    }

    if (status === "unauthenticated") {
      resetPosthog();
    }
  }, [client, user?.id, user?.email, user?.name, user?.company, status]);

  return null;
}

function PageViewTracker({ client }: { client: typeof posthog }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString();

  useEffect(() => {
    if (!client) {
      return;
    }

    const url = search ? `${pathname}?${search}` : pathname || "/";
    captureEvent("$pageview", { $current_url: url });
  }, [client, pathname, search]);

  return null;
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<typeof posthog | null>(null);

  useEffect(() => {
    const phClient = getPosthogClient();
    if (phClient) {
      setClient(phClient);
    }
  }, []);

  if (!isPosthogEnabled || !client) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider client={client}>
      <IdentifyUser client={client} />
      <Suspense fallback={null}>
        <PageViewTracker client={client} />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}
