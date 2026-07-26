'use client';

import { useGameState } from '@/app/lib/store';
import { Gem, Mail, Home, Bell } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn, formatCurrency } from '@/lib/utils';
import Link from 'next/link';

/**
 * ЛОКАЛЬНАЯ ВЕРСИЯ TopBar v32.
 * Полностью удалены зависимости от Firebase для работы в автономном режиме.
 */
export function TopBar() {
  const pathname = usePathname();
  const { credits, crystals, language, isPremium, clubLogo, clubName, displayName } = useGameState();

  const itemBaseClass = "h-8 flex items-center justify-center transition-all border shadow-[0_0_10px_rgba(0,0,0,0.1)]";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-white/10 h-14 flex items-center">
      <div className="w-full max-lg mx-auto px-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-[3] min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {clubLogo && (
              <div className="w-7 h-7 bg-transparent flex items-center justify-center shrink-0">
                <img src={clubLogo} alt="Club" className="w-full h-full object-contain" />
              </div>
            )}

            <div className="flex items-center gap-1 overflow-visible">
              <div className={cn(
                "relative inline-flex items-center",
                isPremium && "border-l-2 border-accent pl-1.5"
              )}>
                {isPremium && (
                  <div className="absolute inset-0 bg-gradient-to-r from-accent/20 via-accent/5 to-transparent -z-10" />
                )}
                <span className="text-[10px] font-black uppercase tracking-tight whitespace-nowrap text-white">
                  {clubName || displayName || (language === 'ru' ? 'ЗАГРУЗКА...' : 'LOADING...')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Link href="/">
            <div className={cn(itemBaseClass, "w-8 rounded-full bg-secondary/50 border-white/5 hover:bg-white/5", pathname === '/' && "bg-primary/10 border-primary/30 text-primary")}>
              <Home className={cn("w-4 h-4", pathname === '/' ? "text-primary" : "text-muted-foreground")} />
            </div>
          </Link>
          <Link href="/chats/private">
            <div className={cn(itemBaseClass, "w-8 rounded-full relative bg-secondary/50 border-white/5 hover:bg-white/5")}>
              <Mail className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
          <Link href="/notifications">
            <div className={cn(itemBaseClass, "w-8 rounded-full relative bg-secondary/50 border-white/5 hover:bg-white/5")}>
              <Bell className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
          <div className={cn(itemBaseClass, "px-2 rounded-full bg-primary/10 border-primary/20")}>
            <div className="w-3 h-3 rounded-full bg-yellow-500/20 flex items-center justify-center mr-1">
              <span className="text-yellow-500 text-[7px] font-bold italic">€</span>
            </div>
            <span className="text-[9px] font-headline font-bold text-primary">{formatCurrency(credits)}</span>
          </div>
          <div className={cn(itemBaseClass, "px-2 rounded-full bg-accent/10 border-accent/20")}>
            <Gem className="w-3 h-3 text-accent mr-1" />
            <span className="text-[9px] font-headline font-bold text-accent">{formatCurrency(crystals || 0)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
