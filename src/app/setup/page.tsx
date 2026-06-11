
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, writeBatch, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LEAGUES } from '@/app/lib/leagues-data';
import { COUNTRIES } from '@/app/lib/countries-data';
import { Loader2, Clock, CheckCircle2, Flag, Globe } from 'lucide-react';
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
  const { isLoaded, language } = useGameState();
  
  const [step, setStep] = useState<'league' | 'country'>('league');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/auth/register');
    }
  }, [user, isUserLoading, router]);

  const handleCompleteSetup = async () => {
    if (!user || !selectedLeagueId || !selectedCountryCode) return;
    setIsUpdating(true);
    try {
      const selectedCountry = COUNTRIES.find(c => c.code === selectedCountryCode);
      const uniqueSquad = getRandomStartingSquad();
      const { seasonNumber } = getGlobalSeasonInfo();
      const nowIso = new Date().toISOString();
      // DO NOT overwrite displayName here, keep what was entered at registration
      
      const profileData = {
        selectedLeagueId,
        leagueLevel: 9,
        groupId: 1,
        country: selectedCountry?.name || 'International',
        setupDate: nowIso,
        inGameCurrency: 10000000,
        crystals: 0,
        experiencePoints: 0,
        managerLevel: 1,
        skillPoints: 0,
        lastProcessedSeason: Number(seasonNumber || 1),
        lineup: { 
          offlane: uniqueSquad[0].id, carry: uniqueSquad[1].id, mid: uniqueSquad[2].id, 
          support: uniqueSquad[3].id, full_support: uniqueSquad[4].id, 
          sub1: uniqueSquad[5].id, sub2: uniqueSquad[6].id
        },
        arena: { capacity: 5000, pressCenterLevel: 0, cafeLevel: 0, shopLevel: 0, screensLevel: 0, parkingLevel: 0, lightingLevel: 0, pendingCapacitySeats: null, constructionFinishes: {}, constructionStarts: {}, isAccelerated: {} },
        hq: { hrLevel: 0, financeLevel: 0, scoutsLevel: 0, pressOfficeLevel: 0, adminLevel: 0, constructionFinishes: {}, constructionStarts: {}, isAccelerated: {} },
        bootcamp: { bootcampLevel: 0, tacticsHallLevel: 0, poolLevel: 0, researchLevel: 0, constructionFinishes: {}, constructionStarts: {}, isAccelerated: {} },
        academy: { youthBootcampLevel: 0, streamingLevel: 0, scoutsLevel: 0, discoLevel: 0, constructionFinishes: {}, constructionStarts: {}, isAccelerated: {} },
        medical: { physiotherapyLevel: 0, massageLevel: 0, psychiatristLevel: 0, labLevel: 0, psychologistLevel: 0, constructionFinishes: {}, constructionStarts: {}, isAccelerated: {} }
      };

      const batch = writeBatch(db);
      const rootRef = doc(db, 'players_v10', user.uid);
      batch.set(rootRef, profileData, { merge: true });

      // Initialize Heroes sub-collection
      uniqueSquad.forEach(hero => {
        const heroRef = doc(collection(rootRef, 'heroes'), hero.id);
        batch.set(heroRef, JSON.parse(JSON.stringify(hero)));
      });

      await batch.commit();

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('lote_hub_entered', 'true');
      }
      
      toast({
        title: language === 'ru' ? "Профиль настроен!" : "Profile Configured!",
      });

      router.replace('/');
    } catch (e: any) {
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
        </header>
        <div className="flex-1">
          {step === 'league' ? (
            <div className="grid grid-cols-2 gap-3">
              {LEAGUES.map((l) => (
                <Card 
                  key={l.id} 
                  className={cn("glass-card border-white/5 cursor-pointer", selectedLeagueId === l.id && "ring-2 ring-primary")} 
                  onClick={() => setSelectedLeagueId(l.id)}
                >
                  <CardContent className="p-4 text-center">
                    <span className="text-xl font-headline font-bold text-white">{l.startTime}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {COUNTRIES.map((c) => (
                <Card 
                  key={c.code} 
                  className={cn("glass-card border-white/5 cursor-pointer", selectedCountryCode === c.code && "ring-2 ring-accent")} 
                  onClick={() => setSelectedCountryCode(c.code)}
                >
                  <CardContent className="p-4 text-center">
                    <span className="text-3xl">{c.flag}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        <footer className="mt-12">
          <Button disabled={isUpdating} onClick={step === 'league' ? () => setStep('country') : handleCompleteSetup} className="w-full h-16 hero-gradient font-black">
            {isUpdating ? <Loader2 className="animate-spin" /> : 'FINALIZE PROFILE'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
