'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * Охранник маршрутов с обязательной 5-секундной заставкой.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { isLoaded, selectedLeagueId, country } = useGameState();
  const router = useRouter();
  const pathname = usePathname();
  
  // Состояние для управления 5-секундным сплэш-скрином
  const [splashActive, setSplashActive] = useState(true);

  useEffect(() => {
    // Принудительная задержка 5 секунд для атмосферы
    const timer = setTimeout(() => {
      setSplashActive(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (pathname?.startsWith('/auth')) return;

    if (!isUserLoading && !user) {
      router.replace('/auth/login');
      return;
    }

    if (user && isLoaded) {
      const isSetupComplete = !!(selectedLeagueId && country);
      if (!isSetupComplete && pathname !== '/setup') {
        router.replace('/setup');
      } else if (isSetupComplete && pathname === '/setup') {
        router.replace('/');
      }
    }
  }, [user, isUserLoading, isLoaded, selectedLeagueId, country, router, pathname]);

  if (pathname?.startsWith('/auth')) {
    return <>{children}</>;
  }

  // Показываем экран загрузки, если идет инициализация ИЛИ не прошло 5 секунд
  if (splashActive || isUserLoading || !isLoaded) {
    return <LoadingScreen />;
  }

  return (
    <div className="animate-in fade-in duration-1000">
      {children}
    </div>
  );
}
