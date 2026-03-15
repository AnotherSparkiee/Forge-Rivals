'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check } from 'lucide-react';
import { useGameState } from '@/app/lib/store';
import { cn } from '@/lib/utils';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { language, setLanguage, isLoaded } = useGameState();

  const translations = {
    en: {
      title: "Initiate Profile",
      callsign: "Team Name",
      emailLabel: "Email Address",
      passLabel: "Access Key (Password)",
      submitBtn: "CREATE PROFILE",
      alreadyRegistered: "Already registered?",
      loginLink: "Synchronize Link",
      successTitle: "Profile Initialized",
      successDesc: "Welcome to the league, Commander. Now, choose your operational sector.",
      errorTitle: "Registration Failed"
    },
    ru: {
      title: "Инициация профиля",
      callsign: "Название команды",
      emailLabel: "Почта (Email)",
      passLabel: "Ключ доступа (Пароль)",
      submitBtn: "СОЗДАТЬ ПРОФИЛЬ",
      alreadyRegistered: "Уже зарегистрированы?",
      loginLink: "Установить связь",
      successTitle: "Профиль инициализирован",
      successDesc: "Добро пожаловать в лигу, Командир. Выберите сектор развертывания.",
      errorTitle: "Ошибка регистрации"
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userProfileRef = doc(db, 'users', user.uid);
      const profileData = {
        id: user.uid,
        displayName: username,
        inGameCurrency: 500,
        experiencePoints: 0,
        lastLoginDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ownedHeroIds: ['h1', 'h2', 'h3', 'h4', 'h5'],
        leagueRankingId: 'none'
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

  if (!isLoaded) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2 mb-4 bg-secondary/20 p-1 rounded-lg border border-white/5">
        <Button 
          variant="ghost" 
          size="sm"
          className={cn("flex-1 text-[10px] gap-1 h-7", language === 'en' && "bg-white/10 text-primary")}
          onClick={() => setLanguage('en')}
        >
          EN {language === 'en' && <Check className="w-3 h-3" />}
        </Button>
        <Button 
          variant="ghost" 
          size="sm"
          className={cn("flex-1 text-[10px] gap-1 h-7", language === 'ru' && "bg-white/10 text-primary")}
          onClick={() => setLanguage('ru')}
        >
          RU {language === 'ru' && <Check className="w-3 h-3" />}
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
                placeholder="Team Alpha" 
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
            <Button type="submit" className="w-full hero-gradient font-bold" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t.submitBtn}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              {t.alreadyRegistered} <Link href="/auth/login" className="text-primary hover:underline">{t.loginLink}</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
