
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
  ChevronRight, Loader2, XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function TournamentsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { language, isLoaded } = useGameState();
  const [isActionLoading, setIsActionLoading] = useState(false);

  const myLobbyRef = useMemoFirebase(() => user ? doc(db, 'friendly_lobbies', user.uid) : null, [db, user]);
  const { data: myLobby, isLoading: isLobbyLoading } = useDoc(myLobbyRef);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v4', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !isLoaded || !user || isLobbyLoading) {
    return <LoadingScreen />;
  }

  const translations = {
    en: {
      title: "TOURNAMENT HUB",
      subtitle: "Global Competitions & Friendly Matches",
      locked: "Locked",
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
      toastPosted: "Request Posted",
      toastPostedDesc: "Your challenge is now visible in the lobby.",
      toastCancelled: "Request Withdrawn",
      toastCancelledDesc: "The lobby entry has been deleted."
    },
    ru: {
      title: "ТУРНИРНЫЙ ХАБ",
      subtitle: "Глобальные соревнования и товарищеские игры",
      locked: "Закрыто",
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
      toastPosted: "Заявка размещена",
      toastPostedDesc: "Ваш вызов теперь виден в списке открытых матчей.",
      toastCancelled: "Заявка отменена",
      toastCancelledDesc: "Ваша запись удалена из лобби."
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleToggleLobby = async () => {
    if (!user || !profile) return;
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
    { label: t.cw, desc: "Clan War coordination", icon: Swords, active: false },
    { label: t.tournaments, desc: "Active championships", icon: Trophy, active: false },
    { label: t.history, desc: "Past results", icon: History, active: false },
    { label: t.trial, desc: "Test against AI", icon: Gamepad2, active: false },
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
