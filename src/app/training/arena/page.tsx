
'use client';

import { useGameState } from '../../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ChevronLeft, Users, MessageSquare, Coffee, ShoppingBag, 
  Monitor, Home, Lightbulb, ArrowUpCircle, Wallet
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function ArenaPage() {
  const { 
    arena, credits, upgradeArenaCapacity, upgradeArenaFacility, language, isLoaded 
  } = useGameState();
  const { toast } = useToast();

  if (!isLoaded) return null;

  const labels = {
    en: {
      title: "ARENA MANAGEMENT",
      subtitle: "Stadium Operations Terminal",
      capacity: "Seating Capacity",
      upgrade: "Upgrade",
      level: "Level",
      cost: "Cost",
      facilities: "Facility Development",
      success: "Upgrade Successful",
      error: "Insufficient Credits",
      items: {
        capacity: { label: "Stadium Expansion", desc: "+500 Seats per upgrade" },
        pressCenterLevel: { label: "Press Center", desc: "Attracts more media and fans" },
        cafeLevel: { label: "Food Court", desc: "Increases matchday revenue" },
        shopLevel: { label: "Fan Shop", desc: "Higher merchandise sales" },
        screensLevel: { label: "Digital Screens", desc: "Better fan engagement" },
        roofLevel: { label: "Stadium Roof", desc: "Protects from bad weather" },
        lightingLevel: { label: "Lighting System", desc: "Enables HD broadcasts" }
      }
    },
    ru: {
      title: "УПРАВЛЕНИЕ АРЕНОЙ",
      subtitle: "Терминал эксплуатации стадиона",
      capacity: "Вместимость трибун",
      upgrade: "Улучшить",
      level: "Уровень",
      cost: "Стоимость",
      facilities: "Развитие инфраструктуры",
      success: "Улучшение завершено",
      error: "Недостаточно кредитов",
      items: {
        capacity: { label: "Расширение стадиона", desc: "+500 мест за улучшение" },
        pressCenterLevel: { label: "Пресс-центр", desc: "Привлекает СМИ и фанатов" },
        cafeLevel: { label: "Кафе и фуд-корт", desc: "Доход в дни матчей" },
        shopLevel: { label: "Магазин атрибутики", desc: "Продажи мерчандайзинга" },
        screensLevel: { label: "Экраны и табло", desc: "Вовлеченность зрителей" },
        roofLevel: { label: "Крыша стадиона", desc: "Защита от непогоды" },
        lightingLevel: { label: "Система освещения", desc: "HD-трансляции игр" }
      }
    }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  const handleUpgradeCapacity = () => {
    const cost = 1000;
    if (upgradeArenaCapacity(cost)) {
      toast({ title: t.success, description: `+500 seats added.` });
    } else {
      toast({ title: t.error, variant: "destructive" });
    }
  };

  const handleUpgradeFacility = (facility: any) => {
    const currentLevel = (arena as any)[facility];
    const cost = 500 * (currentLevel + 1);
    if (upgradeArenaFacility(facility, cost)) {
      toast({ title: t.success, description: `${t.items[facility as keyof typeof t.items].label} level increased.` });
    } else {
      toast({ title: t.error, variant: "destructive" });
    }
  };

  const facilityList = [
    { id: 'pressCenterLevel', icon: MessageSquare, color: 'text-blue-400' },
    { id: 'cafeLevel', icon: Coffee, color: 'text-orange-400' },
    { id: 'shopLevel', icon: ShoppingBag, color: 'text-green-400' },
    { id: 'screensLevel', icon: Monitor, color: 'text-primary' },
    { id: 'roofLevel', icon: Home, color: 'text-slate-400' },
    { id: 'lightingLevel', icon: Lightbulb, color: 'text-yellow-400' },
  ];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/training">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </div>
        <Badge variant="outline" className="flex items-center gap-1.5 py-1 border-primary/20 text-primary">
          <Wallet className="w-3 h-3" /> {credits.toLocaleString()}
        </Badge>
      </header>

      {/* Main Capacity Card */}
      <Card className="glass-card mb-6 border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-primary/20">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase font-bold text-muted-foreground tracking-widest">{t.capacity}</p>
              <p className="text-3xl font-headline font-bold text-primary">{arena.capacity.toLocaleString()}</p>
            </div>
          </div>
          <Button 
            onClick={handleUpgradeCapacity}
            className="w-full hero-gradient font-bold h-12 flex items-center justify-between px-6"
          >
            <span className="flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4" /> {t.upgrade}
            </span>
            <span className="font-mono text-xs">€ 1,000</span>
          </Button>
          <p className="text-[10px] text-center mt-3 text-muted-foreground italic">
            {t.items.capacity.desc}
          </p>
        </CardContent>
      </Card>

      <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] mb-4 px-1">
        {t.facilities}
      </h2>

      <div className="space-y-3">
        {facilityList.map((item) => {
          const level = (arena as any)[item.id];
          const cost = 500 * (level + 1);
          const data = t.items[item.id as keyof typeof t.items];

          return (
            <Card key={item.id} className="glass-card border-white/5 overflow-hidden">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl bg-secondary/50 border border-white/5 ${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase">{data.label}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[9px] h-4 py-0 uppercase">LVL {level}</Badge>
                      <p className="text-[9px] text-muted-foreground italic">{data.desc}</p>
                    </div>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-9 px-3 border-white/10 hover:bg-primary/10 hover:border-primary/30"
                  onClick={() => handleUpgradeFacility(item.id)}
                >
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-[9px] uppercase font-bold text-primary mb-0.5">{t.upgrade}</span>
                    <span className="text-[8px] font-mono opacity-70">€{cost}</span>
                  </div>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
