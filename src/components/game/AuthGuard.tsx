'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';

/**
 * Охранник маршрутов. 
 * Управляет 5-секундным сплэш-скрином только при ПЕРВОМ входе в приложение.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { isLoaded, selectedLeagueId, country } = useGameState();
  const router = useRouter();
  const pathname = usePathname();
  
  // Проверяем, была ли уже показана заставка в этой сессии
  const [splashActive, setSplashActive] = useState(false);

  useEffect(() => {
    // Показываем 5-секундную заставку только при самом первом монтировании AuthGuard
    const hasShownSplash = sessionStorage.getItem('lote_splash_shown');
    
    if (!hasShownSplash) {
      setSplashActive(true);
      const timer = setTimeout(() => {
        setSplashActive(false);
        sessionStorage.setItem('lote_splash_shown', 'true');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    // Не мешаем страницам авторизации
    if (pathname?.startsWith('/auth')) return;

    // Редирект на логин, если пользователь не авторизован
    if (!isUserLoading && !user) {
      router.replace('/auth/login');
      return;
    }

    // Проверка завершенности настройки профиля
    if (user && isLoaded) {
      const isSetupComplete = !!(selectedLeagueId && country);
      if (!isSetupComplete && pathname !== '/setup') {
        router.replace('/setup');
      } else if (isSetupComplete && pathname === '/setup') {
        router.replace('/');
      }
    }
  }, [user, isUserLoading, isLoaded, selectedLeagueId, country, router, pathname]);

  // Если мы на странице логина/регистрации — рендерим сразу
  if (pathname?.startsWith('/auth')) {
    return <>{children}</>;
  }

  // Показываем экран загрузки (Splash) при инициализации или активном таймере 5 сек
  if (splashActive || isUserLoading || !isLoaded) {
    return <LoadingScreen />;
  }

  return (
    <div className="animate-in fade-in duration-500">
      {children}
    </div>
  );
}
