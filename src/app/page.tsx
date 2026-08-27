'use client';

import { useGameState } from './lib/store';
import { 
  Users, MessageSquare, ShoppingCart, 
  CalendarDays, Medal, ArrowRightLeft, 
  Shield, Construction, Briefcase, 
  LineChart, Heart, Newspaper, Settings, Search, Tv, User as UserIcon, UserCheck,
  Radar, LayoutList, Swords, Timer, Activity
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
import Image from 'next/image';

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
    { id: 'reports', label: language === 'ru' ? 'ОБЗОР МАТЧА' : 'MATCH REVIEW', href: '/reports', icon: Tv, color: 'text-primary', badge: totalUnreadCount > 0 ? totalUnreadCount : null },
    { id: 'squad', label: language === 'ru' ? 'СОСТАВ КОМАНДЫ' : 'SQUAD', href: '/roster/squad', icon: Users, color: 'text-blue-400' },
    { id: 'transfers', label: language === 'ru' ? 'ТРАНСФЕРЫ' : 'TRANSFERS', href: '/transfers', icon: ArrowRightLeft, color: 'text-yellow-500' },
    { id: 'training', label: language === 'ru' ? 'РАЗВИТИЕ' : 'INFRA', href: '/training', icon: Construction, color: 'text-orange-400' },
    { id: 'staff', label: language === 'ru' ? 'ПЕРСОНАЛ' : 'STAFF', href: '/staff', icon: Briefcase, color: 'text-amber-500' },
    { id: 'scouting', label: language === 'ru' ? 'ПОИСК ТАЛАНТОВ' : 'SCOUTING', href: '/youth-academy/scouting', icon: Radar, color: 'text-purple-400' },
    { id: 'rankings', label: language === 'ru' ? 'ТАБЛИЦЫ' : 'RANKINGS', href: '/rankings', icon: LayoutList, color: 'text-green-400' },
    { id: 'matches', label: language === 'ru' ? 'РАСПИСАНИЕ' : 'SCHEDULE', href: '/matches', icon: CalendarDays, color: 'text-red-400' },
    { id: 'finances', label: language === 'ru' ? 'ФИНАНСЫ' : 'FINANCES', href: '/finances', icon: LineChart, color: 'text-emerald-400' },
    { id: 'tournaments', label: language === 'ru' ? 'ТУРНИРЫ' : 'TOURNAMENTS', href: '/tournaments', icon: Swords, color: 'text-yellow-400' },
    { id: 'fanclub', label: language === 'ru' ? 'ФАН БАЗА' : 'FANBASE', href: '/fanclub', icon: Heart, color: 'text-pink-400' },
    { id: 'top', label: language === 'ru' ? 'ТОП СЕЗОНА' : 'SEASON TOP', href: '/rankings', icon: Medal, color: 'text-amber-500' },
    { id: 'chats', label: language === 'ru' ? 'ЧАТЫ' : 'CHATS', href: '/chats', icon: MessageSquare, color: 'text-cyan-400' },
    { id: 'friends', label: language === 'ru' ? 'ДРУЗЬЯ' : 'FRIENDS', href: '/managers', icon: UserCheck, color: 'text-indigo-400' },
    { id: 'profile', label: language === 'ru' ? 'О СЕБЕ' : 'PROFILE', href: '/profile', icon: UserIcon, color: 'text-rose-400' },
    { id: 'associations', label: language === 'ru' ? 'АССОЦИАЦИИ' : 'ALLIANCE', href: '/associations', icon: Shield, color: 'text-sky-400' },
    { id: 'shop', label: language === 'ru' ? 'МАГАЗИН' : 'SHOP', href: '/shop', icon: ShoppingCart, color: 'text-lime-400' },
    { id: 'news', label: language === 'ru' ? 'НОВОСТИ' : 'NEWS', href: '/news', icon: Newspaper, color: 'text-slate-400' },
    { id: 'system', label: language === 'ru' ? 'НАСТРОЙКИ' : 'SYSTEM', href: '/system', icon: Settings, color: 'text-primary', isSystem: true },
    { id: 'search', label: language === 'ru' ? 'ПОИСК' : 'SEARCH', href: '/search', icon: Search, color: 'text-blue-500' },
  ];

  const currentNextMatch = resolvedNextMatch?.match;

  return (
    <div className="relative min-h-[calc(100dvh-4rem-3.5rem)] h-[calc(100dvh-4rem-3.5rem)] flex flex-col overflow-hidden">
      <div className="flex-1 w-full max-w-md mx-auto px-4 pt-4 flex flex-col z-10 overflow-hidden">
        
        {/* NEXT MATCH TACTICAL CARD */}
        <Card className="relative overflow-hidden mb-4 border-white/20 bg-[#1a2b45] rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] shrink-0 min-h-[110px]">
          <div className="absolute inset-0 z-0 opacity-80">
             <Image 
                src="https://i.ibb.co/Qj1q1TZV/IMG-20260827-161555.png" 
                alt="" 
                fill 
                className="object-cover object-center"
                unoptimized={true}
             />
          </div>
          <div className="absolute inset-0 bg-white/5 z-1" />
          
          <CardContent className="p-4 flex items-center justify-between relative z-10 h-full min-h-[110px]">
            <div className="flex items-center gap-4">
              {/* Opponent Logo */}
              <div className="w-14 h-14 flex items-center justify-center shrink-0">
                {resolvedNextMatch?.opponentLogo ? (
                  <img 
                    src={resolvedNextMatch.opponentLogo} 
                    alt="Opponent Logo" 
                    className="w-full h-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" 
                  />
                ) : (
                  <Swords className="w-10 h-10 text-primary drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" />
                )}
              </div>
              <div>
                <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-0.5 drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]">{language === 'ru' ? 'СЛЕДУЮЩИЙ СОПЕРНИК' : 'NEXT OPPONENT'}</p>
                <h2 className="text-base font-headline font-bold text-white uppercase tracking-tight truncate max-w-[130px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">{resolvedNextMatch?.opponentName || 'SEARCHING...'}</h2>
                <p className="text-[8px] font-bold text-white/80 uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{language === 'ru' ? 'ТУР' : 'TOUR'} {currentNextMatch?.tour || '--'}</p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <p className="text-[7px] font-black text-white uppercase tracking-widest mb-1 drop-shadow-[0_2px_3px_rgba(0,0,0,1)] flex items-center gap-1">
                <Timer className="w-2.5 h-2.5" />
                {language === 'ru' ? 'ДО МАТЧА' : 'UNTIL MATCH'}
              </p>
              <p className="text-xl font-headline font-black text-primary italic text-glow-blue tabular-nums leading-none drop-shadow-[0_2px_5px_rgba(0,0,0,1)]">
                {currentNextMatch ? getCountdown(currentNextMatch.startTime) : '00:00:00'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* MAIN MENU GRID */}
        <div className="grid grid-cols-4 gap-2 flex-1 mb-2">
          {menuItems.map((item) => (
            <Link key={item.id} href={item.href} className="block">
              <Card className="aspect-square glass-card border-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all group flex flex-col items-center justify-center p-1 relative rounded-[1.25rem] overflow-hidden">
                {item.isSystem ? (
                  <div className="relative w-12 h-12 transition-transform duration-300 group-hover:scale-110">
                     <Image 
                        src="https://i.ibb.co/07QQCFT/1787830105436.png" 
                        alt="System" 
                        fill 
                        className="object-contain"
                        unoptimized={true}
                     />
                  </div>
                ) : (
                  <>
                    <div className={cn("transition-transform duration-300 group-hover:scale-110", item.color)}>
                      <item.icon className="w-7 h-7" />
                    </div>
                    <span className="text-[7px] font-black uppercase text-center text-muted-foreground group-hover:text-white mt-1.5 leading-none tracking-tighter">
                      {item.label}
                    </span>
                  </>
                )}
                
                {item.badge && (
                  <div className="absolute top-1.5 right-1.5">
                    <Badge className="bg-red-500 text-white text-[7px] h-3.5 min-w-[14px] px-1 font-black animate-pulse border-none shadow-lg">
                      {item.badge}
                    </Badge>
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
