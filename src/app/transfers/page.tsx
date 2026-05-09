'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ShoppingCart, Star, Search, SlidersHorizontal, 
  Package, Coins, ChevronLeft, ChevronRight, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function TransfersPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { language, isLoaded } = useGameState();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !isLoaded || !user) {
    return <LoadingScreen />;
  }

  const translations = {
    en: {
      title: "TRANSFER TERMINAL",
      subtitle: "Market Operations Hub",
      locked: "Restricted",
      menu: [
        { label: 'PRO Players', desc: 'Elite professional athletes market', icon: Star, active: false },
        { label: 'Quick Search', desc: 'Rapid acquisition protocols', icon: Search, active: true, href: '/transfers/quick-search' },
        { label: 'Advanced Search', desc: 'Detailed scouting filters', icon: SlidersHorizontal, active: true, href: '/transfers/advanced-search' },
        { label: 'My Purchases', desc: 'Acquisition history dossier', icon: Package, active: false },
        { label: 'My Sales', desc: 'Transfer revenue records', icon: Coins, active: false },
      ]
    },
    ru: {
      title: "ТРАНСФЕРНЫЙ ТЕРМИНАЛ",
      subtitle: "Хаб рыночных операций",
      locked: "Закрыто",
      menu: [
        { label: 'PRO-Игроки', desc: 'Рынок элитных профессионалов', icon: Star, active: false },
        { label: 'Быстрый поиск', desc: 'Протоколы мгновенного найма', icon: Search, active: true, href: '/transfers/quick-search' },
        { label: 'Расширенный поиск', desc: 'Детальные фильтры скаутинга', icon: SlidersHorizontal, active: true, href: '/transfers/advanced-search' },
        { label: 'Мои покупки', desc: 'Досье истории приобретений', icon: Package, active: false },
        { label: 'Мои продажи', desc: 'Записи о доходах с трансферов', icon: Coins, active: false },
      ]
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-2">
        {t.menu.map((item) => {
          const content = (
            <Card 
              className={cn(
                "glass-card border-white/5 transition-all",
                item.active ? "hover:bg-white/5 cursor-pointer" : "opacity-60"
              )}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <item.icon className={cn("w-5 h-5", item.active ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase">{item.label}</h3>
                    <p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p>
                  </div>
                </div>
                {item.active ? (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                     <Lock className="w-3 h-3 text-muted-foreground/50" />
                     <span className="text-[7px] uppercase font-bold text-muted-foreground/50">{t.locked}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );

          if (item.active && item.href) {
            return (
              <Link key={item.label} href={item.href} className="block">
                {content}
              </Link>
            );
          }

          return (
            <div key={item.label} className={cn("block", !item.active && "cursor-not-allowed")}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
