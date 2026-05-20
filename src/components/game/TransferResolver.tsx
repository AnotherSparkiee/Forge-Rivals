'use client';

import { useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc, collection, query, where, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

/**
 * BACKGROUND RESOLVER for Transfer Market.
 * Uses useCollection for a stable real-time listener to avoid Firestore assertion errors.
 */
export function TransferResolver() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { isLoaded, updateHero, removeHero, addCredits, language } = useGameState();
  const { toast } = useToast();
  
  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v2'), where('sellerId', '==', user.uid));
  }, [db, user?.uid]);

  const { data: mySales } = useCollection(marketQuery);
  const processedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoaded || isUserLoading || !user || !mySales) return;

    const resolveSales = async () => {
      const now = new Date();

      for (const agent of mySales) {
        const expiresAt = new Date(agent.expiresAt);
        
        // If expired and not already processed in this session
        if (now > expiresAt && !processedIds.current.has(agent.id)) {
          processedIds.current.add(agent.id);
          
          const heroId = agent.heroData.id;
          
          try {
            if (agent.highestBidderId) {
              // SOLD!
              addCredits(agent.currentBid);
              removeHero(heroId, 0);
              
              toast({
                title: language === 'ru' ? "Игрок продан!" : "Player Sold!",
                description: `${agent.heroData.name} продан за €${agent.currentBid.toLocaleString()}`
              });
            } else {
              // NOT SOLD - return to club (clear transfer metadata)
              updateHero(heroId, { 
                onTransferUntil: null, 
                transferMarketId: null 
              });
              
              toast({
                title: language === 'ru' ? "Аукцион завершен" : "Auction Ended",
                description: `${agent.heroData.name} остается в клубе (ставок нет).`
              });
            }

            // Clean up market entry
            await deleteDoc(doc(db, 'market_v2', agent.id));
          } catch (e) {
            console.error("Failed to resolve sale", e);
            processedIds.current.delete(agent.id); // Retry next check
          }
        }
      }
    };

    const interval = setInterval(resolveSales, 15000); // Check every 15 seconds
    resolveSales();
    return () => clearInterval(interval);
  }, [isLoaded, isUserLoading, user, mySales, addCredits, removeHero, updateHero, language, toast, db]);

  return null;
}