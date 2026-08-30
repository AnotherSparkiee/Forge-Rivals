
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { COUNTRIES } from '@/app/lib/countries-data';
import { 
  Loader2, ChevronLeft, Edit3, Flag, Shield, 
  CalendarDays, Target, Swords, Timer, ChevronRight,
  ShieldCheck, ArrowRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGameState, LineupSlot } from '@/app/lib/store';
import { getRandomStartingSquad } from '@/app/lib/moba-data';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { findStrategicPlacement, initializeClubV13 } from '@/app/actions/season-init';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { cn } from '@/lib/utils';
import { collection, query, where } from 'firebase/firestore';
import { getBotName } from '../lib/leagues-data';
import { Badge } from '@/components/ui/badge';

const CLUBS = [
  { id: 'parivision', name: 'Parivision', logo: 'https://iili.io/CYIAgVa.webp' },
  { id: 'falcons', name: 'Falcons', logo: 'https://iili.io/CYTjsIe.webp' },
  { id: 'spirit', name: 'Team Spirit', logo: 'https://iili.io/CYTefEb.webp' },
  { id: 'aurora', name: 'Aurora Gaming', logo: 'https://iili.io/CYuhmu9.webp' },
  { id: 'betboom', name: 'BetBoom Team', logo: 'https://iili.io/CYuNrj1.webp' },
  { id: 'yandex', name: 'Team Yandex', logo: 'https://iili.io/CYukyZP.webp' },
  { id: 'liquid', name: 'Team Liquid', logo: 'https://iili.io/CYuS3pR.webp' },
  { id: 'navi', name: 'NAVI', logo: 'https://iili.io/CYupwe2.webp' },
];

type SetupStep = 'name' | 'country' | 'club' | 'summary';

