'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, collection, query, where } from 'firebase/firestore';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Swords, Trophy, Loader2, XCircle, ShieldCheck, UserCheck } from 'lucide-react';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { INITIAL_HEROES } from '@/app/lib/moba-data';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function FriendlyMatchListener() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { language, team, strategy, recordMatch } = useGameState();
  const { toast } = useToast();

  const [hostLobby, setHostLobby] = useState<any | null>(null);
  const [challengeResult, setChallengeResult] = useState<any | null>(null);
  const [isProcessing, setIsActionLoading] = useState(false);

  // 1. Listen for challenges as Host
  useEffect(() => {
    if (isUserLoading || !user) return;
    const lobbyRef = doc(db, 'friendly_lobbies', user.uid);
    const unsubscribe = onSnapshot(lobbyRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'challenged') {
          setHostLobby({ ...data, id: docSnap.id });
        } else {
          setHostLobby(null);
        }
      } else {
        setHostLobby(null);
      }
    });
    return () => unsubscribe();
  }, [user, isUserLoading, db]);

  // 2. Listen for results as Challenger
  useEffect(() => {
    if (isUserLoading || !user) return;
    const q = query(
      collection(db, 'friendly_lobbies'), 
      where('challengerId', '==', user.uid),
      where('status', 'in', ['accepted', 'rejected'])
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

  const handleHostRespond = async (accept: boolean) => {
    if (!hostLobby) return;
    setIsActionLoading(true);
    try {
      const lobbyRef = doc(db, 'friendly_lobbies', hostLobby.id);
      if (accept) {
        // Simulate Match
        const result = await simulateMobaMatch({
          teamA: { name: hostLobby.hostName, strategy: strategy, heroes: team },
          teamB: { 
            name: hostLobby.challengerName || "Rival Manager", 
            strategy: "Aggressive Play", 
            heroes: INITIAL_HEROES.slice(0, 5) 
          },
          includeRandomEvents: true,
          isBo2: false
        });
        
        await updateDoc(lobbyRef, {
          status: 'accepted',
          matchResult: result,
          updatedAt: serverTimestamp()
        });
        
        // Save to local history for Host (The opponent is the challenger)
        recordMatch(result.winner, result, 0, hostLobby.challengerName || "Rival Manager", 'friendly', false);
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
    }
  };

  const clearChallengeResult = async () => {
    if (!challengeResult) return;
    try {
      // If was accepted, record match for Challenger too
      if (challengeResult.status === 'accepted' && challengeResult.matchResult) {
        // For challenger, Team A in result is Host, Team B is Challenger
        // We need to swap perspective for recordMatch if needed, but recordMatch currently assumes Team A is User
        // Actually, simulateMobaMatch above puts Host as Team A. 
        // So for challenger, we need to swap.
        const userResult = {
          ...challengeResult.matchResult,
          scoreA: challengeResult.matchResult.scoreB,
          scoreB: challengeResult.matchResult.scoreA,
          winner: challengeResult.matchResult.winner === challengeResult.hostName ? challengeResult.hostName : (challengeResult.matchResult.winner === "Draw" ? "Draw" : challengeResult.challengerName)
        };
        
        recordMatch(userResult.winner, userResult, 0, challengeResult.hostName || "Host Manager", 'friendly', false);
      }
      await deleteDoc(doc(db, 'friendly_lobbies', challengeResult.id));
      setChallengeResult(null);
    } catch (e) {
      console.error(e);
    }
  };

  const t = {
    hostTitle: language === 'ru' ? "ПОЛУЧЕН ВЫЗОВ" : "CHALLENGE RECEIVED",
    hostDesc: language === 'ru' ? `Менеджер ${hostLobby?.challengerName} хочет провести товарищеский матч.` : `Manager ${hostLobby?.challengerName} wants a friendly match.`,
    accept: language === 'ru' ? "ПРИНЯТЬ" : "ACCEPT",
    decline: language === 'ru' ? "ОТКЛОНИТЬ" : "DECLINE",
    resAccepted: language === 'ru' ? "ВЫЗОВ ПРИНЯТ" : "CHALLENGE ACCEPTED",
    resRejected: language === 'ru' ? "ВЫЗОВ ОТКЛОНЕН" : "CHALLENGE REJECTED",
    resAcceptedDesc: language === 'ru' ? `Менеджер ${challengeResult?.hostName} принял ваш вызов! Матч симулирован.` : `Manager ${challengeResult?.hostName} accepted! Match simulated.`,
    resRejectedDesc: language === 'ru' ? `Менеджер ${challengeResult?.hostName} отклонил ваш запрос.` : `Manager ${challengeResult?.hostName} declined your request.`,
    close: language === 'ru' ? "ЗАКРЫТЬ" : "CLOSE",
    view: language === 'ru' ? "ПОСМОТРЕТЬ РЕЗУЛЬТАТ" : "VIEW RESULT",
  };

  return (
    <>
      {/* 1. HOST DIALOG (Accept/Reject) */}
      <Dialog open={!!hostLobby} onOpenChange={() => !isProcessing && setHostLobby(null)}>
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

      {/* 2. CHALLENGER DIALOG (Result) */}
      <Dialog open={!!challengeResult} onOpenChange={() => !isProcessing && clearChallengeResult()}>
        <DialogContent className={cn(
          "max-w-xs border-white/10 p-6",
          challengeResult?.status === 'accepted' ? "bg-card" : "bg-destructive/5"
        )}>
          <DialogHeader>
            <div className={cn(
              "mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 border",
              challengeResult?.status === 'accepted' ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"
            )}>
              {challengeResult?.status === 'accepted' ? (
                <UserCheck className="w-8 h-8 text-green-400" />
              ) : (
                <XCircle className="w-8 h-8 text-red-400" />
              )}
            </div>
            <DialogTitle className={cn(
              "text-center font-headline font-bold uppercase tracking-tight",
              challengeResult?.status === 'accepted' ? "text-green-400" : "text-red-400"
            )}>
              {challengeResult?.status === 'accepted' ? t.resAccepted : t.resRejected}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground mt-2">
              {challengeResult?.status === 'accepted' ? t.resAcceptedDesc : t.resRejectedDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <Button 
              className={cn(
                "w-full font-bold uppercase text-[10px] h-12",
                challengeResult?.status === 'accepted' ? "hero-gradient" : "bg-secondary/50"
              )}
              onClick={clearChallengeResult}
            >
              {challengeResult?.status === 'accepted' ? t.view : t.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
