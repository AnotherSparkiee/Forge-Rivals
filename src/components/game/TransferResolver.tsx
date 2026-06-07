
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc, collection, query, where, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export function TransferResolver() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { isLoaded, updateHero, removeHero, addCredits, language, addHeroDirectly, addYouthHeroDirectly } = useGameState();
  const { toast } = useToast();
  
  // Track sales where I am the seller
  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'), where('sellerId', '==', user.uid));
  }, [db, user?.uid]);

  const { data: mySales } = useCollection(marketQuery);

  // Track purchases where I am the highest bidder
  const purchaseQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v7'), where('highestBidderId', '==', user.uid));
  }, [db, user?.uid]);

  const { data: myPurchases } = useCollection(purchaseQuery);

  const processedIds = useRef<Set<string>>(new Set());

  const sendNotification = useCallback((targetUserId: string, title: string, description: string) => {
    addDocumentNonBlocking(collection(db, 'notifications_v6'), {
      userId: targetUserId,
      title,
      description,
      type: 'market',
      read: false,
      createdAt: new Date().toISOString()
    });
  }, [db]);

  // Resolve sales logic
  useEffect(() => {
    if (!isLoaded || isUserLoading || !user || !mySales) return;

    const resolveAuctions = async () => {
      const now = new Date();

      for (const agent of mySales) {
        const expiresAt = new Date(agent.expiresAt);
        
        if (now > expiresAt && !processedIds.current.has(agent.id)) {
          processedIds.current.add(agent.id);
          const heroId = agent.heroData.id;
          
          try {
            if (agent.highestBidderId) {
              // 1. Notify Seller
              const sellerTitle = language === 'ru' ? "Игрок продан!" : "Player Sold!";
              const sellerDesc = language === 'ru' 
                ? `${agent.heroData.name} продан клубу "${agent.highestBidderName}" за €${agent.currentBid.toLocaleString()}`
                : `${agent.heroData.name} was sold to "${agent.highestBidderName}" for €${agent.currentBid.toLocaleString()}`;
              
              addCredits(agent.currentBid);
              removeHero(heroId, 0);
              sendNotification(user.uid, sellerTitle, sellerDesc);
              
              // 2. Notify Buyer
              const buyerTitle = language === 'ru' ? "Игрок приобретен!" : "Player Acquired!";
              const buyerDesc = language === 'ru'
                ? `Вы успешно купили игрока ${agent.heroData.name} у клуба "${agent.sellerName}"`
                : `Successfully purchased ${agent.heroData.name} from "${agent.sellerName}"`;
                
              sendNotification(agent.highestBidderId, buyerTitle, buyerDesc);

              toast({ title: sellerTitle, description: sellerDesc });
            } else {
              // No bids - Return to club
              updateHero(heroId, { onTransferUntil: null, transferMarketId: null });
              
              const title = language === 'ru' ? "Аукцион завершен" : "Auction Ended";
              const desc = language === 'ru' 
                ? `${agent.heroData.name} остается в клубе (ставок нет).`
                : `${agent.heroData.name} remains in club (no bids).`;

              sendNotification(user.uid, title, desc);
              toast({ title, description: desc });
            }

            await deleteDoc(doc(db, 'market_v7', agent.id));
          } catch (e) {
            console.error("Failed to resolve auction", e);
            processedIds.current.delete(agent.id);
          }
        }
      }
    };

    const interval = setInterval(resolveAuctions, 15000);
    resolveAuctions();
    return () => clearInterval(interval);
  }, [isLoaded, isUserLoading, user, mySales, addCredits, removeHero, updateHero, language, toast, db, sendNotification]);

  // Resolve purchases logic (Claiming the hero)
  useEffect(() => {
    if (!isLoaded || isUserLoading || !user || !myPurchases) return;

    const resolvePurchases = async () => {
      const now = new Date();

      for (const agent of myPurchases) {
        const expiresAt = new Date(agent.expiresAt);
        
        // If I am the highest bidder and it expired, I should receive the hero
        if (now > expiresAt && !processedIds.current.has(agent.id)) {
          processedIds.current.add(agent.id);
          
          try {
            // Add hero to local state (the seller handles document deletion)
            const heroData = { ...agent.heroData, onTransferUntil: null, transferMarketId: null };
            
            if (agent.isYouth) {
              addYouthHeroDirectly(heroData);
            } else {
              addHeroDirectly(heroData);
            }

            toast({
              title: language === 'ru' ? "Пополнение в составе!" : "New Hero Joined!",
              description: language === 'ru' 
                ? `${heroData.name} теперь в вашем распоряжении.` 
                : `${heroData.name} is now under your command.`
            });
          } catch (e) {
            console.error("Failed to claim purchased hero", e);
            processedIds.current.delete(agent.id);
          }
        }
      }
    };

    const interval = setInterval(resolvePurchases, 15000);
    resolvePurchases();
    return () => clearInterval(interval);
  }, [isLoaded, isUserLoading, user, myPurchases, addHeroDirectly, addYouthHeroDirectly, language, toast]);

  return null;
}
