'use client';

import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Coffee, Globe, Medal, 
  ChevronRight, Clock, Target, CalendarClock, ShieldAlert,
  ArrowRight, Users
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { getMoscowTime, toMskDate } from '@/app/lib/time-utils';

/**
 * Open Tournaments List v3.2.
 * Cyber Athletic Cup updated with custom image assets.
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
      subtitle: "Active Registration & Live Events",
      back: "Back",
      live: "LIVE",
      kettle: "Cyber Athletic Cup",
      globe: "Cast Iron Globe",
      brick: "Cast Iron Brick",
      noUpcoming: "No upcoming tournaments",
      checkHistory: "Completed tournaments are archived in History.",
      historyBtn: "VIEW HISTORY",
      desc: "Register for upcoming events or watch active LIVE battles.",
      format: "16 Teams • Groups + Playoffs • Bo1"
    },
    ru: {
      title: "ОТКРЫТЫЕ ТУРНИРЫ",
      subtitle: "Регистрация и текущие события",
      back: "Назад",
      live: "В ЭФИРЕ",
      kettle: "Cyber Athletic Cup",
      globe: "Чугунный Глобус",
      brick: "Чугунный Кирпич",
      noUpcoming: "Предстоящих турниров нет",
      checkHistory: "Завершенные турниры перемещены в Историю.",
      historyBtn: "В ИСТОРИЮ",
      desc: "Регистрируйтесь в новых событиях или смотрите LIVE-битвы.",
      format: "16 команд • Группы + Плей-офф • Bo1"
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
    const hour = now.getHours();
    const min = now.getMinutes();
    const schedules = [10, 14, 18, 22];

    const active = schedules.find(h => {
      const visibleFrom = h - 3;
      return hour >= visibleFrom && (hour < h || (hour === h && min < 90));
    });

    if (active === undefined) return "IDLE";
    if (hour < active && (hour > active - 1 || min < 45)) return "REG_OPEN";
    if (hour < active) return "REG_CLOSED";
    return "LIVE";
  };

  const kettleStatus = getKettleStatus();
  const globeStatus = getDailyStatus(21, 5);
  const brickStatus = getDailyStatus(21, 35);

  const upcomingTournaments = [
    { id: 'kettle', name: t.kettle, icon: null, image: "https://iili.io/Ca1DVf9.md.png", bg: 'bg-primary/20', status: kettleStatus, href: '/tournaments/iron-kettle', visible: kettleStatus !== 'IDLE' },
    { id: 'globe', name: t.globe, icon: Globe, color: 'text-primary', bg: 'bg-primary/20', status: globeStatus, href: '/tournaments/iron-globe', visible: globeStatus !== 'FINISHED' },
    { id: 'brick', name: t.brick, icon: Medal, color: 'text-accent', bg: 'bg-accent/20', status: brickStatus, href: '/tournaments/iron-brick', visible: brickStatus !== 'FINISHED' },
  ].filter(t => t.visible);

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
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-2">
        {upcomingTournaments.length > 0 ? (
          upcomingTournaments.map((tour) => (
            <Link key={tour.id} href={tour.href}>
              <Card className={cn(
                "glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer group overflow-hidden",
                tour.status === 'LIVE' && "border-red-500/30 bg-red-500/5"
              )}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-1.5 rounded-xl transition-transform group-hover:scale-110 flex items-center justify-center overflow-hidden w-12 h-12 bg-secondary/50 border border-white/5")}>
                      {tour.image ? (
                        <img src={tour.image} alt="" className="w-full h-full object-contain" />
                      ) : (
                        tour.icon && <tour.icon className={cn("w-6 h-6", tour.color)} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase text-white group-hover:text-primary transition-colors">{tour.name}</h3>
                      <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">{t.format}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <Badge className={cn(
                      "text-[7px] font-black h-5 uppercase tracking-widest px-2",
                      tour.status === 'LIVE' ? "bg-red-600 animate-pulse text-white" : 
                      (tour.status === 'REG_OPEN' || tour.status === 'OPEN' ? "bg-green-600/20 text-green-400" : "bg-secondary text-muted-foreground")
                    )}>
                      {tour.status}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
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

      {upcomingTournaments.length > 0 && (
        <div className="mt-8 p-6 bg-secondary/10 rounded-3xl border border-dashed border-white/5 text-center opacity-40">
          <CalendarClock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-[8px] font-black uppercase tracking-widest">{t.desc}</p>
        </div>
      )}
    </div>
  );
}
