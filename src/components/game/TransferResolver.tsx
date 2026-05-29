'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc, collection, query, where, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export function TransferResolver() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { isLoaded, updateHero, removeHero, addCredits, language } = useGameState();
  const { toast } = useToast();
  
  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v3'), where('sellerId', '==', user.uid));
  }, [db, user?.uid]);

  const { data: mySales } = useCollection(marketQuery);
  const processedIds = useRef<Set<string>>(new Set());

  const sendNotification = useCallback((title: string, description: string) => {
    if (!user) return;
    addDocumentNonBlocking(collection(db, 'notifications_v2'), {
      userId: user.uid,
      title,
      description,
      type: 'market',
      read: false,
      createdAt: new Date().toISOString()
    });
  }, [user, db]);

  useEffect(() => {
    if (!isLoaded || isUserLoading || !user || !mySales) return;

    const resolveSales = async () => {
      const now = new Date();

      for (const agent of mySales) {
        const expiresAt = new Date(agent.expiresAt);
        
        if (now > expiresAt && !processedIds.current.has(agent.id)) {
          processedIds.current.add(agent.id);
          
          const heroId = agent.heroData.id;
          
          try {
            if (agent.highestBidderId) {
              // SOLD!
              addCredits(agent.currentBid);
              removeHero(heroId, 0);
              
              const title = language === 'ru' ? "Игрок продан!" : "Player Sold!";
              const desc = language === 'ru' 
                ? `${agent.heroData.name} продан за €${agent.currentBid.toLocaleString()}`
                : `${agent.heroData.name} sold for €${agent.currentBid.toLocaleString()}`;
              
              sendNotification(title, desc);
              
              toast({ title, description: desc });
            } else {
              // NOT SOLD
              updateHero(heroId, { 
                onTransferUntil: null, 
                transferMarketId: null 
              });
              
              const title = language === 'ru' ? "Аукцион завершен" : "Auction Ended";
              const desc = language === 'ru' 
                ? `${agent.heroData.name} остается в клубе (ставок нет).`
                : `${agent.heroData.name} remains in club (no bids).`;

              sendNotification(title, desc);
              
              toast({ title, description: desc });
            }

            await deleteDoc(doc(db, 'market_v3', agent.id));
          } catch (e) {
            console.error("Failed to resolve sale", e);
            processedIds.current.delete(agent.id);
          }
        }
      }
    };

    const interval = setInterval(resolveSales, 15000);
    resolveSales();
    return () => clearInterval(interval);
  }, [isLoaded, isUserLoading, user, mySales, addCredits, removeHero, updateHero, language, toast, db, sendNotification]);

  return null;
}
