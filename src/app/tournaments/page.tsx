
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Trophy, Medal, Swords, UserPlus, 
  Search, History, Gamepad2, ChevronLeft, 
  ChevronRight, Loader2, XCircle, ShoppingBasket
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { generateBotSquad } from '@/app/lib/moba-data';

function sanitizeForFirestore(obj: any) {
  if (!obj) return null;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return null;
  }
}

export default function TournamentsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { language, isLoaded, strategy, ownedHeroes, lineup, displayName } = useGameState();
  const [isActionLoading, setIsActionLoading] = useState(false);

  const myLobbyRef = useMemoFirebase(() => user ? doc(db, 'friendly_lobbies_v3', user.uid) : null, [db, user]);
  const { data: myLobby, isLoading: isLobbyLoading } = useDoc(myLobbyRef);

  const myBasketRef = useMemoFirebase(() => user ? doc(db, 'cw_basket_v2', user.uid) : null, [db, user]);
  const { data: myBasket } = useDoc(myBasketRef);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/register');
    }
  }, [user, isUserLoading, router]);

  const isBusy = useMemo(() => !!myLobby || !!myBasket, [myLobby, myBasket]);

  if (isUserLoading || !isLoaded || !user || isLobbyLoading) {
    return <LoadingScreen />;
  }

  const translations = {
    en: {
      title: "TOURNAMENT HUB",
      subtitle: "Global Competitions & Friendly Matches",
      busy: "Operational Conflict",
      schedule: "Schedule Friendly",
      cancel: "Cancel Friendly Match",
      open: "Open Friendlies",
      cw: "CW Basket",
      history: "Tournament History",
      trial: "Trial Match",
      toastPosted: "Request Posted",
      toastCancelled: "Request Withdrawn",
      toastTrial: "Trial Scheduled"
    },
    ru: {
      title: "ТУРНИРНЫЙ ХАБ",
      subtitle: "Глобальные соревнования и товарищеские игры",
      busy: "Оперативный конфликт",
      schedule: "Назначить тов. Матч",
      cancel: "Отменить тов. Матч",
      open: "Открытые тов. Матчи",
      cw: "КВ корзина",
      history: "История турниров",
      trial: "Пробный матч",
      toastPosted: "Заявка размещена",
      toastCancelled: "Заявка отмена",
      toastTrial: "Пробный матч назначен"
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleToggleLobby = async () => {
    if (!user || !profile || isActionLoading) return;
    if (!myLobby && isBusy) { toast({ title: t.busy, variant: "destructive" }); return; }
    setIsActionLoading(true);
    try {
      if (myLobby) {
        await deleteDoc(doc(db, 'friendly_lobbies_v3', user.uid));
        toast({ title: t.toastCancelled });
      } else {
        await setDoc(doc(db, 'friendly_lobbies_v3', user.uid), {
          hostId: String(user.uid), hostName: String(displayName || "Manager"),
          status: 'searching', challengerId: null, challengerName: null, isTrial: false, updatedAt: serverTimestamp()
        });
        toast({ title: t.toastPosted });
      }
    } finally { setIsActionLoading(false); }
  };

  const handleStartTrial = async () => {
    if (!user || !profile || isActionLoading || isBusy) return;
    setIsActionLoading(true);
    try {
      const botId = `bot_trial_${Math.floor(Math.random() * 9000)}`;
      const squad = ownedHeroes.filter(h => Object.values(lineup).includes(h.id)).map(h => ({
        name: h.name,
        role: h.role,
        overallRating: h.overallRating,
        proStats: h.proStats,
        isSub: h.id === lineup.sub1 || h.id === lineup.sub2
      }));

      const botSquad = generateBotSquad(25);

      const simulationResult = await simulateMobaMatch({ 
        teamA: { name: String(displayName || "Manager"), strategy, heroes: squad }, 
        teamB: { name: "Elite Bot", strategy: "Balanced Play", heroes: botSquad }, 
        isBo2: false 
      });

      await setDoc(doc(db, 'friendly_lobbies_v3', user.uid), { 
        hostId: String(user.uid), 
        hostName: String(displayName || "Manager"), 
        status: 'accepted', 
        challengerId: botId, 
        challengerName: "Elite Bot", 
        matchResult: sanitizeForFirestore(simulationResult), 
        acceptedAt: serverTimestamp(), 
        updatedAt: serverTimestamp(), 
        isTrial: true 
      });

      toast({ title: t.toastTrial });
      router.push('/');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Trial failed", description: e.message });
    } finally { 
      setIsActionLoading(false); 
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button></Link>
        <div><h1 className="text-2xl font-headline font-bold uppercase">{t.title}</h1><p className="text-muted-foreground text-[10px] uppercase">{t.subtitle}</p></div>
      </header>
      <div className="space-y-2">
        <Link href="/tournaments/open"><Card className="glass-card p-4 flex items-center justify-between"><div className="flex items-center gap-4"><Trophy className="text-yellow-500 w-5 h-5" /><div><h3 className="text-sm font-bold uppercase">Open Tournaments</h3></div></div><ChevronRight className="w-4 h-4 text-muted-foreground" /></Card></Link>
        <Card className="glass-card p-4 flex items-center justify-between cursor-pointer" onClick={handleToggleLobby}><div className="flex items-center gap-4"><UserPlus className="text-primary w-5 h-5" /><div><h3 className="text-sm font-bold uppercase">{myLobby ? t.cancel : t.schedule}</h3></div></div>{isActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}</Card>
        <Link href="/tournaments/open-friendlies"><Card className="glass-card p-4 flex items-center justify-between"><div className="flex items-center gap-4"><Search className="text-accent w-5 h-5" /><div><h3 className="text-sm font-bold uppercase">{t.open}</h3></div></div><ChevronRight className="w-4 h-4 text-muted-foreground" /></Card></Link>
        <Link href="/tournaments/cw-basket"><Card className="glass-card p-4 flex items-center justify-between"><div className="flex items-center gap-4"><ShoppingBasket className="text-green-400 w-5 h-5" /><div><h3 className="text-sm font-bold uppercase">{t.cw}</h3></div></div><ChevronRight className="w-4 h-4 text-muted-foreground" /></Card></Link>
        <Link href="/tournaments/history"><Card className="glass-card p-4 flex items-center justify-between"><div className="flex items-center gap-4"><History className="text-muted-foreground w-5 h-5" /><div><h3 className="text-sm font-bold uppercase">{t.history}</h3></div></div><ChevronRight className="w-4 h-4 text-muted-foreground" /></Card></Link>
        <Card className="glass-card p-4 flex items-center justify-between cursor-pointer" onClick={handleStartTrial}><div className="flex items-center gap-4"><Gamepad2 className="text-accent w-5 h-5" /><div><h3 className="text-sm font-bold uppercase">{t.trial}</h3></div></div>{isActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}</Card>
      </div>
    </div>
  );
}
