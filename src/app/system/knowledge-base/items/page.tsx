'use client';

import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Zap, Gem, ScrollText, ShieldCheck, Heart, Coffee } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function ItemsKnowledgePage() {
  const { language } = useGameState();

  const t = {
    ru: {
      title: "КАТАЛОГ ПРЕДМЕТОВ",
      subtitle: "Артефакты и операционные ресурсы",
      items: [
        {
          name: "Energy Drink",
          label: "Энергетик 'Cyber-Rush'",
          desc: "Мгновенно восстанавливает 25% энергии выбранному игроку.",
          type: "Расходник",
          icon: Coffee,
          color: "text-blue-400"
        },
        {
          name: "Training Manual",
          label: "Методичка 'S-Tier Strategy'",
          desc: "Дает бонус +10% к получаемому опыту в следующем матче.",
          type: "Обучение",
          icon: ScrollText,
          color: "text-yellow-400"
        },
        {
          name: "Shield Generator",
          label: "Скан-радар",
          desc: "Увеличивает вероятность нахождения редкого таланта при скаутинге на 5%.",
          type: "Инфраструктура",
          icon: ShieldCheck,
          color: "text-primary"
        },
        {
          name: "Aegis",
          label: "Эгида Бессмертия",
          desc: "Позволяет переподписать контракт с ветераном (32+) без штрафа к навыкам.",
          type: "Легендарный",
          icon: ShieldCheck,
          color: "text-accent"
        }
      ]
    },
    en: {
      title: "ITEM CATALOG",
      subtitle: "Artifacts and operational resources",
      items: [
        {
          name: "Energy Drink",
          label: "Cyber-Rush Energy",
          desc: "Instantly restores 25% energy to a selected unit.",
          type: "Consumable",
          icon: Coffee,
          color: "text-blue-400"
        },
        {
          name: "Training Manual",
          label: "S-Tier Strategy Guide",
          desc: "Grants +10% XP bonus in the next tactical engagement.",
          type: "Training",
          icon: ScrollText,
          color: "text-yellow-400"
        },
        {
          name: "Shield Generator",
          label: "Scan-Radar",
          desc: "Increases rare talent discovery probability by 5% during scouting.",
          type: "Infrastructure",
          icon: ShieldCheck,
          color: "text-primary"
        },
        {
          name: "Aegis",
          label: "Aegis of Immortality",
          desc: "Allows veteran contract renewal (32+) without skill penalty.",
          type: "Legendary",
          icon: ShieldCheck,
          color: "text-accent"
        }
      ]
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

      <div className="space-y-3">
        {t.items.map((item) => (
          <Card key={item.name} className="glass-card border-white/5 bg-secondary/10 overflow-hidden">
            <CardContent className="p-4 flex items-start gap-4">
              <div className={cn("p-2.5 rounded-xl bg-secondary/50 border border-white/5 shrink-0", item.color)}>
                <item.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-xs font-bold uppercase text-white truncate">{item.label}</h3>
                  <Badge className="bg-secondary text-[6px] font-black uppercase tracking-tighter border-white/5">{item.type}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                  "{item.desc}"
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
