'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LEAGUES } from '@/app/lib/leagues-data';
import { COUNTRIES } from '@/app/lib/countries-data';
import { Loader2, Clock, CheckCircle2, Flag, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

export default function SetupPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { isLoaded, selectedLeagueId: currentLeague, country: currentCountry, language } = useGameState();
  
  const [step, setStep] = useState<'league' | 'country'>('league');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/auth/register');
    }
  }, [user, isUserLoading, router]);

  const handleCompleteSetup = async () => {
    if (!user || !selectedLeagueId || !selectedCountryCode) return;
    setIsUpdating(true);
    try {
      const targetLevel = 9;
      const targetGroup = 1;
      const { seasonNumber } = getGlobalSeasonInfo();
      
      const profileRef = doc(db, 'players_v10', user.uid);
      const selectedCountry = COUNTRIES.find(c => c.code === selectedCountryCode);
      
      await setDoc(profileRef, {
        selectedLeagueId,
        country: selectedCountry?.name || 'International',
        leagueLevel: targetLevel,
        groupId: targetGroup,
        setupDate: new Date().toISOString(),
        lastProcessedSeason: Number(seasonNumber)
      }, { merge: true });
      
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('lote_hub_entered', 'true');
      }
      
      toast({
        title: language === 'ru' ? "Профиль настроен!" : "Profile Configured!",
        description: language === 'ru' ? "Добро пожаловать в лигу." : "Welcome to the league."
      });

      router.replace('/');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isUserLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]" />
      
      <div className="relative z-10 w-full max-w-md mx-auto px-4 flex flex-col min-h-screen py-12">
        <header className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
            {step === 'league' ? <Clock className="w-8 h-8 text-primary" /> : <Globe className="w-8 h-8 text-accent" />}
          </div>
          <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">
            {step === 'league' ? (language === 'ru' ? 'ВЫБОР ВРЕМЕНИ' : 'SELECT MATCH TIME') : (language === 'ru' ? 'ВЫБОР СТРАНЫ' : 'CHOOSE CLUB FLAG')}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase font-black tracking-[0.3em] mt-2">
            {step === 'league' ? (language === 'ru' ? 'ШАГ 1 ИЗ 2' : 'STEP 1 OF 2') : (language === 'ru' ? 'ШАГ 2 ИЗ 2' : 'STEP 2 OF 2')}
          </p>
        </header>

        <div className="flex-1">
          {step === 'league' ? (
            <div className="grid grid-cols-2 gap-3 animate-in fade-in zoom-in-95 duration-500">
              {LEAGUES.map((l) => (
                <Card 
                  key={l.id} 
                  className={cn(
                    "glass-card border-white/5 cursor-pointer transition-all hover:border-primary/50 group",
                    selectedLeagueId === l.id && "ring-2 ring-primary border-primary bg-primary/10 scale-[1.02]"
                  )} 
                  onClick={() => setSelectedLeagueId(l.id)}
                >
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">{l.id}</p>
                    <span className="text-xl font-headline font-bold text-white tracking-tighter">{l.startTime}</span>
                    <span className="text-[7px] font-bold text-primary/40 mt-1 uppercase">MOSCOW TIME</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 animate-in fade-in slide-in-from-right-4 duration-500">
              {COUNTRIES.map((c) => (
                <Card 
                  key={c.code} 
                  className={cn(
                    "glass-card border-white/5 cursor-pointer transition-all hover:border-accent/50",
                    selectedCountryCode === c.code && "ring-2 ring-accent border-accent bg-accent/10 scale-[1.02]"
                  )} 
                  onClick={() => setSelectedCountryCode(c.code)}
                >
                  <CardContent className="p-4 flex flex-col items-center">
                    <span className="text-3xl mb-2">{c.flag}</span>
                    <span className="text-[8px] font-black uppercase text-center truncate w-full text-muted-foreground">{c.name}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <footer className="mt-12 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Button 
            size="lg" 
            disabled={isUpdating || (step === 'league' ? !selectedLeagueId : !selectedCountryCode)} 
            onClick={step === 'league' ? () => setStep('country') : handleCompleteSetup} 
            className="w-full h-16 hero-gradient font-black text-xs uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all"
          >
            {isUpdating ? <Loader2 className="animate-spin" /> : (step === 'league' ? 'CONTINUE' : 'FINALIZE PROFILE')}
          </Button>
          
          {step === 'country' && (
            <button 
              onClick={() => setStep('league')}
              className="w-full text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-white transition-colors"
            >
              PREVIOUS STEP
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
