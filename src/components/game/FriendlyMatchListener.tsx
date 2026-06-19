'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useFirestore, addDocumentNonBlocking } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, collection, query, where } from 'firebase/firestore';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Swords, Loader2, XCircle, ShieldCheck } from 'lucide-react';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { generateBotSquad } from '@/app/lib/moba-data';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getMatchResult } from '@/app/lib/leagues-data';

const MATCH_DURATION_MS = 15 * 60 * 1000; 
const TRIAL_DURATION_MS = 1000; // Instant trial for testing
const LOBBY_EXPIRATION_MS = 60 * 1000; 

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
  const router = useRouter();
  const { language, strategy, recordMatch, ownedHeroes, lineup, matchHistory, displayName } = useGameState();
  const { toast } = useToast();

  const [activeLobby, setActiveLobby] = useState<any | null>(null);
  const [challengeResult, setChallengeResult] = useState<any | null>(null);
  const [isProcessing, setIsActionLoading] = useState(false);
  
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  
  const handledChallengeIdRef = useRef<string | null>(null);
  const isSimulatingRef = useRef(false);

  const sendNotification = useCallback((targetUserId: string, title: string, description: string) => {
    addDocumentNonBlocking(collection(db, 'notifications_v7'), {
      userId: targetUserId,
      title,
      description,
      type: 'match',
      read: false,
      createdAt: new Date().toISOString()
    });
  }, [db]);

  useEffect(() => {
    if (isUserLoading || !user) return;
    const lobbyRef = doc(db, 'friendly_lobbies_v3', user.uid);
    const unsubscribe = onSnapshot(lobbyRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setActiveLobby({ ...data, id: docSnap.id });
      } else {
        setActiveLobby(null);
      }
    });
    return () => unsubscribe();
  }, [user, isUserLoading, db]);

  useEffect(() => {
    if (isUserLoading || !user) return;
    const q = query(
      collection(db, 'friendly_lobbies_v3'), 
      where('challengerId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setChallengeResult({ ...data, id: snapshot.docs[0].id });
      } else {
        setChallengeResult(null);
      }
    });
    return () => unsubscribe();
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

    if (data.status === 'searching' && isHost) {
      const createdAt = data.updatedAt?.toMillis() || Date.now();
      const checkExpiration = () => {
        if (Date.now() - createdAt > LOBBY_EXPIRATION_MS) {
          deleteDoc(doc(db, 'friendly_lobbies_v3', data.id)).catch(() => {});
          toast({
            title: language === 'ru' ? "Заявка истекла" : "Request Expired",
            description: language === 'ru' ? "Никто не принял ваш вызов в течение минуты." : "No one accepted your challenge within a minute.",
            variant: "destructive"
          });
        }
      };
      const expirationTimer = setInterval(checkExpiration, 10000);
      return () => clearInterval(expirationTimer);
    }

    if (data.status === 'rejected') {
      if (!isHost) {
        toast({
          title: language === 'ru' ? "Вызов отклонен" : "Challenge Rejected",
          description: language === 'ru' ? `Менеджер ${data.hostName} отклонил ваш вызов.` : `Manager ${data.hostName} rejected your challenge.`,
          variant: "destructive"
        });
      }
      if (isHost) {
        deleteDoc(doc(db, 'friendly_lobbies_v3', data.id)).catch(() => {});
      }
      return;
    }

    if (data.status === 'accepted' && data.matchResult) {
      const acceptedAt = data.acceptedAt?.toMillis() || Date.now(); 
      const matchType = data.isTrial ? 'trial' : 'friendly';
      const matchUniqueId = `${matchType}_${data.id}_${acceptedAt}`;
      
      const alreadyProcessed = matchHistory.some(m => m.id === matchUniqueId);
      if (alreadyProcessed) {
        if (isHost) deleteDoc(doc(db, 'friendly_lobbies_v3', data.id)).catch(() => {});
        return;
      }

      const duration = data.isTrial ? TRIAL_DURATION_MS : MATCH_DURATION_MS;
      const finishTime = acceptedAt + duration;
      
      const checkAndComplete = async () => {
        if (isSimulatingRef.current) return;
        const now = Date.now();

        if (now >= finishTime) {
          isSimulatingRef.current = true;
          try {
            const result = data.matchResult;
            
            const seriesScoreParts = result.seriesScore.split('-');
            const winsA = parseInt(seriesScoreParts[0]);
            const winsB = parseInt(seriesScoreParts[1]);

            const myScoreA = isHost ? winsA : winsB;
            const myScoreB = isHost ? winsB : winsA;
            
            const opponentName = isHost ? (data.challengerName || "Rival") : (data.hostName || "Host");
            
            recordMatch(
              myScoreA > myScoreB ? (isHost ? data.hostName : data.challengerName) : (myScoreA === myScoreB ? "Draw" : opponentName), 
              { ...result.games[0], scoreA: myScoreA, scoreB: myScoreB, seriesScore: `${myScoreA}-${myScoreB}`, games: result.games }, 
              0, 
              opponentName, 
              matchType, 
              new Date().toISOString(), 
              matchUniqueId
            );
            
            toast({
              title: language === 'ru' ? "Матч завершен" : "Match Finished",
              description: language === 'ru' ? `Отчет боя против ${opponentName} готов.` : `Battle report vs ${opponentName} is ready.`,
            });

            if (isHost) {
              await deleteDoc(doc(db, 'friendly_lobbies_v3', data.id)).catch(() => {});
            }
          } catch (e) {
            console.error("Friendly completion error:", e);
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
        const squad = ownedHeroes
          .filter(h => Object.values(lineup).includes(h.id))
          .map(h => ({
            name: h.name,
            role: h.role,
            overallRating: h.overallRating,
            proStats: h.proStats,
            isSub: h.id === lineup.sub1 || h.id === lineup.sub2
          }));

        if (squad.length < 5) {
          toast({ 
            title: language === 'ru' ? "Недостаточно игроков" : "Incomplete Squad", 
            description: language === 'ru' ? "В активном составе должно быть минимум 5 героев." : "At least 5 heroes required in active lineup.",
            variant: "destructive" 
          });
          setIsActionLoading(false);
          setShowChallengeModal(false);
          return;
        }

        const botSquad = generateBotSquad(25);

        const [finalScoreA, finalScoreB] = getMatchResult(activeLobby.hostId, activeLobby.challengerId || "bot", 0, 1);

        const result = await simulateMobaMatch({
          teamA: { name: activeLobby.hostName, strategy: strategy, heroes: squad },
          teamB: { 
            name: activeLobby.challengerName || "AI Trainer", 
            strategy: "Balanced Play", 
            heroes: botSquad
          },
          isBo2: true,
          scoreA: finalScoreA,
          scoreB: finalScoreB
        });
        
        await updateDoc(lobbyRef, {
          status: 'accepted',
          matchResult: sanitizeForFirestore(result),
          acceptedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        if (activeLobby.challengerId && activeLobby.challengerId !== 'sys_bot' && activeLobby.challengerId !== 'sys_bot_trainer') {
          sendNotification(
            activeLobby.challengerId,
            language === 'ru' ? "Вызов принят!" : "Challenge Accepted!",
            language === 'ru' ? `Менеджер ${activeLobby.hostName} готов к бою.` : `Manager ${activeLobby.hostName} is ready for battle.`
          );
        }

        toast({
          title: language === 'ru' ? "Матч начат" : "Match Started",
          description: language === 'ru' ? "Игра отображается на главной странице." : "Match is visible on the home page.",
        });
      } else {
        await updateDoc(lobbyRef, {
          status: 'rejected',
          updatedAt: serverTimestamp()
        });
      }
    } catch (e: any) {
      console.error("Match start failed:", e);
      toast({ title: "Failed to start match", description: e.message, variant: "destructive" });
    } finally {
      setIsActionLoading(false);
      setShowChallengeModal(false);
    }
  };

  const t = {
    hostTitle: language === 'ru' ? "ПОЛУЧЕН ВЫЗОВ" : "CHALLENGE RECEIVED",
    hostDesc: language === 'ru' ? `Менеджер ${activeLobby?.challengerName} хочет провести матч.` : `Manager ${activeLobby?.challengerName} wants a match.`,
    accept: language === 'ru' ? "ПРИНЯТЬ" : "ACCEPT",
    decline: language === 'ru' ? "ОТКЛОНИТЬ" : "DECLINE",
  };

  return (
    <>
      <Dialog open={showChallengeModal} onOpenChange={setShowChallengeModal}>
        <DialogContent className="max-w-xs bg-card border-white/10 p-6">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 border border-primary/20">
              <Swords className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <DialogTitle className="text-center font-headline font-bold uppercase tracking-tight text-primary">
              {t.hostTitle}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground mt-2">
              {t.hostDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-6">
            <Button 
              className="hero-gradient font-bold uppercase text-[10px] h-12" 
              onClick={() => handleHostRespond(true)}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              {t.accept}
            </Button>
            <Button 
              variant="outline" 
              className="font-bold uppercase text-[10px] h-12 border-white/10" 
              onClick={() => handleHostRespond(false)}
              disabled={isProcessing}
            >
              <XCircle className="w-4 h-4 mr-2 text-red-400" />
              {t.decline}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
