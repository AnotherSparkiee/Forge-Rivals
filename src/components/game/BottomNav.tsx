'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '@/app/lib/store';
import { getMoscowTime, formatMoscowTime } from '@/app/lib/time-utils';
import { ChevronLeft, Check } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useGameState();
  const [serverTime, setServerTime] = useState<string | null>(null);

  useEffect(() => {
    // ВАЖНО: Обновляем время только на клиенте после монтирования, 
    // чтобы избежать ошибок гидратации и сброса даты.
    const updateTime = () => {
      const now = getMoscowTime();
      setServerTime(formatMoscowTime(now));
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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-white/10 h-20 flex items-center shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      <div className="w-full max-w-lg mx-auto px-4 grid grid-cols-3 items-center">
        
        {/* Left: Action Button */}
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

        {/* Center: Server Time Terminal */}
        <div className="flex flex-col items-center justify-center">
           <div className="px-3 py-1 bg-accent/5 rounded border border-accent/10 shadow-[0_0_15px_rgba(var(--accent),0.05)]">
             <p className="text-[11px] font-mono font-bold text-accent whitespace-nowrap tabular-nums tracking-tight leading-none min-w-[140px] text-center">
               {serverTime || 'SYNCING...'}
             </p>
           </div>
        </div>

        {/* Right: Navigation Back */}
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
