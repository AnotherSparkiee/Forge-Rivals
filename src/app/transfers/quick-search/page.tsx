'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Search, Star, Globe, 
  UserPlus, Coins, Info, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateUniqueHero, Role } from '@/app/lib/moba-data';

export default function QuickSearchPage() {
  const { language, isLoaded } = useGameState();
  const router = useRouter();

  const t = {
    title: language === 'ru' ? "БЫСТРЫЙ ПОИСК" : "QUICK SEARCH",
    subtitle: language === 'ru' ? "Мгновенный подбор по позициям" : "Instant position-based scouting",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    age: language === 'ru' ? "лет" : "yrs",
    salary: language === 'ru' ? "Зарплата" : "Salary",
    buy: language === 'ru' ? "КУПИТЬ" : "ACQUIRE",
    noPlayers: language === 'ru' ? "Кандидаты не найдены" : "No candidates found",
    roles: [
      { id: 'Carry', label: language === 'ru' ? "Керри" : "Carry" },
      { id: 'Midlaner', label: language === 'ru' ? "Мидер" : "Midlaner" },
      { id: 'Tank', label: language === 'ru' ? "Оффлейнер" : "Offlaner" },
      { id: 'Jungler', label: language === 'ru' ? "Поддержка" : "Support" },
      { id: 'Support', label: language === 'ru' ? "Полная поддержка" : "Full Support" },
    ]
  };

  // Generate mock market players for each role
  const marketPlayers = useMemo(() => {
    const roles: Role[] = ['Carry', 'Midlaner', 'Tank', 'Jungler', 'Support'];
    const data: Record<string, any[]> = {};
    
    roles.forEach(role => {
      data[role] = Array.from({ length: 4 }).map((_, i) => generateUniqueHero(role, i, false));
    });
    
    return data;
  }, []);

  if (!isLoaded) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/transfers">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <Search className="w-6 h-6 text-accent" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <Tabs defaultValue="Carry" className="w-full">
        <div className="overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <TabsList className="bg-secondary/30 border border-white/5 h-11 w-max flex p-1">
            {t.roles.map((role) => (
              <TabsTrigger 
                key={role.id} 
                value={role.id}
                className="text-[9px] font-black uppercase px-4 h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {role.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {t.roles.map((role) => (
          <TabsContent key={role.id} value={role.id} className="space-y-3 mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {marketPlayers[role.id]?.map((player) => (
              <Card key={player.id} className="glass-card border-white/5 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shadow-lg">
                        <img src={player.image} alt={player.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-background rounded-md px-1 border border-white/10 text-[10px]">
                        {player.country.flag}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold uppercase truncate">{player.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5 text-primary" /> {player.age} {t.age}
                        </span>
                        <span className="text-[9px] font-bold text-accent uppercase flex items-center gap-1">
                          <Globe className="w-2.5 h-2.5" /> {player.country.name}
                        </span>
                      </div>
                    </div>

                    <div className="text-right border-l border-white/5 pl-4">
                      <p className="text-[8px] font-black text-primary uppercase tracking-tighter mb-0.5">{t.overall}</p>
                      <p className="text-2xl font-headline font-bold text-primary italic leading-none">{player.overallRating}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-secondary/40 p-2 rounded-lg border border-white/5">
                      <p className="text-[7px] uppercase font-black text-muted-foreground">{t.salary}</p>
                      <p className="text-xs font-bold text-white">€{(player.salary || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-secondary/40 p-2 rounded-lg border border-white/5">
                      <p className="text-[7px] uppercase font-black text-muted-foreground">Market Value</p>
                      <p className="text-xs font-bold text-accent">€{((player.overallRating * 15000) + 50000).toLocaleString()}</p>
                    </div>
                  </div>

                  <Button className="w-full hero-gradient h-10 font-black text-[10px] tracking-widest uppercase shadow-lg">
                    <UserPlus className="w-3.5 h-3.5 mr-2" /> {t.buy}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
