'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, collection, query, where } from 'firebase/firestore';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Swords, Loader2, XCircle, ShieldCheck } from 'lucide-react';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { INITIAL_HEROES } from '@/app/lib/moba-data';
import { useToast } from '@/hooks/use-toast';

const MATCH_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Handles friendly match logic in the background.
 * Shows Accept/Decline modal for Host.
 * Auto-completes matches when time is up.
 */
export function FriendlyMatchListener() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { language, team, strategy, recordMatch } = useGameState();
  const { toast } = useToast();

  const [activeLobby, setActiveLobby] = useState<any | null>(null);
  const [challengeResult, setChallengeResult] = useState<any | null>(null);
  const [isProcessing, setIsActionLoading] = useState(false);

  // 1. Listen for challenges or active matches as Host
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

  // 2. Listen for results or accepted matches as Challenger
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

  // 3. Background Completion Logic
  useEffect(() => {
    const data = activeLobby || challengeResult;
    if (!data || !user) return;

    const isHost = data.hostId === user.uid;

    // Auto-clear rejected
    if (data.status === 'rejected') {
      if (!isHost) {
        toast({
          title: language === 'ru' ? "Вызов отклонен" : "Challenge Rejected",
          description: language === 'ru' ? `Менеджер ${data.hostName} отклонил ваш вызов.` : `Manager ${data.hostName} declined your challenge.`,
          variant: "destructive"
        });
      }
      if (isHost) {
        deleteDoc(doc(db, 'friendly_lobbies', data.id));
      }
      return;
    }

    // Auto-record accepted when time is up
    if (data.status === 'accepted' && data.matchResult) {
      const acceptedAt = data.acceptedAt?.toMillis() || Date.now();
      const finishTime = acceptedAt + MATCH_DURATION_MS;
      
      const checkAndComplete = () => {
        if (Date.now() >= finishTime) {
          const result = data.matchResult;
          const finalResult = isHost ? result : {
            ...result,
            scoreA: result.scoreB,
            scoreB: result.scoreA,
            winner: result.winner === data.hostName ? data.hostName : (result.winner === "Draw" ? "Draw" : data.challengerName)
          };
          
          const opponentName = isHost ? (data.challengerName || "Rival") : (data.hostName || "Host");
          recordMatch(finalResult.winner, finalResult, 0, opponentName, 'friendly');
          
          toast({
            title: language === 'ru' ? "Матч завершен" : "Match Completed",
            description: language === 'ru' ? `Товарищеская игра против ${opponentName} окончена.` : `Friendly match vs ${opponentName} finished.`,
          });

          // Only Host deletes the record to prevent race conditions during recording
          if (isHost) {
            deleteDoc(doc(db, 'friendly_lobbies', data.id));
          }
        }
      };

      const timer = setInterval(checkAndComplete, 10000);
      checkAndComplete();
      return () => clearInterval(timer);
    }
  }, [activeLobby, challengeResult, user, language, recordMatch, db]);

  const handleHostRespond = async (accept: boolean) => {
    if (!activeLobby) return;
    setIsActionLoading(true);
    try {
      const lobbyRef = doc(db, 'friendly_lobbies', activeLobby.id);
      if (accept) {
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
    }
  };

  const t = {
    hostTitle: language === 'ru' ? "ПОЛУЧЕН ВЫЗОВ" : "CHALLENGE RECEIVED",
    hostDesc: language === 'ru' ? `Менеджер ${activeLobby?.challengerName} хочет провести товарищеский матч.` : `Manager ${activeLobby?.challengerName} wants a friendly match.`,
    accept: language === 'ru' ? "ПРИНЯТЬ" : "ACCEPT",
    decline: language === 'ru' ? "ОТКЛОНИТЬ" : "DECLINE",
  };

  // Only show the receiving challenge dialog
  return (
    <Dialog open={activeLobby?.status === 'challenged'} onOpenChange={(open) => {
      if (!open && !isProcessing) setActiveLobby(null);
    }}>
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
  );
}