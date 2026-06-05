
'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * Критический страж маршрутов.
 * Теперь форсирует страницу регистрации как точку входа.
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
    const isHubEntered = typeof window !== 'undefined' && sessionStorage.getItem('lote_hub_entered') === 'true';

    // 1. ПЕРВИЧНЫЙ ВХОД (ВСЕГДА НА РЕГИСТРАЦИЮ ПРИ СТАРТЕ С КОРНЯ)
    if (pathname === '/' && !isHubEntered) {
      router.replace('/auth/register');
      return;
    }

    // 2. ЗАЩИТА ПРИ ОТСУТСТВИИ ПОЛЬЗОВАТЕЛЯ
    if (!user) {
      if (!isAuthPage) {
        router.replace('/auth/register');
      } else {
        setIsInitialCheckDone(true);
      }
      return;
    }

    // 3. ОБРАБОТКА АВТОРИЗОВАННОГО ПОЛЬЗОВАТЕЛЯ
    if (isLoaded) {
      const isSetupComplete = !!(selectedLeagueId && country);
      
      if (!isSetupComplete) {
        // Если профиль не настроен, пускаем только на регистрацию/логин или настройку
        if (!isSetupPage && !isAuthPage) {
          router.replace('/setup');
        } else {
          setIsInitialCheckDone(true);
        }
      } else {
        // Если профиль настроен, позволяем находиться на любой странице
        // Но не перенаправляем автоматически с /auth, чтобы пользователь мог выйти или переключиться
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
