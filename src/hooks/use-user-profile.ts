"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  company?: string;
  image?: string | null;
}

export function useUserProfile() {
  const { data: session, status, update } = useSession();
  const [overrides, setOverrides] = useState<{
    name?: string;
    company?: string;
  } | null>(null);

  const baseUser: UserProfile | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email || "",
        name: session.user.name || undefined,
        company: (session.user as any).company || undefined,
        image: session.user.image || null,
      }
    : null;

  const user: UserProfile | null = useMemo(() => {
    if (!baseUser) return null;
    return {
      ...baseUser,
      name: overrides?.name ?? baseUser.name,
      company: overrides?.company ?? baseUser.company,
    };
  }, [baseUser, overrides]);

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";

  const refreshSession = useCallback(async () => {
    await update();
  }, [update]);

  useEffect(() => {
    if (!session?.user) {
      setOverrides(null);
    }
  }, [session?.user]);

  useEffect(() => {
    const handleProfileDetailsUpdated = (event: CustomEvent) => {
      const detail = event.detail || {};
      const nextOverrides: { name?: string; company?: string } = {};
      if (typeof detail.name === "string") {
        nextOverrides.name = detail.name;
      }
      if (typeof detail.company === "string") {
        nextOverrides.company = detail.company;
      }
      if (typeof detail.companyName === "string") {
        nextOverrides.company = detail.companyName;
      }
      if (Object.keys(nextOverrides).length > 0) {
        setOverrides((prev) => ({ ...prev, ...nextOverrides }));
      }
    };

    window.addEventListener(
      "profileDetailsUpdated",
      handleProfileDetailsUpdated as EventListener,
    );
    return () => {
      window.removeEventListener(
        "profileDetailsUpdated",
        handleProfileDetailsUpdated as EventListener,
      );
    };
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
    refreshSession,
    status,
  };
}
