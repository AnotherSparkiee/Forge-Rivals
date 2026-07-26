'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * ЛОКАЛЬНЫЙ ГАРД v2.0
 * Работает без Firebase, проверяет только наличие настроенного профиля в локальном хранилище.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { isLoaded, selectedLeagueId, country } = useGameState();
  const router = useRouter();
  const pathname = usePathname();
  
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

  const isAuthPage = pathname?.startsWith('/auth');
  const isSetupPage = pathname === '/setup';

  useEffect(() => {
    if (!isLoaded) return;

    // В локальном режиме мы всегда "авторизованы" как local-manager
    const needsSetup = !selectedLeagueId || !country;
    
    if (needsSetup) {
      if (!isSetupPage && !isAuthPage) {
        router.replace('/setup');
      } else {
        setIsInitialCheckDone(true);
      }
    } else {
      if (isSetupPage || isAuthPage) {
        router.replace('/');
      } else {
        setIsInitialCheckDone(true);
      }
    }
  }, [isLoaded, selectedLeagueId, country, router, pathname, isAuthPage, isSetupPage]);

  if (!isLoaded || (!isInitialCheckDone && !isAuthPage && !isSetupPage)) {
    return <LoadingScreen />;
  }

  return (
    <div className="animate-in fade-in duration-500 h-full">
      {children}
    </div>
  );
}
