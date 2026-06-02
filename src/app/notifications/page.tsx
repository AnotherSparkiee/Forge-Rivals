
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Bell, ChevronLeft, Trash2, 
  CheckCircle2, Info, 
  Swords, ShoppingCart, UserPlus, Zap, Trophy, ShieldAlert, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { collection, query, where, orderBy, doc, writeBatch } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function NotificationsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { language, isLoaded } = useGameState();

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v11', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const notificationsQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(
      collection(db, 'notifications_v7'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
  }, [db, user?.uid]);

  const { data: notifications, isLoading: isNotifsLoading } = useCollection(notificationsQuery);

  const displayNotifs = useMemo(() => {
    if (!notifications || !profile) return [];
    const setupTime = profile.setupDate ? new Date(profile.setupDate).getTime() : 0;
    return notifications.filter(n => {
      const notifTime = new Date(n.createdAt).getTime();
      return notifTime >= setupTime;
    });
  }, [notifications, profile]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  const handleMarkAsRead = (id: string) => {
    updateDocumentNonBlocking(doc(db, 'notifications_v7', id), { read: true });
  };

  const handleMarkAllRead = async () => {
    if (!displayNotifs || !user) return;
    const batch = writeBatch(db);
    const unread = displayNotifs.filter(n => !n.read);
    unread.forEach(n => {
      batch.update(doc(db, 'notifications_v7', n.id), { read: true });
    });
    await batch.commit();
  };

  const handleClearAll = async () => {
    if (!displayNotifs || !user) return;
    const batch = writeBatch(db);
    displayNotifs.forEach(n => {
      batch.delete(doc(db, 'notifications_v7', n.id));
    });
    await batch.commit();
  };

  if (isUserLoading || !isLoaded || !user) {
    return <LoadingScreen />;
  }

  const t = {
    en: {
      title: "NOTIFICATIONS",
      subtitle: "Operational Event Log",
      markAllRead: "Read All",
      clearAll: "Clear All",
      noNotifs: "Operational status quiet",
      noNotifsDesc: "No significant tactical events detected since your club was commissioned.",
      typeMatch: "Match Event",
      typeMarket: "Market Update",
      typeSocial: "Social Activity",
      typeInfra: "Infrastructure",
      typeLeague: "League Update",
    },
    ru: {
      title: "УВЕДОМЛЕНИЯ",
      subtitle: "Журнал оперативных событий",
      markAllRead: "Прочитать всё",
      clearAll: "Очистить всё",
      noNotifs: "Важных событий нет",
      noNotifsDesc: "С момента ввода клуба в эксплуатацию значимых оперативных событий не зафиксировано.",
      typeMatch: "Матчи",
      typeMarket: "Рынок",
      typeSocial: "Друзья",
      typeInfra: "Инфраструктура",
      typeLeague: "Лига",
    }
  }[language as 'en' | 'ru'];

  const getIcon = (type: string) => {
    switch (type) {
      case 'match': return { icon: Swords, color: 'text-primary', label: t.typeMatch };
      case 'market': return { icon: ShoppingCart, color: 'text-yellow-400', label: t.typeMarket };
      case 'social': return { icon: UserPlus, color: 'text-green-400', label: t.typeSocial };
      case 'infrastructure': return { icon: Zap, color: 'text-accent', label: t.typeInfra };
      case 'league': return { icon: Trophy, color: 'text-red-400', label: t.typeLeague };
      default: return { icon: Info, color: 'text-muted-foreground', label: 'System' };
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" /> {t.title}
            </h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </div>
      </header>

      {displayNotifs && displayNotifs.length > 0 ? (
        <div className="flex gap-2 mb-6">
          <Button variant="outline" size="sm" className="h-8 text-[8px] font-black uppercase flex-1 border-white/5 bg-secondary/20" onClick={handleMarkAllRead}>
            <CheckCircle2 className="w-3 h-3 mr-2" /> {t.markAllRead}
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[8px] font-black uppercase flex-1 border-white/5 bg-secondary/20 text-muted-foreground" onClick={handleClearAll}>
            <Trash2 className="w-3 h-3 mr-2" /> {t.clearAll}
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        {isNotifsLoading ? (
          <div className="py-20 text-center opacity-50"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : displayNotifs && displayNotifs.length > 0 ? (
          displayNotifs.map((notif) => {
            const config = getIcon(notif.type);
            const Icon = config.icon;
            
            return (
              <Card 
                key={notif.id} 
                className={cn(
                  "glass-card border-white/5 transition-all overflow-hidden relative cursor-pointer active:scale-[0.98]",
                  !notif.read && "border-primary/20 bg-primary/5"
                )}
                onClick={() => !notif.read && handleMarkAsRead(notif.id)}
              >
                {!notif.read && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                )}
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={cn("p-2.5 rounded-xl bg-secondary/50 shrink-0", config.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className={cn("text-[8px] font-black uppercase tracking-widest", config.color)}>{config.label}</span>
                        <span className="text-[8px] text-muted-foreground font-mono">
                          {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white leading-tight mb-1">{notif.title}</h3>
                      <p className="text-[10px] text-muted-foreground leading-relaxed italic">{notif.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
            <div className="w-24 h-24 rounded-full bg-secondary/10 border-2 border-dashed border-white/5 flex items-center justify-center mb-6">
              <ShieldAlert className="w-12 h-12 text-muted-foreground opacity-20" />
            </div>
            <h2 className="text-xl font-headline font-bold uppercase text-white tracking-tight">{t.noNotifs}</h2>
            <p className="text-xs text-muted-foreground mt-2 max-w-[240px] leading-relaxed italic">
              {t.noNotifsDesc}
            </p>
            <Link href="/" className="mt-8">
              <Button variant="outline" className="h-10 text-[9px] font-black uppercase tracking-widest border-white/10 px-8">
                {language === 'ru' ? 'Вернуться в хаб' : 'Return to Hub'}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
