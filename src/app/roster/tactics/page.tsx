'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ChevronLeft, Swords, Target, Shield, 
  Zap, Settings2, Info, Check, Save,
  TrendingUp, Activity, Crosshair
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

type Intensity = 'passive' | 'standard' | 'active';

export default function TacticsPage() {
  const { language, isLoaded, strategy, lineSettings, updateTactics } = useGameState();
  const router = useRouter();
  const { toast } = useToast();

  const [currentStrategy, setCurrentStrategy] = useState(strategy || 'Balanced Play');
  const [currentLineSettings, setCurrentLineSettings] = useState(lineSettings || {
    carry: 'standard',
    mid: 'standard',
    offlane: 'standard'
  });

  const t = {
    title: language === 'ru' ? "ТАКТИКА КОМАНДЫ" : "TEAM TACTICS",
    subtitle: language === 'ru' ? "Управление боевым порядком" : "Combat formation management",
    presets: language === 'ru' ? "ТАКТИЧЕСКИЕ ПРЕСЕТЫ" : "TACTICAL PRESETS",
    manual: language === 'ru' ? "РУЧНАЯ НАСТРОЙКА ЛИНИЙ" : "MANUAL LINE SETTINGS",
    save: language === 'ru' ? "СОХРАНИТЬ ТАКТИКУ" : "SAVE TACTICS",
    saved: language === 'ru' ? "Тактика сохранена" : "Tactics Saved",
    savedDesc: language === 'ru' ? "Команда перегруппирована согласно новому протоколу." : "Team regrouped according to the new protocol.",
    intensities: {
      passive: language === 'ru' ? "Пассивно" : "Passive",
      standard: language === 'ru' ? "Стандарт" : "Standard",
      active: language === 'ru' ? "Активно" : "Active"
    },
    lines: {
      carry: language === 'ru' ? "Линия Керри" : "Carry Lane",
      mid: language === 'ru' ? "Центральная линия" : "Mid Lane",
      offlane: language === 'ru' ? "Сложная линия" : "Offlane"
    },
    presetItems: [
      { id: 'Aggressive Play', label: language === 'ru' ? "Агрессивный" : "Aggressive", icon: Zap, color: "text-red-400", desc: language === 'ru' ? "Максимальный прессинг на всех линиях." : "Maximum pressure on all lanes.", settings: { carry: 'active', mid: 'active', offlane: 'active' } },
      { id: 'Balanced Play', label: language === 'ru' ? "Сбалансированный" : "Balanced", icon: Activity, color: "text-primary", desc: language === 'ru' ? "Равномерное распределение ресурсов." : "Even resource distribution.", settings: { carry: 'standard', mid: 'standard', offlane: 'standard' } },
      { id: 'Defensive Play', label: language === 'ru' ? "Сдержанный" : "Defensive", icon: Shield, color: "text-blue-400", desc: language === 'ru' ? "Упор на выживание и контр-атаки." : "Focus on survival and counter-attacks.", settings: { carry: 'passive', mid: 'passive', offlane: 'passive' } },
      { id: 'Side Pressure', label: language === 'ru' ? "Давление по флангам" : "Side Pressure", icon: TrendingUp, color: "text-accent", desc: language === 'ru' ? "Активные боковые линии, сдержанный мид." : "Active side lanes, passive mid.", settings: { carry: 'active', mid: 'passive', offlane: 'active' } },
      { id: 'Fast Pace', label: language === 'ru' ? "Быстрый темп" : "Fast Pace", icon: Crosshair, color: "text-orange-400", desc: language === 'ru' ? "Активный мид и оффлейн для захвата объектов." : "Active mid and offlane for objective control.", settings: { carry: 'standard', mid: 'active', offlane: 'active' } },
    ]
  };

  const handlePresetSelect = (preset: any) => {
    setCurrentStrategy(preset.id);
    setCurrentLineSettings(preset.settings);
  };

  const handleLineChange = (line: keyof typeof currentLineSettings, val: Intensity) => {
    const newSettings = { ...currentLineSettings, [line]: val };
    setCurrentLineSettings(newSettings);
    
    // Check if it matches a preset
    const matchingPreset = t.presetItems.find(p => 
      p.settings.carry === newSettings.carry && 
      p.settings.mid === newSettings.mid && 
      p.settings.offlane === newSettings.offlane
    );
    
    if (matchingPreset) {
      setCurrentStrategy(matchingPreset.id);
    } else {
      setCurrentStrategy('Custom Tactics');
    }
  };

  const handleSave = () => {
    updateTactics(currentStrategy, currentLineSettings);
    toast({
      title: t.saved,
      description: t.savedDesc,
    });
  };

  if (!isLoaded) return <LoadingScreen />;

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
            <Swords className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-8">
        {/* PRESETS */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent px-1 flex items-center gap-2">
            <Target className="w-3.5 h-3.5" /> {t.presets}
          </h2>
          <div className="space-y-2">
            {t.presetItems.map((preset) => (
              <Card 
                key={preset.id}
                onClick={() => handlePresetSelect(preset)}
                className={cn(
                  "glass-card border-white/5 transition-all cursor-pointer overflow-hidden",
                  currentStrategy === preset.id ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20" : "hover:bg-white/5"
                )}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-lg bg-secondary/50", preset.color)}>
                      <preset.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-tight">{preset.label}</h3>
                      <p className="text-[10px] text-muted-foreground leading-tight">{preset.desc}</p>
                    </div>
                  </div>
                  {currentStrategy === preset.id && <Check className="w-5 h-5 text-primary" />}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* MANUAL CONFIG */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1 flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5" /> {t.manual}
          </h2>
          
          <div className="space-y-3">
            {(Object.keys(t.lines) as Array<keyof typeof t.lines>).map((line) => (
              <Card key={line} className="glass-card border-white/5">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-primary">{t.lines[line]}</span>
                    <Badge variant="outline" className="text-[8px] uppercase border-white/10 opacity-60">
                      {t.intensities[currentLineSettings[line] as Intensity]}
                    </Badge>
                  </div>
                  <div className="flex gap-1 bg-secondary/30 p-1 rounded-xl border border-white/5">
                    {(['passive', 'standard', 'active'] as Intensity[]).map((intensity) => (
                      <button
                        key={intensity}
                        onClick={() => handleLineChange(line, intensity)}
                        className={cn(
                          "flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                          currentLineSettings[line] === intensity 
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                            : "text-muted-foreground hover:bg-white/5"
                        )}
                      >
                        {t.intensities[intensity]}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* INFO CARD */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex gap-4">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
              {language === 'ru' 
                ? "Выбранная тактика определяет поведение ваших героев на карте. Агрессивные линии чаще вступают в размены и ганкают, пассивные — фокусируются на выживании и фарме."
                : "The selected tactics determine your heroes' behavior on the map. Active lanes engage in trades and ganks more frequently, while passive lanes focus on survival and farming."}
            </p>
          </CardContent>
        </Card>

        {/* SAVE BUTTON - NOW IN THE CONTENT FLOW */}
        <div className="pt-4">
          <Button 
            onClick={handleSave}
            className="w-full h-14 hero-gradient font-black text-xs tracking-[0.2em] uppercase shadow-2xl shadow-primary/30 active:scale-95 transition-all"
          >
            <Save className="w-4 h-4 mr-2" />
            {t.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
