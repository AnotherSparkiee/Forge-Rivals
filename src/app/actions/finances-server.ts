'use server';

/**
 * @fileOverview Серверный модуль финансов с поддержкой идемпотентности и TTL.
 */

import { doc, getDoc, setDoc, serverTimestamp, runTransaction, Timestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { FinancialOpSchema } from '@/app/lib/validation-schemas';
import { logger } from '@/app/lib/logger';

/**
 * Выполняет финансовую операцию с проверкой ключа идемпотентности.
 * Включает expiresAt для автоматической очистки (TTL).
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

      if (logSnap.exists()) {
        logger.warn("Idempotency match detected. Skipping operation.", { idempotencyKey });
        return { success: true, alreadyProcessed: true };
      }

      const playerRef = doc(db, 'players_v14', userId);
      const playerSnap = await transaction.get(playerRef);
      if (!playerSnap.exists()) throw new Error("PLAYER_NOT_FOUND");

      const pData = playerSnap.data();
      const currentBalance = Number(pData[type] || 0);

      if (amount < 0 && currentBalance < Math.abs(amount)) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      transaction.update(playerRef, { 
        [type]: currentBalance + amount,
        updatedAt: serverTimestamp() 
      });

      // TTL: 7 дней для очистки ключей
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      transaction.set(logRef, {
        userId,
        amount,
        type,
        description,
        processedAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt)
      });

      return { success: true };
    });

    return result;
  } catch (error: any) {
    logger.error("Financial operation failed", error, { userId, idempotencyKey });
    return { success: false, error: error.message };
  }
}
