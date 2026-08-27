'use client';

import { useGameState } from './lib/store';
import { 
  Users, MessageSquare, ShoppingCart, 
  CalendarDays, Medal, ArrowRightLeft, 
  Shield, Construction, Briefcase, 
  LineChart, Heart, Newspaper, Settings, Search, Tv, User as UserIcon, UserCheck,
  Radar, LayoutList, Swords, Timer, Activity,
  Gears
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect, useMemo } from 'react';
import { getMoscowTime, isMatchLive } from './lib/time-utils';
import { collection, query, where } from 'firebase/firestore';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { 
    language, isLoaded, isDataReady, matchHistory, 
    allSeasonMatches, lastSeenMatchDay, rank, selectedLeagueId,
    leagueLevel, groupId, clubLogo: myClubLogo
  } = useGameState();

  const [now, setNow] = useState(getMoscowTime());

  useEffect(() => {
    const timer = setInterval(() => setNow(getMoscowTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const groupPlayersQuery = useMemoFirebase(() => {
    if (!db || !selectedLeagueId) return null;
    return query(collection(db, 'players_v11'), 
      where('selectedLeagueId', '==', selectedLeagueId),
      where('leagueLevel', '==', leagueLevel),
      where('groupId', '==', groupId)
    );
  }, [db, selectedLeagueId, leagueLevel, groupId]);

  const { data: groupPlayers } = useCollection(groupPlayersQuery);

  const nameMap = useMemo(() => {
    const names: Record<number, string> = {};
    const logos: Record<number, string> = {};
    if (groupPlayers) {
      groupPlayers.forEach(p => {
        names[p.rank] = p.clubName || p.displayName;
        logos[p.rank] = p.clubLogo;
      });
    }
    return { names, logos };
  }, [groupPlayers]);

  const resolvedNextMatch = useMemo(() => {
    if (!allSeasonMatches || !rank) return null;
    const myNext = allSeasonMatches
      .filter(m => (Number(m.homeRank) === rank || Number(m.awayRank) === rank) && !m.isFinished)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
    if (!myNext) return null;
    const isHome = Number(myNext.homeRank) === rank;
    const oppRank = isHome ? Number(myNext.awayRank) : Number(myNext.homeRank);
    return {
      match: myNext,
      opponentName: nameMap.names[oppRank] || `BOT01100${oppRank}`,
      opponentLogo: nameMap.logos[oppRank] || null
    };
  }, [allSeasonMatches, rank, nameMap]);

  const getCountdown = (targetTimeIso: string) => {
    const diff = new Date(targetTimeIso).getTime() - now.getTime();
    if (diff > 0) {
      const hh = Math.floor(diff / 3600000);
      const mm = Math.floor((diff % 3600000) / 60000);
      const ss = Math.floor((diff % 60000) / 1000);
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }
    return '00:00:00';
  };

  const unreadMatches = (allSeasonMatches || []).filter(m => 
    user && (Number(m.homeRank) === rank || Number(m.awayRank) === rank) && 
    m.isFinished && Number(m.day) > (lastSeenMatchDay || 0)
  );
  const totalUnreadCount = unreadMatches.length + (matchHistory || []).filter(m => m.seen === false).length;

  if (isUserLoading || !isLoaded || !isDataReady) return <LoadingScreen />;

  const menuItems = [
    { label: language === 'ru' ? 'ОБЗОР МАТЧА' : 'MATCH REVIEW', href: '/reports', icon: Tv, color: 'text-primary', badge: totalUnreadCount > 0 ? totalUnreadCount : null },
    { label: language === 'ru' ? 'СОСТАВ КОМАНДЫ' : 'SQUAD', href: '/roster/squad', icon: Users, color: 'text-blue-400' },
    { label: language === 'ru' ? 'ТРАНСФЕРЫ' : 'TRANSFERS', href: '/transfers', icon: ArrowRightLeft, color: 'text-yellow-500' },
    { label: language === 'ru' ? 'РАЗВИТИЕ' : 'INFRA', href: '/training', icon: Construction, color: 'text-orange-400' },
    { label: language === 'ru' ? 'ПЕРСОНАЛ' : 'STAFF', href: '/staff', icon: Briefcase, color: 'text-amber-500' },
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
    { label: language === 'ru' ? 'НАСТРОЙКИ' : 'SYSTEM', href: '/system', icon: Settings, color: 'text-primary' },
    { label: language === 'ru' ? 'ПОИСК' : 'SEARCH', href: '/search', icon: Search, color: 'text-blue-500' },
  ];

  const currentNextMatch = resolvedNextMatch?.match;
  const isNextMatchLive = currentNextMatch ? isMatchLive(currentNextMatch.startTime) : false;

  return (
    <div className="relative min-h-screen flex flex-col bg-[#0a0d14] overflow-x-hidden">
      {/* BACKGROUND MAP EFFECT */}
      <div className="absolute inset-0 bg-[url('https://i.postimg.cc/7Z9Xp0mP/map-overlay.png')] bg-cover bg-center opacity-10 pointer-events-none" />
      
      <div className="flex-1 w-full max-w-md mx-auto px-4 pt-4 pb-32 z-10">
        
        {/* NEXT MATCH TACTICAL CARD */}
        <Card className="relative overflow-hidden mb-6 border-white/10 bg-gradient-to-br from-[#121c2e] to-[#0a0d14] rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-[url('https://i.postimg.cc/7L4vKjS3/tactical-map.jpg')] bg-cover bg-center opacity-40 mix-blend-overlay" />
          <CardContent className="p-5 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-secondary/60 border border-primary/30 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.2)]">
                <Swords className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-black text-primary/80 uppercase tracking-widest mb-1">{language === 'ru' ? 'СЛЕДУЮЩИЙ СОПЕРНИК' : 'NEXT OPPONENT'}</p>
                <h2 className="text-xl font-headline font-bold text-white uppercase tracking-tight">{resolvedNextMatch?.opponentName || 'BOT0110017'}</h2>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">{language === 'ru' ? 'ТУР' : 'TOUR'} {currentNextMatch?.tour || 2}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">{language === 'ru' ? 'ДО МАТЧА' : 'UNTIL MATCH'}</p>
              <p className="text-2xl font-headline font-black text-primary italic text-glow-blue">
                {currentNextMatch ? getCountdown(currentNextMatch.startTime) : '23:35:54'}
              </p>
            </div>
          </CardContent>
          {/* DECORATIVE DESK ICON */}
          <div className="absolute bottom-[-15px] left-1/2 -translate-x-1/2 w-32 opacity-80 pointer-events-none">
            <img src="https://i.postimg.cc/VvPz5xM7/desk-ui.png" alt="" className="w-full h-auto" />
          </div>
        </Card>

        {/* MAIN MENU GRID */}
        <div className="grid grid-cols-4 gap-2.5">
          {menuItems.map((item) => (
            <Link key={item.label} href={item.href}>
              <Card className="aspect-square glass-card border-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all group flex flex-col items-center justify-center p-1.5 relative rounded-[1.5rem]">
                <div className={cn("transition-transform duration-300 group-hover:scale-110", item.color)}>
                  <item.icon className="w-8 h-8" />
                </div>
                {item.badge && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-red-500 text-white text-[8px] h-4 min-w-[16px] px-1 font-black animate-pulse border-none shadow-lg">
                      {item.badge}
                    </Badge>
                  </div>
                )}
                {/* LABELS ONLY FOR NON-SYSTEM OR AS PER DESIGN */}
                <span className="text-[7px] font-black uppercase text-center text-muted-foreground group-hover:text-white mt-2 leading-none tracking-tighter">
                  {item.label}
                </span>
              </Card>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}