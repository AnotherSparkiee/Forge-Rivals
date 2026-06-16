'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, ArrowRight } from 'lucide-react';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';

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
  const { language } = useGameState();
  const { user, isUserLoading } = useUser();

  const t = {
    en: {
      title: "Initiate Profile", subtitle: "Instant access to the command center", callsign: "Team Name", emailLabel: "Email Address", passLabel: "Access Key",
      submitBtn: "INITIALIZE PROFILE", alreadyRegistered: "Already registered?", loginLink: "Sync Link", successTitle: "Profile Initialized",
      welcomeBack: "Authorized Session Detected", enterHub: "ENTER COMMAND CENTER"
    },
    ru: {
      title: "Инициация профиля", subtitle: "Мгновенный доступ к командному центру", callsign: "Название клуба", emailLabel: "Почта (Email)", passLabel: "Пароль",
      submitBtn: "СОЗДАТЬ ПРОФИЛЬ", alreadyRegistered: "Уже зарегистрированы?", loginLink: "Войти", successTitle: "Профиль инициализирован",
      welcomeBack: "Сессия авторизована", enterHub: "ВОЙТИ В КОМАНДНЫЙ ЦЕНТР"
    }
  }[language as 'en' | 'ru'] || { title: "Register", subtitle: "Join", callsign: "Team", emailLabel: "Email", passLabel: "Pass", submitBtn: "Join", alreadyRegistered: "Have account?", loginLink: "Login", successTitle: "Success", welcomeBack: "Welcome", enterHub: "Go" };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    if (!trimmedUsername || trimmedUsername.length < 2 || trimmedUsername === "Unknown Commander" || password.length < 6) {
      toast({ 
        variant: "destructive", 
        title: language === 'ru' ? "Некорректные данные" : "Invalid Data", 
        description: language === 'ru' ? "Название клуба слишком короткое или пароль слишком простой." : "Club name or password is invalid." 
      });
      return;
    }

    setIsLoading(true);
    try {
      const { seasonNumber } = getGlobalSeasonInfo();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      const profileData = {
        id: userCredential.user.uid, 
        displayName: trimmedUsername, 
        email, 
        lastLoginDate: new Date().toISOString(), 
        createdAt: new Date().toISOString(),
        lastProcessedSeason: Number(seasonNumber || 1)
      };
      
      await setDoc(doc(db, 'players_v10', userCredential.user.uid), cleanData(profileData));
      toast({ title: t.successTitle });
      router.push('/setup');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally { setIsLoading(false); }
  };

  if (isUserLoading) return <LoadingScreen />;

  if (user) {
    return (
      <Card className="glass-card border-primary/20 bg-primary/5 p-8 text-center">
        <h2 className="text-xl font-headline font-bold text-white uppercase mb-4">{t.welcomeBack}</h2>
        <Button onClick={() => router.push('/')} className="w-full h-14 hero-gradient font-black text-xs uppercase">{t.enterHub} <ArrowRight className="ml-2 w-4 h-4" /></Button>
      </Card>
    );
  }

  return (
    <Card className="glass-card w-full max-w-sm">
      <CardHeader><CardTitle className="font-headline text-center uppercase tracking-widest text-accent text-lg">{t.title}</CardTitle><p className="text-[10px] text-center text-muted-foreground uppercase font-bold px-4 leading-relaxed">{t.subtitle}</p></CardHeader>
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>{t.callsign}</Label><Input value={username} onChange={e => setUsername(e.target.value)} required className="bg-secondary/50" /></div>
          <div className="space-y-2"><Label>{t.emailLabel}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-secondary/50" /></div>
          <div className="space-y-2"><Label>{t.passLabel}</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="bg-secondary/50" /></div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full hero-gradient font-bold h-12" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin" /> : <><UserPlus className="w-4 h-4 mr-2" /> {t.submitBtn}</>}</Button>
          <p className="text-xs text-center text-muted-foreground mt-2">{t.alreadyRegistered} <Link href="/" className="text-primary hover:underline">{t.loginLink}</Link></p>
        </CardFooter>
      </form>
    </Card>
  );
}
