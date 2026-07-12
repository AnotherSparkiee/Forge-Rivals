'use client';

import { useGameState } from './lib/store';
import { 
  Users, MessageSquare, ShoppingCart, 
  CalendarDays, Medal, ArrowRightLeft, 
  Shield, Construction, Briefcase, 
  LineChart, Heart, Newspaper, Settings, Search, Tv, User as UserIcon, UserCheck,
  Radar, LayoutList, Swords
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const { language, isLoaded, isDataReady, matchHistory, allSeasonMatches, lastSeenMatchDay } = useGameState();

  const unreadMatches = (allSeasonMatches || []).filter(m => 
    user && (m.homeId === user.uid || m.awayId === user.uid) && 
    m.isFinished && 
    Number(m.day) > (lastSeenMatchDay || 0)
  );

  const historyUnread = (matchHistory || []).filter(m => m.seen === false);
  const totalUnread = [...unreadMatches, ...historyUnread];
  const latestUnreadId = totalUnread[0]?.id;
  
  const lastPlayedId = (matchHistory && matchHistory.length > 0) 
    ? matchHistory[matchHistory.length - 1].id 
    : null;

  const matchReviewHref = latestUnreadId ? `/match?id=${latestUnreadId}` : (lastPlayedId ? `/match?id=${lastPlayedId}` : '/matches');

  if (isUserLoading || !isLoaded || !isDataReady) return <LoadingScreen />;

  const menuItems = [
    { label: language === 'ru' ? 'ОБЗОР МАТЧА' : 'MATCH OVERVIEW', href: matchReviewHref, icon: Tv, color: 'text-primary' },
    { label: language === 'ru' ? 'СОСТАВ КОМАНДЫ' : 'SQUAD', href: '/roster/squad', icon: Users, color: 'text-accent' },
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

  return (
    <div className="relative min-h-[calc(100vh-3.5rem-5rem)] flex items-center justify-center overflow-hidden">
      {/* Background Style from Preloader */}
      <div className="absolute inset-0 bg-[#0a0d14] -z-20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)] -z-10" />
      
      <div className="relative z-10 w-full max-w-md mx-auto px-4 h-full flex items-center justify-center">
        <div className="grid grid-cols-4 gap-2 w-full py-6">
          {menuItems.map((item) => (
            <Link key={item.label} href={item.href}>
              <Card className="glass-card hover:bg-white/5 transition-all border-white/5 group aspect-square flex flex-col items-center justify-center p-1">
                <div className={cn("p-2 rounded-lg bg-secondary/50 group-hover:bg-primary/10 transition-colors border border-white/5 mb-1.5", item.color)}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-[7px] font-black uppercase text-center text-muted-foreground group-hover:text-white transition-colors leading-tight px-0.5">
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
