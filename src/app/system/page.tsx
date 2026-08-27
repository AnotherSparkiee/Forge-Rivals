
'use client';

import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, Settings, Users, ShieldCheck, 
  Info, Loader2, Package, Gift,
  ChevronRight, Sparkles, Database, Sword,
  RefreshCw, Globe, ShieldAlert
} from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { runGlobalEmergencyRepair } from '@/app/actions/fix-calendar';
import { useToast } from '@/hooks/use-toast';

export default function SystemPage() {
  const { language } = useGameState();
  const db = useFirestore();
  const { toast } = useToast();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Запрос всех игроков v11 для подсчета статистики
  const playersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'players_v11'));
  }, [db]);
  
  const { data: players, isLoading } = useCollection(playersQuery);

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

  const handleSyncWorld = async () => {
    setIsSyncing(true);
    try {
      const res = await runGlobalEmergencyRepair();
      setSyncStatus(res.details || res.status);
      
      if (res.status === 'ALL_COMPLETE' || res.status === 'ALREADY_DONE') {
        toast({ title: language === 'ru' ? "Синхронизация завершена!" : "Sync Complete!" });
      } else {
        toast({ title: language === 'ru' ? "Порция обработана" : "Chunk Processed" });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Sync Failed" });
    } finally {
      setIsSyncing(false);
    }
  };

  const t = {
    ru: { 
      title: "СИСТЕМА", 
      subtitle: "Параметры и сетевая статистика (v11)",
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
      bonuses: "Список Подарков",
      bonusesDesc: "Справочник дипломатических грузов S-Tier",
      loading: "Синхронизация...",
      hostId: "ID хоста",
      syncTitle: "ГЛОБАЛЬНАЯ СИНХРОНИЗАЦИЯ",
      syncBtn: "СИНХРОНИЗИРОВАТЬ МИР",
      syncDesc: "Нажмите для пошагового развертывания 511 групп лиги и переноса игроков."
    },
    en: { 
      title: "SYSTEM", 
      subtitle: "Parameters and network metrics (v11)",
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
      bonuses: "Gifts List",
      bonusesDesc: "Guide to S-Tier diplomatic cargo",
      loading: "Syncing...",
      hostId: "Host ID",
      syncTitle: "GLOBAL SYNCHRONIZATION",
      syncBtn: "SYNC WORLD STRUCTURE",
      syncDesc: "Click to deploy 511 league groups and migrate players chunk by chunk."
    }
  }[language === 'ru' ? 'ru' : 'en'];

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
          <h2 className="text-[10px] font-black uppercase tracking-widest text-accent px-1">{t.status}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card className="glass-card border-white/5 bg-secondary/10">
              <CardContent className="p-4 text-center">
                <Users className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-[8px] font-black text-muted-foreground uppercase">{t.online}</p>
                {isLoading ? (
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
                {isLoading ? (
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

        {/* НОВЫЙ БЛОК СИНХРОНИЗАЦИИ */}
        <section className="space-y-3">
           <h2 className="text-[10px] font-black uppercase tracking-widest text-primary px-1">{t.syncTitle}</h2>
           <Card className="glass-card border-primary/20 bg-primary/5">
              <CardContent className="p-4 space-y-4">
                 <div className="flex gap-4">
                    <div className="p-2.5 rounded-xl bg-primary/20 border border-primary/30 shrink-0">
                       {isSyncing ? <RefreshCw className="w-6 h-6 text-primary animate-spin" /> : <Globe className="w-6 h-6 text-primary" />}
                    </div>
                    <div>
                       <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                         "{t.syncDesc}"
                       </p>
                       {syncStatus && (
                         <Badge variant="outline" className="mt-2 text-[8px] border-primary/30 text-primary uppercase font-black">
                           STATUS: {syncStatus}
                         </Badge>
                       )}
                    </div>
                 </div>
                 <Button 
                   className="w-full h-12 hero-gradient font-black text-[10px] tracking-widest uppercase shadow-lg active:scale-95 transition-all"
                   onClick={handleSyncWorld}
                   disabled={isSyncing}
                 >
                   {isSyncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                   {t.syncBtn}
                 </Button>
              </CardContent>
           </Card>
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
          <p className="text-[8px] font-black uppercase tracking-widest">{t.hostId}: v11-GLOBAL-SYNC</p>
          <p className="text-[7px] uppercase font-bold text-muted-foreground mt-1">Версия реестра: 11.0.1</p>
          <Badge variant="outline" className="text-[8px] border-green-500/30 text-green-400 font-black uppercase tracking-widest mt-2">AUTONOMOUS_CYCLE_ACTIVE</Badge>
        </div>
      </div>
    </div>
  );
}
