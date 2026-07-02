'use client';

/**
 * @fileOverview ТУРНИРНЫЙ ХАБ v1.9.
 * Реализовано обновленное меню из 5 основных кнопок согласно регламенту FMO.
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
  Globe, LayoutGrid, Coffee, CalendarClock, ListFilter
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

  const t = {
    en: {
      title: "TOURNAMENT HUB",
      subtitle: "Global Competitions & Matchmaking",
      dailyTitle: "EVENT TRACKER",
      menuTitle: "MATCHMAKING TERMINALS",
      ironKettle: "Iron Kettle",
      ironGlobe: "Iron Globe",
      ironBrick: "Iron Brick",
      reset: "EMERGENCY RESET",
      resetDesc: "Clear all match tasks",
      menu: [
        { id: 'schedule', label: myLobby ? 'Cancel Match' : 'Schedule Friendly', desc: myLobby ? 'Abort active request' : 'Wait for an opponent', icon: myLobby ? XCircle : UserPlus, color: myLobby ? 'text-red-400' : 'text-accent' },
        { id: 'open', label: 'Open Friendlies', desc: 'Browse available challenges', icon: Search, href: '/tournaments/open-friendlies', color: 'text-primary' },
        { id: 'cw', label: 'CW Basket', desc: 'Instant random pairing', icon: ShoppingBasket, href: '/tournaments/cw-basket', color: 'text-green-400' },
        { id: 'list', label: 'Open Tournaments', desc: 'Active competition schedule', icon: Globe, href: '/tournaments/open', color: 'text-blue-400' },
        { id: 'history', label: 'Tournament History', desc: 'Official record of achievements', icon: History, href: '/tournaments/history', color: 'text-slate-400' }
      ]
    },
    ru: {
      title: "ТУРНИРНЫЙ ХАБ",
      subtitle: "Глобальные соревнования и подбор",
      dailyTitle: "ТРЕКЕР СОБЫТИЙ",
      menuTitle: "ТЕРМИНАЛЫ ПОДБОРА",
      ironKettle: "Чугунный Чайник",
      ironGlobe: "Чугунный Глобус",
      ironBrick: "Чугунный Кирпич",
      reset: "ЭКСТРЕННЫЙ СБРОС",
      resetDesc: "Очистить зависшие задачи",
      menu: [
        { id: 'schedule', label: myLobby ? 'Отменить тов. матч' : 'Назначить тов. матч', desc: myLobby ? 'Прервать активный поиск' : 'Ожидать вызова соперника', icon: myLobby ? XCircle : UserPlus, color: myLobby ? 'text-red-400' : 'text-accent' },
        { id: 'open', label: 'Открытые тов. матчи', desc: 'Список доступных вызовов', icon: Search, href: '/tournaments/open-friendlies', color: 'text-primary' },
        { id: 'cw', label: 'КВ (Корзина)', desc: 'Мгновенный случайный подбор', icon: ShoppingBasket, href: '/tournaments/cw-basket', color: 'text-green-400' },
        { id: 'list', label: 'Открытые турниры', desc: 'Список активных чемпионатов', icon: Globe, href: '/tournaments/open', color: 'text-blue-400' },
        { id: 'history', label: 'История турниров', desc: 'Архив официальных достижений', icon: History, href: '/tournaments/history', color: 'text-slate-400' }
      ]
    }
  }[language === 'ru' ? 'ru' : 'en'];

  const handleToggleLobby = async () => {
    if (!user || isActionLoading) return;
    setIsActionLoading(true);
    try {
      if (myLobby) {
        await deleteDoc(doc(db, 'friendly_lobbies_v3', user.uid));
        toast({ title: language === 'ru' ? "Поиск отменен" : "Search cancelled" });
      } else {
        if (myBasket) {
          toast({ title: language === 'ru' ? "Вы уже в КВ Корзине" : "Already in CW Basket", variant: "destructive" });
          return;
        }
        await setDoc(doc(db, 'friendly_lobbies_v3', user.uid), {
          hostId: user.uid, hostName: displayName || "Manager",
          status: 'searching', challengerId: null, challengerName: null, isTrial: false, updatedAt: serverTimestamp()
        });
        toast({ title: language === 'ru' ? "Поиск начат" : "Search initiated" });
      }
    } finally { setIsActionLoading(false); }
  };

  const handleEmergencyReset = async () => {
    if (!user || isActionLoading) return;
    setIsActionLoading(true);
    try {
      if (myLobby) await deleteDoc(doc(db, 'friendly_lobbies_v3', user.uid));
      if (myBasket) await deleteDoc(doc(db, 'cw_basket_v2', user.uid));
      toast({ title: language === 'ru' ? "Задачи очищены!" : "Tasks Cleared!" });
    } finally { setIsActionLoading(false); }
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

  const getKettleStatus = () => {
    const mins = now.getMinutes();
    if (mins < 15) return "REG_OPEN";
    if (mins < 20) return "PREPARING";
    if (mins < 50) return "LIVE";
    return "BREAK";
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-8 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full bg-secondary/50 border border-white/5">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-8">
        {/* PYRAMID CUP HIGHLIGHT */}
        <Link href="/tournaments/cup">
          <Card className="glass-card p-5 flex items-center justify-between border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-transparent group hover:bg-yellow-500/5 transition-all overflow-hidden relative">
            <div className="absolute top-0 right-0 p-1">
              <Badge className="bg-yellow-500 text-black text-[7px] font-black uppercase tracking-tighter">Season Trophy</Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                <Trophy className="text-yellow-500 w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-headline font-bold uppercase text-white tracking-tight">Кубок Пирамиды</h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase opacity-70">Главный национальный трофей</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-yellow-500 transition-colors" />
          </Card>
        </Link>

        {/* EVENT TRACKER (DAILY TOURNAMENTS) */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent px-1 flex items-center gap-2">
            <CalendarClock className="w-4 h-4" /> {t.dailyTitle}
          </h2>
          <div className="grid grid-cols-1 gap-2">
             <Link href="/tournaments/iron-kettle" className="block">
               <Card className="glass-card border-orange-500/30 bg-orange-500/5 hover:border-orange-500/50 transition-all cursor-pointer overflow-hidden">
                 <CardContent className="p-4 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                     <div className="p-2.5 rounded-xl bg-orange-500/20 border border-orange-500/30"><Coffee className="w-6 h-6 text-orange-500" /></div>
                     <div>
                       <h4 className="text-sm font-bold uppercase text-white">{t.ironKettle}</h4>
                       <p className="text-[8px] text-muted-foreground uppercase font-black">Hourly Cycle • 16 Teams • G + P</p>
                     </div>
                   </div>
                   <Badge className={cn("text-[7px] font-black h-5", getKettleStatus() === 'LIVE' ? "bg-red-600 animate-pulse" : "bg-orange-500/20 text-orange-400 border-none")}>
                     {getKettleStatus()}
                   </Badge>
                 </CardContent>
               </Card>
             </Link>
             <div className="grid grid-cols-2 gap-2">
               <Link href="/tournaments/iron-globe" className="block">
                 <Card className="glass-card border-white/5 hover:border-primary/30 transition-all cursor-pointer overflow-hidden">
                   <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                     <Globe className="w-8 h-8 text-primary" />
                     <h4 className="text-[10px] font-bold uppercase text-white">{t.ironGlobe}</h4>
                     <Badge variant="outline" className="text-[7px] font-black h-5 border-white/10">{getDailyStatus(21, 5)}</Badge>
                   </CardContent>
                 </Card>
               </Link>
               <Link href="/tournaments/iron-brick" className="block">
                 <Card className="glass-card border-white/5 hover:border-accent/30 transition-all cursor-pointer overflow-hidden">
                   <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                     <Medal className="w-8 h-8 text-accent" />
                     <h4 className="text-[10px] font-bold uppercase text-white">{t.ironBrick}</h4>
                     <Badge variant="outline" className="text-[7px] font-black h-5 border-white/10">{getDailyStatus(21, 35)}</Badge>
                   </CardContent>
                 </Card>
               </Link>
             </div>
          </div>
        </section>

        {/* MAIN MENU LIST (5 ITEMS) */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1 flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" /> {t.menuTitle}
          </h2>
          <div className="space-y-2">
            {t.menu.map((item) => {
              const content = (
                <Card 
                  key={item.id}
                  onClick={item.id === 'schedule' ? handleToggleLobby : undefined}
                  className={cn(
                    "glass-card border-white/5 transition-all group overflow-hidden cursor-pointer hover:bg-white/5",
                    item.id === 'schedule' && myLobby && "border-red-500/30 bg-red-500/5"
                  )}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn("p-2.5 rounded-xl bg-secondary/50 border border-white/5 group-hover:bg-primary/10 transition-colors shadow-inner", item.color)}>
                        {isActionLoading && item.id === 'schedule' ? <Loader2 className="w-5 h-5 animate-spin" /> : <item.icon className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold uppercase group-hover:text-white transition-colors">{item.label}</h3>
                        <p className="text-[10px] text-muted-foreground font-medium leading-tight">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all" />
                  </CardContent>
                </Card>
              );

              if (item.href) {
                return <Link key={item.id} href={item.href} className="block">{content}</Link>;
              }
              return content;
            })}
          </div>
        </section>

        {/* EMERGENCY ACTION */}
        <section className="pt-4">
           <Card className="glass-card border-red-500/20 bg-red-500/5">
             <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase text-red-400 tracking-tight">{t.reset}</h4>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase opacity-60">{t.resetDesc}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 px-4 border-red-500/30 text-red-400 font-black text-[9px] uppercase hover:bg-red-500/20 transition-all"
                  onClick={handleEmergencyReset}
                  disabled={isActionLoading}
                >
                  <RefreshCw className={cn("w-3 h-3 mr-1.5", isActionLoading && "animate-spin")} />
                  RESET
                </Button>
             </CardContent>
           </Card>
        </section>
      </div>
    </div>
  );
}