export default function SetupPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const { language, isLoaded, saveToLocal, seasonNumber } = useGameState();
  
  const [step, setStep] = useState<SetupStep>('name');
  const [teamName, setTeamName] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Data for summary step
  const [placementData, setPlacementData] = useState<any>(null);

  const loginName = useMemo(() => {
    if (!user?.email) return "";
    return user.email.split('@')[0];
  }, [user?.email]);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/auth/login');
    if (user && !teamName) setTeamName(loginName);
  }, [user, isUserLoading, router, loginName, teamName]);

  const handleCompleteSetup = async () => {
    if (!selectedCountryCode || !selectedClubId || !teamName.trim() || isUpdating || !user) return;
    setIsUpdating(true);
    
    try {
      const targetLeagueId = "ALPHA";
      const placement = await findStrategicPlacement(targetLeagueId);
      const selectedCountry = COUNTRIES.find(c => c.code === selectedCountryCode);
      const selectedClub = CLUBS.find(c => c.id === selectedClubId);
      
      const startingSquad = getRandomStartingSquad();
      const initialLineup: Record<LineupSlot, string | null> = {
        carry: startingSquad.filter(p => p.role === 'Carry')[0]?.id || null,
        mid: startingSquad.filter(p => p.role === 'Midlaner')[0]?.id || null,
        offlane: startingSquad.filter(p => p.role === 'Tank')[0]?.id || null,
        support: startingSquad.filter(p => p.role === 'Jungler')[0]?.id || null,
        full_support: startingSquad.filter(p => p.role === 'Support')[0]?.id || null,
        sub_carry: startingSquad.filter(p => p.role === 'Carry')[1]?.id || null,
        sub_mid: startingSquad.filter(p => p.role === 'Midlaner')[1]?.id || null,
        sub_offlane: startingSquad.filter(p => p.role === 'Tank')[1]?.id || null,
        sub_support: startingSquad.filter(p => p.role === 'Jungler')[1]?.id || null,
        sub_full_support: startingSquad.filter(p => p.role === 'Support')[1]?.id || null,
        res1: null, res2: null, res3: null, res4: null, res5: null, res6: null, res7: null, res8: null
      };

      const finalClubName = teamName.trim();

      await initializeClubV13(user.uid, {
        tier: placement.tier,
        group: placement.group,
        rank: placement.rank,
        clubName: finalClubName,
        clubLogo: selectedClub?.logo,
        country: selectedCountry?.name,
        selectedLeagueId: targetLeagueId
      });

      const fullPlacement = {
        ...placement,
        leagueId: targetLeagueId,
        clubName: finalClubName,
        clubLogo: selectedClub?.logo
      };
      setPlacementData(fullPlacement);

      saveToLocal({
        id: user.uid,
        selectedLeagueId: targetLeagueId,
        leagueLevel: Number(placement.tier),
        groupId: Number(placement.group),
        rank: Number(placement.rank),
        country: selectedCountry?.name || 'International',
        clubName: finalClubName,
        displayName: finalClubName,
        clubLogo: selectedClub?.logo || null,
        ownedPlayers: startingSquad,
        lineup: initialLineup,
        isDataReady: true,
        isTeamLoaded: true,
        version: 131
      });

      toast({ title: language === 'ru' ? "Клуб v131 инициализирован!" : "Club v131 Initialized!" });
      setStep('summary');
    } catch (e: any) {
      console.error("[SETUP ERROR]:", e);
    } finally {
      setIsUpdating(false);
    }
  };

  const t = {
    ru: {
      name: 'НАЗВАНИЕ КОМАНДЫ',
      country: 'ВЫБОР ФЛАГА',
      club: 'ВЫБОР ЛОГОТИПА',
      summary: 'РАЗВЕРТЫВАНИЕ ЗАВЕРШЕНО',
      finalize: 'СОЗДАТЬ КЛУБ',
      continue: 'ПРОДОЛЖИТЬ',
      enterHub: 'ВОЙТИ В КОМАНДНЫЙ ЦЕНТР',
      tour: 'ТУР',
      nextOpponent: 'СЛЕДУЮЩИЙ СОПЕРНИК',
      subtitles: {
        name: 'Введите публичный позывной вашей организации',
        country: 'Выберите страну которую будете представлять',
        club: 'Выберите логотип вашей организации',
        summary: 'Ваше место в Лиге определено. Изучите расписание.'
      }
    },
    en: {
      name: 'TEAM CALLSIGN',
      country: 'SELECT FLAG',
      club: 'SELECT LOGO',
      summary: 'DEPLOYMENT COMPLETE',
      finalize: 'CREATE CLUB',
      continue: 'CONTINUE',
      enterHub: 'ENTER COMMAND CENTER',
      tour: 'TOUR',
      nextOpponent: 'NEXT OPPONENT',
      subtitles: {
        name: 'Enter the public callsign for your organization',
        country: 'Select the country you will represent',
        club: 'Choose your organization logo',
        summary: 'Your position in the League is secured. Review schedule.'
      }
    }
  }[language === 'ru' ? 'ru' : 'en'];

  if (!isLoaded || isUserLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]" />
      <div className="relative z-10 w-full max-w-md mx-auto px-4 flex flex-col min-h-screen pt-12 pb-32">
        <header className="text-center mb-8 relative shrink-0">
          {(step !== 'name' && step !== 'summary') && (
            <Button variant="ghost" size="icon" className="absolute left-0 top-0 rounded-full" onClick={() => setStep(step === 'country' ? 'name' : 'country')}>
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
          <h1 className="text-2xl font-headline font-bold text-white uppercase tracking-tighter">
            {t[step]}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest mt-1 opacity-60 px-4 leading-tight">
            {t.subtitles[step]}
          </p>
        </header>
        
        <div className="flex-1 flex flex-col animate-in fade-in duration-700">
          {step === 'name' && (
            <Card className="glass-card border-white/10 bg-secondary/20">
              <CardContent className="p-6">
                <div className="relative">
                  <Edit3 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/50" />
                  <Input 
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Team name..."
                    className="h-14 pl-12 bg-background/50 border-white/5 text-lg font-bold uppercase tracking-tight"
                    maxLength={20}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'country' && (
            <div className="grid grid-cols-4 gap-2">
              {COUNTRIES.map((c) => (
                <Card 
                  key={c.code} 
                  className={cn(
                    "glass-card border-white/5 cursor-pointer transition-all aspect-square flex items-center justify-center", 
                    selectedCountryCode === c.code ? "ring-2 ring-accent bg-accent/10 shadow-[0_0_15px_rgba(var(--accent),0.3)]" : "hover:bg-white/5"
                  )} 
                  onClick={() => setSelectedCountryCode(c.code)}
                >
                  <CardContent className="p-0 text-center flex flex-col items-center justify-center">
                    <span className="text-2xl">{c.flag}</span>
                    <p className="text-[6px] text-muted-foreground uppercase mt-1 font-black truncate max-w-full px-1">{c.name}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {step === 'club' && (
            <div className="grid grid-cols-4 gap-2">
              {CLUBS.map((c) => (
                <Card 
                  key={c.id} 
                  className={cn(
                    "glass-card border-white/5 cursor-pointer transition-all overflow-hidden aspect-square flex items-center justify-center", 
                    selectedClubId === c.id ? "ring-2 ring-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.3)]" : "hover:bg-white/5"
                  )} 
                  onClick={() => setSelectedClubId(c.id)}
                >
                  <CardContent className="p-0 flex items-center justify-center w-full h-full">
                    <img src={c.logo} alt={c.name} className="w-full h-full object-contain p-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {step === 'summary' && placementData && (
            <SummaryView data={placementData} onComplete={() => router.replace('/')} t={t} language={language} seasonNumber={seasonNumber} />
          )}
        </div>
        
        {step !== 'summary' && (
          <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-white/10 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <div className="max-w-md mx-auto">
              <Button 
                disabled={isUpdating || (step === 'name' && teamName.trim().length < 3) || (step === 'country' && !selectedCountryCode) || (step === 'club' && !selectedClubId)} 
                onClick={() => {
                  if (step === 'name') setStep('country');
                  else if (step === 'country') setStep('club');
                  else handleCompleteSetup();
                }} 
                className="w-full h-16 hero-gradient font-black text-xs tracking-[0.2em] uppercase shadow-2xl active:scale-95 transition-all"
              >
                {isUpdating ? <Loader2 className="animate-spin" /> : (step === 'club' ? t.finalize : t.continue)}
              </Button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

function SummaryView({ data, onComplete, t, language, seasonNumber }: { data: any, onComplete: () => void, t: any, language: string, seasonNumber: number }) {
  const db = useFirestore();
  const { user } = useUser();

  const matchesQuery = useMemoFirebase(() => {
    if (!db || !data) return null;
    return query(
      collection(db, 'matches_v2'),
      where('leagueId', '==', data.leagueId),
      where('level', '==', Number(data.tier)),
      where('groupId', '==', Number(data.group)),
      where('season', '==', seasonNumber)
    );
  }, [db, data, seasonNumber]);

  const { data: rawMatches, isLoading: isMatchesLoading } = useCollection(matchesQuery);

  const myMatches = useMemo(() => {
    if (!rawMatches || !data) return [];
    return rawMatches
      .filter(m => Number(m.homeRank) === Number(data.rank) || Number(m.awayRank) === Number(data.rank))
      .sort((a, b) => a.tour - b.tour);
  }, [rawMatches, data]);

  const nextMatch = myMatches[0];

  return (
    <div className="space-y-6 pb-10">
      {/* SECTOR CARD */}
      <Card className="glass-card border-primary/20 bg-primary/5">
        <CardContent className="p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-primary/30 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(var(--primary),0.3)]">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">ASSIGNED SECTOR</p>
            <h2 className="text-2xl font-headline font-bold text-white italic">DIV {data.tier} • GROUP {data.group}</h2>
            <Badge variant="outline" className="mt-2 text-primary border-primary/30">RANK #{data.rank}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* NEXT OPPONENT PREVIEW */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-black uppercase text-accent tracking-widest px-1">{t.nextOpponent}</h3>
        {isMatchesLoading ? (
           <div className="p-8 text-center bg-secondary/20 rounded-2xl border border-dashed border-white/5 opacity-40"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
        ) : nextMatch ? (
          <Card className="glass-card border-accent/20 bg-accent/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/50 border border-white/10 flex items-center justify-center">
                  <img src="https://i.ibb.co/tpcQnnj1/1000078926-no-bg-preview-carve-photos.png" alt="Rival" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest">OPPONENT_FOUND</p>
                  <h4 className="text-sm font-bold uppercase text-white truncate max-w-[120px]">
                    {Number(nextMatch.homeRank) === Number(data.rank) ? nextMatch.awayName : nextMatch.homeName}
                  </h4>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[7px] font-black text-accent uppercase tracking-widest">START_TIME</p>
                <p className="text-xs font-mono font-bold text-white">{new Date(nextMatch.startTime).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {/* SEASON SCHEDULE LIST */}
      <section className="space-y-3">
        <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">SEASON 1 PROTOCOL</h3>
        <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide pr-1">
          {myMatches.map((m, i) => (
            <div key={i} className="bg-secondary/20 p-3 rounded-xl border border-white/5 flex items-center justify-between">
               <div className="flex items-center gap-3">
                 <Badge variant="outline" className="text-[8px] font-black h-5 border-white/10">{t.tour} {m.tour}</Badge>
                 <span className="text-[10px] font-bold uppercase truncate max-w-[150px]">
                   {Number(m.homeRank) === Number(data.rank) ? m.awayName : m.homeName}
                 </span>
               </div>
               <span className="text-[9px] font-mono text-muted-foreground">
                 {new Date(m.startTime).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
               </span>
            </div>
          ))}
        </div>
      </section>

      <Button onClick={onComplete} className="w-full h-16 hero-gradient font-black text-xs tracking-widest uppercase shadow-2xl mt-4">
        {t.enterHub} <ArrowRight className="ml-2 w-4 h-4" />
      </Button>
    </div>
  );
}
