
'use client';

/**
 * @fileOverview Монитор матчей (Passive Sync).
 * Слушает коллекцию matches_v1. Клиент БОЛЬШЕ не симулирует матчи.
 * Движок симуляции перенесен в Cloud Functions (Source of Truth).
 */

import { useState, useEffect } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { 
  Dialog, DialogContent, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Swords, Trophy } from 'lucide-react';

export function AutoMatchManager() {
  const { isLoaded, selectedLeagueId, leagueLevel, groupId, id: userId } = useGameState();
  const db = useFirestore();
  const router = useRouter();
  
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [lastMatch, setLastMatch] = useState<any | null>(null);

  // Слушаем только ЗАВЕРШЕННЫЕ матчи для данной группы
  const matchQuery = useMemoFirebase(() => {
    if (!selectedLeagueId || !userId) return null;
    return query(
      collection(db, 'matches_v1'),
      where('leagueId', '==', selectedLeagueId),
      where('divisionId', '==', leagueLevel),
      where('groupId', '==', groupId),
      where('status', '==', 'finished'),
      orderBy('startTime', 'desc'),
      limit(1)
    );
  }, [db, selectedLeagueId, leagueLevel, groupId, userId]);

  const { data: matches } = useCollection(matchQuery);

  useEffect(() => {
    if (matches && matches.length > 0) {
      const match = matches[0];
      const isMyMatch = match.homeId === userId || match.awayId === userId;
      
      // Показываем уведомление, если матч свежий (в пределах последнего часа)
      const matchTime = new Date(match.startTime).getTime();
      const now = Date.now();
      
      if (isMyMatch && (now - matchTime < 3600000) && lastMatch?.id !== match.id) {
        setLastMatch(match);
        setShowResultDialog(true);
      }
    }
  }, [matches, userId, lastMatch]);

  if (!isLoaded || !selectedLeagueId) return null;

  return (
    <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
      <DialogContent className="max-w-sm bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
        <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
          <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]">
            <Trophy className="w-8 h-8 text-primary animate-bounce" />
          </div>
          <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">OFFICIAL RESULT</DialogTitle>
          <DialogDescription className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-black">
            The league has finalized your recent engagement.
          </DialogDescription>
        </div>
        <div className="p-6">
           <Button 
            className="w-full h-14 hero-gradient font-black text-xs tracking-widest" 
            onClick={() => { 
              setShowResultDialog(false); 
              router.push(`/match?id=${lastMatch?.id}`); 
            }}
           >
             VIEW TACTICAL DEBRIEF
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
