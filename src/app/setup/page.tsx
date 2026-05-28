'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc, collection, getDocs, query, where } from 'firebase/firestore';
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
      <div className="w-full max-w-lg flex flex-col h-full max-h-[90vh] space-y-6 animate-in fade-in duration-700">
        <header className="text-center space-y-2 flex-shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Фаза настройки</span>
          </div>
          <h1 className="text-3xl font-headline font-bold text-white tracking-tighter uppercase leading-none">
            {step === 'league' ? 'Выберите график лиги' : 'Подтвердите страну'}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60 px-4 leading-relaxed">
            {step === 'league' 
              ? 'Синхронизируйте ваш центр управления с мировым временем матчей.' 
              : 'Ваш флаг определит визуальный облик клуба в глобальных рейтингах.'}
          </p>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-hide pr-1">
          {step === 'league' ? (
            <div className="grid grid-cols-2 gap-3 pb-4">
              {LEAGUES.map((league) => (
                <Card 
                  key={league.id} 
                  className={cn(
                    "glass-card cursor-pointer transition-all border-white/5", 
                    selectedLeagueId === league.id ? "ring-2 ring-primary border-primary bg-primary/10 shadow-[0_0_30px_rgba(var(--primary),0.2)]" : "hover:border-white/20"
                  )} 
                  onClick={() => setSelectedLeagueId(league.id)}
                >
                  <CardHeader className="pb-1 p-4">
                    <div className="flex justify-between items-start">
                      <CardTitle className="font-headline text-base font-bold">{league.id}</CardTitle>
                      <Clock className={cn("w-3.5 h-3.5", selectedLeagueId === league.id ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <CardDescription className="text-accent font-black uppercase text-[8px] tracking-widest">{league.startTime} MSK</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="text-[9px] text-muted-foreground leading-relaxed italic line-clamp-2">Операционное окно для проведения ежедневных матчей в данном часовом поясе.</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-4">
              {COUNTRIES.map((country) => (
                <Card 
                  key={country.code} 
                  className={cn(
                    "glass-card cursor-pointer transition-all hover:bg-white/5 border-white/5", 
                    selectedCountryCode === country.code ? "ring-2 ring-primary border-primary bg-primary/10 shadow-[0_0_30px_rgba(var(--primary),0.2)]" : "hover:border-white/20"
                  )} 
                  onClick={() => setSelectedCountryCode(country.code)}
                >
                  <CardContent className="flex flex-col items-center justify-center p-6 gap-3 relative">
                    <span className="text-4xl">{country.flag}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-center">{country.name}</span>
                    {selectedCountryCode === country.code && <CheckCircle2 className="text-primary w-4 h-4 absolute top-2 right-2 animate-in zoom-in" />}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 px-4 flex-shrink-0 pt-2">
          <Button 
            size="lg" 
            disabled={isUpdating || (step === 'league' ? !selectedLeagueId : !selectedCountryCode)} 
            onClick={step === 'league' ? handleNextStep : handleCompleteSetup} 
            className="w-full hero-gradient text-xs font-headline font-black h-14 tracking-[0.2em] shadow-2xl shadow-primary/20 rounded-xl"
          >
            {isUpdating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (step === 'league' ? 'ПРОДОЛЖИТЬ' : 'УСТАНОВИТЬ СВЯЗЬ')}
          </Button>
          {step === 'country' && (
            <Button variant="ghost" onClick={() => setStep('league')} className="w-full h-10 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white">
              Назад к выбору лиги
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
