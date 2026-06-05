
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, ArrowRight, ShieldCheck } from 'lucide-react';
import { useGameState } from '@/app/lib/store';
import { getRandomStartingSquad } from '@/app/lib/moba-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';

function cleanData(obj: any) {
  return JSON.parse(JSON.stringify(obj, (key, value) => 
    value === undefined ? null : value
  ));
}

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { language, isLoaded: storeIsLoaded } = useGameState();
  const { user, isUserLoading } = useUser();

  const translations = {
    en: {
      title: "Initiate Profile",
      subtitle: "Instant access to the command center",
      callsign: "Team Name",
      emailLabel: "Email Address",
      passLabel: "Access Key (Password)",
      submitBtn: "INITIALIZE PROFILE",
      alreadyRegistered: "Already registered?",
      loginLink: "Synchronize Link",
      successTitle: "Profile Initialized",
      successDesc: "Welcome to the league, Commander.",
      errorTitle: "Operation Failed",
      welcomeBack: "Authorized Session Detected",
      enterHub: "ENTER COMMAND CENTER"
    },
    ru: {
      title: "Инициация профиля",
      subtitle: "Мгновенный доступ к командному центру",
      callsign: "Название команды",
      emailLabel: "Почта (Email)",
      passLabel: "Ключ доступа (Пароль)",
      submitBtn: "СОЗДАТЬ ПРОФИЛЬ",
      alreadyRegistered: "Уже зарегистрированы?",
      loginLink: "Установить связь",
      successTitle: "Профиль инициализирован",
      successDesc: "Добро пожаловать в лигу, Командир.",
      errorTitle: "Ошибка операции",
      welcomeBack: "Сессия авторизована",
      enterHub: "ВОЙТИ В КОМАНДНЫЙ ЦЕНТР"
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleEnter = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('lote_hub_entered', 'true');
    }
    router.push('/');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || username.length < 2) return;
    if (password.length < 6) return;

    setIsLoading(true);

    try {
      const { seasonNumber } = getGlobalSeasonInfo();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      const uniqueSquad = getRandomStartingSquad();
      const profileData = {
        id: newUser.uid,
        displayName: username.trim(),
        email: email,
        inGameCurrency: 10000000,
        crystals: 0,
        experiencePoints: 0,
        lastLoginDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        setupDate: new Date().toISOString(),
        ownedHeroes: uniqueSquad,
        ownedHeroIds: uniqueSquad.map(h => h.id),
        lineup: {
          offlane: uniqueSquad[0].id, carry: uniqueSquad[1].id, mid: uniqueSquad[2].id,
          support: uniqueSquad[3].id, full_support: uniqueSquad[4].id, sub1: uniqueSquad[5].id, sub2: uniqueSquad[6].id
        },
        leagueLevel: 9, divisionSubId: 1, groupId: 1, rank: 1000,
        wins: 0, draws: 0, losses: 0, points: 0,
        lastProcessedSeason: Number(seasonNumber || 1)
      };

      await setDoc(doc(db, 'players_v10', newUser.uid), cleanData(profileData));
      toast({ title: t.successTitle, description: t.successDesc });
      handleEnter();
    } catch (error: any) {
      console.error("Reg fail:", error);
      toast({ variant: "destructive", title: t.errorTitle, description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (isUserLoading || !storeIsLoaded) return null;

  if (user) {
    return (
      <div className="space-y-4 animate-in fade-in zoom-in duration-500">
        <Card className="glass-card border-primary/20 bg-primary/5">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="font-headline uppercase tracking-widest text-white text-lg">{t.welcomeBack}</CardTitle>
            <p className="text-[10px] text-muted-foreground uppercase font-bold mt-2">ID: {user.uid.slice(0, 12)}...</p>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleEnter} className="w-full h-14 hero-gradient font-black text-xs tracking-widest">
              {t.enterHub} <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </CardFooter>
        </Card>
        <p className="text-center">
          <button onClick={() => auth.signOut()} className="text-[10px] font-black text-red-400 uppercase tracking-widest hover:underline">
            {language === 'ru' ? 'ВЫЙТИ ИЗ АККАУНТА' : 'SIGN OUT'}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2 mb-4 bg-secondary/20 p-1 rounded-lg border border-white/5">
        <Button variant="ghost" size="sm" className="flex-1 text-xs font-bold h-8 uppercase tracking-widest text-muted-foreground" onClick={() => router.push('/auth/login')}>
          {language === 'ru' ? 'ВХОД' : 'LOGIN'}
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 text-xs font-bold h-8 uppercase tracking-widest bg-white/10 text-primary">
          {language === 'ru' ? 'РЕГИСТРАЦИЯ' : 'REGISTER'}
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-headline text-center uppercase tracking-widest text-accent text-lg">{t.title}</CardTitle>
          <p className="text-[10px] text-center text-muted-foreground uppercase font-bold px-4 leading-relaxed">{t.subtitle}</p>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t.callsign}</Label>
              <Input id="username" placeholder="Squad Name" value={username} onChange={(e) => setUsername(e.target.value)} required className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t.emailLabel}</Label>
              <Input id="email" type="email" placeholder="example@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.passLabel}</Label>
              <Input id="password" type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-secondary/50" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full hero-gradient font-bold h-12" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><UserPlus className="w-4 h-4 mr-2" /> {t.submitBtn}</>}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              {t.alreadyRegistered} <Link href="/auth/login" className="text-primary hover:underline">{t.loginLink}</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
