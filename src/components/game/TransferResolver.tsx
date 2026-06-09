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
  const { isLoaded, updateHero, removeHero, addCredits, language, addHeroDirectly, addYouthHeroDirectly } = useGameState();
  
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
   * Это гарантирует, что даже при одновременной обработке несколькими клиентами
   * создастся ровно одно уведомление.
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
          const heroId = agent.heroData.id;
          
          try {
            if (agent.highestBidderId) {
              const sellerTitle = language === 'ru' ? "Игрок продан!" : "Player Sold!";
              const sellerDesc = language === 'ru' 
                ? `${agent.heroData.name} продан клубу "${agent.highestBidderName}" за €${agent.currentBid.toLocaleString()}`
                : `${agent.heroData.name} was sold to "${agent.highestBidderName}" for €${agent.currentBid.toLocaleString()}`;
              
              addCredits(agent.currentBid);
              removeHero(heroId, 0);
              
              // Уведомление продавцу с уникальным ID сделки
              sendNotification(user.uid, sellerTitle, sellerDesc, `sale_done_${agent.id}`);
            } else {
              // Возврат в состав если не купили
              updateHero(heroId, { onTransferUntil: null, transferMarketId: null });
              const title = language === 'ru' ? "Аукцион завершен" : "Auction Ended";
              const desc = language === 'ru' 
                ? `${agent.heroData.name} остается в клубе (ставок нет).`
                : `${agent.heroData.name} remains in club (no bids).`;
              
              sendNotification(user.uid, title, desc, `sale_fail_${agent.id}`);
            }
            // Удаляем лот с рынка
            await deleteDoc(doc(db, 'market_v7', agent.id));
          } catch (e) {
            console.error("Failed to resolve auction (sale)", e);
            processedIds.current.delete(agent.id);
          }
        }
      }
    };

    const interval = setInterval(resolveAuctions, 20000);
    resolveAuctions();
    return () => clearInterval(interval);
  }, [isLoaded, isUserLoading, user, mySales, addCredits, removeHero, updateHero, language, db, sendNotification]);

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
            const heroData = { ...agent.heroData, onTransferUntil: null, transferMarketId: null };
            
            // Добавляем героя
            if (agent.isYouth) {
              addYouthHeroDirectly(heroData);
            } else {
              addHeroDirectly(heroData);
            }

            const title = language === 'ru' ? "Пополнение в составе!" : "New Hero Joined!";
            const desc = language === 'ru' 
              ? `${heroData.name} теперь в вашем распоряжении.` 
              : `${heroData.name} is now under your command.`;
            
            // Уведомление покупателю с уникальным ID сделки
            sendNotification(user.uid, title, desc, `buy_done_${agent.id}`);
            
            // Пытаемся удалить документ. 
            await deleteDoc(doc(db, 'market_v7', agent.id));
          } catch (e) {
            console.error("Failed to claim purchased hero", e);
            processedIds.current.delete(agent.id);
          }
        }
      }
    };

    const interval = setInterval(resolvePurchases, 20000);
    resolvePurchases();
    return () => clearInterval(interval);
  }, [isLoaded, isUserLoading, user, myPurchases, addHeroDirectly, addYouthHeroDirectly, language, sendNotification, db]);

  return null;
}
