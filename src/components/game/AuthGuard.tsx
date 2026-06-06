
'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * Критический страж маршрутов.
 * Предотвращает доступ к игре без полной регистрации (лига, страна).
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { isLoaded, selectedLeagueId, country } = useGameState();
  const router = useRouter();
  const pathname = usePathname();
  
  const [isInitialCheckDone, setIsInitialCheckDone] = useState(false);

  useEffect(() => {
    if (isUserLoading || !isLoaded) return;

    const isAuthPage = pathname?.startsWith('/auth');
    const isSetupPage = pathname === '/setup';
    const isHubEntered = typeof window !== 'undefined' && sessionStorage.getItem('lote_hub_entered') === 'true';

    // 1. ЗАЩИТА ПРИ ОТСУТСТВИИ ПОЛЬЗОВАТЕЛЯ
    if (!user) {
      if (!isAuthPage) {
        router.replace('/auth/register');
      } else {
        setIsInitialCheckDone(true);
      }
      return;
    }

    // 2. ПРИНУДИТЕЛЬНЫЙ ВХОД (если не нажата кнопка входа в текущей сессии)
    // Исключаем страницы авторизации и настройки из этого правила
    if (pathname === '/' && !isHubEntered && !isAuthPage && !isSetupPage) {
      router.replace('/auth/register');
      return;
    }

    // 3. ПРОВЕРКА ПОЛНОТЫ ПРОФИЛЯ
    // Если пользователь вошел, но не выбрал лигу/страну, пускаем только на /setup
    const isProfileComplete = !!(selectedLeagueId && country);
    
    if (!isProfileComplete) {
      if (!isSetupPage && !isAuthPage) {
        router.replace('/setup');
      } else {
        setIsInitialCheckDone(true);
      }
    } else {
      // Профиль полный
      setIsInitialCheckDone(true);
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
