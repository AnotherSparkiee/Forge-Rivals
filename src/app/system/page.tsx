'use client';

import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, Settings, Users, ShieldCheck, 
  Info, Loader2, Package, Gift,
  ChevronRight, Sparkles, Database, Sword,
  RefreshCw, Globe, ShieldAlert, AlertTriangle, Construction, Zap
} from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { TOTAL_GROUPS } from '../lib/leagues-data';
import { runGlobalEmergencyRepair } from '../actions/fix-calendar';
import { useToast } from '@/hooks/use-toast';

export default function SystemPage() {
  const { language, seasonNumber, selectedLeagueId } = useGameState();
  const db = useFirestore();
  const { toast } = useToast();
  const [isBuilding, setIsBuilding] = useState(false);

  // Запрос всех актуальных игроков v12 для подсчета статистики
  const playersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'players_v12'));
  }, [db]);
  
  const { data: players, isLoading: isPlayersLoading } = useCollection(playersQuery);

  // Запрос статуса инициализации мира
  const initStatusRef = useMemoFirebase(() => {
    if (!db || !selectedLeagueId) return null;
    return doc(db, 'system_v1', `init_S${seasonNumber}_L${selectedLeagueId}`);
  }, [db, selectedLeagueId, seasonNumber]);

  const { data: initStatus } = useDoc(initStatusRef);

  // Запрос статуса ремонта
  const repairStatusRef = useMemoFirebase(() => {
    if (!db || !selectedLeagueId) return null;
    return doc(db, 'system_v1', `repair_v120_S${seasonNumber}_L${selectedLeagueId}`);
  }, [db, selectedLeagueId, seasonNumber]);

  const { data: repairStatus } = useDoc(repairStatusRef);

  const stats = useMemo(() => {
    if (!players) return { total: 0, online: 0 };
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const total = players.length;
    const onlineCount = players.filter(p => {
      const lastLogin = p.lastLoginDate ? new Date(p.lastLoginDate).getTime() : 0;
      return lastLogin > fiveMinutesAgo;
    }).length;
    return { total: Math.max(total, 0), online: Math.max(onlineCount, 0) };
  }, [players]);

  const worldProgress = initStatus?.currentIndex || 0;
  const isWorldReady = initStatus?.status === 'completed';
  const currentPhase = repairStatus?.phase || 'INITIALIZING';

  const t = {
    ru: { 
      title: "СИСТЕМА", 
      subtitle: "Параметры и сетевая статистика (v120)",
      status: "Статус сети",
      online: "Игроков онлайн",
      registered: "Зарегистрировано",
      knowledge: "База знаний",
      heroes: "Герои",
      heroesDesc: "Реестр из 128 игровых персонажей",
      roles: "Роли",
      rolesDesc: "Специализации и позиции на карте",
      items: "Предметы",
      itemsDesc: "Каталог артефактов и снаряжения",
      bonuses: "Реестр Подарков",
      bonusesDesc: "Справочник дипломатических грузов S-Tier",
      loading: "Синхронизация...",
      hostId: "ID хоста",
      worldStatus: "Состояние мира",
      building: "Постройка пирамиды...",
      ready: "Мир v120 полностью готов",
      forceBuild: "ФОРСИРОВАТЬ ПОСТРОЙКУ МИРА",
      forceDesc: "Нажмите для ускорения создания 511 групп"
    },
    en: { 
      title: "SYSTEM", 
      subtitle: "Parameters and network metrics (v120)",
      status: "Network Status",
      online: "Online Managers",
      registered: "Total Registered",
      knowledge: "Knowledge Base",
      heroes: "Heroes",
      heroesDesc: "Registry of 128 game units",
      roles: "Roles",
      rolesDesc: "Specializations and roles",
      items: "Items",
      itemsDesc: "Artifact and equipment catalog",
      bonuses: "Gifts Registry",
      bonusesDesc: "Guide to S-Tier diplomatic cargo",
      loading: "Syncing...",
      hostId: "Host ID",
      worldStatus: "World Integrity",
      building: "Building Pyramid...",
      ready: "World v120 Ready",
      forceBuild: "FORCE WORLD BUILD",
      forceDesc: "Click to accelerate creation of 511 groups"
    }
  }[language === 'ru' ? 'ru' : 'en'];

  const handleForceBuild = async () => {
    if (isBuilding) return;
    setIsBuilding(true);
    try {
      const res = await runGlobalEmergencyRepair();
      toast({ 
        title: language === 'ru' ? "Цикл постройки запущен" : "Build Cycle Initiated",
        description: `Status: ${res.status} | Progress: ${res.progress || 'N/A'}`
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-8 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full bg-secondary/50 border border-white/5">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-accent px-1">{t.worldStatus}</h2>
          <Card className={cn(
            "glass-card border-white/5 bg-secondary/10 overflow-hidden transition-all",
            !isWorldReady && "border-primary/30"
          )}>
            <CardContent className="p-4">
               <div className="flex items-center justify-between mb-3">
                 <div className="flex items-center gap-3">
                   <div className={cn("p-2 rounded-lg bg-secondary/50", !isWorldReady ? "text-primary animate-pulse" : "text-green-400")}>
                     {isWorldReady ? <ShieldCheck className="w-5 h-5" /> : <Construction className="w-5 h-5" />}
                   </div>
                   <div>
                     <p className="text-xs font-bold uppercase text-white">{isWorldReady ? t.ready : t.building}</p>
                     <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest">Phase: {currentPhase}</p>
                   </div>
                 </div>
                 <div className="text-right">
                    <p className="text-sm font-headline font-bold text-primary">{worldProgress} / {TOTAL_GROUPS}</p>
                 </div>
               </div>
               <div className="h-1.5 w-full bg-background rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
                    style={{ width: `${(worldProgress / TOTAL_GROUPS) * 100}%` }}
                  />
               </div>

               {!isWorldReady && (
                 <div className="mt-6 pt-4 border-t border-white/5">
                   <Button 
                    className="w-full h-12 hero-gradient font-black text-[10px] uppercase tracking-widest shadow-xl"
                    onClick={handleForceBuild}
                    disabled={isBuilding}
                   >
                     {isBuilding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                     {t.forceBuild}
                   </Button>
                   <p className="text-[8px] text-center text-muted-foreground uppercase font-bold mt-2">{t.forceDesc}</p>
                 </div>
               )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-accent px-1">{t.status}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card className="glass-card border-white/5 bg-secondary/10">
              <CardContent className="p-4 text-center">
                <Users className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-[8px] font-black text-muted-foreground uppercase">{t.online}</p>
                {isPlayersLoading ? (
                  <div className="flex justify-center mt-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary opacity-50" />
                  </div>
                ) : (
                  <p className="text-xl font-headline font-bold text-white italic">{stats.online}</p>
                )}
              </CardContent>
            </Card>
            <Card className="glass-card border-white/5 bg-secondary/10">
              <CardContent className="p-4 text-center">
                <ShieldCheck className="w-5 h-5 text-green-400 mx-auto mb-2" />
                <p className="text-[8px] font-black text-muted-foreground uppercase">{t.registered}</p>
                {isPlayersLoading ? (
                  <div className="flex justify-center mt-2">
                    <Loader2 className="w-4 h-4 animate-spin text-green-400 opacity-50" />
                  </div>
                ) : (
                  <p className="text-xl font-headline font-bold text-white italic">{stats.total}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-accent px-1">{t.knowledge}</h2>
          <Link href="/system/knowledge-base/heroes" className="block">
            <Card className="glass-card border-white/5 bg-secondary/10 hover:bg-white/5 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10"><Sparkles className="w-5 h-5 text-primary" /></div>
                  <div><h3 className="text-xs font-bold uppercase">{t.heroes}</h3><p className="text-[9px] text-muted-foreground uppercase">{t.heroesDesc}</p></div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/system/knowledge-base/roles" className="block">
            <Card className="glass-card border-white/5 bg-secondary/10 hover:bg-white/5 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-red-500/10"><Sword className="w-5 h-5 text-red-400" /></div>
                  <div><h3 className="text-xs font-bold uppercase">{t.roles}</h3><p className="text-[9px] text-muted-foreground uppercase">{t.rolesDesc}</p></div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/system/knowledge-base/items" className="block">
            <Card className="glass-card border-white/5 bg-secondary/10 hover:bg-white/5 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-blue-500/10"><Package className="w-5 h-5 text-blue-400" /></div>
                  <div><h3 className="text-xs font-bold uppercase">{t.items}</h3><p className="text-[9px] text-muted-foreground uppercase">{t.itemsDesc}</p></div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/system/knowledge-base/bonuses" className="block">
            <Card className="glass-card border-white/5 bg-secondary/10 hover:bg-white/5 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-yellow-500/10"><Gift className="w-5 h-5 text-yellow-500" /></div>
                  <div><h3 className="text-xs font-bold uppercase">{t.bonuses}</h3><p className="text-[9px] text-muted-foreground uppercase">{t.bonusesDesc}</p></div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </section>

        <div className="p-6 bg-primary/5 rounded-2xl border border-dashed border-white/10 text-center opacity-30">
          <Info className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-[8px] font-black uppercase tracking-widest">{t.hostId}: v120-UNIVERSE-ARCHITECT</p>
          <p className="text-[7px] uppercase font-bold text-muted-foreground mt-1">Версия реестра: 12.1.1</p>
          <Badge variant="outline" className="text-[8px] border-green-500/30 text-green-400 font-black uppercase tracking-widest mt-2">AUTONOMOUS_CYCLE_ACTIVE</Badge>
        </div>
      </div>
    </div>
  );
}
