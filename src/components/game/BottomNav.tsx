'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '@/app/lib/store';
import { getMoscowTime, formatTerminalTime } from '@/app/lib/time-utils';
import { ChevronLeft } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * ОПЕРАЦИОННЫЙ ТЕРМИНАЛ (Bottom Bar v38)
 * Динамический хронометр, синхронизированный с серверным временем Москвы (UTC+3).
 */
export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useGameState();
  
  const [terminalTime, setTerminalTime] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => {
      // getMoscowTime() теперь возвращает время, синхронизированное с сервером (Real MSK + 1 year)
      const now = getMoscowTime();
      setTerminalTime(formatTerminalTime(now));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  if (pathname?.startsWith('/auth') || pathname === '/setup') {
    return null;
  }

  const t = {
    back: language === 'ru' ? 'НАЗАД' : 'BACK',
    status: language === 'ru' ? 'ОНЛАЙН' : 'ONLINE',
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-white/10 h-20 flex items-center shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      <div className="w-full max-w-lg mx-auto px-6 grid grid-cols-3 items-center">
        
        <div className="flex justify-start">
          <div className="flex flex-col gap-0.5 opacity-80">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <span className="text-[8px] font-black tracking-[0.2em] text-white">
                {t.status}
              </span>
            </div>
            <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest">
              Sync: Global_MSK
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
           <div className="px-4 py-1.5 bg-primary/5 rounded-lg border border-primary/20 shadow-inner group">
             <p className="text-[13px] font-mono font-black text-primary whitespace-nowrap tabular-nums tracking-widest leading-none min-w-[140px] text-center transition-all group-hover:text-accent">
               {terminalTime || 'CONNECTING...'}
             </p>
           </div>
        </div>

        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="group flex flex-col gap-0.5 h-auto py-1.5 px-4 hover:bg-white/5 transition-all active:scale-95 border border-transparent hover:border-white/5"
          >
            <ChevronLeft className="w-4 h-4 text-primary group-hover:-translate-x-1 transition-transform" />
            <span className="text-[8px] font-black tracking-widest text-muted-foreground group-hover:text-white">
              {t.back}
            </span>
          </Button>
        </div>

      </div>
    </nav>
  );
}