'use server';

/**
 * @fileOverview Серверный модуль финансов с поддержкой идемпотентности.
 */

import { doc, getDoc, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { FinancialOpSchema } from '@/app/lib/validation-schemas';
import { logger } from '@/app/lib/logger';

/**
 * Выполняет финансовую операцию с проверкой ключа идемпотентности.
 * Предотвращает двойное списание/начисление при повторных запросах.
 */
export async function processFinancialOperation(userId: string, data: any) {
  const validation = FinancialOpSchema.safeParse(data);
  if (!validation.success) return { success: false, error: "INVALID_INPUT" };

  const { idempotencyKey, amount, type, description } = validation.data;
  const { firestore: db } = initializeFirebase();

  try {
    const result = await runTransaction(db, async (transaction) => {
      const logRef = doc(db, 'system_v1', `idempotency_${idempotencyKey}`);
      const logSnap = await transaction.get(logRef);

      // 1. Проверка: была ли такая операция уже выполнена?
      if (logSnap.exists()) {
        logger.warn("Idempotency match detected. Skipping operation.", { idempotencyKey });
        return { success: true, alreadyProcessed: true };
      }

      const playerRef = doc(db, 'players_v14', userId);
      const playerSnap = await transaction.get(playerRef);
      if (!playerSnap.exists()) throw new Error("PLAYER_NOT_FOUND");

      const pData = playerSnap.data();
      const currentBalance = Number(pData[type] || 0);

      // 2. Проверка баланса (только для списания)
      if (amount < 0 && currentBalance < Math.abs(amount)) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      // 3. Обновление баланса
      transaction.update(playerRef, { 
        [type]: currentBalance + amount,
        updatedAt: serverTimestamp() 
      });

      // 4. Запись ключа идемпотентности
      transaction.set(logRef, {
        userId,
        amount,
        type,
        description,
        processedAt: serverTimestamp()
      });

      return { success: true };
    });

    return result;
  } catch (error: any) {
    logger.error("Financial operation failed", error, { userId, idempotencyKey });
    return { success: false, error: error.message };
  }
}
