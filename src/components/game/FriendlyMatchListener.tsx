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
import { getRandomStartingSquad } from '@/app/lib/moba-data';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const MATCH_DURATION_MS = 15 * 60 * 1000; 
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
  const { language, team, strategy, recordMatch, ownedHeroes, lineup, matchHistory } = useGameState();
  const { toast } = useToast();

  const [activeLobby, setActiveLobby] = useState<any | null>(null);
  const [challengeResult, setChallengeResult] = useState<any | null>(null);
  const [isProcessing, setIsActionLoading] = useState(false);
  
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  
  const handledChallengeIdRef = useRef<string | null>(null);
  const isSimulatingRef = useRef(false);

  const sendNotification = useCallback((targetUserId: string, title: string, description: string) => {
    addDocumentNonBlocking(collection(db, 'notifications_v1'), {
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
    const lobbyRef = doc(db, 'friendly_lobbies', user.uid);
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
      collection(db, 'friendly_lobbies'), 
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
        
        sendNotification(
          activeLobby.hostId, 
          language === 'ru' ? "Получен вызов!" : "Challenge Received!", 
          language === 'ru' ? `Менеджер ${activeLobby.challengerName} бросил вам вызов.` : `Manager ${activeLobby.challengerName} challenged you.`
        );
      }
    } else if (activeLobby?.status !== 'challenged') {
      setShowChallengeModal(false);
      handledChallengeIdRef.current = null;
    }
  }, [activeLobby, language, sendNotification]);

  useEffect(() => {
    const data = activeLobby || challengeResult;
    if (!data || !user) return;

    const isHost = data.hostId === user.uid;

    if (data.status === 'searching' && isHost) {
      const createdAt = data.updatedAt?.toMillis() || Date.now();
      const checkExpiration = () => {
        if (Date.now() - createdAt > LOBBY_EXPIRATION_MS) {
          deleteDoc(doc(db, 'friendly_lobbies', data.id)).catch(() => {});
          toast({
            title: language === 'ru' ? "Заявка истекла" : "Request Expired",
            description: language === 'ru' ? "Никто не принял ваш вызов в течение минуты." : "No one accepted your challenge within a minute.",
            variant: "destructive"
          });
        }
      };
      const expirationTimer = setInterval(checkExpiration, 5000);
      return () => clearInterval(expirationTimer);
    }

    if (data.status === 'rejected') {
      if (!isHost) {
        toast({
          title: language === 'ru' ? "Вызов отклонен" : "Challenge Rejected",
          description: language === 'ru' ? `Менеджер ${data.hostName} отклонил ваш вызов.` : `Manager ${data.hostName} declined your challenge.`,
          variant: "destructive"
        });
      }
      if (isHost) {
        deleteDoc(doc(db, 'friendly_lobbies', data.id)).catch(() => {});
      }
      return;
    }

    if (data.status === 'accepted' && data.matchResult) {
      const acceptedAt = data.acceptedAt?.toMillis() || Date.now(); 
      const matchType = data.isTrial ? 'trial' : 'friendly';
      const matchUniqueId = `${matchType}_${data.id}_${acceptedAt}`;
      
      const alreadyProcessed = matchHistory.some(m => m.id === matchUniqueId);
      if (alreadyProcessed) {
        if (isHost) deleteDoc(doc(db, 'friendly_lobbies', data.id)).catch(() => {});
        return;
      }

      const finishTime = acceptedAt + MATCH_DURATION_MS;
      
      const checkAndComplete = async () => {
        if (isSimulatingRef.current) return;
        const now = Date.now();

        if (now >= finishTime) {
          if (matchHistory.some(m => m.id === matchUniqueId)) {
            if (isHost) deleteDoc(doc(db, 'friendly_lobbies', data.id)).catch(() => {});
            return;
          }

          isSimulatingRef.current = true;
          const result = data.matchResult;
          const finalResult = isHost ? result : {
            ...result,
            scoreA: result.scoreB,
            scoreB: result.scoreA,
            winner: result.winner === data.hostName ? data.hostName : (result.winner === "Draw" ? "Draw" : data.challengerName)
          };
          
          const opponentName = isHost ? (data.challengerName || "Rival") : (data.hostName || "Host");
          
          recordMatch(finalResult.winner, finalResult, 0, opponentName, matchType, new Date().toISOString(), matchUniqueId);
          
          toast({
            title: language === 'ru' ? "Матч завершен" : "Match Finished",
            description: language === 'ru' ? `Отчет боя против ${opponentName} готов.` : `Battle report vs ${opponentName} is ready.`,
          });

          if (isHost) {
            await deleteDoc(doc(db, 'friendly_lobbies', data.id)).catch(() => {});
          }
          isSimulatingRef.current = false;
        }
      };

      const timer = setInterval(checkAndComplete, 5000);
      checkAndComplete();
      return () => clearInterval(timer);
    }
  }, [activeLobby, challengeResult, user, language, recordMatch, db, toast, matchHistory, ownedHeroes, lineup]);

  const handleHostRespond = async (accept: boolean) => {
    if (!activeLobby) return;
    setIsActionLoading(true);
    try {
      const lobbyRef = doc(db, 'friendly_lobbies', activeLobby.id);
      if (accept) {
        const squad = ownedHeroes.filter(h => Object.values(lineup).includes(h.id)).map(h => ({
          name: h.name,
          role: h.role,
          overallRating: h.overallRating,
          proStats: h.proStats,
          isSub: h.id === lineup.sub1 || h.id === lineup.sub2
        }));

        const rivalSquad = getRandomStartingSquad().map((h, i) => ({
          name: `${h.name} Rival`,
          role: h.role,
          overallRating: h.overallRating,
          proStats: h.proStats,
          isSub: i > 4
        }));

        const result = await simulateMobaMatch({
          teamA: { name: activeLobby.hostName, strategy: strategy, heroes: squad },
          teamB: { 
            name: activeLobby.challengerName || "Rival Manager", 
            strategy: "Aggressive Play", 
            heroes: rivalSquad
          },
          isBo2: false
        });
        
        await updateDoc(lobbyRef, {
          status: 'accepted',
          matchResult: sanitizeForFirestore(result),
          acceptedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        sendNotification(
          activeLobby.challengerId,
          language === 'ru' ? "Вызов принят!" : "Challenge Accepted!",
          language === 'ru' ? `Менеджер ${activeLobby.hostName} готов к бою.` : `Manager ${activeLobby.hostName} is ready for battle.`
        );

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
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
      setShowChallengeModal(false);
    }
  };

  const t = {
    hostTitle: language === 'ru' ? "ПОЛУЧЕН ВЫЗОВ" : "CHALLENGE RECEIVED",
    hostDesc: language === 'ru' ? `Менеджер ${activeLobby?.challengerName} хочет провести товарищеский матч.` : `Manager ${activeLobby?.challengerName} wants a friendly match.`,
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
