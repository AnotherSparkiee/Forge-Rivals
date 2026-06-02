
'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * Критический страж маршрутов.
 * Гарантирует, что неавторизованные пользователи видят ТОЛЬКО страницы входа/регистрации.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { isLoaded, selectedLeagueId, country } = useGameState();
  const router = useRouter();
  const pathname = usePathname();
  
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

  useEffect(() => {
    if (isUserLoading) return;

    const isAuthPage = pathname?.startsWith('/auth');
    const isSetupPage = pathname === '/setup';

    // 1. ПРИНУДИТЕЛЬНАЯ АВТОРИЗАЦИЯ
    if (!user) {
      if (!isAuthPage) {
        router.replace('/auth/register');
      } else {
        setIsInitialCheckDone(true);
      }
      return;
    }

    // 2. ОБРАБОТКА АВТОРИЗОВАННОГО ПОЛЬЗОВАТЕЛЯ
    if (isLoaded) {
      const isSetupComplete = !!(selectedLeagueId && country);
      
      if (!isSetupComplete) {
        if (!isSetupPage && !isAuthPage) {
          router.replace('/setup');
        } else {
          setIsInitialCheckDone(true);
        }
      } else {
        if (isAuthPage || isSetupPage) {
          router.replace('/');
        } else {
          setIsInitialCheckDone(true);
        }
      }
    }
  }, [user, isUserLoading, isLoaded, selectedLeagueId, country, router, pathname]);

  if (isUserLoading || !isInitialCheckDone) {
    return <LoadingScreen />;
  }

  const isAuthPage = pathname?.startsWith('/auth');
  if (!user && !isAuthPage) {
    return <LoadingScreen />;
  }

  return (
    <div className="animate-in fade-in duration-500 h-full">
      {children}
    </div>
  );
}
