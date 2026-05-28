'use client';

import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Trophy, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

/**
 * Open Tournaments Placeholder (Stub).
 * Displays a clean UI state when no official tournaments are scheduled.
 */
export default function OpenTournamentsPage() {
  const { language } = useGameState();

  const t = {
    title: language === 'ru' ? "ОТКРЫТЫЕ ТУРНИРЫ" : "OPEN TOURNAMENTS",
    subtitle: language === 'ru' ? "Список официальных соревнований" : "List of official competitions",
    noTours: language === 'ru' ? "Нет открытых турниров" : "No open tournaments",
    noToursDesc: language === 'ru' 
      ? "В данный момент регистрация на новые чемпионаты закрыта. Следите за лентой уведомлений, чтобы не пропустить следующие игры." 
      : "Registration for new championships is currently closed. Follow the notification feed for upcoming operational events.",
    back: language === 'ru' ? "Вернуться в хаб" : "Back to Hub"
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
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

      <div className="space-y-6">
        <Card className="glass-card border-white/5 bg-secondary/10 overflow-hidden py-12">
          <CardContent className="flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl animate-pulse"></div>
              <div className="w-24 h-24 rounded-full bg-secondary/50 border-2 border-dashed border-white/10 flex items-center justify-center relative z-10">
                <Trophy className="w-12 h-12 text-muted-foreground opacity-20" />
              </div>
            </div>
            
            <div className="space-y-2 px-6">
              <h2 className="text-xl font-headline font-bold uppercase text-white">{t.noTours}</h2>
              <p className="text-xs text-muted-foreground leading-relaxed italic opacity-70">
                "{t.noToursDesc}"
              </p>
            </div>

            <div className="pt-4 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-primary/50">
              <ShieldAlert className="w-3 h-3" />
              Operational Standby
            </div>
          </CardContent>
        </Card>

        <Link href="/tournaments" className="block">
          <Button variant="outline" className="w-full h-12 border-white/10 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/5">
            {t.back}
          </Button>
        </Link>
      </div>
    </div>
  );
}
