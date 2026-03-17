'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LEAGUES, TEAMS_PER_GROUP, getMockGroupTeams } from '@/app/lib/leagues-data';
import { COUNTRIES } from '@/app/lib/countries-data';
import { Loader2, Clock, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useGameState } from '@/app/lib/store';

export default function SetupPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { seasonDay } = useGameState();
  
  const [step, setStep] = useState<'league' | 'country'>('league');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // New collection players_v2
  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v2', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (profile?.selectedLeagueId && profile?.country) {
      router.push('/');
    }
  }, [profile, router]);

  const handleNextStep = () => {
    if (selectedLeagueId) {
      setStep('country');
    }
  };

  const calculateInheritedStats = (leagueId: string, level: number, group: number, day: number) => {
    if (day === 0) return { wins: 0, draws: 0, losses: 0, points: 0 };
    const groupTeams = getMockGroupTeams(1000, "Template", level, 1, group, false, day, undefined, leagueId);
    const replacedBot = groupTeams[groupTeams.length - 1];
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
      const usersCol = collection(db, 'players_v2');
      const leagueQuery = query(usersCol, where('selectedLeagueId', '==', selectedLeagueId));
      const leagueSnap = await getDocs(leagueQuery);
      
      const playerCount = leagueSnap.size;
      let targetLevel = 1;
      let targetGroup = Math.floor(playerCount / TEAMS_PER_GROUP) + 1;
      
      if (targetGroup > 64) { 
        targetLevel = 2;
        targetGroup = 1;
      }

      const inheritedStats = calculateInheritedStats(selectedLeagueId, targetLevel, targetGroup, seasonDay);

      const profileRef = doc(db, 'players_v2', user.uid);
      const selectedCountry = COUNTRIES.find(c => c.code === selectedCountryCode);
      
      await updateDoc(profileRef, {
        selectedLeagueId: selectedLeagueId,
        country: selectedCountry?.name,
        leagueLevel: targetLevel,
        groupId: targetGroup,
        divisionSubId: 1,
        wins: inheritedStats.wins,
        draws: inheritedStats.draws,
        losses: inheritedStats.losses,
        points: inheritedStats.points,
        setupDate: new Date().toISOString()
      });
      
      toast({
        title: "Setup Complete",
        description: `Welcome to ${selectedLeagueId}. Team initialized in Division ${targetLevel}, Group ${targetGroup}.`,
      });
      router.push('/');
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save profile configuration.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-headline font-bold text-primary mb-4 tracking-tight uppercase">
          {step === 'league' ? 'Select Operational League' : 'Confirm Jurisdiction'}
        </h1>
        <p className="text-muted-foreground text-lg italic">
          {step === 'league' 
            ? 'Choose your tactical time window. New managers take over existing slots in the hierarchy.' 
            : 'Your flag will represent your organization in the global rankings.'}
        </p>
      </header>

      {step === 'league' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {LEAGUES.map((league) => (
            <Card 
              key={league.id} 
              className={cn(
                "glass-card cursor-pointer transition-all hover:scale-[1.02]",
                selectedLeagueId === league.id ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:border-white/20"
              )}
              onClick={() => setSelectedLeagueId(league.id)}
            >
              <CardHeader className="pb-2 p-4">
                <div className="flex justify-between items-start">
                  <CardTitle className="font-headline text-lg">{league.id}</CardTitle>
                  <Clock className={cn("w-4 h-4", selectedLeagueId === league.id ? "text-primary" : "text-muted-foreground")} />
                </div>
                <CardDescription className="text-accent font-bold uppercase text-[10px] tracking-tighter">
                  {league.startTime} MSK Sync
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-[10px] text-muted-foreground leading-relaxed italic">{league.description}</p>
                {selectedLeagueId === league.id && (
                  <div className="mt-2 flex justify-center">
                    <CheckCircle2 className="text-primary w-5 h-5 animate-in zoom-in" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {COUNTRIES.map((country) => (
            <Card 
              key={country.code} 
              className={cn(
                "glass-card cursor-pointer transition-all hover:bg-white/5",
                selectedCountryCode === country.code ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:border-white/20"
              )}
              onClick={() => setSelectedCountryCode(country.code)}
            >
              <CardContent className="flex flex-col items-center justify-center p-6 gap-2">
                <span className="text-4xl">{country.flag}</span>
                <span className="text-sm font-bold uppercase tracking-tighter text-center">{country.name}</span>
                {selectedCountryCode === country.code && (
                  <CheckCircle2 className="text-primary w-5 h-5 absolute top-2 right-2 animate-in zoom-in" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-center gap-4">
        {step === 'country' && (
          <Button 
            variant="outline" 
            onClick={() => setStep('league')}
            className="w-full max-w-[150px] h-14"
          >
            BACK
          </Button>
        )}
        <Button 
          size="lg" 
          disabled={isUpdating || (step === 'league' ? !selectedLeagueId : !selectedCountryCode)} 
          onClick={step === 'league' ? handleNextStep : handleCompleteSetup}
          className="w-full max-w-sm hero-gradient text-lg font-headline font-bold h-14"
        >
          {isUpdating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (step === 'league' ? 'NEXT' : 'FINALIZE SETUP')}
        </Button>
      </div>
    </div>
  );
}
