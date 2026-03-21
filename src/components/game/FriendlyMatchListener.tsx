'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, collection, query, where } from 'firebase/firestore';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Swords, Trophy, Loader2, XCircle, ShieldCheck, UserCheck, Clock, PlayCircle } from 'lucide-react';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { INITIAL_HEROES } from '@/app/lib/moba-data';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const MATCH_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function FriendlyMatchListener() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { language, team, strategy, recordMatch } = useGameState();
  const { toast } = useToast();

  const [activeLobby, setActiveLobby] = useState<any | null>(null);
  const [challengeResult, setChallengeResult] = useState<any | null>(null);
  const [isProcessing, setIsActionLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Update current time for countdowns
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Listen for challenges or active matches as Host
  useEffect(() => {
    if (isUserLoading || !user) return;
    const lobbyRef = doc(db, 'friendly_lobbies', user.uid);
    const unsubscribe = onSnapshot(lobbyRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Host sees if someone challenged them OR if they accepted and match is in progress
        if (data.status === 'challenged' || data.status === 'accepted') {
          setActiveLobby({ ...data, id: docSnap.id });
        } else {
          setActiveLobby(null);
        }
      } else {
        setActiveLobby(null);
      }
    });
    return () => unsubscribe();
  }, [user, isUserLoading, db]);

  // 2. Listen for results or accepted matches as Challenger
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
    if (!activeLobby) return;
    setIsActionLoading(true);
    try {
      const lobbyRef = doc(db, 'friendly_lobbies', activeLobby.id);
      if (accept) {
        // Simulate Match immediately but hide result for 15 mins
        const result = await simulateMobaMatch({
          teamA: { name: activeLobby.hostName, strategy: strategy, heroes: team },
          teamB: { 
            name: activeLobby.challengerName || "Rival Manager", 
            strategy: "Aggressive Play", 
            heroes: INITIAL_HEROES.slice(0, 5) 
          },
          includeRandomEvents: true,
          isBo2: false
        });
        
        await updateDoc(lobbyRef, {
          status: 'accepted',
          matchResult: result,
          acceptedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        toast({
          title: language === 'ru' ? "Матч начат" : "Match Started",
          description: language === 'ru' ? "Команды вышли на арену. Ожидайте завершения." : "Teams are on the field. Wait for completion.",
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
    }
  };

  const handleClearResult = async (data: any) => {
    if (!data) return;
    
    try {
      if (data.status === 'accepted' && data.matchResult) {
        const isHost = data.hostId === user?.uid;
        const result = data.matchResult;
        
        const finalResult = isHost ? result : {
          ...result,
          scoreA: result.scoreB,
          scoreB: result.scoreA,
          winner: result.winner === data.hostName ? data.hostName : (result.winner === "Draw" ? "Draw" : data.challengerName)
        };
        
        const opponentName = isHost ? (data.challengerName || "Rival") : (data.hostName || "Host");
        recordMatch(finalResult.winner, finalResult, 0, opponentName, 'friendly', false);
      }
      
      // Only delete if it's the host's lobby record or if challenger is closing it
      await deleteDoc(doc(db, 'friendly_lobbies', data.id));
      if (data.hostId === user?.uid) setActiveLobby(null);
      else setChallengeResult(null);
    } catch (e) {
      console.error(e);
    }
  };

  const formatTime = (ms: number) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const t = {
    hostTitle: language === 'ru' ? "ПОЛУЧЕН ВЫЗОВ" : "CHALLENGE RECEIVED",
    hostDesc: language === 'ru' ? `Менеджер ${activeLobby?.challengerName} хочет провести товарищеский матч.` : `Manager ${activeLobby?.challengerName} wants a friendly match.`,
    accept: language === 'ru' ? "ПРИНЯТЬ" : "ACCEPT",
    decline: language === 'ru' ? "ОТКЛОНИТЬ" : "DECLINE",
    inProgress: language === 'ru' ? "МАТЧ В ПРОЦЕССЕ" : "MATCH IN PROGRESS",
    inProgressDesc: language === 'ru' ? "Идет тактическое развертывание и сражение..." : "Tactical deployment and engagement in progress...",
    resAccepted: language === 'ru' ? "ВЫЗОВ ПРИНЯТ" : "CHALLENGE ACCEPTED",
    resRejected: language === 'ru' ? "ВЫЗОВ ОТКЛОНЕН" : "CHALLENGE REJECTED",
    view: language === 'ru' ? "ПОСМОТРЕТЬ РЕЗУЛЬТАТ" : "VIEW RESULT",
    close: language === 'ru' ? "ЗАКРЫТЬ" : "CLOSE",
    wait: language === 'ru' ? "ОЖИДАНИЕ" : "WAITING",
  };

  // Helper to render the lobby status for both roles
  const renderLobbyContent = (data: any, isHost: boolean) => {
    if (!data) return null;

    if (data.status === 'rejected') {
      return (
        <div className="text-center py-4">
          <DialogHeader>
            <DialogTitle className="font-headline font-bold text-red-400 uppercase text-center">{t.resRejected}</DialogTitle>
          </DialogHeader>
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4 mt-4" />
          <p className="text-xs text-muted-foreground mt-2">
            {language === 'ru' ? `Менеджер ${isHost ? data.challengerName : data.hostName} отклонил запрос.` : `Manager ${isHost ? data.challengerName : data.hostName} declined the request.`}
          </p>
          <Button className="w-full mt-6 bg-secondary/50" onClick={() => handleClearResult(data)}>{t.close}</Button>
        </div>
      );
    }

    if (data.status === 'accepted') {
      const acceptedAt = data.acceptedAt?.toMillis() || Date.now();
      const timeLeft = MATCH_DURATION_MS - (now - acceptedAt);
      const isFinished = timeLeft <= 0;

      return (
        <div className="text-center py-4">
          <DialogHeader>
            <DialogTitle className={cn("font-headline font-bold uppercase text-lg text-center", isFinished ? "text-green-400" : "text-primary")}>
              {isFinished ? (language === 'ru' ? 'МАТЧ ЗАВЕРШЕН' : 'MATCH COMPLETED') : t.inProgress}
            </DialogTitle>
          </DialogHeader>
          {isFinished ? (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4 mt-4 border border-green-500/20">
                <PlayCircle className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">{language === 'ru' ? 'Результаты симуляции получены.' : 'Simulation results are ready.'}</p>
              <Button className="w-full mt-6 hero-gradient font-bold h-12 uppercase text-[10px]" onClick={() => handleClearResult(data)}>{t.view}</Button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 mt-4 border border-primary/20 animate-pulse">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">{t.wait}: {formatTime(timeLeft)}</p>
              <div className="mt-6 p-3 bg-secondary/30 rounded-xl border border-white/5">
                <p className="text-[10px] text-muted-foreground italic leading-relaxed">"{t.inProgressDesc}"</p>
              </div>
              <div className="mt-4 flex items-center justify-center gap-4">
                <Badge variant="outline" className="text-[8px] border-primary/30 text-primary">{data.hostName}</Badge>
                <Swords className="w-4 h-4 text-accent animate-bounce" />
                <Badge variant="outline" className="text-[8px] border-accent/30 text-accent">{data.challengerName}</Badge>
              </div>
            </>
          )}
        </div>
      );
    }

    // Host receiving challenge
    if (isHost && data.status === 'challenged') {
      return (
        <>
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
        </>
      );
    }

    return null;
  };

  return (
    <>
      {/* 1. ACTIVE LOBBY DIALOG (Host Perspective) */}
      <Dialog open={!!activeLobby} onOpenChange={() => {
        // Only allow manual close if it's just a challenge, not an active match
        if (activeLobby?.status === 'challenged' && !isProcessing) setActiveLobby(null);
      }}>
        <DialogContent className="max-w-xs bg-card border-white/10 p-6">
          {renderLobbyContent(activeLobby, true)}
        </DialogContent>
      </Dialog>

      {/* 2. CHALLENGE RESULT DIALOG (Challenger Perspective) */}
      <Dialog open={!!challengeResult} onOpenChange={() => {}}>
        <DialogContent className="max-w-xs bg-card border-white/10 p-6">
          {renderLobbyContent(challengeResult, false)}
        </DialogContent>
      </Dialog>
    </>
  );
}
