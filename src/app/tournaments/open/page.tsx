'use client';

import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Coffee, Globe, Medal, 
  ChevronRight, Clock, Target, CalendarClock, ShieldAlert
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { getMoscowTime, toMskDate } from '@/app/lib/time-utils';

/**
 * Open Tournaments List v2.2.
 * Only shows upcoming or LIVE tournaments. Finished ones are hidden (moved to History).
 */
export default function OpenTournamentsPage() {
  const { language } = useGameState();
  const [now, setNow] = useState(getMoscowTime());

  useEffect(() => {
    const timer = setInterval(() => setNow(getMoscowTime()), 1000);
    return () => clearInterval(timer);
  }, []);

  const t = {
    en: {
      title: "OPEN TOURNAMENTS",
      subtitle: "Upcoming & Active Events",
      back: "Back",
      live: "LIVE",
      kettle: "Cast Iron Kettle",
      globe: "Cast Iron Globe",
      brick: "Cast Iron Brick",
      noUpcoming: "No upcoming tournaments",
      checkHistory: "Completed tournaments are archived in History.",
      historyBtn: "VIEW HISTORY",
      desc: "Register for upcoming events or watch active LIVE battles."
    },
    ru: {
      title: "ОТКРЫТЫЕ ТУРНИРЫ",
      subtitle: "Предстоящие и активные события",
      back: "Назад",
      live: "В ЭФИРЕ",
      kettle: "Чугунный Чайник",
      globe: "Чугунный Глобус",
      brick: "Чугунный Кирпич",
      noUpcoming: "Предстоящих турниров нет",
      checkHistory: "Завершенные турниры перемещены в Историю.",
      historyBtn: "В ИСТОРИЮ",
      desc: "Регистрируйтесь в новых событиях или смотрите LIVE-битвы."
    }
  }[language === 'ru' ? 'ru' : 'en'];

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

  const kettleStatus = getKettleStatus();
  const globeStatus = getDailyStatus(21, 5);
  const brickStatus = getDailyStatus(21, 35);

  const showKettle = true; // Kettle is hourly, always upcoming or live
  const showGlobe = globeStatus !== "FINISHED";
  const showBrick = brickStatus !== "FINISHED";

  const hasAnyUpcoming = showGlobe || showBrick || showKettle;

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
        {hasAnyUpcoming ? (
          <>
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
                  <Badge className={cn("text-[7px] font-black h-5", kettleStatus === 'LIVE' ? "bg-red-600 animate-pulse" : "bg-orange-500/20 text-orange-400 border-none")}>
                    {kettleStatus}
                  </Badge>
                </CardContent>
              </Card>
            </Link>

            {/* DAILY TOURNAMENTS */}
            <div className="grid grid-cols-2 gap-2">
              {showGlobe && (
                <Link href="/tournaments/iron-globe">
                  <Card className="glass-card border-white/5 hover:border-primary/30 transition-all cursor-pointer overflow-hidden h-full">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <Globe className="w-8 h-8 text-primary" />
                      <h4 className="text-[10px] font-bold uppercase text-white">{t.globe}</h4>
                      <Badge variant="outline" className={cn("text-[7px] font-black h-5 border-white/10", globeStatus === 'LIVE' && "text-red-500 border-red-500/50")}>
                        {globeStatus}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              )}
              {showBrick && (
                <Link href="/tournaments/iron-brick">
                  <Card className="glass-card border-white/5 hover:border-accent/30 transition-all cursor-pointer overflow-hidden h-full">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <Medal className="w-8 h-8 text-accent" />
                      <h4 className="text-[10px] font-bold uppercase text-white">{t.brick}</h4>
                      <Badge variant="outline" className={cn("text-[7px] font-black h-5 border-white/10", brickStatus === 'LIVE' && "text-red-500 border-red-500/50")}>
                        {brickStatus}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              )}
            </div>

            <div className="p-6 bg-secondary/10 rounded-2xl border border-dashed border-white/5 text-center opacity-40">
               <CalendarClock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
               <p className="text-[8px] font-black uppercase tracking-widest">{t.desc}</p>
            </div>
          </>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
            <div className="w-24 h-24 rounded-full bg-secondary/10 border-2 border-dashed border-white/5 flex items-center justify-center mb-6">
              <ShieldAlert className="w-12 h-12 text-muted-foreground opacity-20" />
            </div>
            <h2 className="text-xl font-headline font-bold uppercase text-white tracking-tight">{t.noUpcoming}</h2>
            <p className="text-xs text-muted-foreground mt-2 max-w-[240px] leading-relaxed italic">
              {t.checkHistory}
            </p>
            <Link href="/tournaments/history" className="mt-8">
              <Button className="h-12 px-8 hero-gradient font-black text-[10px] uppercase tracking-widest shadow-xl">
                {t.historyBtn}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
