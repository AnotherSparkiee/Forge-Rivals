'use client';

import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Trophy, Coffee, Globe, Medal, 
  ChevronRight, Clock, Target, CalendarClock
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { getMoscowTime, toMskDate } from '@/app/lib/time-utils';

/**
 * Open Tournaments List v2.0.
 * Lists all active automated tournaments.
 */
export default function OpenTournamentsPage() {
  const { language, activeSeasonNumber, selectedLeagueId } = useGameState();
  const [now, setNow] = useState(getMoscowTime());

  useEffect(() => {
    const timer = setInterval(() => setNow(getMoscowTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const t = {
    title: language === 'ru' ? "ОТКРЫТЫЕ ТУРНИРЫ" : "OPEN TOURNAMENTS",
    subtitle: language === 'ru' ? "Список официальных соревнований" : "List of official competitions",
    back: language === 'ru' ? "Назад" : "Back",
    live: language === 'ru' ? "В ЭФИРЕ" : "LIVE",
    kettle: language === 'ru' ? "Чугунный Чайник" : "Cast Iron Kettle",
    globe: language === 'ru' ? "Чугунный Глобус" : "Cast Iron Globe",
    brick: language === 'ru' ? "Чугунный Кирпич" : "Cast Iron Brick",
    cup: language === 'ru' ? "Кубок Пирамиды" : "Pyramid Cup",
    desc: language === 'ru' ? "Выберите соревнование для участия или просмотра" : "Select a competition to participate or spectate"
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
      <header className="mb-6 flex items-center gap-4">
        <Link href="/tournaments">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-4">
        {/* PYRAMID CUP */}
        <Link href="/tournaments/cup">
          <Card className="glass-card border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-yellow-500/20"><Trophy className="w-6 h-6 text-yellow-500" /></div>
                <div>
                  <h3 className="text-sm font-bold uppercase text-white">{t.cup}</h3>
                  <p className="text-[8px] text-muted-foreground uppercase font-black">Season {activeSeasonNumber} • National Trophy</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>

        {/* IRON KETTLE */}
        <Link href="/tournaments/iron-kettle">
          <Card className="glass-card border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-orange-500/20"><Coffee className="w-6 h-6 text-orange-500" /></div>
                <div>
                  <h3 className="text-sm font-bold uppercase text-white">{t.kettle}</h3>
                  <p className="text-[8px] text-muted-foreground uppercase font-black">Hourly • 16 Teams • G + P</p>
                </div>
              </div>
              <Badge className={cn("text-[7px] font-black h-5", getKettleStatus() === 'LIVE' ? "bg-red-600 animate-pulse" : "bg-orange-500/20 text-orange-400 border-none")}>
                {getKettleStatus()}
              </Badge>
            </CardContent>
          </Card>
        </Link>

        {/* DAILY TOURNAMENTS */}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/tournaments/iron-globe">
            <Card className="glass-card border-white/5 hover:border-primary/30 transition-all cursor-pointer overflow-hidden h-full">
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <Globe className="w-8 h-8 text-primary" />
                <h4 className="text-[10px] font-bold uppercase text-white">{t.globe}</h4>
                <Badge variant="outline" className="text-[7px] font-black h-5 border-white/10">{getDailyStatus(21, 5)}</Badge>
              </CardContent>
            </Card>
          </Link>
          <Link href="/tournaments/iron-brick">
            <Card className="glass-card border-white/5 hover:border-accent/30 transition-all cursor-pointer overflow-hidden h-full">
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <Medal className="w-8 h-8 text-accent" />
                <h4 className="text-[10px] font-bold uppercase text-white">{t.brick}</h4>
                <Badge variant="outline" className="text-[7px] font-black h-5 border-white/10">{getDailyStatus(21, 35)}</Badge>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="p-6 bg-secondary/10 rounded-2xl border border-dashed border-white/5 text-center opacity-40">
           <CalendarClock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
           <p className="text-[8px] font-black uppercase tracking-widest">{t.desc}</p>
        </div>
      </div>
    </div>
  );
}
