'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { doc } from 'firebase/firestore';
import { getMoscowTime, formatMoscowTime } from '@/app/lib/time-utils';
import { Globe, Clock, Wallet } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { COUNTRIES } from '@/app/lib/countries-data';

/**
 * TopBar component displays essential game state information:
 * - Current Team Name & Country (from Profile)
 * - Server Time (Moscow Time)
 * - Credit Balance (from Game State Store)
 */
export function TopBar() {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { credits } = useGameState();
  const db = useFirestore();
  const [serverTime, setServerTime] = useState('');

  // Stable reference for user profile document
  const userRef = useMemoFirebase(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  // Update server clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setServerTime(formatMoscowTime(getMoscowTime()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Hide the bar on auth, registration, and setup pages
  if (isUserLoading || !user || pathname?.startsWith('/auth') || pathname === '/setup') {
    return null;
  }

  // Find country data for the flag
  const userCountry = COUNTRIES.find(c => c.name === profile?.country);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-white/10 h-14 flex items-center">
      <div className="w-full max-w-lg mx-auto px-4 flex items-center justify-between gap-4">
        {/* Section 1: Team Name and Operational Sector (Country) */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0 border border-white/5 shadow-inner">
            <span className="text-xl" role="img" aria-label="country-flag">
              {userCountry?.flag || '🏳️'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-primary uppercase truncate leading-tight tracking-tighter">
              {profile?.displayName || 'Syncing...'}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] leading-tight flex items-center gap-1 opacity-70">
              <Globe className="w-2.5 h-2.5" /> {profile?.country || 'Sector Unknown'}
            </p>
          </div>
        </div>

        {/* Section 2: Moscow Server Time (Centered) */}
        <div className="hidden xs:flex flex-col items-center flex-1">
           <div className="flex items-center gap-1 text-[8px] text-muted-foreground uppercase font-bold tracking-widest opacity-60">
             <Clock className="w-2.5 h-2.5" /> Server Time (MSK)
           </div>
           <p className="text-[10px] font-mono font-bold text-accent tabular-nums">
             {serverTime || '00.00 00:00:00'}
           </p>
        </div>

        {/* Section 3: Financial Assets (Credits) */}
        <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20 shadow-[0_0_10px_rgba(var(--primary),0.1)]">
          <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <span className="text-yellow-500 text-[10px] font-bold italic">€</span>
          </div>
          <span className="text-xs font-headline font-bold text-primary">
            {credits.toLocaleString()}
          </span>
        </div>
      </div>
    </header>
  );
}
