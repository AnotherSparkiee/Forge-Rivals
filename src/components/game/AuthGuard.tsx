
'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * Критический страж маршрутов.
 * Теперь разрешает доступ к "/" без пользователя, так как "/" — страница входа.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { isLoaded, selectedLeagueId, country } = useGameState();
  const router = useRouter();
  const pathname = usePathname();
  
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

  useEffect(() => {
    if (isUserLoading || !isLoaded) return;

    const isRoot = pathname === '/';
    const isAuthPage = pathname?.startsWith('/auth');
    const isSetupPage = pathname === '/setup';

    // 1. Если не авторизован и не на странице входа/регистрации/корня -> на корень
    if (!user) {
      if (!isAuthPage && !isRoot) {
        router.replace('/');
      } else {
        setIsInitialCheckDone(true);
      }
      return;
    }

    // 2. Проверка полноты профиля
    const isProfileComplete = !!(selectedLeagueId && country);
    
    if (!isProfileComplete) {
      if (!isSetupPage && !isAuthPage && !isRoot) {
        router.replace('/setup');
      } else {
        setIsInitialCheckDone(true);
      }
    } else {
      // Профиль полный, если зашли на страницы авторизации -> на хаб
      if (isAuthPage) {
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
