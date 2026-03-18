
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { 
  ChevronLeft, Swords, Search, ShieldAlert, 
  User, Zap, Loader2, Target
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { query, collection, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function OpenFriendliesPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { language, isLoaded } = useGameState();
  const [isChallenging, setIsChallenging] = useState<string | null>(null);

  const lobbiesQuery = useMemoFirebase(() => {
    return query(collection(db, 'friendly_lobbies'), where('status', '==', 'searching'));
  }, [db]);

  const { data: lobbies, isLoading: isLobbiesLoading } = useCollection(lobbiesQuery);
  
  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v2', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !isLoaded || !user || isLobbiesLoading) {
    return <LoadingScreen />;
  }

  const translations = {
    en: {
      title: "OPEN FRIENDLIES",
      subtitle: "Tactical match-making hub",
      noLobbies: "No Active Requests",
      noLobbiesDesc: "No managers are currently seeking practice matches. Post your own request!",
      challenge: "CHALLENGE",
      wait: "WAITING...",
      selfRequest: "This is your request",
      toastSent: "Challenge Sent",
      toastSentDesc: "Manager is reviewing your request. Stand by for response."
    },
    ru: {
      title: "ОТКРЫТЫЕ МАТЧИ",
      subtitle: "Хаб тактического подбора игроков",
      noLobbies: "Нет активных заявок",
      noLobbiesDesc: "В данный момент никто не ищет тренировочных игр. Разместите свою заявку!",
      challenge: "ВЫЗВАТЬ",
      wait: "ОЖИДАНИЕ...",
      selfRequest: "Это ваша заявка",
      toastSent: "Вызов отправлен",
      toastSentDesc: "Менеджер рассматривает ваш запрос. Ожидайте ответа."
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleChallenge = async (lobbyId: string, hostName: string) => {
    if (!user || !profile) return;
    setIsChallenging(lobbyId);
    try {
      const lobbyRef = doc(db, 'friendly_lobbies', lobbyId);
      await updateDoc(lobbyRef, {
        status: 'challenged',
        challengerId: user.uid,
        challengerName: profile.displayName || "Manager",
        updatedAt: serverTimestamp()
      });
      toast({
        title: t.toastSent,
        description: `${t.toastSentDesc} (${hostName})`,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsChallenging(null);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/tournaments">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <Search className="w-6 h-6 text-accent" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      {lobbies && lobbies.length > 0 ? (
        <div className="space-y-3">
          {lobbies.map((lobby) => (
            <Card key={lobby.id} className={cn(
              "glass-card border-white/5 overflow-hidden transition-all",
              lobby.hostId === user.uid && "opacity-60 grayscale border-primary/20"
            )}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center border border-white/10 shadow-inner">
                    <User className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                      {lobby.hostName}
                      {lobby.hostId === user.uid && <Badge variant="outline" className="text-[7px] py-0 border-primary text-primary">YOU</Badge>}
                    </h3>
                    <p className="text-[9px] text-accent font-bold uppercase tracking-widest flex items-center gap-1">
                      <Target className="w-3 h-3" /> Tactical Training
                    </p>
                  </div>
                </div>

                {lobby.hostId === user.uid ? (
                  <span className="text-[8px] font-black text-muted-foreground uppercase">{t.selfRequest}</span>
                ) : (
                  <Button 
                    size="sm" 
                    className="hero-gradient font-bold text-[10px] h-9 px-4"
                    disabled={!!isChallenging}
                    onClick={() => handleChallenge(lobby.id, lobby.hostName)}
                  >
                    {isChallenging === lobby.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Swords className="w-3 h-3 mr-2" />}
                    {t.challenge}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-muted-foreground opacity-20" />
          <div>
            <h2 className="text-lg font-headline font-bold uppercase">{t.noLobbies}</h2>
            <p className="text-xs text-muted-foreground mt-2 max-w-[200px] mx-auto leading-relaxed">
              {t.noLobbiesDesc}
            </p>
          </div>
          <Link href="/tournaments" className="pt-4">
            <Button variant="outline" className="text-[10px] font-bold uppercase border-white/10">
              {language === 'ru' ? 'РАЗМЕСТИТЬ ЗАЯВКУ' : 'POST REQUEST'}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
