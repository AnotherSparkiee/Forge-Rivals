'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, writeBatch, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LEAGUES } from '@/app/lib/leagues-data';
import { COUNTRIES } from '@/app/lib/countries-data';
import { Loader2, Flag, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getRandomStartingSquad } from '@/app/lib/moba-data';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function SetupPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useGameState();
  
  const [step, setStep] = useState<'league' | 'country'>('league');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/');
    }
  }, [user, isUserLoading, router]);

  const handleCompleteSetup = async () => {
    if (!user || !selectedLeagueId || !selectedCountryCode || !profile) return;
    setIsUpdating(true);
    try {
      const selectedCountry = COUNTRIES.find(c => c.code === selectedCountryCode);
      const uniqueSquad = getRandomStartingSquad();
      const { seasonNumber } = getGlobalSeasonInfo();
      const nowIso = new Date().toISOString();
      
      const pointerData = {
        selectedLeagueId,
        leagueLevel: 9,
        groupId: 1,
        country: selectedCountry?.name || 'International',
        setupDate: nowIso
      };

      const teamData = {
        id: user.uid,
        displayName: profile.displayName || "Manager",
        credits: 1000000, // Starting budget
        crystals: 50,    // Starting crystals
        experiencePoints: 0,
        managerLevel: 1,
        managerSkills: { sponsors: 0, agents: 0, training: 0, medical: 0 },
        arena: { capacity: 5000 },
        hq: {}, bootcamp: {}, academy: {}, medical: {},
        lineup: { 
          offlane: uniqueSquad[0].id, carry: uniqueSquad[1].id, mid: uniqueSquad[2].id, 
          support: uniqueSquad[3].id, full_support: uniqueSquad[4].id, 
          sub1: uniqueSquad[5].id, sub2: uniqueSquad[6].id
        },
        strategy: 'Balanced Play',
        lastProcessedSeason: Number(seasonNumber || 1),
        matchHistory: [],
        createdAt: nowIso
      };

      const batch = writeBatch(db);
      const rootRef = doc(db, 'players_v10', user.uid);
      
      // Update root profile pointers
      batch.update(rootRef, pointerData);

      // Construct identical 8-segment path used in store.tsx
      const seasonId = `season_${seasonNumber || 1}`;
      const prefixedGroupId = `${seasonId}_league_${selectedLeagueId}_group_1`;
      
      // leagues_v2 -> {leagueId} -> divisions -> 9 -> groups -> {prefixedGroupId} -> teams -> {userId}
      const teamRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', '9', 'groups', prefixedGroupId, 'teams', user.uid);
      
      batch.set(teamRef, teamData, { merge: true });

      // Initialize starting heroes as subcollection
      uniqueSquad.forEach(hero => {
        const heroRef = doc(collection(teamRef, 'heroes'), hero.id);
        batch.set(heroRef, JSON.parse(JSON.stringify(hero)), { merge: true });
      });

      await batch.commit();

      toast({ title: language === 'ru' ? "Профиль настроен!" : "Profile Configured!" });
      router.replace('/');
    } catch (e: any) {
      console.error("Critical Sync Error", e);
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isUserLoading || isProfileLoading || !user) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]" />
      <div className="relative z-10 w-full max-w-md mx-auto px-4 flex flex-col min-h-screen py-12">
        <header className="text-center mb-12">
          <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">
            {step === 'league' ? 'SELECT MATCH TIME' : 'CHOOSE CLUB FLAG'}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest mt-2">Operational Node Initialization</p>
        </header>
        <div className="flex-1">
          {step === 'league' ? (
            <div className="grid grid-cols-2 gap-3">
              {LEAGUES.map((l) => (
                <Card 
                  key={l.id} 
                  className={cn("glass-card border-white/5 cursor-pointer transition-all", selectedLeagueId === l.id ? "ring-2 ring-primary bg-primary/5" : "hover:bg-white/5")} 
                  onClick={() => setSelectedLeagueId(l.id)}
                >
                  <CardContent className="p-4 text-center">
                    <span className="text-xl font-headline font-bold text-white">{l.startTime}</span>
                    <p className="text-[7px] text-muted-foreground uppercase mt-1">MSK TIME</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {COUNTRIES.map((c) => (
                <Card 
                  key={c.code} 
                  className={cn("glass-card border-white/5 cursor-pointer transition-all", selectedCountryCode === c.code ? "ring-2 ring-accent bg-accent/5" : "hover:bg-white/5")} 
                  onClick={() => setSelectedCountryCode(c.code)}
                >
                  <CardContent className="p-4 text-center">
                    <span className="text-3xl">{c.flag}</span>
                    <p className="text-[7px] text-muted-foreground uppercase mt-2 truncate">{c.name}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        <footer className="mt-12">
          <Button disabled={isUpdating || (step === 'league' && !selectedLeagueId) || (step === 'country' && !selectedCountryCode)} onClick={step === 'league' ? () => setStep('country') : handleCompleteSetup} className="w-full h-16 hero-gradient font-black text-xs tracking-widest uppercase shadow-xl">
            {isUpdating ? <Loader2 className="animate-spin" /> : (step === 'league' ? 'CONTINUE' : 'FINALIZE PROFILE')}
          </Button>
        </footer>
      </div>
    </div>
  );
}
