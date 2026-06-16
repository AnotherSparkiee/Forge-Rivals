'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * STRATEGIC ROUTE GUARD
 * Ensures that unauthorized users always land on the Auth form,
 * and authorized users with incomplete profiles land on Setup.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { isLoaded, selectedLeagueId, country } = useGameState();
  const router = useRouter();
  const pathname = usePathname();
  
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

  useEffect(() => {
    if (isUserLoading) return;

    const isRoot = pathname === '/';
    const isAuthPage = pathname?.startsWith('/auth');
    const isSetupPage = pathname === '/setup';

    // 1. IF NOT AUTHORIZED
    if (!user) {
      if (!isRoot && !isAuthPage) {
        router.replace('/');
      } else {
        setIsInitialCheckDone(true);
      }
      return;
    }

    // 2. IF AUTHORIZED
    // Wait for store to sync profile data
    if (!isLoaded) return;

    const isProfileComplete = !!(selectedLeagueId && country);
    
    if (!isProfileComplete) {
      // Force setup if profile is missing, even from Root
      if (!isSetupPage && !isAuthPage) {
        router.replace('/setup');
      } else {
        setIsInitialCheckDone(true);
      }
    } else {
      // If profile is complete but user hits setup, send to hub
      if (isSetupPage) {
        router.replace('/');
      } else {
        setIsInitialCheckDone(true);
      }
    }
  }, [user, isUserLoading, isLoaded, selectedLeagueId, country, router, pathname]);

  if (isUserLoading || !isInitialCheckDone) {
    return <LoadingScreen />;
  }

  return (
    <div className="animate-in fade-in duration-500 h-full">
      {children}
    </div>
  );
}
