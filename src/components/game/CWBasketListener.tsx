'use client';

/**
 * @fileOverview Слушатель КВ Корзины v12.4 (Selective Fatigue).
 * Исправлено: списание энергии только у основы.
 */

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState, LineupSlot } from '@/app/lib/store';
import { doc, deleteDoc, serverTimestamp, getDoc, increment, writeBatch } from 'firebase/firestore';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Swords, Loader2, Timer, Zap, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePathname } from 'next/navigation';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { generateBotSquad } from '@/app/lib/moba-data';
import { getMatchResult } from '@/app/lib/leagues-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

function sanitizeForFirestore(obj: any) {
  if (!obj) return null;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return null;
  }
}

export function CWBasketListener() {
  const { user } = useUser();
  const db = useFirestore();
  const pathname = usePathname();
  const { 
    language, strategy, recordMatch, ownedPlayers, lineup, 
    matchHistory, clubLogo, selectedLeagueId, leagueLevel, groupId, rank 
  } = useGameState();
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const notifiedMatchIdRef = useRef<string | null>(null);
  const isSimulatingRef = useRef(false);

  const myEntryRef = useMemoFirebase(() => user ? doc(db, 'cw_basket_v2', user.uid) : null, [db, user]);
  const { data: myEntry } = useDoc(myEntryRef);

  useEffect(() => {
    if (!user || !myEntry || myEntry.status !== 'matched' || !myEntry.matchStartTime) {
      notifiedMatchIdRef.current = null;
      setShowModal(false);
      return;
    }

    const currentMatchId = myEntry.matchStartTime;

    if (notifiedMatchIdRef.current !== currentMatchId) {
      const alreadyRecorded = matchHistory.some(m => m.id === currentMatchId);
      if (pathname !== '/tournaments/cw-basket' && !alreadyRecorded) {
        setShowModal(true);
      }
      notifiedMatchIdRef.current = currentMatchId;
    }

    const startTime = new Date(myEntry.matchStartTime).getTime();
    
    const checkAndSimulate = async () => {
      if (!user || isSimulatingRef.current) return;
      const now = Date.now();

      if (now >= startTime) {
        const alreadyRecorded = matchHistory.some(m => m.id === currentMatchId);
        if (alreadyRecorded) {
          await deleteDoc(doc(db, 'cw_basket_v2', user.uid));
          return;
        }

        isSimulatingRef.current = true;
        try {
          const squad = ownedPlayers.filter(h => Object.values(lineup).includes(h.id)).map(h => ({
            name: h.name, role: h.role, overallRating: h.overallRating, proStats: h.proStats,
            image: h.image, form: h.form, fatigue: h.fatigue,
            isSub: h.id === lineup.sub1 || h.id === lineup.sub2
          }));

          const rivalSquad = generateBotSquad(10);

          let rivalLogo = null;
          if (myEntry.matchedWithId) {
            const rivalSnap = await getDoc(doc(db, 'players_v10', myEntry.matchedWithId));
            if (rivalSnap.exists()) {
              rivalLogo = rivalSnap.data().clubLogo || null;
            }
          }

          const [finalScoreA, finalScoreB] = getMatchResult(user.uid, myEntry.matchedWithId || "rival", 0, false);

          const result = await simulateMobaMatch({
            teamA: { name: myEntry.userName || "My Team", strategy, heroes: squad },
            teamB: { 
              name: myEntry.matchedWithName || "Rival Manager", 
              strategy: "Balanced Play", 
              heroes: rivalSquad
            },
            isBo2: true,
            scoreA: finalScoreA,
            scoreB: finalScoreB
          });

          const safeResult = sanitizeForFirestore(result);
          if (!safeResult) throw new Error("Simulation failed");

          const seriesScoreParts = safeResult.seriesScore.split('-');
          const winsA = parseInt(seriesScoreParts[0]);
          const winsB = parseInt(seriesScoreParts[1]);

          recordMatch(
            safeResult.winner, 
            { ...safeResult.games[0], scoreA: winsA, scoreB: winsB, seriesScore: safeResult.seriesScore, games: safeResult.games, homeName: myEntry.userName, awayName: myEntry.matchedWithName }, 
            0, 
            myEntry.matchedWithName, 
            'basket',
            new Date().toISOString(),
            currentMatchId,
            { homeId: user.uid, awayId: myEntry.matchedWithId, homeLogo: clubLogo, awayLogo: rivalLogo }
          );

          // СПИСАНИЕ УСТАЛОСТИ - ТОЛЬКО ДЛЯ ОСНОВЫ
          const batch = writeBatch(db);
          const info = getGlobalSeasonInfo();
          const seasonId = `season_${info.activeSeasonNumber}`;
          const prefixedGroupId = `${seasonId}_league_${selectedLeagueId}_group_${groupId}`;
          const teamRef = doc(db, 'leagues_v2', selectedLeagueId!, 'divisions', String(leagueLevel), 'groups', prefixedGroupId, 'teams', user.uid);
          
          const fatigueLoss = 12 + Math.floor(Math.random() * 8);
          const coreSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
          coreSlots.forEach(slot => {
            const pId = lineup[slot];
            if (pId) {
              const heroRef = doc(teamRef, 'heroes', pId);
              batch.update(heroRef, { fatigue: increment(-fatigueLoss) });
            }
          });
          await batch.commit();

          toast({
            title: language === 'ru' ? "КВ матч завершен" : "CW match finished",
            description: language === 'ru' ? `Результаты боя против ${myEntry.matchedWithName} сохранены.` : `Battle results vs ${myEntry.matchedWithName} archived.`,
          });

          await deleteDoc(doc(db, 'cw_basket_v2', user.uid));
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
  }, [user, myEntry, pathname, strategy, recordMatch, language, db, toast, matchHistory, ownedPlayers, lineup, clubLogo, selectedLeagueId, leagueLevel, groupId]);

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
          <div className="mx-auto w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]">
            <Swords className="w-6 h-6 text-primary animate-pulse" />
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
            className="w-full h-12 hero-gradient font-black text-xs tracking-widest" 
            onClick={handleAcknowledge}
          >
            {t.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
