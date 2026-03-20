
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc } from 'firebase/firestore';
import { Globe, Gem } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { COUNTRIES } from '@/app/lib/countries-data';
import { LEAGUES } from '@/app/lib/leagues-data';

export function TopBar() {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { credits, crystals, language } = useGameState();
  const db = useFirestore();

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v2', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  if (isUserLoading || !user || pathname?.startsWith('/auth') || pathname === '/setup') {
    return null;
  }

  const userCountry = COUNTRIES.find(c => c.name === profile?.country);
  const league = profile?.selectedLeagueId ? LEAGUES.find(l => l.id === profile.selectedLeagueId) : null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-white/10 h-14 flex items-center">
      <div className="w-full max-w-lg mx-auto px-4 flex items-center justify-between gap-4">
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
            <p className="text-[8px] text-muted-foreground uppercase tracking-widest leading-tight flex items-center gap-1 opacity-70">
              <Globe className="w-2 h-2" /> {league ? `${league.id} @ ${league.startTime}` : profile?.country || 'Sector'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Credits - Euros */}
          <div className="flex items-center gap-1.5 bg-primary/10 px-2 py-1 rounded-full border border-primary/20 shadow-[0_0_10px_rgba(var(--primary),0.05)]">
            <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <span className="text-yellow-500 text-[8px] font-bold italic">€</span>
            </div>
            <span className="text-[10px] font-headline font-bold text-primary">
              {credits.toLocaleString()}
            </span>
          </div>
          
          {/* Premium Currency - Crystals */}
          <div className="flex items-center gap-1.5 bg-accent/10 px-2 py-1 rounded-full border border-accent/20 shadow-[0_0_10px_rgba(var(--accent),0.05)]">
            <Gem className="w-3 h-3 text-accent" />
            <span className="text-[10px] font-headline font-bold text-accent">
              {crystals || 0}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
