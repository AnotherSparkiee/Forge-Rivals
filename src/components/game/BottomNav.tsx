'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '@/app/lib/store';
import { getMoscowTime, formatMoscowTime } from '@/app/lib/time-utils';
import { ChevronLeft, Check, Radio } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { COUNTRIES } from '@/app/lib/countries-data';

/**
 * Tactical Bottom Navigation Bar
 * Layout: [Accept] --- [Identity + Time] --- [Back]
 */
export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const db = useFirestore();
  const { language, isSyncing } = useGameState();
  const [serverTime, setServerTime] = useState('');

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  useEffect(() => {
    const updateTime = () => {
      setServerTime(formatMoscowTime(getMoscowTime()));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (pathname?.startsWith('/auth') || pathname === '/setup') {
    return null;
  }

  const t = {
    accept: language === 'ru' ? 'ПРИНЯТЬ' : 'ACCEPT',
    back: language === 'ru' ? 'НАЗАД' : 'BACK',
  };

  const userCountry = COUNTRIES.find(c => c.name === profile?.country);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-white/10 h-20 flex items-center shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      <div className="w-full max-w-lg mx-auto px-4 grid grid-cols-3 items-center">
        
        {/* Left: Accept Button */}
        <div className="flex justify-start">
          <Button 
            variant="ghost" 
            size="sm" 
            className="group flex flex-col gap-0.5 h-auto py-1.5 px-3 hover:bg-primary/10 transition-all active:scale-95"
          >
            <Check className="w-4 h-4 text-green-400 group-hover:scale-110 transition-transform" />
            <span className="text-[8px] font-black tracking-widest text-muted-foreground group-hover:text-primary">
              {t.accept}
            </span>
          </Button>
        </div>

        {/* Center: Team Identity + Server Time */}
        <div className="flex flex-col items-center justify-center gap-1.5">
           {/* Identity Line */}
           <div className="flex items-center gap-1.5 max-w-[140px] px-2 py-0.5 rounded-full bg-primary/5 border border-primary/10">
             <span className="text-xs" role="img" aria-label="flag">
               {userCountry?.flag || '🏳️'}
             </span>
             <span className="text-[9px] font-black text-primary uppercase truncate tracking-tighter">
               {profile?.displayName || 'Syncing...'}
             </span>
             {isSyncing && (
               <Radio className="w-2 h-2 text-accent animate-pulse" />
             )}
           </div>

           {/* Time Line */}
           <div className="px-2 py-0.5 bg-accent/5 rounded border border-accent/10 shadow-[0_0_15px_rgba(var(--accent),0.05)]">
             <p className="text-[10px] font-mono font-bold text-accent whitespace-nowrap tabular-nums tracking-tight leading-none">
               {serverTime || '00.00 00:00:00'}
             </p>
           </div>
        </div>

        {/* Right: Back Button */}
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="group flex flex-col gap-0.5 h-auto py-1.5 px-3 hover:bg-accent/10 transition-all active:scale-95"
          >
            <ChevronLeft className="w-4 h-4 text-primary group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-[8px] font-black tracking-widest text-muted-foreground group-hover:text-accent">
              {t.back}
            </span>
          </Button>
        </div>

      </div>
    </nav>
  );
}
