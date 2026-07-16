'use client';

/**
 * @fileOverview ТУРНИРНЫЙ ХАБ v2.1.
 * Возвращена вкладка "Пробный матч" под "Открытые турниры".
 */

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Trophy, Medal, Swords, UserPlus, 
  Search, History, ChevronLeft, 
  ChevronRight, Loader2, XCircle, ShoppingBasket,
  Globe, Briefcase, Zap
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
  const { language, isLoaded, displayName } = useGameState();
  const [isActionLoading, setIsActionLoading] = useState(false);

  const myLobbyRef = useMemoFirebase(() => user ? doc(db, 'friendly_lobbies_v3', user.uid) : null, [db, user]);
  const { data: myLobby, isLoading: isLobbyLoading } = useDoc(myLobbyRef);

  const myBasketRef = useMemoFirebase(() => user ? doc(db, 'cw_basket_v2', user.uid) : null, [db, user]);
  const { data: myBasket } = useDoc(myBasketRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/register');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !isLoaded || !user || isLobbyLoading) {
    return <LoadingScreen />;
  }

  const t = {
    en: {
      title: "TOURNAMENT HUB",
      subtitle: "Operational Terminals",
      menu: [
        { id: 'schedule', label: myLobby ? 'Cancel Match' : 'Schedule Friendly', desc: myLobby ? 'Abort active request' : 'Wait for an opponent', icon: myLobby ? XCircle : UserPlus, color: myLobby ? 'text-red-400' : 'text-accent' },
        { id: 'open', label: 'Open Friendlies', desc: 'Browse available challenges', icon: Search, href: '/tournaments/open-friendlies', color: 'text-primary' },
        { id: 'cw', label: 'CW Basket', desc: 'Instant random pairing', icon: ShoppingBasket, href: '/tournaments/cw-basket', color: 'text-green-400' },
        { id: 'list', label: 'Open Tournaments', desc: 'Active competition schedule', icon: Globe, href: '/tournaments/open', color: 'text-blue-400' },
        { id: 'trial', label: 'Trial Match', desc: 'Instant combat test vs Bot', icon: Zap, color: 'text-yellow-500' },
        { id: 'history', label: 'Tournament History', desc: 'Official record of achievements', icon: History, href: '/tournaments/history', color: 'text-slate-400' }
      ]
    },
    ru: {
      title: "ТУРНИРНЫЙ ХАБ",
      subtitle: "Операционные терминалы",
      menu: [
        { id: 'schedule', label: myLobby ? 'Отменить тов. матч' : 'Назначить тов. матч', desc: myLobby ? 'Прервать активный поиск' : 'Ожидать вызова соперника', icon: myLobby ? XCircle : UserPlus, color: myLobby ? 'text-red-400' : 'text-accent' },
        { id: 'open', label: 'Открытые тов. матчи', desc: 'Список доступных вызовов', icon: Search, href: '/tournaments/open-friendlies', color: 'text-primary' },
        { id: 'cw', label: 'КВ (Корзина)', desc: 'Мгновенный случайный подбор', icon: ShoppingBasket, href: '/tournaments/cw-basket', color: 'text-green-400' },
        { id: 'list', label: 'Открытые турниры', desc: 'Список активных чемпионатов', icon: Globe, href: '/tournaments/open', color: 'text-blue-400' },
        { id: 'trial', label: 'Пробный матч', desc: 'Мгновенный тест состава против Бота', icon: Zap, color: 'text-yellow-500' },
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

  const handleStartTrial = async () => {
    if (!user || isActionLoading) return;
    if (myLobby || myBasket) {
      toast({ 
        title: language === 'ru' ? "Завершите текущий поиск" : "Complete active search first", 
        variant: "destructive" 
      });
      return;
    }
    setIsActionLoading(true);
    try {
      // Создаем лобби, которое уже "бросило вызов" ботом
      await setDoc(doc(db, 'friendly_lobbies_v3', user.uid), {
        hostId: user.uid,
        hostName: displayName || "Manager",
        status: 'challenged',
        challengerId: 'sys_training_bot',
        challengerName: language === 'ru' ? 'Тренировочный Бот' : 'Training Bot',
        isTrial: true,
        updatedAt: serverTimestamp()
      });
      toast({ title: language === 'ru' ? "Вызов бота инициирован" : "Bot challenge initiated" });
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
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

      <div className="space-y-2">
        {t.menu.map((item) => {
          const isClickAction = item.id === 'schedule' || item.id === 'trial';
          const clickHandler = item.id === 'schedule' ? handleToggleLobby : (item.id === 'trial' ? handleStartTrial : undefined);

          const content = (
            <Card 
              key={item.id}
              onClick={clickHandler}
              className={cn(
                "glass-card border-white/5 transition-all group overflow-hidden cursor-pointer hover:bg-white/5",
                item.id === 'schedule' && myLobby && "border-red-500/30 bg-red-500/5"
              )}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-secondary/50 border border-white/5 group-hover:bg-primary/10 transition-colors shadow-inner", item.color)}>
                    {isActionLoading && (item.id === 'schedule' || item.id === 'trial') ? <Loader2 className="w-5 h-5 animate-spin" /> : <item.icon className="w-5 h-5" />}
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

          if (item.href && !isClickAction) {
            return <Link key={item.id} href={item.href} className="block">{content}</Link>;
          }
          return content;
        })}
      </div>
    </div>
  );
}
