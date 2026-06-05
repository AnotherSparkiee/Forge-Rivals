
'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/**
 * Слушатель ошибок Firebase.
 * Вместо того чтобы убивать приложение через throw, он выводит уведомление.
 * Это предотвращает белый экран при временных задержках прав доступа.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      console.warn("[Firebase Security]:", error.message);
      
      // Не показываем ошибку если это первичная инициализация (часто бывает ложной)
      if (error.context?.path?.includes('players_v10')) return;

      toast({
        variant: "destructive",
        title: "Ошибка синхронизации",
        description: "Сервер временно ограничил доступ. Попробуйте позже.",
      });
    };

    errorEmitter.on('permission-error', handleError);
    return () => errorEmitter.off('permission-error', handleError);
  }, [toast]);

  return null;
}
