
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LEAGUES, getMockGroupTeams } from '@/app/lib/leagues-data';
import { COUNTRIES } from '@/app/lib/countries-data';
import { Loader2, Clock, CheckCircle2, ShieldCheck, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

export default function SetupPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { isLoaded, selectedLeagueId: currentLeague, country: currentCountry } = useGameState();
  
  const [step, setStep] = useState<'league' | 'country'>('league');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/auth/register');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (isLoaded && currentLeague && currentCountry) {
      router.replace('/');
    }
  }, [isLoaded, currentLeague, currentCountry, router]);

  const handleCompleteSetup = async () => {
    if (!user || !selectedLeagueId || !selectedCountryCode) return;
    setIsUpdating(true);
    try {
      const targetLevel = Math.floor(Math.random() * 9) + 1;
      const maxGroupsInDiv = Math.pow(2, targetLevel - 1);
      const targetGroup = Math.floor(Math.random() * maxGroupsInDiv) + 1;
      const { seasonDay, seasonStartDate, seasonNumber } = getGlobalSeasonInfo();
      
      const profileRef = doc(db, 'players_v10', user.uid);
      const selectedCountry = COUNTRIES.find(c => c.code === selectedCountryCode);
      
      await setDoc(profileRef, {
        selectedLeagueId,
        country: selectedCountry?.name || 'International',
        leagueLevel: targetLevel,
        groupId: targetGroup,
        setupDate: new Date().toISOString(),
        seasonStartDate: seasonStartDate || new Date().toISOString(),
        lastProcessedSeason: Number(seasonNumber)
      }, { merge: true });
      
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('lote_hub_entered', 'true');
      }
      router.replace('/');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isUserLoading || !user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background overflow-hidden">
      <div className="w-full max-w-lg flex flex-col space-y-4 animate-in fade-in duration-700">
        <header className="text-center">
          <h1 className="text-xl font-headline font-bold text-white uppercase tracking-tight">
            {step === 'league' ? 'CHOOSE MATCH TIME' : 'CHOOSE CLUB FLAG'}
          </h1>
        </header>

        <div className="flex-1 py-4">
          {step === 'league' ? (
            <div className="grid grid-cols-4 gap-2">
              {LEAGUES.map((l) => (
                <Card key={l.id} className={cn("glass-card cursor-pointer p-2 flex flex-col items-center", selectedLeagueId === l.id && "ring-2 ring-primary bg-primary/20")} onClick={() => setSelectedLeagueId(l.id)}>
                  <p className="text-[10px] font-bold">{l.id}</p>
                  <span className="text-primary font-black text-[10px] mt-1">{l.startTime}</span>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {COUNTRIES.map((c) => (
                <Card key={c.code} className={cn("glass-card cursor-pointer p-2 flex flex-col items-center", selectedCountryCode === c.code && "ring-2 ring-primary bg-primary/20")} onClick={() => setSelectedCountryCode(c.code)}>
                  <span className="text-2xl">{c.flag}</span>
                  <span className="text-[8px] font-black uppercase text-center truncate w-full mt-1">{c.name}</span>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Button size="lg" disabled={isUpdating || (step === 'league' ? !selectedLeagueId : !selectedCountryCode)} onClick={step === 'league' ? () => setStep('country') : handleCompleteSetup} className="w-full h-14 hero-gradient font-black text-xs uppercase tracking-widest">
          {isUpdating ? <Loader2 className="animate-spin" /> : 'CONTINUE'}
        </Button>
      </div>
    </div>
  );
}
