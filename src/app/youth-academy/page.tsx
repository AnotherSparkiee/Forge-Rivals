'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Users, GraduationCap, Dumbbell, ShoppingCart,
  ChevronLeft, ChevronRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function YouthAcademyHubPage() {
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
      title: "YOUTH ACADEMY",
      subtitle: "Talent Development Hub",
      locked: "Locked",
      menu: [
        { label: 'Academy Squad', desc: 'Manage your current students', icon: Users, href: '/youth-academy/squad', active: true },
        { label: 'Youth Training', desc: 'Daily skill development for pupils', icon: Dumbbell, href: '/youth-academy/training', active: true },
        { label: 'Youth Transfers', desc: 'Market operations for rising stars', icon: ShoppingCart, href: '/youth-academy/transfers', active: true },
      ]
    },
    ru: {
      title: "ЮНОШЕСКАЯ АКАДЕМИЯ",
      subtitle: "Центр развития талантов",
      locked: "Закрыто",
      menu: [
        { label: 'Состав академии', desc: 'Ваши текущие ученики', icon: Users, href: '/youth-academy/squad', active: true },
        { label: 'Тренировка юниоров', desc: 'Развитие навыков молодежи', icon: Dumbbell, href: '/youth-academy/training', active: true },
        { label: 'Трансферы юниоров', desc: 'Рынок будущих легенд', icon: ShoppingCart, href: '/youth-academy/transfers', active: true },
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
            <GraduationCap className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-2">
        {t.menu.map((item) => (
          <Link 
            key={item.label} 
            href={item.active ? item.href! : '#'} 
            className={cn("block", !item.active && "cursor-not-allowed")}
          >
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
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                {item.active ? (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Badge variant="outline" className="text-[8px] uppercase">{t.locked}</Badge>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
