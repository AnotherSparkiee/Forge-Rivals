'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';
import { useUser } from '@/firebase';

/**
 * ГАРД АВТОРИЗАЦИИ v3.0
 * Теперь использует реальный статус Firebase Auth.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { isLoaded, isTeamLoaded } = useGameState();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  
  const isAuthPage = pathname?.startsWith('/auth');
  const isSetupPage = pathname === '/setup';

  useEffect(() => {
    // Ждем загрузки стора и статуса пользователя
    if (!isLoaded || isUserLoading) return;

    if (!user) {
      // Если не авторизован - только страницы входа/регистрации
      if (!isAuthPage) {
        router.replace('/auth/login');
      }
    } else {
      // Если авторизован, но клуб не создан
      if (!isTeamLoaded) {
        if (!isSetupPage) {
          router.replace('/setup');
        }
      } else {
        // Если авторизован и клуб есть - нельзя на страницы входа или настройки
        if (isAuthPage || isSetupPage) {
          router.replace('/');
        }
      }
    }
  }, [isLoaded, isUserLoading, user, isTeamLoaded, router, pathname, isAuthPage, isSetupPage]);

  // Показываем лоадер во время проверок
  if (!isLoaded || isUserLoading) {
    return <LoadingScreen />;
  }

  // Предотвращаем мерцание контента перед редиректом
  if (!user && !isAuthPage) return <LoadingScreen />;
  if (user && !isTeamLoaded && !isSetupPage) return <LoadingScreen />;

  return (
    <div className="animate-in fade-in duration-500 h-full">
      {children}
    </div>
  );
}
