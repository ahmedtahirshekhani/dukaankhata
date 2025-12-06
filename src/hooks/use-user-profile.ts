'use client';

import { useSession } from 'next-auth/react';
import { useCallback } from 'react';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  company?: string;
  image?: string | null;
}

export function useUserProfile() {
  const { data: session, status, update } = useSession();

  const user: UserProfile | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.name || undefined,
        company: (session.user as any).company || undefined,
        image: session.user.image || null,
      }
    : null;

  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  const refreshSession = useCallback(async () => {
    await update();
  }, [update]);

  return {
    user,
    isLoading,
    isAuthenticated,
    refreshSession,
    status,
  };
}
