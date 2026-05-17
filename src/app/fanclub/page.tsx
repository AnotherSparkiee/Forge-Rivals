'use client';

import { useState } from 'react';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, ChevronRight, Heart, Users, Ticket, 
  BusFront, Signature, Info, Star, ShieldCheck, 
  TrendingUp, Zap, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Badge } from '@/components/ui/badge';

type FanclubTab = 
  | 'menu'
  | 'groups' 
  | 'free_entry' 
  | 'organized_trip' 
  | 'autograph';

export default function FanclubPage() {
  const { language, isLoaded } = useGameState();
  const [activeTab, setActiveTab] = useState<FanclubTab>('menu');

  if (!isLoaded) return <LoadingScreen />;

  const translations = {
    en: {
      title: "FANCLUB TERMINAL",
      subtitle: "Supporter Management & Loyalty Protocols",
      back: "Back to Hub",
      tabs: {
        groups: { label: "Fan Groups", desc: "Manage organized supporter organizations", icon: Users, color: "text-blue-400" },
        free_entry: { label: "Free Entry", desc: "Promotional ticketing for matchday hype", icon: Ticket, color: "text-green-400" },
        organized_trip: { label: "Organized Trip", desc: "Support for away sector deployments", icon: BusFront, color: "text-orange-400" },
        autograph: { label: "Autograph Session", desc: "Boosting hero media popularity", icon: Signature, color: "text-accent" }
      },
      groupsInfo: {
        title: "SUPPORTER HIERARCHY",
        desc: "Loyal fan groups increase your home stadium advantage and ticket sales efficiency.",
        status: "Active Groups",
        stats: "Community Reach"
      },
      promoInfo: {
        title: "PROMOTIONAL DEPLOYMENT",
        desc: "Offering free entry to local cadet schools increases stadium occupancy but reduces immediate revenue."
      }
    },
    ru: {
      title: "ТЕРМИНАЛ ФАНКЛУБА",
      subtitle: "Управление болельщиками и лояльностью",
      back: "В меню терминала",
      tabs: {
        groups: { label: "Фан-группы", desc: "Управление организациями болельщиков", icon: Users, color: "text-blue-400" },
        free_entry: { label: "Свободный вход", desc: "Промо-акции для заполнения трибун", icon: Ticket, color: "text-green-400" },
        organized_trip: { label: "Организованный выезд", desc: "Поддержка выездного сектора на играх", icon: BusFront, color: "text-orange-400" },
        autograph: { label: "Автограф-сессия", desc: "Повышение медийности и популярности героев", icon: Signature, color: "text-accent" }
      },
      groupsInfo: {
        title: "ИЕРАРХИЯ БОЛЕЛЬЩИКОВ",
        desc: "Организованные фан-группы усиливают преимущество домашней арены и увеличивают продажи мерча.",
        status: "Активные группы",
        stats: "Охват аудитории"
      },
      promoInfo: {
        title: "ПРОМО-КАМПАНИИ",
        desc: "Предоставление свободного входа для местных школ повышает заполняемость стадиона в долгосрочной перспективе."
      }
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const renderContent = () => {
    switch (activeTab) {
      case 'groups':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Card className="glass-card border-blue-500/20 bg-blue-500/5">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  <Users className="w-10 h-10 text-blue-400" />
                </div>
                <h3 className="text-xl font-headline font-bold uppercase text-white">{t.groupsInfo.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed italic px-4">
                  "{t.groupsInfo.desc}"
                </p>
              </CardContent>
            </Card>

            <div className="space-y-3">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">{t.groupsInfo.status}</h4>
               <div className="bg-secondary/20 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <ShieldCheck className="w-5 h-5 text-primary" />
                   <span className="text-xs font-bold uppercase tracking-tight">Main Ultras Section</span>
                 </div>
                 <Badge className="bg-primary text-primary-foreground text-[8px] font-black uppercase">Level 1</Badge>
               </div>
               <div className="bg-secondary/20 p-4 rounded-xl border border-dashed border-white/10 flex items-center justify-center opacity-40">
                 <p className="text-[8px] font-black uppercase tracking-[0.2em]">New Slot: 10,000 XP Required</p>
               </div>
            </div>
          </div>
        );

      case 'free_entry':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Card className="glass-card border-green-500/20 bg-green-500/5">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                  <Ticket className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-xl font-headline font-bold uppercase text-white">{t.promoInfo.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed italic px-4">
                  "{t.promoInfo.desc}"
                </p>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button className="w-full h-14 bg-green-600/10 border border-green-500/20 text-green-400 font-black uppercase text-[10px] tracking-widest hover:bg-green-600/20">
                <Sparkles className="w-4 h-4 mr-2" /> Launch "Cadet Day" Promo
              </Button>
              <p className="text-[8px] text-center text-muted-foreground uppercase font-bold">Cost: 25,000 € | Duration: 1 Match</p>
            </div>
          </div>
        );

      case 'organized_trip':
        return (
          <div className="py-20 text-center opacity-30 animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground mx-auto mb-4 flex items-center justify-center">
              <BusFront className="w-8 h-8" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest leading-relaxed">
              Logistic node restricted.<br/>Requires Division 7 clearance.
            </p>
          </div>
        );

      case 'autograph':
        return (
          <div className="py-20 text-center opacity-30 animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground mx-auto mb-4 flex items-center justify-center">
              <Signature className="w-8 h-8" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest leading-relaxed">
              Media event scheduling offline.<br/>Upgrade HQ Press Office to unlock.
            </p>
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
              <Heart className="w-6 h-6 text-primary" />
              {t.title}
            </h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 mb-8">
           <Card className="glass-card bg-primary/5 border-primary/20">
             <CardContent className="p-4 text-center">
                <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Fan Count</p>
                <p className="text-xl font-headline font-black italic text-primary">12.5k</p>
             </CardContent>
           </Card>
           <Card className="glass-card bg-accent/5 border-accent/20">
             <CardContent className="p-4 text-center">
                <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Loyalty</p>
                <p className="text-xl font-headline font-black italic text-accent">85%</p>
             </CardContent>
           </Card>
        </div>

        <div className="space-y-2">
          {(Object.entries(t.tabs) as [FanclubTab, any][]).map(([id, data]) => (
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
