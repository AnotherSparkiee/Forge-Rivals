'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, ArrowRight } from 'lucide-react';
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
  const { user } = useUser();

  const t = {
    en: {
      title: "Initiate Profile", subtitle: "Instant access to the command center", callsign: "Team Name", emailLabel: "Email Address", passLabel: "Access Key",
      submitBtn: "INITIALIZE PROFILE", alreadyRegistered: "Already registered?", loginLink: "Synchronize Link", successTitle: "Profile Initialized",
      welcomeBack: "Authorized Session Detected", enterHub: "ENTER COMMAND CENTER"
    },
    ru: {
      title: "Инициация профиля", subtitle: "Мгновенный доступ к командному центру", callsign: "Название команды", emailLabel: "Почта (Email)", passLabel: "Пароль",
      submitBtn: "СОЗДАТЬ ПРОФИЛЬ", alreadyRegistered: "Уже зарегистрированы?", loginLink: "Установить связь", successTitle: "Профиль инициализирован",
      welcomeBack: "Сессия авторизована", enterHub: "ВОЙТИ В КОМАНДНЫЙ ЦЕНТР"
    }
  }[language as 'en' | 'ru'];

  const handleEnter = () => {
    sessionStorage.setItem('lote_hub_entered', 'true');
    router.push('/');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    // STRICT VALIDATION: Club name must be trimmed and at least 2 chars
    const trimmedUsername = username.trim();
    if (!trimmedUsername || trimmedUsername.length < 2 || trimmedUsername === "Unknown Commander" || password.length < 6) {
      toast({ 
        variant: "destructive", 
        title: language === 'ru' ? "Некорректное название" : "Invalid Name", 
        description: language === 'ru' ? "Название клуба слишком короткое или недопустимо." : "Club name is too short or invalid." 
      });
      return;
    }

    setIsLoading(true);
    try {
      const { seasonNumber } = getGlobalSeasonInfo();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uniqueSquad = getRandomStartingSquad();
      const profileData = {
        id: userCredential.user.uid, displayName: trimmedUsername, email, inGameCurrency: 10000000, crystals: 0,
        experiencePoints: 0, managerLevel: 1, skillPoints: 0, lastLoginDate: new Date().toISOString(), createdAt: new Date().toISOString(),
        ownedHeroes: uniqueSquad, ownedHeroIds: uniqueSquad.map(h => h.id),
        lineup: { 
          offlane: uniqueSquad[0].id, carry: uniqueSquad[1].id, mid: uniqueSquad[2].id, 
          support: uniqueSquad[3].id, full_support: uniqueSquad[4].id, 
          sub1: uniqueSquad[5].id, sub2: uniqueSquad[6].id,
          res1: null, res2: null, res3: null
        },
        leagueLevel: 9, groupId: 1, points: 0, wins: 0, draws: 0, losses: 0, lastProcessedSeason: Number(seasonNumber || 1),
        lastJoinedAssocAt: null
      };
      await setDoc(doc(db, 'players_v10', userCredential.user.uid), cleanData(profileData));
      toast({ title: t.successTitle });
      router.push('/setup');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally { setIsLoading(false); }
  };

  if (user) {
    return (
      <Card className="glass-card border-primary/20 bg-primary/5 p-8 text-center animate-in zoom-in duration-500">
        <h2 className="text-xl font-headline font-bold text-white uppercase mb-4">{t.welcomeBack}</h2>
        <Button onClick={handleEnter} className="w-full h-14 hero-gradient font-black text-xs uppercase">{t.enterHub} <ArrowRight className="ml-2 w-4 h-4" /></Button>
      </Card>
    );
  }

  return (
    <Card className="glass-card animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader><CardTitle className="font-headline text-center uppercase tracking-widest text-accent text-lg">{t.title}</CardTitle><p className="text-[10px] text-center text-muted-foreground uppercase font-bold px-4 leading-relaxed">{t.subtitle}</p></CardHeader>
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>{t.callsign}</Label><Input value={username} onChange={e => setUsername(e.target.value)} required className="bg-secondary/50" /></div>
          <div className="space-y-2"><Label>{t.emailLabel}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-secondary/50" /></div>
          <div className="space-y-2"><Label>{t.passLabel}</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="bg-secondary/50" /></div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full hero-gradient font-bold h-12" disabled={isLoading}>{isLoading ? <Loader2 className="animate-spin" /> : <><UserPlus className="w-4 h-4 mr-2" /> {t.submitBtn}</>}</Button>
          <p className="text-xs text-center text-muted-foreground mt-2">{t.alreadyRegistered} <Link href="/auth/login" className="text-primary hover:underline">{t.loginLink}</Link></p>
        </CardFooter>
      </form>
    </Card>
  );
}
