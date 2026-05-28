'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc, collection, query, where } from 'firebase/firestore';
import { Gem, Mail, Home, Radio, Bell } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { COUNTRIES } from '@/app/lib/countries-data';
import Link from 'next/link';

export function TopBar() {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { credits, crystals, syncStats, isSyncing, language } = useGameState();
  const db = useFirestore();

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const userCountry = COUNTRIES.find(c => c.name === profile?.country);

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
  
  const hasUnreadMessages = useMemo(() => {
    if (!allMessages || !user) return false;
    return allMessages.some(msg => msg.receiverId === user.uid && !msg.read);
  }, [allMessages, user]);

  const notificationsQuery = useMemoFirebase(() => {
    if (!user?.uid || !profile) return null;
    return query(
      collection(db, 'notifications_v1'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );
  }, [db, user?.uid, !!profile]);

  const { data: notifications } = useCollection(notificationsQuery);
  const unreadNotifCount = notifications?.length || 0;

  useEffect(() => {
    if (groupPlayers && groupPlayers.length > 0) {
      syncStats(groupPlayers);
    }
  }, [groupPlayers, syncStats]);

  if (isUserLoading || !user || pathname?.startsWith('/auth') || pathname === '/setup') {
    return null;
  }

  const itemBaseClass = "h-8 flex items-center justify-center transition-all border shadow-[0_0_10px_rgba(0,0,0,0.1)]";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-white/10 h-14 flex items-center">
      <div className="w-full max-w-lg mx-auto px-4 flex items-center justify-between gap-2">
        
        {/* Left: Team Identity & Connection */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px]" role="img" aria-label="flag">
              {userCountry?.flag || '🏳️'}
            </span>
            <span className="text-[9px] font-black text-primary uppercase tracking-tight whitespace-nowrap truncate max-w-[120px]">
              {profile?.displayName || (language === 'ru' ? 'СИНХРОНИЗАЦИЯ...' : 'SYNCING...')}
            </span>
          </div>
          {isSyncing && (
            <Radio className="w-3.5 h-3.5 text-accent shrink-0 animate-pulse" />
          )}
        </div>

        {/* Right: Tools & Balances */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Link href="/">
            <div className={cn(
              itemBaseClass,
              "w-8 rounded-full bg-secondary/50 border-white/5 hover:bg-white/5 cursor-pointer",
              pathname === '/' && "bg-primary/10 border-primary/30 text-primary"
            )}>
              <Home className={cn("w-4 h-4", pathname === '/' ? "text-primary" : "text-muted-foreground")} />
            </div>
          </Link>

          <Link href="/chats/private">
            <div className={cn(
              itemBaseClass,
              "w-8 rounded-full relative bg-secondary/50 border-white/5 hover:bg-white/5",
              hasUnreadMessages && "bg-accent/20 border-accent/50 animate-pulse"
            )}>
              <Mail className={cn("w-4 h-4", hasUnreadMessages ? "text-accent" : "text-muted-foreground")} />
              {hasUnreadMessages && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-background"></div>
              )}
            </div>
          </Link>

          <Link href="/notifications">
            <div className={cn(
              itemBaseClass,
              "w-8 rounded-full relative bg-secondary/50 border-white/5 hover:bg-white/5",
              unreadNotifCount > 0 && "bg-primary/20 border-primary/50 animate-pulse"
            )}>
              <Bell className={cn("w-4 h-4", unreadNotifCount > 0 ? "text-primary" : "text-muted-foreground")} />
              {unreadNotifCount > 0 && (
                <div className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1 bg-red-500 rounded-full border border-background flex items-center justify-center">
                  <span className="text-[7px] font-black text-white leading-none">{unreadNotifCount}</span>
                </div>
              )}
            </div>
          </Link>

          <div className={cn(
            itemBaseClass,
            "px-2 rounded-full bg-primary/10 border-primary/20"
          )}>
            <div className="w-3 h-3 rounded-full bg-yellow-500/20 flex items-center justify-center mr-1">
              <span className="text-yellow-500 text-[7px] font-bold italic">€</span>
            </div>
            <span className="text-[9px] font-headline font-bold text-primary">
              {formatCurrency(credits)}
            </span>
          </div>
          
          <div className={cn(
            itemBaseClass,
            "px-2 rounded-full bg-accent/10 border-accent/20"
          )}>
            <Gem className="w-3 h-3 text-accent mr-1" />
            <span className="text-[9px] font-headline font-bold text-accent">
              {formatCurrency(crystals || 0)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
