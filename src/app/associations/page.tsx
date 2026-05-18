'use client';

import { useState } from 'react';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, ChevronRight, Shield, Globe, 
  PlusCircle, History, Info, Users, Star, 
  ShieldCheck, Trophy, Sparkles, Gem
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

type AssocTab = 
  | 'menu'
  | 'all' 
  | 'create' 
  | 'history';

export default function AssociationPage() {
  const { language, isLoaded, crystals, addCrystals } = useGameState();
  const [activeTab, setActiveTab] = useState<AssocTab>('menu');
  const { toast } = useToast();

  if (!isLoaded) return <LoadingScreen />;

  const translations = {
    en: {
      title: "CLUB ASSOCIATION",
      subtitle: "Alliance Hub & Strategic Coalitions",
      back: "Back to Hub",
      insufficient: "Insufficient crystals",
      tabs: {
        all: { label: "All Associations", desc: "Browse global alliance directory", icon: Globe, color: "text-blue-400" },
        create: { label: "Create Association", desc: "Found your own alliance network", icon: PlusCircle, color: "text-green-400" },
        history: { label: "Tournament History", desc: "War logs and competitive achievements", icon: History, color: "text-accent" }
      },
      createInfo: {
        title: "FOUND ALLIANCE",
        desc: "Creating an association allows you to recruit other managers, participate in Alliance Wars and share tactical data.",
        cost: "500 💎"
      },
      historyInfo: {
        title: "WAR CHRONICLES",
        desc: "Historical records of major alliance engagements and tournament standings."
      }
    },
    ru: {
      title: "АССОЦИАЦИЯ КЛУБОВ",
      subtitle: "Центр альянсов и стратегических союзов",
      back: "В меню терминала",
      insufficient: "Недостаточно кристаллов",
      tabs: {
        all: { label: "Все ассоциации", desc: "Глобальный каталог альянсов", icon: Globe, color: "text-blue-400" },
        create: { label: "Создать ассоциацию", desc: "Основать собственную сеть альянса", icon: PlusCircle, color: "text-green-400" },
        history: { label: "История турниров", desc: "Архив войн и боевых достижений", icon: History, color: "text-accent" }
      },
      createInfo: {
        title: "ОСНОВАТЬ АЛЬЯНС",
        desc: "Создание ассоциации позволяет нанимать других менеджеров, участвовать в Войнах Альянсов и обмениваться тактическими данными.",
        cost: "500 💎"
      },
      historyInfo: {
        title: "ХРОНИКИ ВОЙН",
        desc: "Исторические записи крупных сражений альянсов и турнирные таблицы."
      }
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleCreate = () => {
    if (crystals < 500) {
      toast({ title: t.insufficient, variant: "destructive" });
      return;
    }
    // Simulation logic
    toast({ title: language === 'ru' ? "Функция создания в разработке" : "Creation feature coming soon" });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'all':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-secondary/20 p-4 rounded-xl border border-white/5 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <ShieldCheck className="w-5 h-5 text-primary" />
                 <div>
                   <p className="text-xs font-bold uppercase">Zenith Vanguard</p>
                   <p className="text-[8px] text-muted-foreground uppercase">Members: 12/20</p>
                 </div>
               </div>
               <Badge className="bg-primary/20 text-primary text-[8px] font-black uppercase">LVL 5</Badge>
            </div>
            <div className="bg-secondary/20 p-4 rounded-xl border border-white/5 flex items-center justify-between opacity-60">
               <div className="flex items-center gap-3">
                 <Shield className="w-5 h-5 text-muted-foreground" />
                 <div>
                   <p className="text-xs font-bold uppercase">Onyx Alliance</p>
                   <p className="text-[8px] text-muted-foreground uppercase">Members: 8/20</p>
                 </div>
               </div>
               <Badge className="bg-secondary text-muted-foreground text-[8px] font-black uppercase">LVL 2</Badge>
            </div>
            <div className="py-10 text-center opacity-30">
               <p className="text-[8px] font-black uppercase tracking-widest">End of Directory</p>
            </div>
          </div>
        );

      case 'create':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Card className="glass-card border-green-500/20 bg-green-500/5">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                  <PlusCircle className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-xl font-headline font-bold uppercase text-white">{t.createInfo.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed italic px-4">
                  "{t.createInfo.desc}"
                </p>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button 
                className="w-full h-14 bg-green-600/10 border border-green-500/20 text-green-400 font-black uppercase text-[10px] tracking-widest hover:bg-green-600/20"
                onClick={handleCreate}
              >
                <Gem className="w-4 h-4 mr-2 text-blue-400" /> Confirm Founding ({t.createInfo.cost})
              </Button>
            </div>
          </div>
        );

      case 'history':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
             <Card className="glass-card border-accent/20 bg-accent/5">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(var(--accent),0.3)]">
                  <History className="w-10 h-10 text-accent" />
                </div>
                <h3 className="text-xl font-headline font-bold uppercase text-white">{t.historyInfo.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed italic px-4">
                  "{t.historyInfo.desc}"
                </p>
              </CardContent>
            </Card>

            <div className="py-20 text-center opacity-30">
              <Trophy className="w-16 h-16 mx-auto mb-4" />
              <p className="text-xs font-black uppercase tracking-widest leading-relaxed">
                Association archive restricted.<br/>Requires active membership.
              </p>
            </div>
          </div>
        );

      default: return null;
    }
  };

  if (activeTab === 'menu') {
    return (
      <div className="max-w-md mx-auto px-4 pt-8 pb-32">
        <header className="mb-8 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              {t.title}
            </h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </header>

        <div className="space-y-2">
          {(Object.entries(t.tabs) as [AssocTab, any][]).map(([id, data]) => (
            <Card 
              key={id}
              className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer overflow-hidden group"
              onClick={() => setActiveTab(id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-secondary/50", data.color)}>
                    <data.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase group-hover:text-white transition-colors">{data.label}</h3>
                    <p className="text-[10px] text-muted-foreground leading-tight">{data.desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setActiveTab('menu')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-xl font-headline font-bold uppercase tracking-tight">
            {t.tabs[activeTab as keyof typeof t.tabs].label}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.back}</p>
        </div>
      </header>
      {renderContent()}
    </div>
  );
}
