'use client';

import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Gift, Zap, Crown, Award, 
  ShieldCheck, TrendingUp, Users, Coins, 
  Target, HeartPulse, GraduationCap, Package
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BonusItem {
  id: string;
  label: string;
  desc: string;
  impact: string;
  icon: any;
  color: string;
  category: 'Premium' | 'License' | 'Staff' | 'Infra' | 'Diplomacy';
}

export default function BonusesKnowledgePage() {
  const { language } = useGameState();

  const bonuses: BonusItem[] = [
    {
      id: 'premium_xp',
      label: language === 'ru' ? "Элитный опыт (Premium)" : "Elite Experience",
      desc: language === 'ru' ? "Множитель 5x для всего получаемого опыта менеджера." : "5x multiplier for all manager experience gained.",
      impact: "XP x5",
      icon: Zap,
      color: "text-yellow-500",
      category: 'Premium'
    },
    {
      id: 'premium_diamonds',
      label: language === 'ru' ? "Кристальный грант (Premium)" : "Crystal Grant",
      desc: language === 'ru' ? "Ежедневное начисление 50 алмазов на баланс клуба." : "Daily 50 diamonds added to club balance.",
      impact: "+50 💎 / day",
      icon: Gift,
      color: "text-blue-400",
      category: 'Premium'
    },
    {
      id: 'license_s_tier',
      label: language === 'ru' ? "Лицензия S-Tier" : "S-Tier License",
      desc: language === 'ru' ? "Разблокирует создание ассоциаций и ежедневные подарки друзьям." : "Unlocks association creation and daily gifts to friends.",
      impact: "Full Access",
      icon: Award,
      color: "text-primary",
      category: 'License'
    },
    {
      id: 'coach_strategy',
      label: language === 'ru' ? "Стратегия тренера" : "Coach Strategy",
      desc: language === 'ru' ? "Увеличивает общую мощь состава и эффективность тактики в матчах." : "Increases total squad power and tactical effectiveness.",
      impact: "+Power %",
      icon: GraduationCap,
      color: "text-blue-400",
      category: 'Staff'
    },
    {
      id: 'analyst_tactics',
      label: language === 'ru' ? "Аналитика боя" : "Tactical Data",
      desc: language === 'ru' ? "Бонус к детерминированным событиям в матчах лиги." : "Bonus to deterministic events in league matches.",
      impact: "+Event Luck",
      icon: Target,
      color: "text-red-400",
      category: 'Staff'
    },
    {
      id: 'bootcamp_speed',
      label: language === 'ru' ? "Буткемп-режим" : "Bootcamp Drills",
      desc: language === 'ru' ? "Ускоряет прокачку навыков героев после матчей до 40%." : "Speeds up hero skill progression after matches by up to 40%.",
      impact: "+40% Training",
      icon: Zap,
      color: "text-accent",
      category: 'Infra'
    },
    {
      id: 'sponsor_bonus',
      label: language === 'ru' ? "Спонсорский контракт" : "Sponsor Contract",
      desc: language === 'ru' ? "Бонус к доходу от Лиги в зависимости от навыков менеджера." : "League income bonus based on manager skills.",
      impact: "+10-50% Revenue",
      icon: Coins,
      color: "text-yellow-400",
      category: 'Infra'
    },
    {
      id: 'gift_architect',
      label: language === 'ru' ? "Архитектор Метавселенной" : "Metaverse Architect",
      desc: language === 'ru' ? "Сокращает время строительства текущих объектов." : "Reduces construction time for active projects.",
      impact: "Time Skip",
      icon: Package,
      color: "text-orange-400",
      category: 'Diplomacy'
    },
    {
      id: 'gift_grant',
      label: language === 'ru' ? "Венчурный Грант" : "Venture Grant",
      desc: language === 'ru' ? "Мгновенное пополнение бюджета клуба (от 1M €)." : "Instant club budget boost (from 1M €).",
      impact: "+Cash Boost",
      icon: TrendingUp,
      color: "text-green-400",
      category: 'Diplomacy'
    }
  ];

  const t = {
    ru: {
      title: "СПИСОК БОНУСОВ",
      subtitle: "Справочник усилений и модификаторов",
      impact: "Эффект",
      category: {
        Premium: "Премиум",
        License: "Лицензии",
        Staff: "Персонал",
        Infra: "Инфраструктура",
        Diplomacy: "Дипломатия"
      }
    },
    en: {
      title: "BONUS LIST",
      subtitle: "Guide to buffs and modifiers",
      impact: "Impact",
      category: {
        Premium: "Premium",
        License: "Licenses",
        Staff: "Staff",
        Infra: "Infrastructure",
        Diplomacy: "Diplomacy"
      }
    }
  }[language === 'ru' ? 'ru' : 'en'];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-8 flex items-center gap-4">
        <Link href="/system">
          <Button variant="ghost" size="icon" className="rounded-full bg-secondary/50 border border-white/5">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-6">
        {(['Premium', 'License', 'Staff', 'Infra', 'Diplomacy'] as const).map(cat => {
          const catBonuses = bonuses.filter(b => b.category === cat);
          if (catBonuses.length === 0) return null;

          return (
            <section key={cat} className="space-y-3">
              <div className="flex items-center gap-2 px-1 border-l-2 border-primary/30 pl-3">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-accent">
                  {(t.category as any)[cat]}
                </h2>
              </div>
              <div className="space-y-2">
                {catBonuses.map((bonus) => (
                  <Card key={bonus.id} className="glass-card border-white/5 bg-secondary/10">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className={cn("p-2.5 rounded-xl bg-secondary/50 border border-white/5 shrink-0 shadow-inner", bonus.color)}>
                          <bonus.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="text-xs font-bold uppercase text-white truncate mr-2">{bonus.label}</h3>
                            <Badge className="bg-primary/20 text-primary text-[7px] font-black uppercase h-4 px-1.5 border-primary/30">
                              {bonus.impact}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                            "{bonus.desc}"
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
