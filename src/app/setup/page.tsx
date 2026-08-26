'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { COUNTRIES } from '@/app/lib/countries-data';
import { Loader2, ChevronLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGameState, LineupSlot } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getRandomStartingSquad } from '@/app/lib/moba-data';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { findStrategicPlacement } from '@/app/actions/season-init';
import { useFirestore, useUser, setDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';

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
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const { language, isLoaded, saveToLocal } = useGameState();
  
  // Упрощенный процесс: Страна -> Логотип. Название = Логин (из Auth)
  const [step, setStep] = useState<'country' | 'club'>('country');
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  // Извлекаем "логин" из email (часть до @)
  const loginName = useMemo(() => {
    if (!user?.email) return "Manager";
    return user.email.split('@')[0];
  }, [user?.email]);

  const handleCompleteSetup = async () => {
    if (!selectedCountryCode || !selectedClubId || isUpdating || !user) return;
    setIsUpdating(true);
    
    try {
      // 1. Поиск свободного места в лиге ALPHA по умолчанию
      const targetLeagueId = "ALPHA";
      let placement = { tier: 9, group: 1, rank: 1 };
      try {
        const result = await findStrategicPlacement(targetLeagueId);
        if (result) placement = result;
      } catch (e) {
        console.warn("[SETUP] Placement fallback active");
      }
      
      const selectedCountry = COUNTRIES.find(c => c.code === selectedCountryCode);
      const selectedClub = CLUBS.find(c => c.id === selectedClubId);
      const { activeSeasonNumber } = getGlobalSeasonInfo();
      
      const startingSquad = getRandomStartingSquad();
      const carryPlayers = startingSquad.filter(p => p.role === 'Carry');
      const midPlayers = startingSquad.filter(p => p.role === 'Midlaner');
      const tankPlayers = startingSquad.filter(p => p.role === 'Tank');
      const junglerPlayers = startingSquad.filter(p => p.role === 'Jungler');
      const supportPlayers = startingSquad.filter(p => p.role === 'Support');

      const initialLineup: Record<LineupSlot, string | null> = {
        carry: carryPlayers[0]?.id || null,
        mid: midPlayers[0]?.id || null,
        offlane: tankPlayers[0]?.id || null,
        support: junglerPlayers[0]?.id || null,
        full_support: supportPlayers[0]?.id || null,
        sub_carry: carryPlayers[1]?.id || null,
        sub_mid: midPlayers[1]?.id || null,
        sub_offlane: tankPlayers[1]?.id || null,
        sub_support: junglerPlayers[1]?.id || null,
        sub_full_support: supportPlayers[1]?.id || null,
        res1: null, res2: null, res3: null, res4: null, res5: null, res6: null, res7: null, res8: null
      };

      // Финальное название клуба — это логин пользователя
      const finalClubName = loginName;

      // 2. Сохранение в локальный стор (для мгновенного UI)
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
        lastProcessedSeason: activeSeasonNumber
      });

      // 3. Запись в Firestore (v11)
      if (db) {
        const playerRef = doc(db, 'players_v11', user.uid);
        setDocumentNonBlocking(playerRef, {
          id: user.uid,
          displayName: finalClubName,
          clubName: finalClubName,
          clubLogo: selectedClub?.logo || null,
          selectedLeagueId: String(targetLeagueId),
          leagueLevel: Number(placement.tier),
          groupId: Number(placement.group),
          rank: Number(placement.rank),
          country: selectedCountry?.name || 'International',
          createdAt: serverTimestamp(),
          lastLoginDate: new Date().toISOString(),
          version: 11
        }, { merge: true });
      }

      toast({ 
        title: language === 'ru' ? "Клуб инициализирован!" : "Club Initialized!",
      });

      router.replace('/');
    } catch (e: any) {
      console.error("[SETUP ERROR]:", e);
      setIsUpdating(false);
    }
  };

  if (!isLoaded || isUserLoading) return <LoadingScreen />;

  const t = {
    ru: {
      country: 'ВЫБОР ФЛАГА',
      club: 'ВЫБОР ЛОГОТИПА',
      finalize: 'СОЗДАТЬ КЛУБ',
      continue: 'ПРОДОЛЖИТЬ',
      subtitles: {
        country: 'Выберите страну которую будете представлять',
        club: 'Выберите логотип вашей организации',
      }
    },
    en: {
      country: 'SELECT FLAG',
      club: 'SELECT LOGO',
      finalize: 'CREATE CLUB',
      continue: 'CONTINUE',
      subtitles: {
        country: 'Select the country you will represent',
        club: 'Choose your organization logo',
      }
    }
  }[language === 'ru' ? 'ru' : 'en'];

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]" />
      <div className="relative z-10 w-full max-w-md mx-auto px-4 flex flex-col min-h-screen pt-12 pb-32">
        <header className="text-center mb-8 relative shrink-0">
          {step !== 'country' && (
            <Button variant="ghost" size="icon" className="absolute left-0 top-0 rounded-full" onClick={() => setStep('country')}>
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}
          <h1 className="text-2xl font-headline font-bold text-white uppercase tracking-tighter">
            {step === 'country' ? t.country : t.club}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest mt-1 opacity-60 px-4 leading-tight">
            {t.subtitles[step]}
          </p>
        </header>
        
        <div className="flex-1 flex flex-col justify-center animate-in fade-in duration-700">
          {step === 'country' && (
            <div className="grid grid-cols-4 gap-2 w-full">
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
            <div className="grid grid-cols-4 gap-2 w-full">
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
        </div>
        
        <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-white/10 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
          <div className="max-w-md mx-auto">
            <div className="mb-4 flex flex-col items-center gap-1 opacity-60">
               <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">COMMAND CALLSIGN:</p>
               <p className="text-sm font-headline font-bold text-primary uppercase italic">{loginName}</p>
            </div>
            <Button 
              disabled={
                isUpdating || 
                (step === 'country' && !selectedCountryCode) || 
                (step === 'club' && !selectedClubId)
              } 
              onClick={() => {
                if (step === 'country') setStep('club');
                else handleCompleteSetup();
              }} 
              className="w-full h-16 hero-gradient font-black text-xs tracking-[0.2em] uppercase shadow-2xl active:scale-95 transition-all"
            >
              {isUpdating ? <Loader2 className="animate-spin" /> : (step === 'club' ? t.finalize : t.continue)}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
