'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '@/app/lib/store';
import { getMoscowTime, formatTerminalTime } from '@/app/lib/time-utils';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * ОПЕРАЦИОННЫЙ ТЕРМИНАЛ (Bottom Bar v40)
 * Обновлен: кнопка ПРИНЯТЬ теперь соответствует стилю кнопки НАЗАД, шрифт времени уменьшен.
 */
export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useGameState();
  
  const [terminalTime, setTerminalTime] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => {
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
    accept: language === 'ru' ? 'ПРИНЯТЬ' : 'ACCEPT',
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-white/10 h-20 flex items-center shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      <div className="w-full max-w-lg mx-auto px-6 grid grid-cols-3 items-center">
        
        {/* LEFT: ACCEPT BUTTON (Matched style with BACK) */}
        <div className="flex justify-start">
          <Button 
            variant="ghost" 
            size="sm" 
            className="group flex flex-col gap-0.5 h-auto py-1.5 px-4 hover:bg-white/5 transition-all active:scale-95 border border-transparent hover:border-white/5"
          >
            <CheckCircle2 className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
            <span className="text-[8px] font-black tracking-widest text-muted-foreground group-hover:text-white uppercase">
              {t.accept}
            </span>
          </Button>
        </div>

        {/* CENTER: TIME (HEADLINE STYLE, REDUCED SIZE) */}
        <div className="flex flex-col items-center justify-center">
          <p className="text-base font-headline font-black text-primary italic whitespace-nowrap tabular-nums tracking-wider leading-none text-center uppercase">
            {terminalTime || '...'}
          </p>
        </div>

        {/* RIGHT: BACK BUTTON */}
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="group flex flex-col gap-0.5 h-auto py-1.5 px-4 hover:bg-white/5 transition-all active:scale-95 border border-transparent hover:border-white/5"
          >
            <ChevronLeft className="w-4 h-4 text-primary group-hover:-translate-x-1 transition-transform" />
            <span className="text-[8px] font-black tracking-widest text-muted-foreground group-hover:text-white uppercase">
              {t.back}
            </span>
          </Button>
        </div>

      </div>
    </nav>
  );
}
