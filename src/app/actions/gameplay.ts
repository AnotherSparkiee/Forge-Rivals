
'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { z } from 'zod';
import { Player } from '@/app/lib/moba-data';

/**
 * @fileOverview Защищенный слой игровых действий.
 * Обрабатывает тренировки, состав и трансферы.
 */

const LineupSlotSchema = z.enum([
  'carry', 'mid', 'offlane', 'support', 'full_support',
  'sub_carry', 'sub_mid', 'sub_offlane', 'sub_support', 'sub_full_support',
  'res1', 'res2', 'res3', 'res4', 'res5', 'res6', 'res7', 'res8'
]);

/**
 * Смена состава.
 */
export async function updateLineupAction(userId: string, updates: Record<string, string | null>) {
  const db = getAdminDb();
  const playerRef = db.collection('players_v14').doc(userId);

  try {
    await db.runTransaction(async (t) => {
      const pSnap = await t.get(playerRef);
      if (!pSnap.exists) throw new Error("PLAYER_NOT_FOUND");
      
      const pData = pSnap.data()!;
      const currentLineup = pData.lineup || {};
      const ownedPlayers: Player[] = pData.ownedPlayers || [];
      const ownedIds = new Set(ownedPlayers.map(p => p.id));

      const newLineup = { ...currentLineup };
      
      for (const [slot, playerId] of Object.entries(updates)) {
        if (!LineupSlotSchema.safeParse(slot).success) continue;
        if (playerId && !ownedIds.has(playerId)) throw new Error("UNIT_NOT_OWNED");
        newLineup[slot] = playerId;
      }

      t.update(playerRef, {
        lineup: newLineup,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Тренировка игрока.
 */
export async function startDailyTrainingAction(userId: string, playerId: string, focus: string) {
  const db = getAdminDb();
  const playerRef = db.collection('players_v14').doc(userId);

  try {
    await db.runTransaction(async (t) => {
      const pSnap = await t.get(playerRef);
      if (!pSnap.exists) throw new Error("PLAYER_NOT_FOUND");
      
      const pData = pSnap.data()!;
      const players: Player[] = pData.ownedPlayers || [];
      const idx = players.findIndex(p => p.id === playerId);
      if (idx === -1) throw new Error("UNIT_NOT_FOUND");

      const player = players[idx];
      if (player.dailyTrainingFinishTime) throw new Error("TRAINING_ALREADY_IN_PROGRESS");

      // 24 часа от текущего времени сервера
      const finishTime = new Date(Date.now() + 24 * 3600000).toISOString();
      
      players[idx] = {
        ...player,
        dailyTrainingFocus: focus,
        dailyTrainingFinishTime: finishTime
      };

      t.update(playerRef, {
        ownedPlayers: players,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Инициализация выставления на трансфер.
 */
export async function listPlayerOnMarketAction(userId: string, playerId: string) {
  const db = getAdminDb();
  const playerRef = db.collection('players_v14').doc(userId);

  try {
    return await db.runTransaction(async (t) => {
      const pSnap = await t.get(playerRef);
      if (!pSnap.exists) throw new Error("PLAYER_NOT_FOUND");
      
      const pData = pSnap.data()!;
      const players: Player[] = pData.ownedPlayers || [];
      const idx = players.findIndex(p => p.id === playerId);
      if (idx === -1) throw new Error("UNIT_NOT_FOUND");

      const player = players[idx];
      if (player.onTransferUntil) throw new Error("ALREADY_ON_MARKET");

      const expiry = new Date(Date.now() + 12 * 3600000).toISOString();
      const price = Math.floor((player.overallRating * 15000) + 100000);
      
      const agentId = `market_${userId}_${Date.now()}`;
      const marketRef = db.collection('market_v7').doc(agentId);

      // 1. Создаем лот
      t.set(marketRef, {
        id: agentId,
        heroData: player,
        currentBid: price,
        startingPrice: price,
        sellerId: userId,
        sellerName: pData.displayName || "Manager",
        expiresAt: expiry,
        bidders: [],
        createdAt: FieldValue.serverTimestamp(),
        version: 140
      });

      // 2. Блокируем игрока у владельца
      players[idx] = { ...player, onTransferUntil: expiry, transferMarketId: agentId };
      t.update(playerRef, { ownedPlayers: players });

      return { success: true, agentId };
    });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
