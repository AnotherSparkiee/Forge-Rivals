
'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Users, UserCheck, Newspaper, Ban, VolumeX, UserPlus,
  ChevronLeft, ChevronRight, Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { collection, query, where } from 'firebase/firestore';

export default function ManagersHubPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { language, isLoaded } = useGameState();

  const requestsQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(
      collection(db, 'friend_requests_v4'),
      where('toId', '==', user.uid),
      where('status', '==', 'pending')
    );
  }, [db, user?.uid]);

  const { data: requests } = useCollection(requestsQuery);

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
      title: "MANAGERS HUB",
      subtitle: "Operational Personnel Network",
      locked: "Locked",
      menu: [
        { label: 'All Managers', desc: 'Find and view other club commanders', icon: Globe, active: true, href: '/managers/all' },
        { label: 'Friends', desc: 'Your trusted network of managers', icon: UserCheck, active: true, href: '/managers/friends' },
        { label: 'Friend News', desc: 'Recent activity from your contacts', icon: Newspaper, active: false },
        { label: 'Blacklist', desc: 'Banned and restricted managers', icon: Ban, active: false },
        { label: 'Ignore List', desc: 'Muted transmissions from managers', icon: VolumeX, active: false },
        { label: 'Friend Requests', desc: 'Incoming friendship proposals', icon: UserPlus, active: true, href: '/managers/requests', badge: requests?.length ? requests.length.toString() : null },
      ]
    },
    ru: {
      title: "ХАБ МЕНЕДЖЕРОВ",
      subtitle: "Сеть оперативного персонала",
      locked: "Закрыто",
      menu: [
        { label: 'Все менеджеры', desc: 'Поиск и просмотр других командиров', icon: Globe, active: true, href: '/managers/all' },
        { label: 'Друзья', desc: 'Ваша сеть доверенных менеджеров', icon: UserCheck, active: true, href: '/managers/friends' },
        { label: 'Новости друзей', desc: 'Активность ваших контактов', icon: Newspaper, active: false },
        { label: 'Черный список', desc: 'Заблокированные менеджеры', icon: Ban, active: false },
        { label: 'Игнор-лист', desc: 'Скрытые передачи от менеджеров', icon: VolumeX, active: false },
        { label: 'Хотят дружить', desc: 'Входящие запросы на дружбу', icon: UserPlus, active: true, href: '/managers/requests', badge: requests?.length ? requests.length.toString() : null },
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
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-2">
        {t.menu.map((item) => {
          const content = (
            <Card 
              key={item.label}
              className={cn(
                "glass-card border-white/5 transition-all",
                item.active ? "hover:bg-white/5 cursor-pointer" : "opacity-60"
              )}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-secondary/50", item.color)}>
                    <item.icon className={cn("w-5 h-5", item.active ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold uppercase">{item.label}</h3>
                      {item.badge && (
                        <Badge className="bg-primary text-primary-foreground text-[8px] h-4 px-1.5 font-black animate-pulse">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                {item.active ? (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Badge variant="outline" className="text-[8px] uppercase border-white/10 opacity-50">
                    {t.locked}
                  </Badge>
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
