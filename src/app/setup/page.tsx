'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LEAGUES, getMockGroupTeams } from '@/app/lib/leagues-data';
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

  const calculateInheritedStats = (leagueId: string, level: number, group: number, day: number) => {
    if (day <= 1) return { wins: 0, draws: 0, losses: 0, points: 0 };
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
      const targetLevel = Math.floor(Math.random() * 9) + 1;
      const maxGroupsInDiv = Math.pow(2, targetLevel - 1);
      const targetGroup = Math.floor(Math.random() * maxGroupsInDiv) + 1;

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
        lastProcessedSeason: 0
      };
      
      setDocumentNonBlocking(profileRef, updateData, { merge: true });
      
      toast({
        title: "Профиль синхронизирован",
        description: `Развертывание успешно. Вы назначены в Дивизион ${targetLevel}, Группа ${targetGroup}.`,
      });
      router.push('/');
    } catch (error: any) {
      console.error("Setup sequence fail:", error);
      toast({
        variant: "destructive",
        title: "Ошибка передачи",
        description: "Не удалось инициировать операционный профиль.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isUserLoading || !isLoaded) {
    return (
      <div className="min-h-screen h-screen flex items-center justify-center bg-background overflow-hidden">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[10px] uppercase font-black tracking-[0.3em] text-muted-foreground animate-pulse">СИНХРОНИЗАЦИЯ СПУТНИКОВЫХ ДАННЫХ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.1),_transparent_70%)] overflow-hidden">
      <div className="w-full max-w-lg flex flex-col h-full space-y-4 animate-in fade-in duration-700">
        
        <header className="text-center flex-shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-[8px] font-black uppercase tracking-widest">Инициация профиля</span>
          </div>
          <h1 className="text-xl font-headline font-bold text-white tracking-tighter uppercase leading-tight">
            {step === 'league' ? 'Выберите лигу по времени' : 'Выберите флаг клуба'}
          </h1>
        </header>

        <div className="flex-1 flex items-center justify-center">
          {step === 'league' ? (
            <div className="grid grid-cols-4 gap-2 w-full">
              {LEAGUES.map((league) => (
                <Card 
                  key={league.id} 
                  className={cn(
                    "glass-card cursor-pointer transition-all border-white/5 active:scale-95 h-16 flex flex-col items-center justify-center p-1", 
                    selectedLeagueId === league.id ? "ring-2 ring-primary border-primary bg-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.3)]" : "hover:border-white/10"
                  )} 
                  onClick={() => setSelectedLeagueId(league.id)}
                >
                  <CardContent className="p-0 text-center">
                    <p className={cn("font-headline text-[8px] font-bold tracking-tighter mb-0.5", selectedLeagueId === league.id ? "text-white" : "text-muted-foreground")}>{league.id}</p>
                    <div className="flex items-center justify-center gap-1">
                      <Clock className={cn("w-2 h-2", selectedLeagueId === league.id ? "text-primary" : "text-muted-foreground/40")} />
                      <span className="text-primary font-black text-[9px] font-mono leading-none">{league.startTime}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 w-full">
              {COUNTRIES.map((country) => (
                <Card 
                  key={country.code} 
                  className={cn(
                    "glass-card cursor-pointer transition-all active:scale-95 border-white/5 h-16 flex flex-col items-center justify-center p-1", 
                    selectedCountryCode === country.code ? "ring-2 ring-primary border-primary bg-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.3)]" : "hover:border-white/10"
                  )} 
                  onClick={() => setSelectedCountryCode(country.code)}
                >
                  <CardContent className="flex flex-col items-center justify-center p-0 gap-1 relative w-full">
                    <span className="text-2xl leading-none">{country.flag}</span>
                    <span className="text-[7px] font-black uppercase tracking-tighter text-center line-clamp-1 w-full px-0.5">
                      {country.name}
                    </span>
                    {selectedCountryCode === country.code && (
                      <div className="absolute -top-1 -right-1">
                        <CheckCircle2 className="text-primary w-2.5 h-2.5 bg-background rounded-full" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0 pb-2">
          <Button 
            size="lg" 
            disabled={isUpdating || (step === 'league' ? !selectedLeagueId : !selectedCountryCode)} 
            onClick={step === 'league' ? handleNextStep : handleCompleteSetup} 
            className="w-full hero-gradient text-[10px] font-headline font-black h-12 tracking-[0.2em] shadow-xl rounded-xl uppercase"
          >
            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (step === 'league' ? 'ПРОДОЛЖИТЬ' : 'УСТАНОВИТЬ СВЯЗЬ')}
          </Button>
          {step === 'country' && (
            <Button 
              variant="ghost" 
              onClick={() => setStep('league')} 
              className="w-full h-8 text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-white"
            >
              ← НАЗАД К ВЫБОРУ ЛИГИ
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
