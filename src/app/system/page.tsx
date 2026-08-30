
'use client';

import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, Settings, Users, ShieldCheck, 
  Loader2, Zap, RefreshCw, Globe, 
  ShieldAlert, AlertTriangle, Construction, 
  Trash2, Play, Trophy, Database,
  ChevronRight, CalendarCheck
} from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
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
} from "@/components/ui/dialog";

export default function SystemPage() {
  const { language, seasonNumber, selectedLeagueId } = useGameState();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isBuilding, setIsBuilding] = useState(false);
  const [autoPilot, setAutoPilot] = useState(false);
  const [isNuclearActive, setIsNuclearActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showNuclearDialog, setShowNuclearDialog] = useState(false);
  const [purgeStats, setPurgeStats] = useState({ total: 0, lastOp: 0 });
  
  const playersQuery = useMemoFirebase(() => db ? query(collection(db, 'players_v14')) : null, [db]);
  const { data: players } = useCollection(playersQuery);

  const initStatusRef = useMemoFirebase(() => 
    (db && selectedLeagueId) ? doc(db, 'system_v1', `init_v140_S${seasonNumber}_L${selectedLeagueId}`) : null, 
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
      title: "СИСТЕМА", subtitle: "Параметры и сетевая статистика (v140)",
      status: "Статус сети", online: "Игроков онлайн", registered: "Зарегистрировано",
      worldStatus: "Состояние мира", building: "Подготовка пирамиды к 31.08...", ready: "Мир v140 готов к старту",
      forceBuild: "ФОРСИРОВАТЬ ПОСТРОЙКУ",
      autoPilotOn: "АВТОПИЛОТ: ПОСТРОЙКА...",
      nuclearStatus: "ИДЕТ ОЧИСТКА...",
      adminTitle: "ТЕРМИНАЛ АДМИНИСТРАТОРА",
      nuclear: "ЯДЕРНЫЙ СБРОС v140", nuclearDesc: "Полное удаление данных сезона",
      resolve: "РАССЧИТАТЬ ТУР", resolveDesc: "Запустить расчет матчей",
      cup: "ГЕНЕРАЦИЯ КУБКА", cupDesc: "Создать турнирную сетку",
      transition: "СМЕНА СЕЗОНА", transitionDesc: "Запустить переход",
      readyCheck: "ГОТОВНОСТЬ СЕЗОНА 1", readyCheckDesc: "Проверка запуска 31.08",
      confirmNuclear: "ПОЛНОЕ УДАЛЕНИЕ", confirmNuclearDesc: "Все данные v140 будут стерты навсегда.",
      btnConfirm: "УНИЧТОЖИТЬ", btnCancel: "ОТМЕНА"
    },
    en: { 
      title: "SYSTEM", subtitle: "Parameters and network metrics (v140)",
      status: "Network Status", online: "Online Managers", registered: "Total Registered",
      worldStatus: "World Integrity", building: "Preparing Pyramid for Aug 31...", ready: "World v140 Ready for Launch",
      forceBuild: "FORCE WORLD BUILD",
      autoPilotOn: "AUTOPILOT: BUILDING...",
      nuclearStatus: "SYSTEM PURGING...",
      adminTitle: "ADMIN TERMINAL",
      nuclear: "NUCLEAR RESET v140", nuclearDesc: "Wipe all season data",
      resolve: "RESOLVE DAILY", resolveDesc: "Trigger match calculation",
      cup: "GENERATE CUP", cupDesc: "Create tournament bracket",
      transition: "SEASON TRANSITION", transitionDesc: "Trigger promotion/relegation",
      readyCheck: "SEASON 1 READY CHECK", readyCheckDesc: "Verify Aug 31 launch",
      confirmNuclear: "FULL DELETION", confirmNuclearDesc: "All v140 data will be wiped permanently.",
      btnConfirm: "WIPE ALL", btnCancel: "CANCEL"
    }
  }[language === 'ru' ? 'ru' : 'en'];

  useEffect(() => {
    if (autoPilot && !isWorldReady && !isProcessing) {
      const timer = setTimeout(() => handleAction('forceBuild'), 2500);
      return () => clearTimeout(timer);
    }
  }, [autoPilot, isWorldReady, isProcessing]);

  useEffect(() => {
    if (isNuclearActive && !isProcessing) {
      const timer = setTimeout(() => handleAction('nuclear'), 2000);
      return () => clearTimeout(timer);
    }
  }, [isNuclearActive, isProcessing]);

  const handleAction = async (action: string) => {
    if (isProcessing && action !== 'forceBuild' && action !== 'nuclear') return;

    if (action === 'forceBuild') setIsBuilding(true);
    else if (action === 'nuclear') setIsNuclearActive(true);
    
    setIsProcessing(true);
    
    try {
      if (action === 'nuclear') {
        const res = await totalNuclearResetV131();
        if (!res?.success) throw new Error("Purge Action Failed");
        
        setPurgeStats(prev => ({ total: prev.total + res.deletedCount, lastOp: res.deletedCount }));
        
        if (res.isComplete) {
          setIsNuclearActive(false);
          toast({ title: "System Purged", description: `Total ${purgeStats.total + res.deletedCount} documents removed.` });
          setTimeout(() => window.location.reload(), 2000);
        }
      }
      else if (action === 'forceBuild') {
        const res = await runGlobalEmergencyRepair();
        if (!res || res.status === 'UNKNOWN') throw new Error("Build Logic Failure");
        if (res.status === 'ALL_READY') {
          setAutoPilot(false);
        }
      }
      else if (action === 'resolve') {
        const res = await resolveDailyMatches();
        toast({ title: "Resolve Complete", description: res?.progress });
      }
      else if (action === 'readyCheck') {
        toast({ title: "Ready Check Pass", description: "Launch sequence set for Aug 31 18:00 MSK." });
      }
    } catch (e: any) {
      console.warn("[ADMIN ACTION ERROR]:", e.message);
      setAutoPilot(false);
      setIsNuclearActive(false);
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
            {(autoPilot || isNuclearActive) && (
              <Badge className={cn(
                "animate-pulse text-[8px] font-black uppercase shadow-lg",
                isNuclearActive ? "bg-red-600 text-white" : "bg-primary text-primary-foreground"
              )}>
                {isNuclearActive ? `${t.nuclearStatus} (${purgeStats.total})` : "AUTOPILOT ACTIVE"}
              </Badge>
            )}
          </div>
          <Card className={cn("glass-card border-white/5 bg-secondary/10 overflow-hidden", (autoPilot || isNuclearActive) && "border-primary/30")}>
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
                onClick={() => setAutoPilot(!autoPilot)} 
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
                  <div className="p-2.5 rounded-xl bg-red-500/20 text-red-500">
                    {isNuclearActive ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  </div>
                  <div><h3 className="text-xs font-black uppercase text-white">{t.nuclear}</h3><p className="text-[8px] text-muted-foreground uppercase">{t.nuclearDesc}</p></div>
                </div>
                <ChevronRight className="w-4 h-4 text-red-500/40" />
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
