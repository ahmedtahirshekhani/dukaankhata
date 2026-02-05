"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { setUserData, GTM_ID } from "@/lib/analytics/gtm";

/**
 * GTM User Tracker Component
 *
 * Tracks user authentication state and user data in GTM.
 * This component should be rendered inside a SessionProvider context.
 *
 * - Pushes user authentication state and user ID to the dataLayer
 * - Only active when GTM is configured
 */
export default function GTMUserTracker() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!GTM_ID) return;

    if (session?.user) {
      setUserData({
        user_id: session.user.email,
        user_authenticated: true,
        user_email: session.user.email,
      });
    } else {
      setUserData({
        user_authenticated: false,
      });
    }
  }, [session]);

  return null;
}
