'use client';

import { useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc, collection, query, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

/**
 * BACKGROUND RESOLVER for Transfer Market.
 * Checks for expired auctions where the user is the seller.
 * If bid exists -> transfer money and remove hero.
 * If no bid exists -> return hero to normal.
 */
export function TransferResolver() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { isLoaded, ownedHeroes, youthAcademyHeroes, updateHero, removeHero, addCredits, language } = useGameState();
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

          if (now > expiresAt) {
            const heroId = data.heroData.id;
            const isJunior = data.isYouth === true;
            
            if (data.highestBidderId) {
              // SOLD!
              // 1. Give money to seller
              addCredits(data.currentBid);
              
              // 2. Remove hero from seller's rosters
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

    // Check every 5 minutes or on load
    resolveMySales();
    const interval = setInterval(resolveMySales, 300000);
    return () => clearInterval(interval);
  }, [isLoaded, isUserLoading, user, db, addCredits, removeHero, updateHero, language, toast]);

  return null;
}