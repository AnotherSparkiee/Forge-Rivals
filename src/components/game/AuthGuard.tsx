'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { doc } from 'firebase/firestore';

/**
 * Enhanced Route Guard for MOBA Tactics Online.
 * Ensures users are authenticated AND have completed their profile setup.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const db = useFirestore();

  // Load the profile to check for completion (league and country selection)
  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v2', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    // 1. Skip checks for auth-related pages (login/register)
    if (pathname?.startsWith('/auth')) return;

    // 2. If Auth is finished and no user, go to login
    if (!isUserLoading && !user) {
      router.replace('/auth/login');
      return;
    }

    // 3. If User exists and profile is fully loaded from Firestore
    if (user && !isProfileLoading) {
      const isSetupComplete = !!(profile?.selectedLeagueId && profile?.country);

      if (!isSetupComplete && pathname !== '/setup') {
        // Force unfinished profiles to the setup page
        router.replace('/setup');
      } else if (isSetupComplete && pathname === '/setup') {
        // Prevent finished profiles from accessing setup again
        router.replace('/');
      }
    }
  }, [user, isUserLoading, isProfileLoading, profile, router, pathname]);

  // Auth pages (login/register) are always accessible immediately
  if (pathname?.startsWith('/auth')) {
    return <>{children}</>;
  }

  // Show loading screen while determining auth state or fetching profile
  const isAuthDetermined = !isUserLoading;
  const isProfileDetermined = user ? !isProfileLoading : true;

  if (!isAuthDetermined || !isProfileDetermined) {
    return <LoadingScreen />;
  }

  // Final check: if user is logged in but setup is incomplete, 
  // don't render children (the game) yet, just show loading while redirecting.
  if (user && pathname !== '/setup') {
    const isSetupComplete = !!(profile?.selectedLeagueId && profile?.country);
    if (!isSetupComplete) {
      return <LoadingScreen />;
    }
  }

  // If no user at all, we don't render children (handled by redirect above)
  if (!user && !pathname?.startsWith('/auth')) {
    return null;
  }

  return <>{children}</>;
}
