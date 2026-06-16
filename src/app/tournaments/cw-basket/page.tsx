'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { 
  ChevronLeft, ShoppingBasket, Search, Swords, 
  Loader2, Radar, ShieldAlert, Timer, Users, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { cn } from '@/lib/utils';

export default function CWBasketPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { language, isLoaded } = useGameState();
  const [isActionLoading, setIsActionLoading] = useState(false);

  const myEntryRef = useMemoFirebase(() => user ? doc(db, 'cw_basket_v2', user.uid) : null, [db, user]);
  const { data: myEntry, isLoading: isEntryLoading } = useDoc(myEntryRef);

  const myLobbyRef = useMemoFirebase(() => user ? doc(db, 'friendly_lobbies_v3', user.uid) : null, [db, user]);
  const { data: myLobby } = useDoc(myLobbyRef);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  const isBusy = useMemo(() => !!myLobby && !myEntry, [myLobby, myEntry]);

  if (isUserLoading || !isLoaded || !user || isEntryLoading) {
    return <LoadingScreen />;
  }

  const translations = {
    en: {
      title: "CW BASKET",
      subtitle: "Quick Matchmaking Protocol",
      startSearch: "START SEARCH",
      stopSearch: "STOP SEARCH",
      matched: "OPPONENT SECURED",
      matchDesc: "Match will commence in 15 minutes.",
      searching: "Scanning frequencies for active managers...",
      found: "Matching established. Preparing deployment.",
      toastFound: "Match Found!",
      toastFoundDesc: "Your tactical engagement is being prepared.",
      busy: "Operational Conflict",
      busyDesc: "You have a scheduled Friendly or Trial match. Complete it first."
    },
    ru: {
      title: "КВ КОРЗИНА",
      subtitle: "Протокол быстрого подбора",
      startSearch: "НАЧАТЬ ПОИСК",
      stopSearch: "ОСТАНОВИТЬ ПОИСК",
      matched: "СОПЕРНИК НАЙДЕН",
      matchDesc: "Матч начнется через 15 минут.",
      searching: "Сканирование частот на наличие менеджеров...",
      found: "Связь установлена. Подготовка к развертыванию.",
      toastFound: "Соперник найден!",
      toastFoundDesc: "Ваше тактическое сражение подготавливается.",
      busy: "Оперативный конфликт",
      busyDesc: "У вас уже назначен Дружеский или Пробный матч. Завершите его сначала."
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleToggleSearch = async () => {
    if (!user || !profile || isActionLoading) return;

    if (!myEntry && isBusy) {
      toast({ title: t.busy, description: t.busyDesc, variant: "destructive" });
      return;
    }

    setIsActionLoading(true);

    try {
      if (myEntry) {
        await deleteDoc(doc(db, 'cw_basket_v2', user.uid));
      } else {
        // 1. Try to find someone searching
        const q = query(
          collection(db, 'cw_basket_v2'), 
          where('status', '==', 'searching'), 
          limit(1)
        );
        const snap = await getDocs(q);
        const opponentDoc = snap.docs.find(d => d.id !== user.uid);

        const matchStartTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        if (opponentDoc) {
          const opponent = opponentDoc.data();
          
          // 2. Match with found opponent
          await setDoc(doc(db, 'cw_basket_v2', opponentDoc.id), {
            status: 'matched',
            matchedWithId: user.uid,
            matchedWithName: profile.displayName || "Manager",
            matchStartTime,
            updatedAt: serverTimestamp()
          }, { merge: true });

          await setDoc(doc(db, 'cw_basket_v2', user.uid), {
            userId: user.uid,
            userName: profile.displayName || "Manager",
            status: 'matched',
            matchedWithId: opponentDoc.id,
            matchedWithName: opponent.userName || "Unknown",
            matchStartTime,
            updatedAt: serverTimestamp()
          });

          toast({ title: t.toastFound, description: t.toastFoundDesc });
        } else {
          // 3. Start own search
          await setDoc(doc(db, 'cw_basket_v2', user.uid), {
            userId: user.uid,
            userName: profile.displayName || "Manager",
            status: 'searching',
            matchedWithId: null,
            matchedWithName: null,
            matchStartTime: null,
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const isMatched = myEntry?.status === 'matched';
  const isSearching = myEntry?.status === 'searching';

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
            <ShoppingBasket className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-6">
        <Card className={cn(
          "glass-card border-white/5 overflow-hidden transition-all duration-500",
          isSearching && "border-primary/30 bg-primary/5",
          isMatched && "border-green-500/30 bg-green-500/5"
        )}>
          <CardContent className="p-8 text-center flex flex-col items-center">
            {isMatched ? (
              <div className="animate-in zoom-in duration-500">
                <div className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                  <Swords className="w-12 h-12 text-green-400" />
                </div>
                <h2 className="text-2xl font-headline font-bold uppercase tracking-tight text-white mb-2">{t.matched}</h2>
                <Badge className="bg-green-500 text-white uppercase text-[10px] mb-4">MATCH SECURED</Badge>
                <div className="bg-background/50 p-4 rounded-xl border border-white/5 space-y-2 mb-6">
                  <p className="text-[10px] uppercase font-black text-muted-foreground">{language === 'ru' ? 'ВАШ СОПЕРНИК' : 'YOUR OPPONENT'}</p>
                  <p className="text-xl font-headline font-bold text-primary italic uppercase">{myEntry.matchedWithName}</p>
                </div>
                <div className="flex items-center justify-center gap-2 text-accent">
                  <Timer className="w-4 h-4 animate-pulse" />
                  <p className="text-xs font-bold uppercase tracking-widest">{t.matchDesc}</p>
                </div>
              </div>
            ) : isSearching ? (
              <div className="space-y-6 w-full">
                <div className="relative w-32 h-32 mx-auto">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
                  <div className="absolute inset-0 rounded-full border-2 border-primary/40 animate-pulse" />
                  <div className="relative w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                    <Radar className="w-12 h-12 text-primary animate-spin" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-headline font-bold text-primary uppercase animate-pulse">{language === 'ru' ? 'ИДЕТ ПОИСК...' : 'SEARCHING...'}</h3>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-2">{t.searching}</p>
                </div>
              </div>
            ) : (
              <div className="py-6 opacity-40">
                <Users className="w-20 h-20 mx-auto mb-4 text-muted-foreground" />
                <p className="text-xs uppercase font-black tracking-widest leading-relaxed">
                  {language === 'ru' ? 'БЫСТРЫЙ ПОИСК СЛУЧАЙНОГО СОПЕРНИКА ДЛЯ ПРАКТИКИ' : 'RAPID RANDOM MATCHMAKING FOR OPERATIONAL PRACTICE'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {!isMatched && (
          <Button 
            className={cn(
              "w-full h-16 font-headline font-bold text-lg uppercase tracking-widest shadow-xl transition-all active:scale-95",
              isSearching ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20" : "hero-gradient"
            )}
            onClick={handleToggleSearch}
            disabled={isActionLoading}
          >
            {isActionLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : isSearching ? t.stopSearch : t.startSearch}
          </Button>
        )}

        {isMatched && (
          <Button 
            variant="outline" 
            className="w-full h-12 uppercase font-bold text-[10px] border-white/10"
            onClick={handleToggleSearch}
            disabled={isActionLoading}
          >
            {language === 'ru' ? 'ВЫЙТИ ИЗ ОЧЕРЕДИ' : 'ABANDON QUEUE'}
          </Button>
        )}
      </div>
    </div>
  );
}
