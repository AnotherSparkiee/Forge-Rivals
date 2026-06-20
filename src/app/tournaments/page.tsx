'use client';

/**
 * @fileOverview ТУРНИРНЫЙ ХАБ v1.6.
 * Исправлена синхронизация времени через toMskDate.
 */

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Trophy, Medal, Swords, UserPlus, 
  Search, History, Gamepad2, ChevronLeft, 
  ChevronRight, Loader2, XCircle, ShoppingBasket, RefreshCw, AlertTriangle,
  Globe, LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getMoscowTime, toMskDate } from '../lib/time-utils';

export default function TournamentsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { language, isLoaded, displayName } = useGameState();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [now, setNow] = useState(getMoscowTime());

  useEffect(() => {
    const timer = setInterval(() => setNow(getMoscowTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const myLobbyRef = useMemoFirebase(() => user ? doc(db, 'friendly_lobbies_v3', user.uid) : null, [db, user]);
  const { data: myLobby, isLoading: isLobbyLoading } = useDoc(myLobbyRef);

  const myBasketRef = useMemoFirebase(() => user ? doc(db, 'cw_basket_v2', user.uid) : null, [db, user]);
  const { data: myBasket } = useDoc(myBasketRef);

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
      busyLobby: "You have an active Friendly or Trial match request.",
      busyBasket: "You are currently in the CW Basket queue.",
      schedule: "Schedule Friendly",
      cancel: "Cancel Friendly Match",
      open: "Open Friendlies",
      cw: "CW Basket",
      history: "Tournament History",
      trial: "Trial Match",
      trialDesc: "Instant battle against AI Trainer",
      cup: "Pyramid Cup",
      cupDesc: "Main National Trophy",
      dailyTitle: "DAILY SPECIALS",
      ironGlobe: "Iron Globe",
      ironBrick: "Iron Brick",
      reset: "EMERGENCY RESET",
      resetDesc: "Clear all stuck match tasks"
    },
    ru: {
      title: "ТУРНИРНЫЙ ХАБ",
      subtitle: "Глобальные соревнования и товарищеские игры",
      busy: "Оперативный конфликт",
      busyLobby: "У вас уже есть активная заявка на матч или поиск.",
      busyBasket: "Вы находитесь в очереди КВ Корзины.",
      schedule: "Назначить тов. Матч",
      cancel: "Отменить тов. Матч",
      open: "Открытые тов. Матчи",
      cw: "КВ корзина",
      history: "История турниров",
      trial: "Пробный матч",
      trialDesc: "Мгновенный бой против ИИ-Тренера",
      cup: "Кубок Пирамиды",
      cupDesc: "Главный трофей нации",
      dailyTitle: "ЕЖЕДНЕВНЫЕ СОБЫТИЯ",
      ironGlobe: "Чугунный Глобус",
      ironBrick: "Чугунный Кирпич",
      reset: "ЭКСТРЕННЫЙ СБРОС",
      resetDesc: "Очистить все застрявшие задачи"
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleToggleLobby = async () => {
    if (!user || isActionLoading) return;
    if (!myLobby && isBusy) { 
      const errorMsg = myBasket ? t.busyBasket : t.busyLobby;
      toast({ title: t.busy, description: errorMsg, variant: "destructive" }); 
      return; 
    }
    setIsActionLoading(true);
    try {
      if (myLobby) {
        await deleteDoc(doc(db, 'friendly_lobbies_v3', user.uid));
      } else {
        await setDoc(doc(db, 'friendly_lobbies_v3', user.uid), {
          hostId: user.uid, hostName: displayName || "Manager",
          status: 'searching', challengerId: null, challengerName: null, isTrial: false, updatedAt: serverTimestamp()
        });
      }
    } finally { setIsActionLoading(false); }
  };

  const handleStartTrial = async () => {
    if (!user || isActionLoading) return;
    if (isBusy) { 
      const errorMsg = myBasket ? t.busyBasket : t.busyLobby;
      toast({ title: t.busy, description: errorMsg, variant: "destructive" }); 
      return; 
    }
    
    setIsActionLoading(true);
    try {
      await setDoc(doc(db, 'friendly_lobbies_v3', user.uid), {
        hostId: user.uid, 
        hostName: displayName || "Manager",
        status: 'challenged',
        challengerId: 'sys_bot_trainer',
        challengerName: language === 'ru' ? 'ИИ-Тренер' : 'AI Trainer',
        isTrial: true,
        updatedAt: serverTimestamp()
      });
      toast({ title: language === 'ru' ? "Вызов от ИИ получен" : "AI Challenge received" });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleEmergencyReset = async () => {
    if (!user || isActionLoading) return;
    setIsActionLoading(true);
    try {
      if (myLobby) await deleteDoc(doc(db, 'friendly_lobbies_v3', user.uid));
      if (myBasket) await deleteDoc(doc(db, 'cw_basket_v2', user.uid));
      toast({ title: language === 'ru' ? "Задачи очищены!" : "Tasks Cleared!" });
    } finally {
      setIsActionLoading(false);
    }
  };

  const getDailyStatus = (sh: number, sm: number) => {
    const mskNow = toMskDate(now);
    const totalNow = mskNow.getUTCHours() * 60 + mskNow.getUTCMinutes();
    const totalStart = sh * 60 + sm;
    if (totalNow < totalStart - 30) return "OPEN";
    if (totalNow < totalStart) return "REG_CLOSED";
    if (totalNow < totalStart + 40) return "LIVE";
    return "FINISHED";
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button></Link>
        <div><h1 className="text-2xl font-headline font-bold uppercase">{t.title}</h1><p className="text-muted-foreground text-[10px] uppercase">{t.subtitle}</p></div>
      </header>

      <div className="space-y-6">
        {/* MAJOR TOURNAMENTS */}
        <div className="space-y-2">
          <Link href="/tournaments/cup">
            <Card className="glass-card p-4 flex items-center justify-between border-yellow-500/20 bg-yellow-500/5 group hover:bg-yellow-500/10 transition-all">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-yellow-500/20 border border-yellow-500/30 group-hover:scale-110 transition-transform">
                  <Trophy className="text-yellow-500 w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase text-white">{t.cup}</h3>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{t.cupDesc}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-yellow-500 transition-colors" />
            </Card>
          </Link>
        </div>

        {/* DAILY SPECIALS */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent px-1 flex items-center gap-2">
            <LayoutGrid className="w-3.5 h-3.5" /> {t.dailyTitle}
          </h2>
          <div className="grid grid-cols-2 gap-2">
             <Link href="/tournaments/iron-globe" className="block">
               <Card className="glass-card border-white/5 hover:border-primary/30 transition-all cursor-pointer overflow-hidden">
                 <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                   <Globe className="w-8 h-8 text-primary" />
                   <h4 className="text-[10px] font-bold uppercase text-white">{t.ironGlobe}</h4>
                   <Badge className="text-[7px] font-black">{getDailyStatus(21, 5)}</Badge>
                 </CardContent>
               </Card>
             </Link>
             <Link href="/tournaments/iron-brick" className="block">
               <Card className="glass-card border-white/5 hover:border-accent/30 transition-all cursor-pointer overflow-hidden">
                 <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                   <Medal className="w-8 h-8 text-accent" />
                   <h4 className="text-[10px] font-bold uppercase text-white">{t.ironBrick}</h4>
                   <Badge className="text-[7px] font-black">{getDailyStatus(21, 35)}</Badge>
                 </CardContent>
               </Card>
             </Link>
          </div>
        </section>

        {/* QUICK ENGAGEMENTS */}
        <div className="space-y-2">
          <Card 
            className={cn(
              "glass-card p-4 flex items-center justify-between cursor-pointer transition-all",
              isBusy && !myLobby?.isTrial ? "opacity-50 border-white/5" : "border-primary/20 bg-primary/5 hover:bg-primary/10"
            )} 
            onClick={handleStartTrial}
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-primary/20 border border-primary/30">
                <Gamepad2 className="text-primary w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase text-white">{t.trial}</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{t.trialDesc}</p>
              </div>
            </div>
            {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </Card>
          
          <Link href="/tournaments/cw-basket">
            <Card className="glass-card p-4 flex items-center justify-between border-green-500/20 bg-green-500/5 group hover:bg-green-500/10 transition-all">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-green-500/20 border border-green-500/30 transition-colors">
                  <ShoppingBasket className="text-green-400 w-5 h-5" />
                </div>
                <div><h3 className="text-sm font-bold uppercase text-white">{t.cw}</h3><p className="text-[10px] text-muted-foreground uppercase">{language === 'ru' ? 'Случайный подбор' : 'Random matchmaking'}</p></div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          </Link>

          <Card className="glass-card p-4 flex items-center justify-between cursor-pointer" onClick={handleToggleLobby}>
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-secondary/50 border border-white/5">
                {myLobby ? <XCircle className="text-red-400 w-5 h-5" /> : <UserPlus className="text-accent w-5 h-5" />}
              </div>
              <div><h3 className="text-sm font-bold uppercase">{myLobby ? t.cancel : t.schedule}</h3></div>
            </div>
            {isActionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          </Card>
        </div>

        {/* UTILS */}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/tournaments/open-friendlies">
            <Button variant="outline" className="w-full h-12 border-white/5 bg-secondary/20 font-black text-[9px] uppercase tracking-widest gap-2">
              <Search className="w-3.5 h-3.5" /> {t.open}
            </Button>
          </Link>
          <Link href="/tournaments/history">
            <Button variant="outline" className="w-full h-12 border-white/5 bg-secondary/20 font-black text-[9px] uppercase tracking-widest gap-2">
              <History className="w-3.5 h-3.5" /> {t.history}
            </Button>
          </Link>
        </div>
      </div>

      {isBusy && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
          <Card className="glass-card border-red-500/20 bg-red-500/5">
            <CardContent className="p-4 space-y-4">
               <div className="flex items-center gap-3">
                 <AlertTriangle className="w-5 h-5 text-red-400" />
                 <div>
                   <h4 className="text-xs font-bold uppercase text-red-400">{t.busy}</h4>
                   <p className="text-[10px] text-muted-foreground">{myBasket ? t.busyBasket : t.busyLobby}</p>
                 </div>
               </div>
               <Button 
                variant="outline" 
                className="w-full h-10 border-red-500/20 text-red-400 font-black text-[9px] uppercase tracking-widest hover:bg-red-500/10"
                onClick={handleEmergencyReset}
                disabled={isActionLoading}
               >
                 {isActionLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                 {t.reset}
               </Button>
               <p className="text-[7px] text-center text-muted-foreground uppercase opacity-50">{t.resetDesc}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}