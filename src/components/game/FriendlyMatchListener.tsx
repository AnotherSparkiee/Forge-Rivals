'use client';

/**
 * @fileOverview Слушатель товарищеских и пробных матчей v11.
 * Резолвит бои на основе реальных характеристик без предварительного форсирования результата.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useFirestore, addDocumentNonBlocking } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, collection, query, where, setDoc, getDoc, getDocs } from 'firebase/firestore';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Swords, Loader2, XCircle, ShieldCheck } from 'lucide-react';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { generateBotSquad } from '@/app/lib/moba-data';
import { useToast } from '@/hooks/use-toast';
import { useRouter, usePathname } from 'next/navigation';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

const FRIENDLY_DURATION_MS = 60 * 1000; 
const TRIAL_DURATION_MS = 1000;

function sanitizeForFirestore(obj: any) {
  if (!obj) return null;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return null;
  }
}

export function FriendlyMatchListener() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const pathname = usePathname();
  const { 
    language, strategy, recordMatch, ownedPlayers, lineup, 
    matchHistory, bootcamp, staff 
  } = useGameState();
  const { toast } = useToast();

  const [activeLobby, setActiveLobby] = useState<any | null>(null);
  const [challengeResult, setChallengeResult] = useState<any | null>(null);
  const [isProcessing, setIsActionLoading] = useState(false);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  
  const handledChallengeIdRef = useRef<string | null>(null);
  const isSimulatingRef = useRef(false);

  const sendNotification = useCallback((targetUserId: string, title: string, description: string) => {
    addDocumentNonBlocking(collection(db, 'notifications_v7'), {
      userId: targetUserId, title, description, type: 'match', read: false, createdAt: new Date().toISOString()
    });
  }, [db]);

  useEffect(() => {
    if (isUserLoading || !user) return;
    const lobbyRef = doc(db, 'friendly_lobbies_v3', user.uid);
    return onSnapshot(lobbyRef, (docSnap) => {
      if (docSnap.exists()) setActiveLobby({ ...docSnap.data(), id: docSnap.id });
      else setActiveLobby(null);
    });
  }, [user, isUserLoading, db]);

  useEffect(() => {
    if (isUserLoading || !user) return;
    const q = query(collection(db, 'friendly_lobbies_v3'), where('challengerId', '==', user.uid));
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) setChallengeResult({ ...snapshot.docs[0].data(), id: snapshot.docs[0].id });
      else setChallengeResult(null);
    });
  }, [user, isUserLoading, db]);

  useEffect(() => {
    if (activeLobby?.status === 'challenged') {
      const challengeId = activeLobby.updatedAt?.toMillis()?.toString() || 'init';
      if (handledChallengeIdRef.current !== challengeId) {
        setShowChallengeModal(true);
        handledChallengeIdRef.current = challengeId;
      }
    } else if (activeLobby?.status !== 'challenged') {
      setShowChallengeModal(false);
      handledChallengeIdRef.current = null;
    }
  }, [activeLobby]);

  useEffect(() => {
    const data = activeLobby || challengeResult;
    if (!data || !user) return;

    const isHost = data.hostId === user.uid;

    if (data.status === 'accepted' && data.matchResult) {
      const acceptedAt = data.acceptedAt?.toMillis() || Date.now(); 
      const matchType = data.isTrial ? 'trial' : 'friendly';
      const matchUniqueId = `${matchType}_${data.id}_${acceptedAt}`;
      const duration = data.isTrial ? TRIAL_DURATION_MS : FRIENDLY_DURATION_MS;
      const finishTime = acceptedAt + duration;
      
      const checkAndComplete = async () => {
        if (isSimulatingRef.current) return;
        if (Date.now() >= finishTime) {
          if (matchHistory.some(m => m.id === matchUniqueId)) {
            if (isHost) await deleteDoc(doc(db, 'friendly_lobbies_v3', data.id)).catch(() => {});
            return;
          }

          isSimulatingRef.current = true;
          try {
            const result = data.matchResult;
            const seriesScoreParts = result.seriesScore.split('-');
            const winsA = parseInt(seriesScoreParts[0]);
            const winsB = parseInt(seriesScoreParts[1]);
            const myScoreA = isHost ? winsA : winsB;
            const myScoreB = isHost ? winsB : winsA;
            const opponentName = isHost ? (data.challengerName || "Rival") : (data.hostName || "Host");
            const myName = isHost ? data.hostName : data.challengerName;
            
            const matchRecord = {
              id: matchUniqueId,
              scoreA: myScoreA, scoreB: myScoreB, status: 'finished', isFinished: true,
              homeName: data.hostName, awayName: data.challengerName, simulation: result,
              type: matchType, playedAt: new Date().toISOString(), version: 32
            };

            await setDoc(doc(db, 'matches_v1', matchUniqueId), matchRecord, { merge: true });

            recordMatch(
              myScoreA > myScoreB ? myName : (myScoreA === myScoreB ? "Draw" : opponentName), 
              { ...result.games[0], scoreA: myScoreA, scoreB: myScoreB, seriesScore: `${myScoreA}-${myScoreB}`, games: result.games, homeName: data.hostName, awayName: data.challengerName }, 
              0, opponentName, matchType, new Date().toISOString(), matchUniqueId
            );
            
            toast({ title: language === 'ru' ? "Матч завершен" : "Match Finished" });
            if (isHost) await deleteDoc(doc(db, 'friendly_lobbies_v3', data.id)).catch(() => {});
          } catch (e) { 
            console.error("Match resolution failed", e); 
          } finally { 
            isSimulatingRef.current = false; 
          }
        }
      };
      const timer = setInterval(checkAndComplete, 2000);
      checkAndComplete();
      return () => clearInterval(timer);
    }
  }, [activeLobby, challengeResult, user, language, recordMatch, db, toast, matchHistory]);

  const handleHostRespond = async (accept: boolean) => {
    if (!activeLobby) return;
    setIsActionLoading(true);
    try {
      const lobbyRef = doc(db, 'friendly_lobbies_v3', activeLobby.id);
      if (accept) {
        const squadA = ownedPlayers.filter(p => Object.values(lineup).includes(p.id)).map(p => ({
          name: p.name, role: p.role, overallRating: p.overallRating, proStats: p.proStats,
          isSub: p.id === lineup.sub1 || p.id === lineup.sub2
        }));

        if (squadA.length < 5) {
          toast({ title: language === 'ru' ? "Недостаточно игроков в основе" : "Incomplete Core Squad", variant: "destructive" });
          setIsActionLoading(false);
          setShowChallengeModal(false);
          return;
        }

        const infraBonusA = (bootcamp?.bootcampLevel || 0) + (bootcamp?.tacticsHallLevel || 0);
        const staffBonusA = (staff?.coach?.skills?.primary || 0);

        let squadB: any[] = [];
        let strategyB = "Balanced Play";
        let infraBonusB = 0;
        let staffBonusB = 0;

        if (activeLobby.isTrial) {
          squadB = generateBotSquad(28);
          infraBonusB = 5;
          staffBonusB = 5;
        } else {
          const challengerProfileSnap = await getDoc(doc(db, 'players_v10', activeLobby.challengerId));
          if (challengerProfileSnap.exists()) {
            const cp = challengerProfileSnap.data();
            const info = getGlobalSeasonInfo();
            const seasonId = `season_${info.activeSeasonNumber}`;
            const prefixedGroupId = `${seasonId}_league_${cp.selectedLeagueId}_group_${cp.groupId}`;
            const challengerTeamRef = doc(db, 'leagues_v2', cp.selectedLeagueId, 'divisions', String(cp.leagueLevel), 'groups', prefixedGroupId, 'teams', activeLobby.challengerId);
            
            const [teamSnap, heroesSnap] = await Promise.all([
              getDoc(challengerTeamRef),
              getDocs(collection(challengerTeamRef, 'heroes'))
            ]);

            if (teamSnap.exists()) {
              const td = teamSnap.data();
              strategyB = td.strategy || "Balanced Play";
              infraBonusB = (td.bootcamp?.bootcampLevel || 0) + (td.bootcamp?.tacticsHallLevel || 0);
              staffBonusB = (td.staff?.coach?.skills?.primary || 0);
              
              const cLineup = td.lineup || {};
              const allHeroes = heroesSnap.docs.map(d => ({ ...d.data(), id: d.id }));
              squadB = allHeroes.filter(h => Object.values(cLineup).includes(h.id)).map((h: any) => ({
                name: h.name, role: h.role, overallRating: h.overallRating, proStats: h.proStats,
                isSub: h.id === cLineup.sub1 || h.id === cLineup.sub2
              }));
            }
          }
        }

        if (squadB.length < 5) squadB = generateBotSquad(22);

        // НЕ форсируем результат, позволяем симулятору рассчитать честный итог
        const result = await simulateMobaMatch({
          teamA: { name: activeLobby.hostName, strategy, heroes: squadA, infraBonus: infraBonusA, staffBonus: staffBonusA },
          teamB: { name: activeLobby.challengerName || "Rival", strategy: strategyB, heroes: squadB, infraBonus: infraBonusB, staffBonus: staffBonusB },
          isBo2: true
        });
        
        await updateDoc(lobbyRef, { 
          status: 'accepted', 
          matchResult: sanitizeForFirestore(result), 
          acceptedAt: serverTimestamp(), 
          updatedAt: serverTimestamp() 
        });

        if (activeLobby.challengerId && !activeLobby.challengerId.startsWith('sys_')) {
          sendNotification(activeLobby.challengerId, language === 'ru' ? "Вызов принят!" : "Challenge Accepted!", `${activeLobby.hostName} готов к бою.`);
        }
      } else {
        await updateDoc(lobbyRef, { status: 'rejected', updatedAt: serverTimestamp() });
      }
    } catch (e) {
      console.error("Friendly Match Engine failed", e);
      toast({ variant: "destructive", title: "Match Sync Failed" });
    } finally { 
      setIsActionLoading(false); 
      setShowChallengeModal(false); 
    }
  };

  const t = {
    hostTitle: language === 'ru' ? "ПОЛУЧЕН ВЫЗОВ" : "CHALLENGE RECEIVED",
    hostDesc: language === 'ru' ? `Менеджер ${activeLobby?.challengerName} запрашивает тактическую проверку.` : `Manager ${activeLobby?.challengerName} requests tactical verification.`,
    accept: language === 'ru' ? "ПРИНЯТЬ" : "ACCEPT", decline: language === 'ru' ? "ОТКЛОНИТЬ" : "DECLINE",
  };

  return (
    <Dialog open={showChallengeModal} onOpenChange={setShowChallengeModal}>
      <DialogContent className="max-w-xs bg-card border-white/10 p-6">
        <DialogHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 border border-primary/20"><Swords className="w-8 h-8 text-primary animate-pulse" /></div>
          <DialogTitle className="text-center font-headline font-bold uppercase text-primary">{t.hostTitle}</DialogTitle>
          <DialogDescription className="text-center text-xs text-muted-foreground mt-2">{t.hostDesc}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-6">
          <Button className="hero-gradient font-bold uppercase text-[10px] h-12" onClick={() => handleHostRespond(true)} disabled={isProcessing}>{isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}{t.accept}</Button>
          <Button variant="outline" className="font-bold uppercase text-[10px] h-12 border-white/10" onClick={() => handleHostRespond(false)} disabled={isProcessing}><XCircle className="w-4 h-4 mr-2 text-red-400" />{t.decline}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
