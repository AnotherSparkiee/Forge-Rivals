'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc, collection, query, where } from 'firebase/firestore';
import { Globe, Gem, Radio, Mail, Bell } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { COUNTRIES } from '@/app/lib/countries-data';
import { useEffect, useMemo } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import Link from 'next/link';

export function TopBar() {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { credits, crystals, syncStats, isSyncing } = useGameState();
  const db = useFirestore();

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const groupQuery = useMemoFirebase(() => {
    if (!profile?.selectedLeagueId || !user?.uid) return null;
    return query(
      collection(db, 'players_v5'),
      where('selectedLeagueId', '==', profile.selectedLeagueId),
      where('leagueLevel', '==', profile.leagueLevel),
      where('groupId', '==', profile.groupId)
    );
  }, [db, profile?.selectedLeagueId, profile?.leagueLevel, profile?.groupId, user?.uid]);

  const { data: groupPlayers } = useCollection(groupQuery);

  const unreadMessagesQuery = useMemoFirebase(() => {
    if (!user?.uid || !profile) return null;
    return query(
      collection(db, 'private_messages'),
      where('participants', 'array-contains', user.uid)
    );
  }, [db, user?.uid, !!profile]);

  const { data: allMessages } = useCollection(unreadMessagesQuery);
  
  const hasUnread = useMemo(() => {
    if (!allMessages || !user) return false;
    return allMessages.some(msg => msg.receiverId === user.uid && !msg.read);
  }, [allMessages, user]);

  useEffect(() => {
    if (groupPlayers && groupPlayers.length > 0) {
      syncStats(groupPlayers);
    }
  }, [groupPlayers, syncStats]);

  if (isUserLoading || !user || pathname?.startsWith('/auth') || pathname === '/setup') {
    return null;
  }

  const userCountry = COUNTRIES.find(c => c.name === profile?.country);

  // Базовый стиль для всех элементов справа (иконки и баланс)
  const itemBaseClass = "h-8 flex items-center justify-center transition-all border shadow-[0_0_10px_rgba(0,0,0,0.1)]";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-white/10 h-14 flex items-center">
      <div className="w-full max-lg mx-auto px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0 border border-white/5">
            <span className="text-lg" role="img" aria-label="country-flag">
              {userCountry?.flag || '🏳️'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-primary uppercase leading-tight tracking-tighter truncate">
              {profile?.displayName || 'Syncing...'}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[8px] text-muted-foreground uppercase tracking-widest leading-tight flex items-center gap-1 opacity-70">
                < Globe className="w-2 h-2" /> {profile?.country || 'Sector'}
                {isSyncing && (
                  <Radio className="w-2.5 h-2.5 text-accent animate-pulse ml-1" />
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Иконка Уведомлений */}
          <div className={cn(
            itemBaseClass,
            "w-8 rounded-full bg-secondary/50 border-white/5 hover:bg-white/5 cursor-pointer"
          )}>
            <Bell className="w-4 h-4 text-muted-foreground" />
          </div>

          {/* Иконка Сообщений */}
          <Link href="/chats/private">
            <div className={cn(
              itemBaseClass,
              "w-8 rounded-full relative",
              hasUnread ? "bg-accent/20 border-accent/50 animate-pulse" : "bg-secondary/50 border-white/5 hover:bg-white/5"
            )}>
              <Mail className={cn("w-4 h-4", hasUnread ? "text-accent" : "text-muted-foreground")} />
              {hasUnread && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-background"></div>
              )}
            </div>
          </Link>

          {/* Баланс Евро */}
          <div className={cn(
            itemBaseClass,
            "px-2.5 rounded-full bg-primary/10 border-primary/20"
          )}>
            <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/20 flex items-center justify-center mr-1.5">
              <span className="text-yellow-500 text-[8px] font-bold italic">€</span>
            </div>
            <span className="text-[10px] font-headline font-bold text-primary">
              {formatCurrency(credits)}
            </span>
          </div>
          
          {/* Баланс Кристаллов */}
          <div className={cn(
            itemBaseClass,
            "px-2.5 rounded-full bg-accent/10 border-accent/20"
          )}>
            <Gem className="w-3.5 h-3.5 text-accent mr-1.5" />
            <span className="text-[10px] font-headline font-bold text-accent">
              {formatCurrency(crystals || 0)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
