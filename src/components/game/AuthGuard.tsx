'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { LoadingScreen } from './LoadingScreen';

/**
 * Centralized Route Guard for MOBA Tactics Online.
 * Ensures only authenticated users can access game sectors.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If auth state is determined and no user is present, redirect to login
    // Skip this check if we are already on an auth page
    if (!isUserLoading && !user && !pathname?.startsWith('/auth')) {
      router.replace('/auth/login');
    }
  }, [user, isUserLoading, router, pathname]);

  // Auth pages (login/register) are always accessible
  if (pathname?.startsWith('/auth')) {
    return <>{children}</>;
  }

  // While checking auth or if no user, keep the loading screen active
  // This prevents any "menu leak" or flashing of protected content
  if (isUserLoading || !user) {
    return <LoadingScreen />;
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
}
