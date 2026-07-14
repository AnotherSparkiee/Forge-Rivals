
'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * STRATEGIC ROUTE GUARD v77 (FMO Protocol)
 * Forces re-setup if the user version is old to ensure squad generation.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { isLoaded, selectedLeagueId, country, version } = useGameState();
  const router = useRouter();
  const pathname = usePathname();
  
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

  const isAuthPage = pathname?.startsWith('/auth');
  const isSetupPage = pathname === '/setup';

  useEffect(() => {
    if (isUserLoading || !isLoaded) return;

    // 1. IF NOT AUTHORIZED
    if (!user) {
      if (!isAuthPage && pathname !== '/') {
        router.replace('/');
      } else {
        setIsInitialCheckDone(true);
      }
      return;
    }

    // 2. IF AUTHORIZED
    // FORCE CLEAN SYNC VERSION 77
    const needsSetup = !selectedLeagueId || !country || (Number(version || 0) < 77);
    
    if (needsSetup) {
      if (!isSetupPage && !isAuthPage) {
        router.replace('/setup');
      } else {
        setIsInitialCheckDone(true);
      }
    } else {
      if (isSetupPage) {
        router.replace('/');
      } else {
        setIsInitialCheckDone(true);
      }
    }
  }, [user, isUserLoading, isLoaded, selectedLeagueId, country, version, router, pathname, isAuthPage, isSetupPage]);

  if (isUserLoading || (!isInitialCheckDone && !isAuthPage && !isSetupPage)) {
    return <LoadingScreen />;
  }

  return (
    <div className="animate-in fade-in duration-500 h-full">
      {children}
    </div>
  );
}
