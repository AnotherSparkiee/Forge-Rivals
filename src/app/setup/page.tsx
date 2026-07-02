'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, writeBatch, collection, query, where, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LEAGUES } from '@/app/lib/leagues-data';
import { COUNTRIES } from '@/app/lib/countries-data';
import { Loader2, ChevronLeft, ShieldCheck, Trophy, Target, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getRandomStartingSquad } from '@/app/lib/moba-data';
import { LoadingScreen } from '@/components/game/LoadingScreen';

const SETUP_VERSION = 73;

const CLUBS = [
  { id: 'parivision', name: 'Parivision', logo: 'https://iili.io/CYIAgVa.webp' },
  { id: 'falcons', name: 'Falcons', logo: 'https://iili.io/CYTjsIe.webp' },
  { id: 'spirit', name: 'Team Spirit', logo: 'https://iili.io/CYTefEb.webp' },
  { id: 'none', name: 'No Official Club', logo: '' },
];

export default function SetupPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { language, isLoaded, displayName } = useGameState();
  
  const [step, setStep] = useState<'league' | 'country' | 'club'>('league');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/');
    }
  }, [user, isUserLoading, router]);

  const findPlacementClient = async (leagueId: string) => {
    const q = query(collection(db, 'players_v10'), where('selectedLeagueId', '==', leagueId));
    const snap = await getDocs(q);
    
    const occupiedIndices = new Set<number>();
    snap.forEach(d => {
      const data = d.data();
      if (Number(data.version || 0) >= 71) {
        const tier = Number(data.leagueLevel);
        const group = Number(data.groupId);
        const rank = Number(data.rank);
        if (tier && group && rank) {
          const groupsBefore = Math.pow(2, tier - 1) - 1;
          const globalIndex = (groupsBefore * 8) + (group - 1) * 8 + (rank - 1);
          occupiedIndices.add(globalIndex);
        }
      }
    });

    let foundIndex = 0;
    for (let i = 0; i < 4088; i++) {
      if (!occupiedIndices.has(i)) {
        foundIndex = i;
        break;
      }
    }

    const groupIndex = Math.floor(foundIndex / 8);
    const tier = Math.floor(Math.log2(groupIndex + 1)) + 1;
    const groupsBeforeTier = Math.pow(2, tier - 1) - 1;
    const group = (groupIndex - groupsBeforeTier) + 1;
    const rank = (foundIndex % 8) + 1;

    return { tier, group, rank };
  };

  const handleCompleteSetup = async () => {
    if (!user || !selectedLeagueId || !selectedCountryCode || !selectedClubId) return;
    setIsUpdating(true);
    try {
      const placement = await findPlacementClient(selectedLeagueId);
      const selectedCountry = COUNTRIES.find(c => c.code === selectedCountryCode);
      const selectedClub = CLUBS.find(c => c.id === selectedClubId);
      const uniqueSquad = getRandomStartingSquad();
      const { activeSeasonNumber } = getGlobalSeasonInfo();
      const nowIso = new Date().toISOString();
      
      const batch = writeBatch(db);
      const rootRef = doc(db, 'players_v10', user.uid);
      
      batch.set(rootRef, {
        selectedLeagueId,
        leagueLevel: Number(placement.tier),
        groupId: Number(placement.group),
        rank: Number(placement.rank),
        country: selectedCountry?.name || 'International',
        clubName: selectedClub?.name || null,
        clubLogo: selectedClub?.logo || null,
        setupDate: nowIso,
        lastProcessedSeason: Number(activeSeasonNumber || 1),
        version: SETUP_VERSION
      }, { merge: true });

      const seasonId = `season_${activeSeasonNumber || 1}`;
      const prefixedGroupId = `${seasonId}_league_${selectedLeagueId}_group_${placement.group}`;
      const teamRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(placement.tier), 'groups', prefixedGroupId, 'teams', user.uid);
      
      batch.set(teamRef, {
        id: user.uid,
        displayName: displayName || "Manager",
        clubName: selectedClub?.name || null,
        clubLogo: selectedClub?.logo || null,
        credits: 1000000, crystals: 50, experiencePoints: 0, managerLevel: 1,
        managerSkills: { sponsors: 0, agents: 0, training: 0, medical: 0 },
        arena: { capacity: 5000 }, hq: {}, bootcamp: {}, academy: {}, medical: {},
        lineup: { 
          offlane: uniqueSquad[0].id, carry: uniqueSquad[1].id, mid: uniqueSquad[2].id, 
          support: uniqueSquad[3].id, full_support: uniqueSquad[4].id, 
          sub1: uniqueSquad[5].id, sub2: uniqueSquad[6].id
        },
        strategy: 'Balanced Play',
        rank: Number(placement.rank),
        lastProcessedSeason: Number(activeSeasonNumber || 1),
        matchHistory: [],
        createdAt: nowIso,
        version: SETUP_VERSION
      }, { merge: true });

      uniqueSquad.forEach(hero => {
        const heroRef = doc(collection(teamRef, 'heroes'), hero.id);
        batch.set(heroRef, JSON.parse(JSON.stringify(hero)), { merge: true });
      });

      await batch.commit();
      toast({ title: language === 'ru' ? "Профиль настроен!" : "Profile Configured!" });
      setTimeout(() => router.replace('/'), 500);

    } catch (e: any) {
      console.error("[SETUP v73 ERROR]", e);
      toast({ variant: "destructive", title: "Setup Failed", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isUserLoading || !user || !isLoaded) return <LoadingScreen />;

  const t = {
    ru: {
      league: 'ВЫБЕРИТЕ ВРЕМЯ МАТЧЕЙ',
      country: 'ВЫБЕРИТЕ ФЛАГ КЛУБА',
      club: 'ВЫБОР КЛУБА',
      continue: 'ПРОДОЛЖИТЬ',
      finalize: 'ЗАВЕРШИТЬ ПРОФИЛЬ',
      protocol: 'Операционный протокол v73',
      msk: 'ВРЕМЯ МСК'
    },
    en: {
      league: 'SELECT MATCH TIME',
      country: 'CHOOSE CLUB FLAG',
      club: 'CLUB SELECTION',
      continue: 'CONTINUE',
      finalize: 'FINALIZE PROFILE',
      protocol: 'Operational Protocol v73',
      msk: 'MSK TIME'
    }
  }[language === 'ru' ? 'ru' : 'en'];

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]" />
      <div className="relative z-10 w-full max-w-md mx-auto px-4 flex flex-col min-h-screen py-12">
        <header className="text-center mb-10 relative">
          {step !== 'league' && (
            <Button variant="ghost" size="icon" className="absolute left-0 top-0 rounded-full" onClick={() => setStep(step === 'country' ? 'league' : 'country')}>
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
          <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">
            {step === 'league' ? t.league : step === 'country' ? t.country : t.club}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest mt-2">{t.protocol}</p>
        </header>
        
        <div className="flex-1">
          {step === 'league' && (
            <div className="grid grid-cols-2 gap-3 h-[60vh] overflow-y-auto scrollbar-hide">
              {LEAGUES.map((l) => (
                <Card 
                  key={l.id} 
                  className={cn("glass-card border-white/5 cursor-pointer transition-all", selectedLeagueId === l.id ? "ring-2 ring-primary bg-primary/5" : "hover:bg-white/5")} 
                  onClick={() => setSelectedLeagueId(l.id)}
                >
                  <CardContent className="p-4 text-center">
                    <span className="text-xl font-headline font-bold text-white">{l.startTime}</span>
                    <p className="text-[7px] text-muted-foreground uppercase mt-1">{t.msk}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {step === 'country' && (
            <div className="grid grid-cols-3 gap-3 h-[60vh] overflow-y-auto scrollbar-hide">
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

          {step === 'club' && (
            <div className="grid grid-cols-2 gap-3 h-[60vh] overflow-y-auto scrollbar-hide">
              {CLUBS.map((c) => (
                <Card 
                  key={c.id} 
                  className={cn(
                    "glass-card border-white/5 cursor-pointer transition-all overflow-hidden group aspect-square flex items-center justify-center", 
                    selectedClubId === c.id ? "ring-2 ring-primary bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.2)]" : "hover:bg-white/5"
                  )} 
                  onClick={() => setSelectedClubId(c.id)}
                >
                  <CardContent className="p-0 flex items-center justify-center w-full h-full">
                    {c.logo ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <img src={c.logo} alt={c.name} className="w-4/5 h-4/5 object-contain" />
                        {selectedClubId === c.id && (
                          <div className="absolute top-2 right-2 bg-primary rounded-full p-1 shadow-lg">
                            <ShieldCheck className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center opacity-30 flex flex-col items-center">
                        <Shield className="w-10 h-10 mb-2" />
                        <p className="text-[9px] font-black uppercase tracking-tighter">NONE</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        
        <footer className="mt-8">
          <Button 
            disabled={isUpdating || (step === 'league' && !selectedLeagueId) || (step === 'country' && !selectedCountryCode) || (step === 'club' && !selectedClubId)} 
            onClick={step === 'league' ? () => setStep('country') : step === 'country' ? () => setStep('club') : handleCompleteSetup} 
            className="w-full h-16 hero-gradient font-black text-xs tracking-widest uppercase shadow-xl"
          >
            {isUpdating ? <Loader2 className="animate-spin" /> : (step === 'club' ? t.finalize : t.continue)}
          </Button>
        </footer>
      </div>
    </div>
  );
}
