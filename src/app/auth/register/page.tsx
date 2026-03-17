
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, limit, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Chrome } from 'lucide-react';
import { useGameState } from '@/app/lib/store';
import { cn } from '@/lib/utils';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { language, isLoaded } = useGameState();

  const translations = {
    en: {
      title: "Initiate Profile",
      navLogin: "Login",
      navRegister: "Register",
      callsign: "Team Name",
      emailLabel: "Email Address",
      passLabel: "Access Key (Password)",
      submitBtn: "CREATE PROFILE",
      googleBtn: "SIGN UP WITH GOOGLE",
      orLabel: "OR",
      alreadyRegistered: "Already registered?",
      loginLink: "Synchronize Link",
      successTitle: "Profile Initialized",
      successDesc: "Welcome to the league, Commander. Prepare for deployment and league assignment.",
      errorTitle: "Registration Failed",
      usernameTaken: "This team name is already assigned to another commander."
    },
    ru: {
      title: "Инициация профиля",
      navLogin: "Вход",
      navRegister: "Регистрация",
      callsign: "Название команды",
      emailLabel: "Почта (Email)",
      passLabel: "Ключ доступа (Пароль)",
      submitBtn: "СОЗДАТЬ ПРОФИЛЬ",
      googleBtn: "РЕГИСТРАЦИЯ ЧЕРЕЗ GOOGLE",
      orLabel: "ИЛИ",
      alreadyRegistered: "Уже зарегистрированы?",
      loginLink: "Установить связь",
      successTitle: "Профиль инициализирован",
      successDesc: "Добро пожаловать в лигу, Командир. Приготовьтесь к развертыванию и зачислению в дивизион.",
      errorTitle: "Ошибка регистрации",
      usernameTaken: "Это название команды уже занято другим командиром."
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const usersRef = collection(db, 'players_v2');
      const q = query(usersRef, where('displayName', '==', username), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        throw new Error(t.usernameTaken);
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userProfileRef = doc(db, 'players_v2', user.uid);
      
      const profileData = {
        id: user.uid,
        displayName: username,
        email: email,
        inGameCurrency: 500,
        experiencePoints: 0,
        lastLoginDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ownedHeroIds: ['h1', 'h2', 'h3', 'h4', 'h5', 'h_sub1', 'h_sub2'],
        leagueLevel: 0,
        divisionSubId: 0,
        groupId: 0,
      };

      await setDoc(userProfileRef, profileData);

      toast({
        title: t.successTitle,
        description: t.successDesc,
      });
      router.push('/setup');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t.errorTitle,
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userProfileRef = doc(db, 'players_v2', user.uid);
      const userSnap = await getDoc(userProfileRef);

      if (!userSnap.exists()) {
        const profileData = {
          id: user.uid,
          displayName: user.displayName || `Manager_${user.uid.slice(0, 5)}`,
          email: user.email,
          inGameCurrency: 500,
          experiencePoints: 0,
          lastLoginDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          ownedHeroIds: ['h1', 'h2', 'h3', 'h4', 'h5', 'h_sub1', 'h_sub2'],
          leagueLevel: 0,
          divisionSubId: 0,
          groupId: 0,
        };
        await setDoc(userProfileRef, profileData);
        router.push('/setup');
      } else {
        const data = userSnap.data();
        if (data?.selectedLeagueId && data?.country) {
          router.push('/');
        } else {
          router.push('/setup');
        }
      }

      toast({
        title: t.successTitle,
        description: t.successDesc,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t.errorTitle,
        description: error.message,
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2 mb-4 bg-secondary/20 p-1 rounded-lg border border-white/5">
        <Button 
          variant="ghost" 
          size="sm"
          className={cn("flex-1 text-xs font-bold h-8 uppercase tracking-widest text-muted-foreground")}
          onClick={() => router.push('/auth/login')}
        >
          {t.navLogin}
        </Button>
        <Button 
          variant="ghost" 
          size="sm"
          className={cn("flex-1 text-xs font-bold h-8 uppercase tracking-widest", "bg-white/10 text-primary")}
          onClick={() => router.push('/auth/register')}
        >
          {t.navRegister}
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-headline text-center uppercase tracking-widest text-accent text-lg">{t.title}</CardTitle>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t.callsign}</Label>
              <Input 
                id="username" 
                placeholder="Team X" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                required 
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t.emailLabel}</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="name@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.passLabel}</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="bg-secondary/50"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full hero-gradient font-bold" disabled={isLoading || isGoogleLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t.submitBtn}
            </Button>

            <div className="flex items-center gap-4 w-full">
              <div className="h-px bg-white/10 flex-1"></div>
              <span className="text-[10px] text-muted-foreground font-bold uppercase">{t.orLabel}</span>
              <div className="h-px bg-white/10 flex-1"></div>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full font-bold border-white/10 hover:bg-white/5 h-11" 
              onClick={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading}
            >
              {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Chrome className="mr-2 h-4 w-4 text-red-400" />}
              {t.googleBtn}
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
