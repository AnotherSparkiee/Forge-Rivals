'use client';

import { useEffect, useRef } from 'react';
import { useAuth, useUser } from '@/firebase';
import { syncTelegramUser } from '@/firebase/telegram-auth';
import { useToast } from '@/hooks/use-toast';

/**
 * Компонент-обработчик среды Telegram.
 * Автоматически синхронизирует пользователя, если он зашел через Telegram WebApp.
 */
export function TelegramSyncHandler() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const syncStartedRef = useRef(false);

  useEffect(() => {
    // Проверка наличия объекта Telegram WebApp
    const tg = (window as any).Telegram?.WebApp;

    if (tg && tg.initDataUnsafe?.user && !user && !isUserLoading && !syncStartedRef.current) {
      syncStartedRef.current = true;
      
      const handleSync = async () => {
        try {
          tg.expand(); // Разворачиваем приложение на весь экран
          tg.ready();

          const result = await syncTelegramUser(auth, tg.initDataUnsafe.user);
          
          if (result.status === 'registered') {
            toast({
              title: "Telegram Sync Complete",
              description: "Your operational profile has been initialized.",
            });
          }
        } catch (e) {
          console.error("Telegram Auto-Sync Error:", e);
          syncStartedRef.current = false;
        }
      };

      handleSync();
    }
  }, [auth, user, isUserLoading, toast]);

  return null;
}
