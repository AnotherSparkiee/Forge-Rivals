'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LEAGUES } from '@/app/lib/leagues-data';
import { COUNTRIES } from '@/app/lib/countries-data';
import { Loader2, ChevronLeft, ShieldCheck, Edit3, CheckCircle2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getRandomStartingSquad } from '@/app/lib/moba-data';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { findStrategicPlacement } from '@/app/actions/season-init';

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

export default function SetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { language, isLoaded, saveToLocal, ownedPlayers } = useGameState();
  
  const [step, setStep] = useState<'league' | 'country' | 'club' | 'name'>('league');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [customClubName, setCustomClubName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCompleteSetup = async () => {
    if (!selectedLeagueId || !selectedCountryCode || !selectedClubId || customClubName.trim().length < 3) return;
    setIsUpdating(true);
    
    try {
      const selectedCountry = COUNTRIES.find(c => c.code === selectedCountryCode);
      const selectedClub = CLUBS.find(c => c.id === selectedClubId);
      const { activeSeasonNumber } = getGlobalSeasonInfo();
      
      // Стратегическое размещение: ищем свободное место сверху вниз (Див 1 -> Див 9)
      const placement = await findStrategicPlacement(selectedLeagueId);
      
      const hasSquad = (ownedPlayers || []).length > 0;
      const startingSquad = hasSquad ? ownedPlayers : getRandomStartingSquad();

      saveToLocal({
        selectedLeagueId,
        leagueLevel: placement.tier,
        groupId: placement.group,
        rank: placement.rank,
        country: selectedCountry?.name || 'International',
        clubName: customClubName.trim(),
        displayName: customClubName.trim(),
        clubLogo: selectedClub?.logo || null,
        ownedPlayers: startingSquad,
        isDataReady: true,
        isTeamLoaded: true,
        lastProcessedSeason: activeSeasonNumber
      });

      toast({ 
        title: language === 'ru' ? "Клуб создан!" : "Club Initialized!",
        description: language === 'ru' ? `Назначен в Дивизион ${placement.tier}.${placement.group}` : `Assigned to Division ${placement.tier}.${placement.group}`
      });
      router.push('/');
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Setup Error" });
      setIsUpdating(false);
    }
  };

  if (!isLoaded) return <LoadingScreen />;

  const t = {
    ru: {
      league: 'ВРЕМЯ МАТЧЕЙ',
      country: 'ФЛАГ КЛУБА',
      club: 'ВЫБОР КЛУБА',
      name: 'НАЗВАНИЕ КЛУБА',
      continue: 'ПРОДОЛЖИТЬ',
      finalize: 'ЗАВЕРШИТЬ ПРОФИЛЬ',
      protocol: 'Стратегический протокол v49',
      msk: 'МСК',
      namePlaceholder: 'Введите название клуба...',
    },
    en: {
      league: 'MATCH TIME',
      country: 'CLUB FLAG',
      club: 'CLUB CHOICE',
      name: 'CLUB NAME',
      continue: 'CONTINUE',
      finalize: 'FINALIZE PROFILE',
      protocol: 'Strategic Protocol v49',
      msk: 'MSK',
      namePlaceholder: 'Enter club name...',
    }
  }[language === 'ru' ? 'ru' : 'en'];

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]" />
      <div className="relative z-10 w-full max-w-md mx-auto px-4 flex flex-col py-12">
        <header className="text-center mb-10 relative">
          {step !== 'league' && (
            <Button variant="ghost" size="icon" className="absolute left-0 top-0 rounded-full" onClick={() => {
              if (step === 'country') setStep('league');
              else if (step === 'club') setStep('country');
              else if (step === 'name') setStep('club');
            }}>
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
          <h1 className="text-2xl font-headline font-bold text-white uppercase tracking-tighter">
            {step === 'league' ? t.league : step === 'country' ? t.country : step === 'club' ? t.club : t.name}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest mt-1 opacity-60">{t.protocol}</p>
        </header>
        
        <div className="flex-1 pb-24">
          {step === 'league' && (
            <div className="grid grid-cols-4 gap-2">
              {LEAGUES.map((l) => (
                <Card 
                  key={l.id} 
                  className={cn(
                    "glass-card border-white/5 cursor-pointer transition-all aspect-square flex items-center justify-center", 
                    selectedLeagueId === l.id ? "ring-2 ring-primary bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.3)]" : "hover:bg-white/5"
                  )} 
                  onClick={() => setSelectedLeagueId(l.id)}
                >
                  <CardContent className="p-0 text-center flex flex-col items-center justify-center">
                    <span className="text-sm font-headline font-bold text-white leading-none">{l.startTime}</span>
                    <p className="text-[6px] text-muted-foreground uppercase mt-1 font-black">{t.msk}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
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

          {step === 'name' && (
            <div className="space-y-6 animate-in fade-in duration-500">
               <Card className="glass-card border-primary/20 bg-primary/5 p-6">
                 <div className="space-y-4">
                   <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{t.name}</Label>
                     <div className="relative">
                       <Edit3 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                       <Input 
                        value={customClubName} 
                        onChange={(e) => setCustomClubName(e.target.value)} 
                        placeholder={t.namePlaceholder}
                        className="pl-12 h-14 bg-background/50 border-white/10 text-lg font-bold focus-visible:ring-primary shadow-inner"
                       />
                     </div>
                   </div>
                 </div>
               </Card>
               <div className="p-4 bg-primary/5 rounded-2xl border border-dashed border-primary/20 flex gap-3 items-start">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                    {language === 'ru' 
                      ? "Новые клубы получают приоритетное распределение в максимально высокий дивизион для обеспечения спортивной конкуренции." 
                      : "New clubs receive priority placement in the highest possible division to ensure competitive parity."}
                  </p>
               </div>
            </div>
          )}
        </div>
        
        <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-white/10 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          <div className="max-w-md mx-auto">
            <Button 
              disabled={
                isUpdating || 
                (step === 'league' && !selectedLeagueId) || 
                (step === 'country' && !selectedCountryCode) || 
                (step === 'club' && !selectedClubId) ||
                (step === 'name' && customClubName.trim().length < 3)
              } 
              onClick={() => {
                if (step === 'league') setStep('country');
                else if (step === 'country') setStep('club');
                else if (step === 'club') setStep('name');
                else handleCompleteSetup();
              }} 
              className="w-full h-16 hero-gradient font-black text-xs tracking-[0.2em] uppercase shadow-2xl active:scale-95 transition-all"
            >
              {isUpdating ? <Loader2 className="animate-spin" /> : (step === 'name' ? t.finalize : t.continue)}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
