'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '@/app/lib/store';
import { getMoscowTime, formatMoscowTime } from '@/app/lib/time-utils';
import { ChevronLeft, Check, Clock } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Tactical Bottom Navigation Bar
 * Layout: [Accept] --- [Server Time] --- [Back]
 */
export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useGameState();
  const [serverTime, setServerTime] = useState('');

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
    timeLabel: language === 'ru' ? 'МСК' : 'MSK'
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-white/10 h-16 flex items-center shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
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

        {/* Center: Server Time */}
        <div className="flex flex-col items-center justify-center text-center">
           <div className="flex items-center gap-1 text-[7px] text-muted-foreground uppercase font-bold tracking-[0.2em] opacity-60 mb-0.5">
             <Clock className="w-2 h-2" /> {t.timeLabel}
           </div>
           <p className="text-[11px] font-mono font-bold text-accent tabular-nums tracking-wider bg-accent/5 px-2 py-0.5 rounded border border-accent/10">
             {serverTime.split(' ')[1] || '00:00:00'}
           </p>
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
