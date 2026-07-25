'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, writeBatch, collection, query, where, getDocs, serverTimestamp, setDoc, limit, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LEAGUES } from '@/app/lib/leagues-data';
import { COUNTRIES } from '@/app/lib/countries-data';
import { Loader2, ChevronLeft, ShieldCheck, Trophy, Target, Shield, Edit3, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { getRandomStartingSquad } from '@/app/lib/moba-data';
import { LoadingScreen } from '@/components/game/LoadingScreen';

const SETUP_VERSION = 87;

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

function cleanData(obj: any) {
  return JSON.parse(JSON.stringify(obj, (key, value) => 
    value === undefined ? null : value
  ));
}

export default function SetupPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { language, isLoaded, displayName, ownedPlayers, youthAcademyPlayers } = useGameState();
  
  const [step, setStep] = useState<'league' | 'country' | 'club' | 'name'>('league');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [customClubName, setCustomClubName] = useState('');
  const [nameStatus, setNameStatus] = useState<'idle' | 'checking' | 'taken' | 'available'>('idle');
  const [isUpdating, setIsUpdating] = useState(false);

  const userRef = useMemoFirebase(() => (user?.uid ? doc(db, 'players_v10', user.uid) : null), [db, user?.uid]);
  const { data: profile } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/auth/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (displayName && !customClubName && displayName !== "Manager") {
      setCustomClubName(displayName);
    }
  }, [displayName, customClubName]);

  useEffect(() => {
    if (step !== 'name' || customClubName.trim().length < 3) {
      setNameStatus('idle');
      return;
    }

    const checkName = async () => {
      setNameStatus('checking');
      try {
        const q = query(
          collection(db, 'players_v10'), 
          where('clubName', '==', customClubName.trim()),
          limit(1)
        );
        const snap = await getDocs(q);
        const results = snap.docs.filter(d => d.id !== user?.uid);
        if (results.length > 0) setNameStatus('taken');
        else setNameStatus('available');
      } catch (e) {
        setNameStatus('idle');
      }
    };

    const timer = setTimeout(checkName, 600);
    return () => clearTimeout(timer);
  }, [customClubName, step, db, user?.uid]);

  const findPlacementClient = async (leagueId: string) => {
    const q = query(collection(db, 'players_v10'), where('selectedLeagueId', '==', leagueId));
    const snap = await getDocs(q);
    const occupiedIndices = new Set<number>();
    
    snap.forEach(d => {
      const data = d.data();
      const tier = Number(data.leagueLevel);
      const group = Number(data.groupId);
      const rank = Number(data.rank);
      if (tier && group && rank) {
        const groupsBefore = Math.pow(2, tier - 1) - 1;
        const globalIndex = (groupsBefore * 8) + (group - 1) * 8 + (rank - 1);
        occupiedIndices.add(globalIndex);
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
    if (!user || !selectedLeagueId || !selectedCountryCode || !selectedClubId || customClubName.trim().length < 3 || nameStatus !== 'available') return;
    setIsUpdating(true);
    try {
      const placement = await findPlacementClient(selectedLeagueId);
      const selectedCountry = COUNTRIES.find(c => c.code === selectedCountryCode);
      const selectedClub = CLUBS.find(c => c.id === selectedClubId);
      const { activeSeasonNumber } = getGlobalSeasonInfo();
      const nowIso = new Date().toISOString();
      
      const batch = writeBatch(db);
      const rootRef = doc(db, 'players_v10', user.uid);
      
      const existingSquad = (ownedPlayers.length > 0 || youthAcademyPlayers.length > 0);
      const uniqueSquad = existingSquad ? [] : getRandomStartingSquad();
      
      const rootData = cleanData({
        id: user.uid,
        email: profile?.email || null,
        tgId: profile?.tgId || null,
        selectedLeagueId,
        leagueLevel: Number(placement.tier),
        groupId: Number(placement.group),
        rank: Number(placement.rank),
        country: selectedCountry?.name || 'International',
        clubName: customClubName.trim(),
        displayName: customClubName.trim(), 
        clubLogo: selectedClub?.logo || null,
        setupDate: nowIso,
        lastProcessedSeason: Number(activeSeasonNumber || 1),
        trophies: profile?.trophies || [],
        lastSeenMatchDay: 0,
        createdAt: profile?.createdAt || nowIso,
        version: SETUP_VERSION
      });

      // 1. Обновляем корень
      batch.set(rootRef, rootData, { merge: true });

      // 2. Пути для команды в лиге
      const seasonId = `season_${activeSeasonNumber || 1}`;
      const prefixedGroupId = `${seasonId}_league_${selectedLeagueId}_group_${placement.group}`;
      const teamRef = doc(db, 'leagues_v2', selectedLeagueId, 'divisions', String(placement.tier), 'groups', prefixedGroupId, 'teams', user.uid);
      
      const teamData = cleanData({
        id: user.uid,
        displayName: customClubName.trim(),
        clubName: customClubName.trim(),
        clubLogo: selectedClub?.logo || null,
        credits: profile?.credits || 1000000, 
        crystals: profile?.crystals || 50, 
        experiencePoints: profile?.experiencePoints || 0, 
        managerLevel: profile?.managerLevel || 1,
        managerSkills: profile?.managerSkills || { sponsors: 0, agents: 0, training: 0, medical: 0 },
        arena: profile?.arena || { capacity: 5000 }, 
        hq: profile?.hq || {}, 
        bootcamp: profile?.bootcamp || {}, 
        academy: profile?.academy || {}, 
        medical: profile?.medical || {},
        lineup: existingSquad ? (profile?.lineup || {}) : { 
          offlane: uniqueSquad[0]?.id, carry: uniqueSquad[1]?.id, mid: uniqueSquad[2]?.id, 
          support: uniqueSquad[3]?.id, full_support: uniqueSquad[4]?.id, 
          sub1: uniqueSquad[5]?.id, sub2: uniqueSquad[6]?.id
        },
        strategy: 'Balanced Play',
        rank: Number(placement.rank),
        lastProcessedSeason: Number(activeSeasonNumber || 1),
        matchHistory: [],
        createdAt: nowIso,
        version: SETUP_VERSION
      });

      batch.set(teamRef, teamData, { merge: true });

      // 3. Создаем героев, если их нет
      if (!existingSquad) {
        uniqueSquad.forEach(hero => {
          const heroRef = doc(collection(rootRef, 'heroes'), hero.id);
          batch.set(heroRef, cleanData({ ...hero, isYouth: false }));
        });
      }

      await batch.commit();
      toast({ title: language === 'ru' ? "Профиль настроен!" : "Profile Configured!" });
      
      // Жесткий редирект для сброса кешей
      window.location.href = '/';
    } catch (e: any) {
      console.error("[SETUP v87 CRITICAL ERROR]", e);
      toast({ variant: "destructive", title: "Setup Failed", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isUserLoading || !user || !isLoaded) return <LoadingScreen />;

  const t = {
    ru: {
      league: 'ВРЕМЯ МАТЧЕЙ',
      country: 'ФЛАГ КЛУБА',
      club: 'ВЫБОР КЛУБА',
      name: 'НАЗВАНИЕ КЛУБА',
      continue: 'ПРОДОЛЖИТЬ',
      finalize: 'ЗАВЕРШИТЬ ПРОФИЛЬ',
      protocol: 'Операционный протокол v87',
      msk: 'МСК',
      namePlaceholder: 'Введите название клуба...',
      nameDesc: 'Это имя будет отображаться в чатах и таблицах.',
      nameChecking: 'Синхронизация с реестром имен...',
      nameTaken: 'Это название уже занято другим клубом',
      nameAvailable: 'Название доступно для регистрации'
    },
    en: {
      league: 'MATCH TIME',
      country: 'CLUB FLAG',
      club: 'CLUB CHOICE',
      name: 'CLUB NAME',
      continue: 'CONTINUE',
      finalize: 'FINALIZE PROFILE',
      protocol: 'Operational Protocol v87',
      msk: 'MSK',
      namePlaceholder: 'Enter club name...',
      nameDesc: 'This name will be visible in chats and rankings.',
      nameChecking: 'Syncing with global registry...',
      nameTaken: 'This callsign is already assigned',
      nameAvailable: 'Callsign available for deployment'
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
                    selectedLeagueId === l.id ? "ring-2 ring-primary bg-primary/10" : "hover:bg-white/5"
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
                    selectedCountryCode === c.code ? "ring-2 ring-accent bg-accent/10 shadow-[0_0_15px_rgba(var(--accent),0.2)]" : "hover:bg-white/5"
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
                    selectedClubId === c.id ? "ring-2 ring-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary),0.2)]" : "hover:bg-white/5"
                  )} 
                  onClick={() => setSelectedClubId(c.id)}
                >
                  <CardContent className="p-0 flex items-center justify-center w-full h-full">
                    <div className="relative w-full h-full flex items-center justify-center p-2">
                      <img src={c.logo} alt={c.name} className="w-full h-full object-contain" />
                      {selectedClubId === c.id && (
                        <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5 shadow-lg">
                          <ShieldCheck className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
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
                        className={cn(
                          "pl-12 h-14 bg-background/50 border-white/10 text-lg font-bold transition-all",
                          nameStatus === 'taken' && "border-red-500 ring-1 ring-red-500/20",
                          nameStatus === 'available' && "border-green-500 ring-1 ring-green-500/20"
                        )}
                       />
                     </div>
                     <div className="min-h-[20px] px-1 transition-all">
                       {nameStatus === 'checking' && (
                         <p className="text-[9px] text-muted-foreground animate-pulse flex items-center gap-1.5 uppercase font-bold">
                           <Loader2 className="w-3 h-3 animate-spin" /> {t.nameChecking}
                         </p>
                       )}
                       {nameStatus === 'taken' && (
                         <p className="text-[9px] text-red-500 flex items-center gap-1.5 uppercase font-bold">
                           <AlertCircle className="w-3 h-3" /> {t.nameTaken}
                         </p>
                       )}
                       {nameStatus === 'available' && (
                         <p className="text-[9px] text-green-500 flex items-center gap-1.5 uppercase font-bold">
                           <CheckCircle2 className="w-3 h-3" /> {t.nameAvailable}
                         </p>
                       )}
                       {nameStatus === 'idle' && (
                         <p className="text-[9px] text-muted-foreground italic">{t.nameDesc}</p>
                       )}
                     </div>
                   </div>
                 </div>
               </Card>
            </div>
          )}
        </div>
        
        <footer className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-white/10 z-50">
          <div className="max-w-md mx-auto">
            <Button 
              disabled={
                isUpdating || 
                (step === 'league' && !selectedLeagueId) || 
                (step === 'country' && !selectedCountryCode) || 
                (step === 'club' && !selectedClubId) ||
                (step === 'name' && (customClubName.trim().length < 3 || nameStatus !== 'available'))
              } 
              onClick={() => {
                if (step === 'league') setStep('country');
                else if (step === 'country') setStep('club');
                else if (step === 'club') setStep('name');
                else handleCompleteSetup();
              }} 
              className="w-full h-16 hero-gradient font-black text-xs tracking-[0.2em] uppercase shadow-2xl active:scale-100 transition-all"
            >
              {isUpdating ? <Loader2 className="animate-spin" /> : (step === 'name' ? t.finalize : t.continue)}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
