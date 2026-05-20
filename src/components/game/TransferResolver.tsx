'use client';

import { useEffect, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

/**
 * BACKGROUND RESOLVER for Transfer Market.
 * TEST MODE: Interval reduced to 30 seconds for 5-min testing.
 */
export function TransferResolver() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { isLoaded, updateHero, removeHero, addCredits, language } = useGameState();
  const { toast } = useToast();
  const isResolvingRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || isUserLoading || !user || isResolvingRef.current) return;

    const resolveMySales = async () => {
      isResolvingRef.current = true;
      try {
        const q = query(
          collection(db, 'market_v2'),
          where('sellerId', '==', user.uid)
        );
        
        const snapshot = await getDocs(q);
        const now = new Date();

        for (const marketDoc of snapshot.docs) {
          const data = marketDoc.data();
          const expiresAt = new Date(data.expiresAt);

          // Check if expired
          if (now > expiresAt) {
            const heroId = data.heroData.id;
            
            if (data.highestBidderId) {
              // SOLD!
              addCredits(data.currentBid);
              removeHero(heroId, 0);
              
              toast({
                title: language === 'ru' ? "Игрок продан!" : "Player Sold!",
                description: `${data.heroData.name} продан за €${data.currentBid.toLocaleString()}`
              });
            } else {
              // NOT SOLD - return to club
              updateHero(heroId, { onTransferUntil: null, transferMarketId: null });
              
              toast({
                title: language === 'ru' ? "Аукцион завершен" : "Auction Ended",
                description: `${data.heroData.name} остается в клубе (ставок нет).`
              });
            }

            // Clean up market entry
            await deleteDoc(doc(db, 'market_v2', marketDoc.id));
          }
        }
      } catch (e) {
        console.error("Transfer resolution failed", e);
      } finally {
        isResolvingRef.current = false;
      }
    };

    // Check every 30 seconds for testing
    const timer = setTimeout(resolveMySales, 2000);
    const interval = setInterval(resolveMySales, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [isLoaded, isUserLoading, user, db, addCredits, removeHero, updateHero, language, toast]);

  return null;
}
