
'use client';

import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Trophy, Clock, Users, Coins } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { getMoscowTime } from '@/app/lib/time-utils';
import { useMemo } from 'react';

export default function OpenTournamentsPage() {
  const { language } = useGameState();

  const mskNow = getMoscowTime();
  const currentHour = mskNow.getHours();
  const currentMin = mskNow.getMinutes();
  
  // Registration for Iron Globe closes at 20:50 MSK
  const isIronGlobeClosed = currentHour > 20 || (currentHour === 20 && currentMin >= 50);

  const t = {
    title: language === 'ru' ? "ОТКРЫТЫЕ ТУРНИРЫ" : "OPEN TOURNAMENTS",
    subtitle: language === 'ru' ? "Список доступных соревнований" : "Available competitive events",
    entry: language === 'ru' ? "Взнос" : "Entry Fee",
    time: language === 'ru' ? "Начало" : "Starts at",
    participants: language === 'ru' ? "Участников" : "Teams",
    noTours: language === 'ru' ? "Нет открытых турниров" : "No open tournaments",
    noToursDesc: language === 'ru' ? "В данный момент нет турниров, доступных для регистрации. Проверьте историю на наличие активных событий." : "Currently no tournaments available for registration. Check history for active events.",
    tournaments: [
      {
        id: 'iron-globe',
        name: language === 'ru' ? 'Чугунный Глобус' : 'Cast Iron Globe',
        desc: language === 'ru' ? 'Престижный кубок для закаленных менеджеров.' : 'A prestigious cup for battle-hardened managers.',
        fee: 90000,
        startTime: '21:05',
        regCloseTime: '20:50',
        teams: 16,
        active: !isIronGlobeClosed,
        href: '/tournaments/iron-globe'
      }
    ]
  };

  const visibleTournaments = t.tournaments.filter(tour => tour.active);

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/tournaments">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-4">
        {visibleTournaments.length > 0 ? (
          visibleTournaments.map((tour) => (
            <Link key={tour.id} href={tour.href}>
              <Card className="glass-card hover:bg-white/5 transition-all overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/20">
                        <Trophy className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-headline font-bold uppercase text-primary">{tour.name}</h3>
                        <p className="text-[10px] text-muted-foreground italic">{tour.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground mt-1" />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-secondary/40 p-2 rounded-lg text-center border border-white/5">
                      <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1 flex items-center justify-center gap-1">
                        <Coins className="w-2.5 h-2.5" /> {t.entry}
                      </p>
                      <p className="text-xs font-bold text-accent">{tour.fee.toLocaleString()} €</p>
                    </div>
                    <div className="bg-secondary/40 p-2 rounded-lg text-center border border-white/5">
                      <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1 flex items-center justify-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {t.time}
                      </p>
                      <p className="text-xs font-bold text-primary">{tour.startTime}</p>
                    </div>
                    <div className="bg-secondary/40 p-2 rounded-lg text-center border border-white/5">
                      <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1 flex items-center justify-center gap-1">
                        <Users className="w-2.5 h-2.5" /> {t.participants}
                      </p>
                      <p className="text-xs font-bold">{tour.teams}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
            <Trophy className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-lg font-headline font-bold uppercase">{t.noTours}</h2>
            <p className="text-[10px] uppercase font-bold tracking-widest mt-2 max-w-[250px]">
              {t.noToursDesc}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
