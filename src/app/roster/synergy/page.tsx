'use client';

import { useGameState, LineupSlot } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Link as LinkIcon, ChevronLeft, ShieldCheck, 
  Info, History, Swords, Trophy, Target, AlertTriangle,
  Zap, Star, Award, ShieldAlert, User, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useMemo } from 'react';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

export default function SynergyPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { matchHistory, language, isLoaded, lineup, ownedPlayers } = useGameState();

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  // Расчет общей статистики матчей для сыгранности
  const matchStats = useMemo(() => {
    if (!profile) return { official: 0, unofficial: 0, total: 0 };
    
    const regDate = profile.createdAt ? new Date(profile.createdAt).getTime() : 0;

    let official = 0;
    let unofficial = 0;

    matchHistory.forEach(m => {
      const playedDate = m.playedAt ? new Date(m.playedAt).getTime() : 0;
      if (playedDate < regDate) return;
      
      const isRealMatch = m.opponentName !== 'SEEDED' && m.opponentName !== 'WAITING';
      if (!isRealMatch) return;

      if (m.type === 'league' || m.type === 'tournament') {
        official++;
      } else if (m.type === 'friendly' || m.type === 'basket' || m.type === 'trial') {
        unofficial++;
      }
    });

    return { official, unofficial, total: official + unofficial };
  }, [matchHistory, profile]);

  // Список игроков основы с их статистикой
  const corePlayers = useMemo(() => {
    if (!profile) return [];
    const regDate = profile.createdAt ? new Date(profile.createdAt).getTime() : 0;
    const slots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];

    return slots.map(slot => {
      const pId = lineup[slot];
      const player = ownedPlayers.find(p => p.id === pId);
      if (!player) return null;

      let pMatches = 0;
      matchHistory.forEach(match => {
        const playedDate = match.playedAt ? new Date(match.playedAt).getTime() : 0;
        if (playedDate < regDate) return;
        
        // Проверяем, участвовал ли этот конкретный игрок в матче
        const performance = match.simulation?.games?.[0]?.scoreboard?.find((p: any) => p.name === player.name);
        if (performance) pMatches++;
      });

      return { ...player, clubMatches: pMatches, slotLabel: slot };
    }).filter(Boolean);
  }, [lineup, ownedPlayers, matchHistory, profile]);

  // Точный расчет сыгранности: 2% за оф. матч, 0.01% за тренировку
  const synergyValue = useMemo(() => {
    const raw = (matchStats.official * 2) + (matchStats.unofficial * 0.01);
    return Math.min(100, raw);
  }, [matchStats]);

  const synergyDisplay = synergyValue.toFixed(2).replace('.', ',');

  const t = {
    title: language === 'ru' ? "СЫГРАННОСТЬ" : "TEAM SYNERGY",
    subtitle: language === 'ru' ? "Протокол командного взаимодействия" : "Tactical cohesion protocol",
    mainCard: language === 'ru' ? "УРОВЕНЬ СВЯЗИ ОСНОВЫ" : "CORE COHESION LEVEL",
    officialOnly: language === 'ru' ? "Учитываются все игры Core 5 после регистрации" : "All Core 5 games post-registration considered",
    league: language === 'ru' ? "Оф. Матчи" : "Official",
    cup: language === 'ru' ? "Тренировки" : "Practice",
    total: language === 'ru' ? "Всего игр" : "Total",
    coreUnits: language === 'ru' ? "АКТИВНЫЕ ЕДИНИЦЫ ЯДРА" : "ACTIVE CORE UNITS",
    gamesCount: language === 'ru' ? "игр" : "games",
    desc: language === 'ru' 
      ? "Сыгранность рассчитывается на основе совместных выступлений основной пятерки. Официальные игры (Лига/Кубок) дают 2%, тренировочные (КВ/Тов/Пробные) дают 1% за каждые 100 матчей."
      : "Synergy is calculated based on core five appearances. Official games (League/Cup) grant 2% each, while practice (CW/Friendly/Trial) grant 1% per 100 matches.",
    levels: [
      { min: 0, label: language === 'ru' ? "Начальный" : "Initial", color: "text-muted-foreground" },
      { min: 10, label: language === 'ru' ? "Низкий" : "Low", color: "text-red-400" },
      { min: 25, label: language === 'ru' ? "Средний" : "Medium", color: "text-yellow-400" },
      { min: 60, label: language === 'ru' ? "Высокий" : "High", color: "text-primary" },
      { min: 100, label: language === 'ru' ? "Элитный" : "Elite", color: "text-accent" },
    ],
    rolesRu: {
      carry: "Керри", mid: "Мидер", offlane: "Танк", support: "Лес", full_support: "Саппорт"
    }
  };

  const currentLevel = [...t.levels].reverse().find(l => synergyValue >= l.min) || t.levels[0];

  if (!isLoaded || isUserLoading) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/roster">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <LinkIcon className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-6">
        <Card className="glass-card border-primary/20 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden">
          <CardContent className="p-8 text-center flex flex-col items-center">
            <div className="relative mb-6">
              <div className="w-36 h-36 rounded-full border-4 border-white/5 flex items-center justify-center relative">
                <div 
                  className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin [animation-duration:4s]" 
                  style={{ opacity: synergyValue > 0 ? 1 : 0.2 }}
                />
                <div className="flex flex-col items-center">
                  <span className="text-4xl font-headline font-black italic text-primary">{synergyDisplay}%</span>
                  <p className="text-[8px] font-black text-primary/60 uppercase tracking-tighter mt-1">PRECISION_SYNC</p>
                </div>
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-background px-4 py-1 rounded-full border border-white/10 shadow-xl">
                <p className={cn("text-[10px] font-black uppercase tracking-widest whitespace-nowrap", currentLevel.color)}>
                  {currentLevel.label} Protocol
                </p>
              </div>
            </div>
            
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">
              {t.mainCard}
            </h2>

            <div className="w-full space-y-4">
              <div className="bg-secondary/30 p-4 rounded-xl border border-white/5 grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-[7px] font-black text-muted-foreground uppercase mb-1">{t.league}</p>
                  <p className="text-lg font-headline font-bold text-primary">{matchStats.official}</p>
                </div>
                <div className="text-center border-x border-white/5">
                  <p className="text-[7px] font-black text-muted-foreground uppercase mb-1">{t.cup}</p>
                  <p className="text-lg font-headline font-bold text-accent">{matchStats.unofficial}</p>
                </div>
                <div className="text-center">
                  <p className="text-[7px] font-black text-muted-foreground uppercase mb-1">{t.total}</p>
                  <p className="text-lg font-headline font-bold text-white">{matchStats.total}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* СПИСОК ИГРОКОВ ОСНОВЫ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" /> {t.coreUnits}
            </h3>
            <Badge variant="outline" className="text-[7px] border-white/10 opacity-50 uppercase">Syncing stats...</Badge>
          </div>

          <div className="space-y-2">
            {corePlayers.length > 0 ? corePlayers.map((player: any) => (
              <Card key={player.id} className="glass-card border-white/5 bg-secondary/10 overflow-hidden">
                <CardContent className="p-3 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-background shrink-0">
                         <img src={player.image} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase text-white truncate max-w-[120px]">{player.name}</h4>
                        <p className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">
                          {(t.rolesRu as any)[player.slotLabel] || player.role}
                        </p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-headline font-bold text-primary italic leading-none">{player.clubMatches}</p>
                      <p className="text-[7px] font-black text-muted-foreground uppercase mt-0.5 tracking-tighter">{t.gamesCount}</p>
                   </div>
                </CardContent>
              </Card>
            )) : (
              <div className="py-10 text-center opacity-30 border border-dashed border-white/5 rounded-2xl flex flex-col items-center gap-4">
                 <ShieldAlert className="w-8 h-8" />
                 <p className="text-[9px] font-bold uppercase tracking-widest">No units assigned to core slots</p>
              </div>
            )}
          </div>
        </section>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex gap-4">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
              "{t.desc}"
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
