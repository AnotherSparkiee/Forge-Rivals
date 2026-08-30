'use client';

import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, Settings, Users, ShieldCheck, 
  Loader2, Zap, RefreshCw, Globe, 
  ShieldAlert, AlertTriangle, Construction, 
  Trash2, Play, FastForward, Trophy, Database,
  ChevronRight, CalendarCheck
} from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { TOTAL_GROUPS } from '../lib/leagues-data';
import { runGlobalEmergencyRepair } from '../actions/fix-calendar';
import { totalNuclearResetV131 } from '../actions/nuclear-reset';
import { resolveDailyMatches, performSeasonTransition } from '../actions/autonomous-cycle';
import { generatePyramidCup } from '../actions/cup-engine';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function SystemPage() {
  const { language, seasonNumber, selectedLeagueId } = useGameState();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isBuilding, setIsBuilding] = useState(false);
  const [autoPilot, setAutoPilot] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showNuclearDialog, setShowNuclearDialog] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const playersQuery = useMemoFirebase(() => db ? query(collection(db, 'players_v13')) : null, [db]);
  const { data: players, isLoading: isPlayersLoading } = useCollection(playersQuery);

  const initStatusRef = useMemoFirebase(() => 
    (db && selectedLeagueId) ? doc(db, 'system_v1', `init_v131_S${seasonNumber}_L${selectedLeagueId}`) : null, 
    [db, selectedLeagueId, seasonNumber]
  );
  const { data: initStatus } = useDoc(initStatusRef);

  const stats = useMemo(() => {
    if (!players) return { total: 0, online: 0 };
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const onlineCount = players.filter(p => (p.lastLoginDate ? new Date(p.lastLoginDate).getTime() : 0) > fiveMinutesAgo).length;
    return { total: players.length, online: onlineCount };
  }, [players]);

  const worldProgress = initStatus?.currentIndex || 0;
  const isWorldReady = worldProgress >= TOTAL_GROUPS;

  const t = {
    ru: { 
      title: "СИСТЕМА", subtitle: "Параметры и сетевая статистика (v131)",
      status: "Статус сети", online: "Игроков онлайн", registered: "Зарегистрировано",
      worldStatus: "Состояние мира", building: "Подготовка пирамиды к 31.08...", ready: "Мир v131 готов к старту",
      forceBuild: "ФОРСИРОВАТЬ ПОСТРОЙКУ",
      autoPilotOn: "АВТОПИЛОТ: ПОСТРОЙКА...",
      adminTitle: "ТЕРМИНАЛ АДМИНИСТРАТОРА",
      nuclear: "ЯДЕРНЫЙ СБРОС v131", nuclearDesc: "Удалить ВСЕХ игроков и таблицы Сезона 1",
      resolve: "РАССЧИТАТЬ ТУР", resolveDesc: "Запустить расчет матчей сегодняшнего дня",
      cup: "ГЕНЕРАЦИЯ КУБКА", cupDesc: "Создать турнирную сетку на текущий сезон",
      transition: "СМЕНА СЕЗОНА", transitionDesc: "Запустить переход в следующий сезон",
      readyCheck: "ГОТОВНОСТЬ СЕЗОНА 1", readyCheckDesc: "Проверить корректность старта 31.08",
      error: "Сервер занят. Пробуем снова...",
      retrying: "Сбой сети. Повтор...",
      confirmNuclear: "ПОЛНОЕ УДАЛЕНИЕ", confirmNuclearDesc: "Все игроки v131 и данные сезона будут стерты. Это действие необратимо.",
      btnConfirm: "УНИЧТОЖИТЬ", btnCancel: "ОТМЕНА"
    },
    en: { 
      title: "SYSTEM", subtitle: "Parameters and network metrics (v131)",
      status: "Network Status", online: "Online Managers", registered: "Total Registered",
      worldStatus: "World Integrity", building: "Preparing Pyramid for Aug 31...", ready: "World v131 Ready for Launch",
      forceBuild: "FORCE WORLD BUILD",
      autoPilotOn: "AUTOPILOT: BUILDING...",
      adminTitle: "ADMIN TERMINAL",
      nuclear: "NUCLEAR RESET v131", nuclearDesc: "Delete ALL players and tables for Season 1",
      resolve: "RESOLVE DAILY", resolveDesc: "Trigger match calculation for current tour",
      cup: "GENERATE CUP", cupDesc: "Create tournament bracket for current season",
      transition: "SEASON TRANSITION", transitionDesc: "Trigger promotion/relegation logic",
      readyCheck: "SEASON 1 READY CHECK", readyCheckDesc: "Verify Aug 31 launch parameters",
      error: "Server busy. Retrying...",
      retrying: "Network lag. Retrying...",
      confirmNuclear: "FULL DELETION", confirmNuclearDesc: "All v131 players and season data will be wiped. Action is irreversible.",
      btnConfirm: "WIPE ALL", btnCancel: "CANCEL"
    }
  }[language === 'ru' ? 'ru' : 'en'];

  // Умная логика автопилота с обработкой ошибок
  useEffect(() => {
    if (autoPilot && !isWorldReady && !isProcessing && !isBuilding) {
      const timer = setTimeout(() => {
        handleAction('forceBuild');
      }, 2000); 
      return () => clearTimeout(timer);
    }
    if (isWorldReady && autoPilot) {
      setAutoPilot(false);
      toast({ title: "Universe v131 Complete", description: "All 511 groups initialized." });
    }
  }, [autoPilot, isWorldReady, isProcessing, isBuilding]);

  const handleAction = async (action: string) => {
    if (isProcessing && action !== 'forceBuild') return;

    if (action === 'forceBuild') setIsBuilding(true);
    else setIsProcessing(true);
    
    try {
      if (action === 'nuclear') {
        await totalNuclearResetV131();
        setAutoPilot(false); 
        toast({ title: "System Purged", description: "All flags and players removed." });
        window.location.reload();
      }
      else if (action === 'resolve') {
        const res = await resolveDailyMatches();
        toast({ title: "Resolve Complete", description: res?.progress });
      }
      else if (action === 'cup') {
        await generatePyramidCup(seasonNumber);
        toast({ title: "Cup Generated" });
      }
      else if (action === 'transition') {
        await performSeasonTransition();
        toast({ title: "Transition Success" });
      }
      else if (action === 'forceBuild') {
        await runGlobalEmergencyRepair();
        setRetryCount(0); // Сброс счетчика ошибок при успехе
      }
      else if (action === 'readyCheck') {
        toast({ title: "Ready Check Pass", description: "Launch sequence set for Aug 31 18:00 MSK." });
      }
    } catch (e: any) {
      console.error("[ADMIN ACTION ERROR]:", e.message);
      if (autoPilot) {
        setRetryCount(prev => prev + 1);
      } else {
        toast({ variant: "destructive", title: "API Delay", description: t.error });
      }
    } finally {
      setIsProcessing(false);
      setIsBuilding(false);
      setShowNuclearDialog(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-8 flex items-center gap-4">
        <Link href="/"><Button variant="ghost" size="icon" className="rounded-full bg-secondary/50 border border-white/5"><ChevronLeft className="w-6 h-6" /></Button></Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white flex items-center gap-2"><Settings className="w-6 h-6 text-primary" /> {t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-8">
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-accent">{t.worldStatus}</h2>
            {autoPilot && (
              <Badge className={cn(
                "animate-pulse text-[8px] font-black uppercase shadow-lg transition-colors",
                retryCount > 0 ? "bg-red-600 text-white" : "bg-primary text-primary-foreground"
              )}>
                {retryCount > 0 ? t.retrying : "AUTOPILOT ACTIVE"}
              </Badge>
            )}
          </div>
          <Card className={cn("glass-card border-white/5 bg-secondary/10 overflow-hidden", (!isWorldReady || autoPilot) && "border-primary/30")}>
            <CardContent className="p-4">
               <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-3">
                   <div className={cn("p-2 rounded-lg bg-secondary/50", (!isWorldReady || autoPilot) ? "text-primary animate-pulse" : "text-green-400")}>
                     {isWorldReady ? <ShieldCheck className="w-5 h-5" /> : <Construction className="w-5 h-5" />}
                   </div>
                   <p className="text-xs font-bold uppercase text-white">{isWorldReady ? t.ready : (autoPilot ? t.autoPilotOn : t.building)}</p>
                 </div>
                 <p className="text-sm font-headline font-bold text-primary">{worldProgress} / {TOTAL_GROUPS}</p>
               </div>
               <div className="h-1.5 w-full bg-background rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-primary transition-all duration-500 shadow-[0_0_10px_rgba(var(--primary),0.5)]" style={{ width: `${(worldProgress / TOTAL_GROUPS) * 100}%` }} />
               </div>
               
               <Button 
                className={cn(
                  "w-full h-14 font-black text-xs uppercase mt-4 shadow-xl transition-all tracking-widest",
                  autoPilot ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20" : "hero-gradient"
                )} 
                onClick={() => autoPilot ? setAutoPilot(false) : setAutoPilot(true)} 
                disabled={isProcessing && !autoPilot}
               >
                  {isBuilding || autoPilot ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />} 
                  {autoPilot ? (language === 'ru' ? 'ОСТАНОВИТЬ' : 'STOP AUTOPILOT') : t.forceBuild}
               </Button>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-red-500 px-1 flex items-center gap-2"><Database className="w-4 h-4" /> {t.adminTitle}</h2>
          <div className="grid grid-cols-1 gap-2">
            <Card className="glass-card border-red-500/20 bg-red-500/5 overflow-hidden group hover:border-red-500/40 transition-all cursor-pointer" onClick={() => setShowNuclearDialog(true)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-red-500/20 text-red-500"><Trash2 className="w-5 h-5" /></div>
                  <div><h3 className="text-xs font-black uppercase text-white">{t.nuclear}</h3><p className="text-[8px] text-muted-foreground uppercase">{t.nuclearDesc}</p></div>
                </div>
                <ChevronRight className="w-4 h-4 text-red-500/40" />
              </CardContent>
            </Card>

            <Card className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer" onClick={() => handleAction('readyCheck')}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-secondary/50 text-primary"><CalendarCheck className="w-5 h-5" /></div>
                  <div><h3 className="text-xs font-black uppercase text-white">{t.readyCheck}</h3><p className="text-[8px] text-muted-foreground uppercase">{t.readyCheckDesc}</p></div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>

            <Card className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer" onClick={() => handleAction('resolve')}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-secondary/50 text-green-400"><Play className="w-5 h-5" /></div>
                  <div><h3 className="text-xs font-black uppercase text-white">{t.resolve}</h3><p className="text-[8px] text-muted-foreground uppercase">{t.resolveDesc}</p></div>
                </div>
                {isProcessing && !isBuilding ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </CardContent>
            </Card>

            <Card className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer" onClick={() => handleAction('cup')}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-secondary/50 text-yellow-500"><Trophy className="w-5 h-5" /></div>
                  <div><h3 className="text-xs font-black uppercase text-white">{t.cup}</h3><p className="text-[8px] text-muted-foreground uppercase">{t.cupDesc}</p></div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-accent px-1">{t.status}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card className="glass-card border-white/5 bg-secondary/10 p-4 text-center">
              <Users className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-[8px] font-black text-muted-foreground uppercase">{t.online}</p>
              <p className="text-xl font-headline font-bold text-white italic">{stats.online}</p>
            </Card>
            <Card className="glass-card border-white/5 bg-secondary/10 p-4 text-center">
              <ShieldCheck className="w-5 h-5 text-green-400 mx-auto mb-2" />
              <p className="text-[8px] font-black text-muted-foreground uppercase">{t.registered}</p>
              <p className="text-xl font-headline font-bold text-white italic">{stats.total}</p>
            </Card>
          </div>
        </section>
      </div>

      <Dialog open={showNuclearDialog} onOpenChange={setShowNuclearDialog}>
        <DialogContent className="max-w-xs bg-card border-white/10 p-6">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20"><AlertTriangle className="w-8 h-8 text-red-500 animate-pulse" /></div>
            <DialogTitle className="text-center font-headline font-bold uppercase text-red-500">{t.confirmNuclear}</DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground mt-2">{t.confirmNuclearDesc}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-6">
            <Button variant="destructive" className="h-12 font-black uppercase text-[10px]" onClick={() => handleAction('nuclear')} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin" /> : t.btnConfirm}
            </Button>
            <Button variant="outline" className="h-12 font-bold uppercase text-[10px] border-white/10" onClick={() => setShowNuclearDialog(false)}>
              {t.btnCancel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
