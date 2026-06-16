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
    if (isUserLoading || !isLoaded) return;

    const isRoot = pathname === '/';
    const isAuthPage = pathname?.startsWith('/auth');
    const isSetupPage = pathname === '/setup';

    // 1. ЕСЛИ НЕ АВТОРИЗОВАН
    if (!user) {
      // Разрешаем только главную и страницы авторизации
      if (!isRoot && !isAuthPage) {
        router.replace('/');
      } else {
        setIsInitialCheckDone(true);
      }
      return;
    }

    // 2. ЕСЛИ АВТОРИЗОВАН
    const isProfileComplete = !!(selectedLeagueId && country);
    
    if (!isProfileComplete) {
      // Если профиль не настроен, пускаем ТОЛЬКО на /setup или / (где сработает логика рендера)
      // Добавляем исключение для страниц /auth/* чтобы не мешать процессу входа/выхода
      if (!isSetupPage && !isRoot && !isAuthPage) {
        router.replace('/setup');
      } else {
        setIsInitialCheckDone(true);
      }
    } else {
      // Профиль настроен, если зашли на страницы авторизации или настройки -> на хаб (корень)
      // Опять же, если мы на /auth, возможно мы выходим или меняем аккаунт, позволяем остаться
      if (isAuthPage || isSetupPage) {
        if (isSetupPage) {
           router.replace('/');
        } else {
           setIsInitialCheckDone(true);
        }
      } else {
        setIsInitialCheckDone(true);
      }
    }
  }, [user, isUserLoading, isLoaded, selectedLeagueId, country, router, pathname]);

  // Пока идет первичная проверка или загрузка данных — показываем сплэш-экран
  if (isUserLoading || !isInitialCheckDone) {
    return <LoadingScreen />;
  }

  return (
    <div className="animate-in fade-in duration-500 h-full">
      {children}
    </div>
  );
}
