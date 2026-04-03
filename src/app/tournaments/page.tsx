
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
import { INITIAL_HEROES } from '@/app/lib/moba-data';

export default function TournamentsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { language, isLoaded, strategy, team, ownedHeroes, lineup } = useGameState();
  const [isActionLoading, setIsActionLoading] = useState(false);

  const myLobbyRef = useMemoFirebase(() => user ? doc(db, 'friendly_lobbies', user.uid) : null, [db, user]);
  const { data: myLobby, isLoading: isLobbyLoading } = useDoc(myLobbyRef);

  const myBasketRef = useMemoFirebase(() => user ? doc(db, 'cw_basket', user.uid) : null, [db, user]);
  const { data: myBasket } = useDoc(myBasketRef);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
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
      locked: "Locked",
      busy: "Operational Conflict",
      busyDesc: "Complete or cancel current engagement before starting a new one.",
      schedule: "Schedule Friendly",
      cancel: "Cancel Friendly Match",
      open: "Open Friendlies",
      cw: "CW Basket",
      tournaments: "Open Tournaments",
      history: "Tournament History",
      trial: "Trial Match",
      descSchedule: "Post a request for a friendly encounter",
      descCancel: "Withdraw your current match request",
      descOpen: "Find managers looking for practice",
      descCW: "Quick random matchmaking system",
      descTrial: "Immediate training match with a bot (15m prep)",
      toastPosted: "Request Posted",
      toastPostedDesc: "Your challenge is now visible in the lobby.",
      toastCancelled: "Request Withdrawn",
      toastCancelledDesc: "The lobby entry has been deleted.",
      toastTrial: "Trial Scheduled",
      toastTrialDesc: "Bot engagement begins in 15 minutes."
    },
    ru: {
      title: "ТУРНИРНЫЙ ХАБ",
      subtitle: "Глобальные соревнования и товарищеские игры",
      locked: "Закрыто",
      busy: "Оперативный конфликт",
      busyDesc: "Завершите или отмените текущую операцию перед началом новой.",
      schedule: "Назначить тов. Матч",
      cancel: "Отменить тов. Матч",
      open: "Открытые тов. Матчи",
      cw: "КВ корзина",
      tournaments: "Открытые турниры",
      history: "История турниров",
      trial: "Пробный матч",
      descSchedule: "Разместить заявку на проведение встречи",
      descCancel: "Удалить вашу текущую заявку из списка",
      descOpen: "Поиск менеджеров для тренировки",
      descCW: "Система быстрого случайного подбора",
      descTrial: "Мгновенный тренировочный бой с ботом (15 мин подгот.)",
      toastPosted: "Заявка размещена",
      toastPostedDesc: "Ваш вызов теперь виден в списке открытых матчей.",
      toastCancelled: "Заявка отменена",
      toastCancelledDesc: "Ваша запись удалена из лобби.",
      toastTrial: "Пробный матч назначен",
      toastTrialDesc: "Бой с ботом начнется через 15 минут."
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleToggleLobby = async () => {
    if (!user || !profile || isActionLoading) return;
    
    if (!myLobby && isBusy) {
      toast({ title: t.busy, description: t.busyDesc, variant: "destructive" });
      return;
    }

    setIsActionLoading(true);
    try {
      if (myLobby) {
        await deleteDoc(doc(db, 'friendly_lobbies', user.uid));
        toast({ title: t.toastCancelled, description: t.toastCancelledDesc });
      } else {
        await setDoc(doc(db, 'friendly_lobbies', user.uid), {
          hostId: user.uid,
          hostName: profile.displayName || "Manager",
          status: 'searching',
          challengerId: null,
          challengerName: null,
          updatedAt: serverTimestamp()
        });
        toast({ title: t.toastPosted, description: t.toastPostedDesc });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStartTrial = async () => {
    if (!user || !profile || isActionLoading) return;
    
    if (isBusy) {
      toast({ title: t.busy, description: t.busyDesc, variant: "destructive" });
      return;
    }

    setIsActionLoading(true);
    try {
      const botId = `bot${Math.floor(Math.random() * 9000) + 1000}`;
      
      const squad = ownedHeroes.filter(h => Object.values(lineup).includes(h.id)).map(h => ({
        ...h,
        isSub: h.id === lineup.sub1 || h.id === lineup.sub2
      }));

      const result = await simulateMobaMatch({
        teamA: { name: profile.displayName || "Manager", strategy, heroes: squad },
        teamB: { 
          name: botId, 
          strategy: "Standard Training", 
          heroes: INITIAL_HEROES.map((h, i) => ({ ...h, isSub: i > 4 }))
        },
        isBo2: false
      });

      await setDoc(doc(db, 'friendly_lobbies', user.uid), {
        hostId: user.uid,
        hostName: profile.displayName || "Manager",
        status: 'accepted',
        challengerId: botId,
        challengerName: botId,
        matchResult: JSON.parse(JSON.stringify(result)),
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isTrial: true
      });

      toast({ title: t.toastTrial, description: t.toastTrialDesc });
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const menu = [
    { 
      label: myLobby ? t.cancel : t.schedule, 
      desc: myLobby ? t.descCancel : t.descSchedule, 
      icon: myLobby ? XCircle : UserPlus, 
      active: true, 
      onClick: handleToggleLobby,
      color: myLobby ? "text-red-400" : "text-primary"
    },
    { label: t.open, desc: t.descOpen, icon: Search, active: true, href: '/tournaments/open-friendlies' },
    { label: t.cw, desc: t.descCW, icon: ShoppingBasket, active: true, href: '/tournaments/cw-basket' },
    { label: t.tournaments, desc: language === 'ru' ? "Активные чемпионаты и кубки" : "Active championships", icon: Trophy, active: true, href: '/tournaments/open' },
    { label: t.history, desc: language === 'ru' ? "Архив ваших выступлений" : "Archive of your battles", icon: History, active: true, href: '/tournaments/history' },
    { label: t.trial, desc: t.descTrial, icon: Gamepad2, active: true, onClick: handleStartTrial, color: "text-accent" },
  ];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <Medal className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-2">
        {menu.map((item) => {
          const Content = (
            <Card 
              key={item.label}
              className={cn(
                "glass-card border-white/5 transition-all overflow-hidden",
                item.active ? "hover:bg-white/5 cursor-pointer" : "opacity-60"
              )}
              onClick={item.onClick}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-secondary/50">
                    {isActionLoading && item.onClick ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : (
                      <item.icon className={cn("w-5 h-5", item.color || "text-primary")} />
                    )}
                  </div>
                  <div>
                    <h3 className={cn("text-sm font-bold uppercase", item.color)}>{item.label}</h3>
                    <p className="text-[10px] text-muted-foreground leading-tight max-w-[200px]">{item.desc}</p>
                  </div>
                </div>
                {item.active ? (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Badge variant="outline" className="text-[8px] uppercase">{t.locked}</Badge>
                )}
              </CardContent>
            </Card>
          );

          if (item.href && item.active) {
            return <Link key={item.label} href={item.href} className="block">{Content}</Link>;
          }

          return <div key={item.label} className={cn("block", !item.active && "cursor-not-allowed")}>{Content}</div>;
        })}
      </div>
    </div>
  );
}
