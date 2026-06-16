'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * КРИТИЧЕСКИЙ СТРАЖ МАРШРУТОВ
 * Гарантирует, что неавторизованные пользователи всегда видят только "/"
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

    // 1. ЕСЛИ НЕ АВТОРИЗОВАН
    if (!user) {
      if (!isRoot && !isAuthPage) {
        router.replace('/');
      } else {
        setIsInitialCheckDone(true);
      }
      return;
    }

    // 2. ЕСЛИ АВТОРИЗОВАН
    // Ждем загрузки состояния игры только для авторизованных
    if (!isLoaded) return;

    const isProfileComplete = !!(selectedLeagueId && country);
    
    if (!isProfileComplete) {
      if (!isSetupPage && !isRoot && !isAuthPage) {
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
  }, [user, isUserLoading, isLoaded, selectedLeagueId, country, router, pathname]);

  if (isUserLoading || !isInitialCheckDone) {
    return <LoadingScreen />;
  }

  // Если нет пользователя и мы не на разрешенных страницах — не рендерим ничего (ждем редиректа)
  const isAllowedPath = pathname === '/' || pathname?.startsWith('/auth');
  if (!user && !isAllowedPath) return <LoadingScreen />;

  return (
    <div className="animate-in fade-in duration-500 h-full">
      {children}
    </div>
  );
}
