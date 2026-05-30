'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus } from 'lucide-react';
import { useGameState } from '@/app/lib/store';
import { getRandomStartingSquad } from '@/app/lib/moba-data';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useGameState();

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
      usernameTaken: "This team name is already assigned.",
      usernameInvalid: "Please enter a valid Team Name.",
      emailTaken: "Email already associated with a profile.",
      weakPassword: "Password must be at least 6 characters."
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
      usernameTaken: "Это название команды уже занято.",
      usernameInvalid: "Пожалуйста, введите корректное название команды.",
      emailTaken: "Этот Email уже используется другим менеджером.",
      weakPassword: "Пароль должен содержать минимум 6 символов."
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || username.length < 2) {
      toast({ variant: "destructive", title: t.errorTitle, description: t.usernameInvalid });
      return;
    }

    if (password.length < 6) {
      toast({ variant: "destructive", title: t.errorTitle, description: t.weakPassword });
      return;
    }

    setIsLoading(true);

    try {
      const usersRef = collection(db, 'players_v8');
      const q = query(usersRef, where('displayName', '==', username.trim()), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        throw new Error(t.usernameTaken);
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Generate randomized balanced squad (targets 29-38 team rating)
      const uniqueSquad = getRandomStartingSquad();
      
      // Auto-assign heroes based on roles
      const initialLineup = {
        offlane: uniqueSquad[0].id,      // Tank
        carry: uniqueSquad[1].id,        // Carry
        mid: uniqueSquad[2].id,          // Midlaner
        support: uniqueSquad[3].id,      // Jungler (Pos 4)
        full_support: uniqueSquad[4].id, // Support (Pos 5)
        sub1: uniqueSquad[5].id,         // Extra Carry
        sub2: uniqueSquad[6].id          // Extra Tank
      };

      const profileData = {
        id: user.uid,
        displayName: username.trim(),
        email: email,
        inGameCurrency: 10000000,
        crystals: 0,
        experiencePoints: 0,
        lastLoginDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ownedHeroes: uniqueSquad,
        ownedHeroIds: uniqueSquad.map(h => h.id),
        lineup: initialLineup,
        leagueLevel: 9,
        divisionSubId: 1,
        groupId: 1,
        rank: 1000,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0
      };

      await setDoc(doc(db, 'players_v8', user.uid), profileData);

      toast({ title: t.successTitle, description: t.successDesc });
      router.push('/setup');
    } catch (error: any) {
      let msg = error.message;
      if (error.code === 'auth/email-already-in-use') msg = t.emailTaken;
      if (error.code === 'auth/weak-password') msg = t.weakPassword;
      
      toast({
        variant: "destructive",
        title: t.errorTitle,
        description: msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

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
          <CardTitle className="font-headline text-center uppercase tracking-widest text-accent text-lg">
            {t.title}
          </CardTitle>
          <p className="text-[10px] text-center text-muted-foreground uppercase font-bold px-4 leading-relaxed">
            {t.subtitle}
          </p>
        </CardHeader>

        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t.callsign}</Label>
              <Input id="username" placeholder="Название команды" value={username} onChange={(e) => setUsername(e.target.value)} required className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t.emailLabel}</Label>
              <Input id="email" type="email" placeholder="example@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.passLabel}</Label>
              <Input id="password" type="password" placeholder="Минимум 6 символов" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-secondary/50" />
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