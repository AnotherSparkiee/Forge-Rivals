'use client';

import { Suspense } from 'react';
import { 
  Swords, Users, UserPlus, TrendingUp, 
  Briefcase, Binoculars, Trophy, Calendar, 
  BarChart3, Medal, Heart, Star, 
  MessageSquare, UserCheck, User, Shield, 
  ShoppingCart, Newspaper, Settings, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

const GRID_ITEMS = [
  { label: 'ОБЗОР МАТЧА', icon: Swords, color: 'text-red-400' },
  { label: 'СОСТАВ', icon: Users, color: 'text-blue-400' },
  { label: 'ТРАНСФЕРЫ', icon: UserPlus, color: 'text-yellow-400' },
  { label: 'РАЗВИТИЕ', icon: TrendingUp, color: 'text-green-400' },
  { label: 'ПЕРСОНАЛ', icon: Briefcase, color: 'text-purple-400' },
  { label: 'ТАЛАНТЫ', icon: Binoculars, color: 'text-sky-400' },
  { label: 'ТАБЛИЦЫ', icon: Trophy, color: 'text-orange-400' },
  { label: 'РАСПИСАНИЕ', icon: Calendar, color: 'text-indigo-400' },
  { label: 'ФИНАНСЫ', icon: BarChart3, color: 'text-emerald-400' },
  { label: 'ТУРНИРЫ', icon: Medal, color: 'text-yellow-300' },
  { label: 'ФАН БАЗА', icon: Heart, color: 'text-pink-400' },
  { label: 'ТОП СЕЗОНА', icon: Star, color: 'text-amber-400' },
  { label: 'ЧАТЫ', icon: MessageSquare, color: 'text-cyan-400' },
  { label: 'ДРУЗЬЯ', icon: UserCheck, color: 'text-rose-400' },
  { label: 'О СЕБЕ', icon: User, color: 'text-white' },
  { label: 'АССОЦИАЦИИ', icon: Shield, color: 'text-violet-400' },
  { label: 'МАГАЗИН', icon: ShoppingCart, color: 'text-lime-400' },
  { label: 'НОВОСТИ', icon: Newspaper, color: 'text-teal-400' },
  { label: 'СИСТЕМА', icon: Settings, color: 'text-slate-400' },
  { label: 'ПОИСК', icon: Search, color: 'text-blue-300' },
];

function HubContent() {
  return (
    <div className="fixed inset-0 h-dvh w-full overflow-hidden flex flex-col bg-background text-foreground select-none touch-none p-1">
      <main className="flex-1 w-full h-full">
        <div className="grid grid-cols-4 grid-rows-5 gap-1 h-full w-full">
          {GRID_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <div 
                key={index} 
                className="relative rounded-sm border border-white/5 bg-card/30 flex flex-col items-center justify-center p-1 text-center overflow-hidden"
              >
                <Icon className={cn("w-6 h-6 mb-1 shrink-0", item.color)} />
                <span className="text-[7px] font-headline font-bold tracking-tighter uppercase leading-tight max-w-full break-words line-clamp-2 px-1">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HubContent />
    </Suspense>
  );
}
