'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc, collection, query, where, deleteDoc } from 'firebase/firestore';
import { getMoscowTime } from '@/app/lib/time-utils';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

/**
 * Модуль автоматического завершения аукционов.
 * Работает на стороне клиента, разрешая сделки по истечении времени.
 * Использует детерминированные ID для уведомлений во избежание дублей.
 */
export function TransferResolver() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { isLoaded, updatePlayer, removePlayer, addCredits, language, addPlayerDirectly, addYouthPlayerDirectly } = useGameState();
  
  // Лоты, которые я продаю
  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'), where('sellerId', '==', user.uid));
  }, [db, user?.uid]);

  const { data: mySales } = useCollection(marketQuery);

  // Лоты, на которых я лидирую
  const purchaseQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'), where('highestBidderId', '==', user.uid));
  }, [db, user?.uid]);

  const { data: myPurchases } = useCollection(purchaseQuery);

  const processedIds = useRef<Set<string>>(new Set());

  /**
   * Отправка уведомления с детерминированным ID. 
   */
  const sendNotification = useCallback((targetUserId: string, title: string, description: string, notifId: string) => {
    const notifRef = doc(db, 'notifications_v7', notifId);
    setDocumentNonBlocking(notifRef, {
      userId: targetUserId,
      title,
      description,
      type: 'market',
      read: false,
      createdAt: new Date().toISOString()
    });
  }, [db]);

  // Эффект разрешения продаж (я продавец)
  useEffect(() => {
    if (!isLoaded || isUserLoading || !user || !mySales) return;

    const resolveAuctions = async () => {
      const mskNow = getMoscowTime();

      for (const agent of mySales) {
        const expiresAt = new Date(agent.expiresAt);
        
        if (mskNow > expiresAt && !processedIds.current.has(agent.id)) {
          processedIds.current.add(agent.id);
          const playerId = agent.heroData.id;
          
          try {
            if (agent.highestBidderId) {
              const sellerTitle = language === 'ru' ? "Игрок продан!" : "Player Sold!";
              const sellerDesc = language === 'ru' 
                ? `${agent.heroData.name} продан клубу "${agent.highestBidderName}" за €${agent.currentBid.toLocaleString()}`
                : `${agent.heroData.name} was sold to "${agent.highestBidderName}" for €${agent.currentBid.toLocaleString()}`;
              
              addCredits(agent.currentBid);
              removePlayer(playerId, 0);
              sendNotification(user.uid, sellerTitle, sellerDesc, `sale_done_${agent.id}`);
            } else {
              updatePlayer(playerId, { onTransferUntil: null, transferMarketId: null });
              const title = language === 'ru' ? "Аукцион завершен" : "Auction Ended";
              const desc = language === 'ru' 
                ? `${agent.heroData.name} остается в клубе (ставок нет).`
                : `${agent.heroData.name} remains in club (no bids).`;
              sendNotification(user.uid, title, desc, `sale_fail_${agent.id}`);
            }
            await deleteDoc(doc(db, 'market_v7', agent.id));
          } catch (e) {
            console.error("Failed to resolve auction (sale)", e);
            processedIds.current.delete(agent.id);
          }
        }
      }
    };

    const interval = setInterval(resolveAuctions, 10000);
    return () => clearInterval(interval);
  }, [isLoaded, isUserLoading, user, mySales, addCredits, removePlayer, updatePlayer, language, db, sendNotification]);

  // Эффект разрешения покупок (я покупатель)
  useEffect(() => {
    if (!isLoaded || isUserLoading || !user || !myPurchases) return;

    const resolvePurchases = async () => {
      const mskNow = getMoscowTime();

      for (const agent of myPurchases) {
        const expiresAt = new Date(agent.expiresAt);
        
        if (mskNow > expiresAt && !processedIds.current.has(agent.id)) {
          processedIds.current.add(agent.id);
          
          try {
            // Очищаем временные поля рынка перед зачислением
            const playerData = { 
              ...agent.heroData, 
              onTransferUntil: null, 
              transferMarketId: null,
              isPro: agent.isPro || agent.heroData?.isPro || false
            };
            
            // Добавляем игрока в коллекцию героев
            if (agent.isYouth) {
              addYouthPlayerDirectly(playerData);
            } else {
              addPlayerDirectly(playerData);
            }

            const title = language === 'ru' ? "Пополнение в составе!" : "New Player Joined!";
            const desc = language === 'ru' 
              ? `${playerData.name} теперь в вашем распоряжении.` 
              : `${playerData.name} is now under your command.`;
            
            sendNotification(user.uid, title, desc, `buy_done_${agent.id}`);
            
            // Удаляем документ лота
            await deleteDoc(doc(db, 'market_v7', agent.id));
          } catch (e) {
            console.error("Failed to claim purchased player", e);
            processedIds.current.delete(agent.id);
          }
        }
      }
    };

    const interval = setInterval(resolvePurchases, 10000);
    return () => clearInterval(interval);
  }, [isLoaded, isUserLoading, user, myPurchases, addPlayerDirectly, addYouthPlayerDirectly, language, sendNotification, db]);

  return null;
}
