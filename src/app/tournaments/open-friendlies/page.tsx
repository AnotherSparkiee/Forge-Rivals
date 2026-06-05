
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { 
  ChevronLeft, Swords, Search, ShieldAlert, 
  User, Zap, Loader2, Target, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { query, collection, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { cn } from '@/lib/utils';

export default function OpenFriendliesPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { language, isLoaded } = useGameState();
  const [isChallenging, setIsChallenging] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const lobbiesQuery = useMemoFirebase(() => {
    return query(collection(db, 'friendly_lobbies_v3'), where('status', '==', 'searching'));
  }, [db]);

  const { data: rawLobbies, isLoading: isLobbiesLoading } = useCollection(lobbiesQuery);
  
  const myBasketRef = useMemoFirebase(() => user ? doc(db, 'cw_basket_v2', user.uid) : null, [db, user]);
  const { data: myBasket } = useDoc(myBasketRef);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const lobbies = useMemo(() => {
    if (!rawLobbies) return [];
    return rawLobbies.filter(lobby => {
      const createdAt = lobby.updatedAt?.toMillis() || now;
      return now - createdAt < 60000;
    });
  }, [rawLobbies, now]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/register');
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
      challenge: "CHALLENGE",
      selfRequest: "This is your request",
      toastSent: "Challenge Sent",
      busy: "Operational Conflict"
    },
    ru: {
      title: "ОТКРЫТЫЕ МАТЧИ",
      subtitle: "Хаб тактического подбора игроков",
      noLobbies: "Нет активных заявок",
      challenge: "ВЫЗВАТЬ",
      selfRequest: "Это ваша заявка",
      toastSent: "Вызов отправлен",
      busy: "Оперативный конфликт"
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleChallenge = async (lobbyId: string, hostName: string) => {
    if (!user || !profile || myBasket) {
      if (myBasket) toast({ title: t.busy, variant: "destructive" });
      return;
    }
    setIsChallenging(lobbyId);
    try {
      await updateDoc(doc(db, 'friendly_lobbies_v3', lobbyId), {
        status: 'challenged',
        challengerId: user.uid,
        challengerName: profile.displayName || "Manager",
        updatedAt: serverTimestamp()
      });
      toast({ title: t.toastSent });
    } finally { setIsChallenging(null); }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/tournaments"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button></Link>
        <div><h1 className="text-2xl font-headline font-bold uppercase">{t.title}</h1><p className="text-muted-foreground text-[10px] uppercase">{t.subtitle}</p></div>
      </header>
      {lobbies.length > 0 ? (
        <div className="space-y-3">
          {lobbies.map((lobby) => (
            <Card key={lobby.id} className="glass-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <User className="w-10 h-10 text-muted-foreground" />
                  <div><h3 className="text-sm font-bold uppercase">{lobby.hostName}</h3></div>
                </div>
                {lobby.hostId === user.uid ? <span className="text-[8px] uppercase">{t.selfRequest}</span> : <Button size="sm" className="hero-gradient" onClick={() => handleChallenge(lobby.id, lobby.hostName)} disabled={!!isChallenging}>{t.challenge}</Button>}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center opacity-30"><ShieldAlert className="w-16 h-16 mx-auto mb-4" /><p>{t.noLobbies}</p></div>
      )}
    </div>
  );
}
