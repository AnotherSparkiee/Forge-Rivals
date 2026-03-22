'use client';

import { useState, useEffect, useMemo } from 'react';
import { useGameState } from '@/app/lib/store';
import { getMoscowDateString } from '@/app/lib/time-utils';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Gem, Gift, Sparkles, CheckCircle2, Lock, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePathname } from 'next/navigation';

/**
 * Handles progressive 30-day login rewards.
 * Displays a calendar of bonuses that improve each day.
 */
export function DailyRewardManager() {
  const { isLoaded, language, lastRewardClaimDate, rewardDay, claimReward } = useGameState();
  const [showReward, setShowReward] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Only show reward on the main dashboard page after registration/setup
    if (isLoaded && pathname === '/') {
      const today = getMoscowDateString();
      if (lastRewardClaimDate !== today) {
        const timer = setTimeout(() => setShowReward(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoaded, lastRewardClaimDate, pathname]);

  // Generate 30 days of rewards
  const calendarRewards = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const day = i + 1;
      const credits = 100000 + (i * 150000) + (Math.floor(i / 7) * 500000);
      const crystals = 10 + (i * 15) + (day % 7 === 0 ? 50 : 0);
      return { day, credits, crystals };
    });
  }, []);

  const currentDayReward = calendarRewards[rewardDay - 1] || calendarRewards[0];

  const handleClaim = () => {
    claimReward(currentDayReward.credits, currentDayReward.crystals);
    setShowReward(false);
  };

  const t = {
    title: language === 'ru' ? "КАЛЕНДАРЬ НАГРАД" : "REWARD CALENDAR",
    subtitle: language === 'ru' ? "Заходите каждый день, чтобы получать лучшие бонусы!" : "Login daily to unlock superior logistical support!",
    claim: language === 'ru' ? "ПОЛУЧИТЬ БОНУС ДНЯ" : "CLAIM TODAY'S BONUS",
    day: language === 'ru' ? "День" : "Day",
    alreadyClaimed: language === 'ru' ? "ПОЛУЧЕНО" : "CLAIMED",
    upcoming: language === 'ru' ? "СКОРО" : "UPCOMING",
    today: language === 'ru' ? "СЕГОДНЯ" : "TODAY",
  };

  return (
    <Dialog open={showReward} onOpenChange={setShowReward}>
      <DialogContent className="max-w-md bg-card border-white/10 p-0 overflow-hidden shadow-2xl h-[85vh] flex flex-col">
        <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5 flex-shrink-0">
          <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-3 border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]">
            <Gift className="w-8 h-8 text-primary animate-bounce" />
          </div>
          <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest font-bold">
            {t.subtitle}
          </DialogDescription>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="grid grid-cols-3 gap-2 pb-4">
            {calendarRewards.map((reward) => {
              const isClaimed = reward.day < rewardDay;
              const isToday = reward.day === rewardDay;
              const isUpcoming = reward.day > rewardDay;

              return (
                <div 
                  key={reward.day}
                  className={cn(
                    "relative p-3 rounded-xl border flex flex-col items-center justify-center transition-all",
                    isClaimed ? "bg-secondary/20 border-white/5 opacity-50" : 
                    isToday ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--primary),0.2)] ring-1 ring-primary/50" : 
                    "bg-secondary/40 border-white/5"
                  )}
                >
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-tighter mb-1",
                    isToday ? "text-primary" : "text-muted-foreground"
                  )}>
                    {t.day} {reward.day}
                  </span>
                  
                  <div className="space-y-1 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Coins className={cn("w-2.5 h-2.5", isToday ? "text-yellow-500" : "text-muted-foreground")} />
                      <span className="text-[9px] font-bold">{(reward.credits / 1000).toFixed(0)}k</span>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Gem className={cn("w-2.5 h-2.5", isToday ? "text-accent" : "text-muted-foreground")} />
                      <span className="text-[9px] font-bold">{reward.crystals}</span>
                    </div>
                  </div>

                  {isClaimed && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px] rounded-xl">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                  
                  {isUpcoming && (
                    <div className="absolute top-1 right-1">
                      <Lock className="w-2 h-2 text-muted-foreground/50" />
                    </div>
                  )}

                  {isToday && (
                    <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[6px] font-black px-1 rounded uppercase">
                      {t.today}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-4 bg-secondary/20 border-t border-white/5 flex-shrink-0">
          <div className="mb-4 p-3 bg-background/50 rounded-xl border border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-[8px] uppercase font-black text-muted-foreground">{t.today} ({t.day} {rewardDay})</p>
                <p className="text-xs font-bold text-primary">
                  {currentDayReward.credits.toLocaleString()} € + {currentDayReward.crystals} Gems
                </p>
              </div>
            </div>
          </div>
          <Button 
            className="w-full h-14 hero-gradient font-bold uppercase text-xs tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all" 
            onClick={handleClaim}
          >
            {t.claim}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
