
'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '@/app/lib/store';
import { getMoscowDateString } from '@/app/lib/time-utils';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Gem, Gift, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Handles daily login rewards for the user.
 * Displays a popup once per day (MSK time) if the reward hasn't been claimed.
 */
export function DailyRewardManager() {
  const { isLoaded, language, lastRewardClaimDate, claimReward } = useGameState();
  const [showReward, setShowReward] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      const today = getMoscowDateString();
      if (lastRewardClaimDate !== today) {
        // Show reward popup after a short delay for better UX
        const timer = setTimeout(() => setShowReward(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoaded, lastRewardClaimDate]);

  const handleClaim = () => {
    claimReward(100000, 50); // 100k Credits + 50 Crystals
    setShowReward(false);
  };

  const t = {
    title: language === 'ru' ? "ЕЖЕДНЕВНЫЙ БОНУС" : "DAILY LOGISTICS BONUS",
    desc: language === 'ru' 
      ? "Ваша команда получила снабжение от спонсоров лиги за активную работу." 
      : "Your team has received logistics support from league sponsors for active operations.",
    claim: language === 'ru' ? "ПОЛУЧИТЬ НАГРАДУ" : "CLAIM SUPPLIES",
    credits: "100,000 €",
    crystals: "50 Crystals"
  };

  return (
    <Dialog open={showReward} onOpenChange={setShowReward}>
      <DialogContent className="max-w-xs bg-card border-white/10 p-0 overflow-hidden shadow-2xl">
        <div className="p-6 text-center bg-gradient-to-br from-primary/20 via-background to-accent/10 border-b border-white/5 relative">
          <div className="absolute top-2 right-2">
            <Sparkles className="w-4 h-4 text-accent animate-pulse" />
          </div>
          <div className="mx-auto w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]">
            <Gift className="w-10 h-10 text-primary animate-bounce" />
          </div>
          <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-3 leading-relaxed">
            {t.desc}
          </DialogDescription>
        </div>

        <div className="p-6 grid grid-cols-2 gap-3 bg-background">
          <div className="bg-secondary/30 p-4 rounded-xl border border-white/5 flex flex-col items-center gap-1 group hover:border-primary/30 transition-colors">
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center mb-1">
              <span className="text-yellow-500 font-bold text-xs">€</span>
            </div>
            <p className="text-sm font-headline font-bold text-primary">{t.credits}</p>
            <p className="text-[8px] uppercase font-bold text-muted-foreground">Credits</p>
          </div>
          
          <div className="bg-secondary/30 p-4 rounded-xl border border-white/5 flex flex-col items-center gap-1 group hover:border-accent/30 transition-colors">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mb-1">
              <Gem className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-sm font-headline font-bold text-accent">{t.crystals}</p>
            <p className="text-[8px] uppercase font-bold text-muted-foreground">Premium</p>
          </div>
        </div>

        <div className="p-4 bg-secondary/20 border-t border-white/5">
          <Button 
            className="w-full hero-gradient font-bold uppercase text-[10px] h-12 shadow-lg hover:scale-[1.02] active:scale-95 transition-all" 
            onClick={handleClaim}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            {t.claim}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
