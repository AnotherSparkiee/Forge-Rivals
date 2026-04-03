
'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Swords, Loader2, Timer, Zap, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePathname } from 'next/navigation';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { INITIAL_HEROES } from '@/app/lib/moba-data';

function sanitizeForFirestore(obj: any) {
  return JSON.parse(JSON.stringify(obj));
}

export function CWBasketListener() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const pathname = usePathname();
  const { language, strategy, team, recordMatch, ownedHeroes, lineup } = useGameState();
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const notifiedMatchIdRef = useRef<string | null>(null);
  const isSimulatingRef = useRef(false);

  const myEntryRef = useMemoFirebase(() => user ? doc(db, 'cw_basket', user.uid) : null, [db, user]);
  const { data: myEntry } = useDoc(myEntryRef);

  useEffect(() => {
    if (myEntry?.status === 'matched' && myEntry.matchStartTime) {
      const currentMatchId = myEntry.matchStartTime;

      if (notifiedMatchIdRef.current !== currentMatchId) {
        if (pathname !== '/tournaments/cw-basket') {
          setShowModal(true);
        }
        notifiedMatchIdRef.current = currentMatchId;
      }

      if (!isSimulatingRef.current) {
        const startTime = new Date(myEntry.matchStartTime).getTime();
        
        const checkAndSimulate = async () => {
          if (Date.now() >= startTime && !isSimulatingRef.current) {
            isSimulatingRef.current = true;
            try {
              const squad = ownedHeroes.filter(h => Object.values(lineup).includes(h.id)).map(h => ({
                ...h,
                isSub: h.id === lineup.sub1 || h.id === lineup.sub2
              }));

              const result = await simulateMobaMatch({
                teamA: { name: myEntry.userName || "My Team", strategy, heroes: squad },
                teamB: { 
                  name: myEntry.matchedWithName || "Rival Manager", 
                  strategy: "Balanced Play", 
                  heroes: INITIAL_HEROES.map((h, i) => ({ ...h, isSub: i > 4 }))
                },
                isBo2: false
              });

              recordMatch(
                result.winner, 
                sanitizeForFirestore(result), 
                0, 
                myEntry.matchedWithName, 
                'basket',
                new Date().toISOString()
              );

              toast({
                title: language === 'ru' ? "КВ матч завершен" : "CW match finished",
                description: language === 'ru' ? `Результаты боя против ${myEntry.matchedWithName} сохранены.` : `Battle results vs ${myEntry.matchedWithName} archived.`,
              });

              await deleteDoc(doc(db, 'cw_basket', user!.uid));
            } catch (e) {
              console.error("CW Auto-sim failed", e);
            } finally {
              isSimulatingRef.current = false;
            }
          }
        };

        const timer = setInterval(checkAndSimulate, 10000);
        checkAndSimulate();
        return () => clearInterval(timer);
      }
    } else if (myEntry?.status !== 'matched') {
      notifiedMatchIdRef.current = null;
      setShowModal(false);
    }
  }, [myEntry, pathname, strategy, team, recordMatch, language, user, db, toast]);

  const handleAcknowledge = () => {
    setShowModal(false);
  };

  const t = {
    title: language === 'ru' ? "БОЙ ЗАПЛАНИРОВАН" : "ENGAGEMENT SCHEDULED",
    desc: language === 'ru' ? "Система КВ нашла вам соперника. Подготовка начнется немедленно." : "CW System has secured an opponent. Deployment sequence initiated.",
    opponent: language === 'ru' ? "СОПЕРНИК" : "OPPONENT",
    time: language === 'ru' ? "НАЧАЛО ЧЕРЕЗ 15 МИНУТ" : "STARTS IN 15 MINUTES",
    close: language === 'ru' ? "ПОНЯЛ" : "ACKNOWLEDGED",
  };

  if (!myEntry || myEntry.status !== 'matched') return null;

  return (
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogContent className="max-w-sm bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
        <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5">
          <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]">
            <Swords className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-bold">
            {t.desc}
          </DialogDescription>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-secondary/30 rounded-xl border border-white/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[8px] uppercase font-black text-muted-foreground">{t.opponent}</p>
                <p className="text-sm font-headline font-bold text-white uppercase italic">{myEntry.matchedWithName}</p>
              </div>
            </div>
            <Zap className="w-4 h-4 text-accent animate-bounce" />
          </div>

          <div className="p-3 bg-accent/5 rounded-lg border border-accent/20 flex items-center justify-center gap-2">
            <Timer className="w-4 h-4 text-accent" />
            <span className="text-[10px] font-black text-accent uppercase tracking-widest">{t.time}</span>
          </div>
        </div>

        <DialogFooter className="p-4 bg-secondary/20 border-t border-white/5">
          <Button 
            className="w-full h-12 hero-gradient font-bold uppercase text-xs tracking-widest" 
            onClick={handleAcknowledge}
          >
            {t.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
