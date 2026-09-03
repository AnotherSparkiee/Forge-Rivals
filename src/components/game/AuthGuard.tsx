'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { LoadingScreen } from './LoadingScreen';
import { useGameState } from '@/app/lib/store';
import { useUser } from '@/firebase';

/**
 * ГАРД АВТОРИЗАЦИИ v14.1
 * Оптимизирован для предотвращения преждевременных редиректов при медленной синхронизации Firestore.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { isLoaded, isTeamLoaded, isInitialSyncDone } = useGameState();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  
  const isAuthPage = pathname?.startsWith('/auth');
  const isSetupPage = pathname === '/setup';

  useEffect(() => {
    // 1. Ждем первичной загрузки из localStorage
    if (!isLoaded || isUserLoading) return;

    if (!user) {
      // Если пользователь не авторизован - только страницы входа
      if (!isAuthPage) {
        router.replace('/auth/login');
      }
    } else {
      // 2. Ждем завершения первой попытки синхронизации профиля из Firestore
      if (!isInitialSyncDone) return;

      if (!isTeamLoaded) {
        // Если авторизован, синхронизация прошла, но клуба НЕТ - отправляем на создание
        if (!isSetupPage) {
          router.replace('/setup');
        }
      } else {
        // Если клуб ЕСТЬ - блокируем доступ к страницам входа и настройки
        if (isAuthPage || isSetupPage) {
          router.replace('/');
        }
      }
    }
  }, [isLoaded, isUserLoading, user, isTeamLoaded, isInitialSyncDone, router, pathname, isAuthPage, isSetupPage]);

  // Показываем лоадер во время критических проверок
  const showLoader = !isLoaded || isUserLoading || (user && !isInitialSyncDone);

  if (showLoader) {
    return <LoadingScreen />;
  }

  // Финальная защита от мерцания контента
  if (!user && !isAuthPage) return <LoadingScreen />;
  if (user && !isTeamLoaded && isInitialSyncDone && !isSetupPage) return <LoadingScreen />;

  return (
    <div className="animate-in fade-in duration-500 h-full">
      {children}
    </div>
  );
}
