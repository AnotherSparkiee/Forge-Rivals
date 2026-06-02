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
        // Если не в сети и не на странице логина — уходим на регистрацию
        router.replace('/auth/register');
      } else {
        // Если на странице логина — всё ок
        setIsInitialCheckDone(true);
      }
      return;
    }

    // 2. ОБРАБОТКА АВТОРИЗОВАННОГО ПОЛЬЗОВАТЕЛЯ
    if (isLoaded) {
      const isSetupComplete = !!(selectedLeagueId && country);
      
      if (!isSetupComplete) {
        // Если не настроен — только страница /setup или выход
        if (!isSetupPage && !isAuthPage) {
          router.replace('/setup');
        } else {
          setIsInitialCheckDone(true);
        }
      } else {
        // Если всё настроено — не пускаем на страницы входа/настройки
        if (isAuthPage || isSetupPage) {
          router.replace('/');
        } else {
          setIsInitialCheckDone(true);
        }
      }
    }
  }, [user, isUserLoading, isLoaded, selectedLeagueId, country, router, pathname]);

  // Пока идет проверка или загрузка данных — показываем только сплэш-скрин
  if (isUserLoading || !isInitialCheckDone) {
    return <LoadingScreen />;
  }

  // Дополнительная проверка безопасности перед рендерингом контента
  const isAuthPage = pathname?.startsWith('/auth');
  if (!user && !isAuthPage) {
    return <LoadingScreen />;
  }

  return (
    <div className="animate-in fade-in duration-500">
      {children}
    </div>
  );
}
