
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LEAGUES, TEAMS_PER_GROUP, getMockGroupTeams } from '@/app/lib/leagues-data';
import { COUNTRIES } from '@/app/lib/countries-data';
import { Loader2, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

export default function SetupPage() {
  const { user, isUserLoading } = useUser();
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
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (isLoaded && currentLeague && currentCountry) {
      router.push('/');
    }
  }, [isLoaded, currentLeague, currentCountry, router]);

  const handleNextStep = () => {
    if (selectedLeagueId) {
      setStep('country');
    }
  };

  /**
   * Calculates inherited stats if joining mid-season
   */
  const calculateInheritedStats = (leagueId: string, level: number, group: number, day: number) => {
    if (day <= 1) return { wins: 0, draws: 0, losses: 0, points: 0 };
    // Simulate what a bot would have earned by this day in this group
    const groupTeams = getMockGroupTeams(1000, "Template", level, 1, group, leagueId, [], undefined, day - 1);
    const replacedBot = groupTeams.length > 0 ? groupTeams[groupTeams.length - 1] : { wins: 0, draws: 0, losses: 0, points: 0 };
    return {
      wins: replacedBot.wins || 0,
      draws: replacedBot.draws || 0,
      losses: replacedBot.losses || 0,
      points: replacedBot.points || 0
    };
  };

  const handleCompleteSetup = async () => {
    if (!user || !selectedLeagueId || !selectedCountryCode) return;

    setIsUpdating(true);
    try {
      const usersCol = collection(db, 'players_v5');
      
      // LIVE LEAGUE LOGIC:
      // New players always start at the bottom of the pyramid (Division 9)
      const targetLevel = 9; 
      
      // 1. Find how many real players are already in this league/division
      const leagueQuery = query(
        usersCol, 
        where('selectedLeagueId', '==', selectedLeagueId),
        where('leagueLevel', '==', targetLevel)
      );
      const leagueSnap = await getDocs(leagueQuery);
      const playerCount = leagueSnap.size;
      
      // 2. Assign group sequentially (8 players per group)
      // Division 9 can have up to 256 groups in a standard power-of-2 pyramid
      let targetGroup = Math.floor(playerCount / TEAMS_PER_GROUP) + 1;
      if (targetGroup > 256) targetGroup = 1; // Overflow protection, restart from group 1 or extend base

      const { seasonDay, seasonStartDate } = getGlobalSeasonInfo();
      const inheritedStats = calculateInheritedStats(selectedLeagueId, targetLevel, targetGroup, seasonDay);

      const profileRef = doc(db, 'players_v5', user.uid);
      const selectedCountry = COUNTRIES.find(c => c.code === selectedCountryCode);
      
      const updateData = {
        id: user.uid,
        selectedLeagueId: selectedLeagueId,
        country: selectedCountry?.name || 'International',
        leagueLevel: Number(targetLevel),
        groupId: Number(targetGroup),
        divisionSubId: 1,
        wins: Number(inheritedStats.wins || 0),
        draws: Number(inheritedStats.draws || 0),
        losses: Number(inheritedStats.losses || 0),
        points: Number(inheritedStats.points || 0),
        setupDate: new Date().toISOString(),
        seasonStartDate: seasonStartDate || new Date().toISOString(),
        lastProcessedSeason: 0 // Will be synced by TopBar/AutoMatchManager
      };
      
      await setDoc(profileRef, updateData, { merge: true });
      
      toast({
        title: "Profile Synchronized",
        description: `Deployment successful. Assigned to Division ${targetLevel}, Group ${targetGroup}.`,
      });
      router.push('/');
    } catch (error: any) {
      console.error("Setup error:", error);
      toast({
        variant: "destructive",
        title: "Transmission Error",
        description: "Failed to initialize operational profile.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isUserLoading || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground animate-pulse">Syncing Satellite Data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.1),_transparent_70%)]">
      <div className="w-full max-w-4xl space-y-12 animate-in fade-in duration-700">
        <header className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Commissioning Phase</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-headline font-bold text-white tracking-tighter uppercase">
            {step === 'league' ? 'Select Operational Window' : 'Confirm Jurisdiction'}
          </h1>
          <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold opacity-60">
            {step === 'league' 
              ? 'Synchronize your command center with a global league shift.' 
              : 'Your flag will define your club\'s visual signature in the rankings.'}
          </p>
        </header>

        {step === 'league' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {LEAGUES.map((league) => (
              <Card 
                key={league.id} 
                className={cn(
                  "glass-card cursor-pointer transition-all hover:scale-[1.02] border-white/5", 
                  selectedLeagueId === league.id ? "ring-2 ring-primary border-primary bg-primary/10 shadow-[0_0_30px_rgba(var(--primary),0.2)]" : "hover:border-white/20"
                )} 
                onClick={() => setSelectedLeagueId(league.id)}
              >
                <CardHeader className="pb-2 p-4">
                  <div className="flex justify-between items-start">
                    <CardTitle className="font-headline text-lg font-bold">{league.id}</CardTitle>
                    <Clock className={cn("w-4 h-4", selectedLeagueId === league.id ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <CardDescription className="text-accent font-black uppercase text-[9px] tracking-widest">{league.startTime} MSK</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-[10px] text-muted-foreground leading-relaxed italic line-clamp-2">{league.description}</p>
                  {selectedLeagueId === league.id && <div className="mt-3 flex justify-center"><CheckCircle2 className="text-primary w-5 h-5 animate-in zoom-in" /></div>}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[50vh] overflow-y-auto pr-2 scrollbar-hide">
            {COUNTRIES.map((country) => (
              <Card 
                key={country.code} 
                className={cn(
                  "glass-card cursor-pointer transition-all hover:bg-white/5 border-white/5", 
                  selectedCountryCode === country.code ? "ring-2 ring-primary border-primary bg-primary/10" : "hover:border-white/20"
                )} 
                onClick={() => setSelectedCountryCode(country.code)}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                  <span className="text-5xl">{country.flag}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-center">{country.name}</span>
                  {selectedCountryCode === country.code && <CheckCircle2 className="text-primary w-5 h-5 absolute top-2 right-2 animate-in zoom-in" />}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-center items-center gap-4">
          {step === 'country' && (
            <Button variant="ghost" onClick={() => setStep('league')} className="w-full md:w-40 h-14 text-xs font-black uppercase tracking-widest">
              Reconfigure
            </Button>
          )}
          <Button 
            size="lg" 
            disabled={isUpdating || (step === 'league' ? !selectedLeagueId : !selectedCountryCode)} 
            onClick={step === 'league' ? handleNextStep : handleCompleteSetup} 
            className="w-full max-w-sm hero-gradient text-sm font-headline font-black h-14 tracking-[0.2em] shadow-2xl shadow-primary/20"
          >
            {isUpdating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (step === 'league' ? 'CONTINUE SEQUENCE' : 'ESTABLISH LINK')}
          </Button>
        </div>
      </div>
    </div>
  );
}
