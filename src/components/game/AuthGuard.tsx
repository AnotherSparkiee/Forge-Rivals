'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * STRATEGIC ROUTE GUARD v70
 * Forces re-setup if the user version is old.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { isLoaded, selectedLeagueId, country, version } = useGameState();
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
    if (!isLoaded) return;

    // FORCE REDISTRIBUTION VERSION 70
    const needsSetup = !selectedLeagueId || !country || (Number(version || 0) < 70);
    
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
  }, [user, isUserLoading, isLoaded, selectedLeagueId, country, version, router, pathname]);

  if (isUserLoading || !isInitialCheckDone) {
    return <LoadingScreen />;
  }

  return (
    <div className="animate-in fade-in duration-500 h-full">
      {children}
    </div>
  );
}
