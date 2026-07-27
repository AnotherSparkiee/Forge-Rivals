'use client';

import { useGameState } from './lib/store';
import { 
  Users, MessageSquare, ShoppingCart, 
  CalendarDays, Medal, ArrowRightLeft, 
  Shield, Construction, Briefcase, 
  LineChart, Heart, Newspaper, Settings, Search, Tv, User as UserIcon, UserCheck,
  Radar, LayoutList, Swords, Timer, ShieldAlert, CalendarClock, Clock
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { getMoscowTime, getGlobalSeasonInfo } from './lib/time-utils';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const { 
    language, isLoaded, isDataReady, matchHistory, 
    allSeasonMatches, lastSeenMatchDay, nextMatch 
  } = useGameState();

  const [now, setNow] = useState(getMoscowTime());

  useEffect(() => {
    const timer = setInterval(() => setNow(getMoscowTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getCountdown = (targetTimeIso: string | Date) => {
    const target = typeof targetTimeIso === 'string' ? new Date(targetTimeIso) : targetTimeIso;
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return '00:00:00';
    const hh = Math.floor(diff / 3600000);
    const mm = Math.floor((diff % 3600000) / 60000);
    const ss = Math.floor((diff % 60000) / 1000);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  };

  const unreadMatches = (allSeasonMatches || []).filter(m => 
    user && (m.homeId === user.uid || m.awayId === user.uid) && 
    m.isFinished && 
    Number(m.day) > (lastSeenMatchDay || 0)
  );

  const historyUnread = (matchHistory || []).filter(m => m.seen === false);
  const totalUnreadCount = unreadMatches.length + historyUnread.length;

  if (isUserLoading || !isLoaded || !isDataReady) return <LoadingScreen />;

  const menuItems = [
    { label: language === 'ru' ? 'ОБЗОР МАТЧА' : 'MATCH OVERVIEW', href: '/reports', icon: Tv, color: 'text-primary', badge: totalUnreadCount > 0 ? totalUnreadCount : null },
    { label: language === 'ru' ? 'СОСТАВ КОМАНДЫ' : 'SQUAD', href: '/roster', icon: Users, color: 'text-accent' },
    { label: language === 'ru' ? 'ТРАНСФЕРЫ' : 'TRANSFERS', href: '/transfers', icon: ArrowRightLeft, color: 'text-yellow-500' },
    { label: language === 'ru' ? 'РАЗВИТИЕ' : 'INFRA', href: '/training', icon: Construction, color: 'text-blue-400' },
    { label: language === 'ru' ? 'ПЕРСОНАЛ' : 'STAFF', href: '/staff', icon: Briefcase, color: 'text-orange-400' },
    { label: language === 'ru' ? 'ПОИСК ТАЛАНТОВ' : 'SCOUTING', href: '/youth-academy/scouting', icon: Radar, color: 'text-purple-400' },
    { label: language === 'ru' ? 'ТАБЛИЦЫ' : 'RANKINGS', href: '/rankings', icon: LayoutList, color: 'text-green-400' },
    { label: language === 'ru' ? 'РАСПИСАНИЕ' : 'SCHEDULE', href: '/matches', icon: CalendarDays, color: 'text-red-400' },
    { label: language === 'ru' ? 'ФИНАНСЫ' : 'FINANCES', href: '/finances', icon: LineChart, color: 'text-emerald-400' },
    { label: language === 'ru' ? 'ТУРНИРЫ' : 'TOURNAMENTS', href: '/tournaments', icon: Swords, color: 'text-yellow-400' },
    { label: language === 'ru' ? 'ФАН БАЗА' : 'FANBASE', href: '/fanclub', icon: Heart, color: 'text-pink-400' },
    { label: language === 'ru' ? 'ТОП СЕЗОНА' : 'SEASON TOP', href: '/rankings', icon: Medal, color: 'text-amber-500' },
    { label: language === 'ru' ? 'ЧАТЫ' : 'CHATS', href: '/chats', icon: MessageSquare, color: 'text-cyan-400' },
    { label: language === 'ru' ? 'ДРУЗЬЯ' : 'FRIENDS', href: '/managers', icon: UserCheck, color: 'text-indigo-400' },
    { label: language === 'ru' ? 'О СЕБЕ' : 'PROFILE', href: '/profile', icon: UserIcon, color: 'text-rose-400' },
    { label: language === 'ru' ? 'АССОЦИАЦИИ' : 'ALLIANCE', href: '/associations', icon: Shield, color: 'text-sky-400' },
    { label: language === 'ru' ? 'МАГАЗИН' : 'SHOP', href: '/shop', icon: ShoppingCart, color: 'text-lime-400' },
    { label: language === 'ru' ? 'НОВОСТИ' : 'NEWS', href: '/news', icon: Newspaper, color: 'text-slate-400' },
    { label: language === 'ru' ? 'СИСТЕМА' : 'SYSTEM', href: '/system', icon: Settings, color: 'text-zinc-400' },
    { label: language === 'ru' ? 'ПОИСК' : 'SEARCH', href: '/search', icon: Search, color: 'text-blue-500' },
  ];

  const currentNextMatch = nextMatch?.match;
  const seasonInfo = getGlobalSeasonInfo();

  return (
    <div className="relative h-[calc(100dvh-3.5rem-5rem)] flex flex-col overflow-hidden bg-[#0a0d14]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.1),_transparent_70%)] -z-10" />
      <div className="flex-1 w-full max-w-md mx-auto px-4 flex flex-col pt-6 overflow-hidden">
        
        {/* NEXT MATCH / OFFSEASON WIDGET - ENLARGED VERSION */}
        {currentNextMatch ? (
          <Card className="glass-card mb-6 border-primary/30 bg-primary/5 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700 shrink-0">
            <CardContent className="p-10 flex items-center justify-between min-h-[160px]">
              <div className="flex items-center gap-6 min-w-0 flex-1">
                <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-primary/20 flex items-center justify-center p-2 shrink-0 shadow-lg">
                  {nextMatch.opponentLogo ? (
                    <img src={nextMatch.opponentLogo} className="w-full h-full object-contain" alt="" />
                  ) : (
                    <Swords className="w-8 h-8 text-accent" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] leading-none mb-2">
                    {language === 'ru' ? 'СЛЕДУЮЩИЙ СОПЕРНИК' : 'NEXT OPPONENT'}
                  </p>
                  <h3 className="text-lg font-bold uppercase truncate text-white leading-tight">
                    {nextMatch.opponentName}
                  </h3>
                </div>
              </div>
              <div className="text-right border-l border-white/5 pl-6 shrink-0 flex flex-col justify-center">
                <div className="flex items-center justify-end gap-2 mb-2 text-muted-foreground">
                  <Timer className="w-4 h-4" />
                  <span className="text-[9px] font-black uppercase tracking-tighter">DEPLOYS_IN</span>
                </div>
                <p className="text-3xl font-headline font-black text-primary italic tabular-nums leading-none">
                  {getCountdown(currentNextMatch.startTime)}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card mb-6 border-accent/30 bg-accent/5 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700 shrink-0">
            <CardContent className="p-10 flex items-center justify-between min-h-[160px]">
               <div className="flex items-center gap-6 min-w-0 flex-1">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-accent/20 flex items-center justify-center shrink-0 shadow-lg">
                    <CalendarClock className="w-9 h-9 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-accent uppercase tracking-[0.2em] leading-none mb-2">
                      {language === 'ru' ? 'ОЖИДАНИЕ НОВОГО СЕЗОНА' : 'AWAITING NEW SEASON'}
                    </p>
                    <h3 className="text-lg font-bold uppercase text-white leading-tight truncate">
                      {seasonInfo.isOffseason && !seasonInfo.isGenerationReady 
                        ? (language === 'ru' ? 'ФОРМИРОВАНИЕ ГРУПП' : 'LEAGUE GENERATION') 
                        : (language === 'ru' ? 'ПОДГОТОВКА ТЕРМИНАЛА' : 'TERMINAL PREPARATION')}
                    </h3>
                  </div>
               </div>
               <div className="text-right border-l border-white/5 pl-6 shrink-0 flex flex-col justify-center">
                 <div className="flex items-center justify-end gap-2 mb-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="text-[9px] font-black uppercase tracking-tighter">SYNC_IN</span>
                 </div>
                 <p className="text-3xl font-headline font-black text-accent italic tabular-nums leading-none">
                   {seasonInfo.isOffseason && !seasonInfo.isGenerationReady 
                    ? getCountdown(seasonInfo.generationTime) 
                    : getCountdown(seasonInfo.nextSeasonStart)}
                 </p>
               </div>
            </CardContent>
          </Card>
        )}

        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <div className="grid grid-cols-4 gap-2 w-full max-h-full py-2">
            {menuItems.map((item) => (
              <Link key={item.label} href={item.href}>
                <Card className="glass-card hover:bg-white/5 transition-all active:scale-95 duration-75 border-white/5 group aspect-square flex flex-col items-center justify-center p-1 relative overflow-visible">
                  <div className={cn("p-2 rounded-lg bg-secondary/50 group-hover:bg-primary/10 transition-colors border border-white/5 mb-1.5", item.color)}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  {item.badge && (
                    <div className="absolute top-1 right-1">
                      <div className="relative">
                        <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20" />
                        <Badge className="bg-red-500 text-white text-[9px] font-black h-5 min-w-[20px] flex items-center justify-center border-2 border-[#0a0d14] rounded-full px-1 shadow-lg relative z-10">
                          {item.badge}
                        </Badge>
                      </div>
                    </div>
                  )}
                  <span className="text-[7px] font-black uppercase text-center text-muted-foreground group-hover:text-white transition-colors leading-tight px-0.5">{item.label}</span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
