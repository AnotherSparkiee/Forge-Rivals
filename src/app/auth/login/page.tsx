
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Chrome, HelpCircle } from 'lucide-react';
import { useGameState } from '@/app/lib/store';
import { cn } from '@/lib/utils';
import { getRandomStartingSquad } from '@/app/lib/moba-data';
import { getGlobalSeasonInfo } from '@/app/lib/time-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useGameState();

  const translations = {
    en: {
      title: "Sync Credentials",
      navLogin: "Login",
      navRegister: "Register",
      emailLabel: "Email or Team Name",
      passLabel: "Access Key (Password)",
      forgotPass: "Forgot Key?",
      submitBtn: "ESTABLISH LINK",
      googleBtn: "LOG IN WITH GOOGLE",
      orLabel: "OR",
      newManager: "New manager?",
      registerLink: "Initialize new profile",
      successTitle: "Access Granted",
      successDesc: "Welcome back to the Command Center.",
      errorTitle: "Access Denied",
      userNotFound: "Team name not found or access restricted. Please use email.",
      invalidCredentials: "Invalid login or access key. Please verify your data.",
      forgotTitle: "Recover Access",
      forgotDesc: "Enter the email linked to your profile to receive a reset transmission.",
      forgotPlaceholder: "commander@example.com",
      forgotSend: "SEND RESET LINK",
      forgotSuccess: "Transmission Sent",
      forgotSuccessDesc: "Check your inbox for the recovery sequence."
    },
    ru: {
      title: "Синхронизация данных",
      navLogin: "Вход",
      navRegister: "Регистрация",
      emailLabel: "Почта или Название команды",
      passLabel: "Ключ доступа (Пароль)",
      forgotPass: "Забыли ключ?",
      submitBtn: "УСТАНОВИТЬ СВЯЗЬ",
      googleBtn: "ВОЙТИ ЧЕРЕЗ GOOGLE",
      orLabel: "ИЛИ",
      newManager: "Новый менеджер?",
      registerLink: "Создать новый профиль",
      successTitle: "Доступ разрешен",
      successDesc: "Добро пожаловать в Командный Центр.",
      errorTitle: "Доступ запрещен",
      userNotFound: "Команда не найдена или доступ ограничен. Используйте почту.",
      invalidCredentials: "Неверный логин или пароль. Проверьте правильность ввода.",
      forgotTitle: "Восстановление доступа",
      forgotDesc: "Введите почту вашего профиля для получения ссылки на сброс пароля.",
      forgotPlaceholder: "commander@example.com",
      forgotSend: "ОТПРАВИТЬ ССЫЛКУ",
      forgotSuccess: "Связь установлена",
      forgotSuccessDesc: "Проверьте почту для получения инструкций по сбросу."
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    let emailToUse = identifier;

    try {
      if (!identifier.includes('@')) {
        try {
          const usersRef = collection(db, 'players_v11');
          const q = query(usersRef, where('displayName', '==', identifier), limit(1));
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) {
            throw new Error(t.userNotFound);
          }
          const userData = querySnapshot.docs[0].data();
          emailToUse = userData.email;
        } catch (serverError: any) {
          throw new Error(t.userNotFound);
        }
      }

      await signInWithEmailAndPassword(auth, emailToUse, password);
      
      toast({ title: t.successTitle, description: t.successDesc });
      router.push('/');
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        errorMessage = t.invalidCredentials;
      }
      toast({ variant: "destructive", title: t.errorTitle, description: errorMessage });
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

      const userProfileRef = doc(db, 'players_v11', user.uid);
      const userSnap = await getDoc(userProfileRef);

      if (!userSnap.exists()) {
        const uniqueSquad = getRandomStartingSquad();
        const { seasonNumber } = getGlobalSeasonInfo();
        
        const initialLineup = {
          offlane: uniqueSquad[0].id,
          carry: uniqueSquad[1].id,
          mid: uniqueSquad[2].id,
          support: uniqueSquad[3].id,
          full_support: uniqueSquad[4].id,
          sub1: uniqueSquad[5].id,
          sub2: uniqueSquad[6].id
        };

        const profileData = {
          id: user.uid,
          displayName: user.displayName || `Manager_${user.uid.slice(0, 5)}`,
          email: user.email,
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
          points: 0,
          lastProcessedSeason: Number(seasonNumber)
        };
        await setDoc(userProfileRef, profileData);
        router.push('/setup');
      } else {
        const data = userSnap.data();
        if (!data?.displayName) {
          await setDoc(userProfileRef, { displayName: user.displayName || `Manager_${user.uid.slice(0, 5)}` }, { merge: true });
        }
        
        if (data?.selectedLeagueId && data?.country) {
          router.push('/');
        } else {
          router.push('/setup');
        }
      }

      toast({ title: t.successTitle, description: t.successDesc });
    } catch (error: any) {
      toast({ variant: "destructive", title: t.errorTitle, description: error.message });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setIsForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      toast({ title: t.forgotSuccess, description: t.forgotSuccessDesc });
      setIsForgotOpen(false);
      setForgotEmail('');
    } catch (error: any) {
      toast({ variant: "destructive", title: t.errorTitle, description: error.message });
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2 mb-4 bg-secondary/20 p-1 rounded-lg border border-white/5">
        <Button variant="ghost" size="sm" className={cn("flex-1 text-xs font-bold h-8 uppercase tracking-widest", "bg-white/10 text-primary")} onClick={() => router.push('/auth/login')}>
          {t.navLogin}
        </Button>
        <Button variant="ghost" size="sm" className={cn("flex-1 text-xs font-bold h-8 uppercase tracking-widest text-muted-foreground")} onClick={() => router.push('/auth/register')}>
          {t.navRegister}
        </Button>
      </div>

      <Card className="glass-card">
        <form onSubmit={handleLogin}>
          <CardHeader>
            <CardTitle className="font-headline text-center uppercase tracking-widest text-accent text-lg">{t.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">{t.emailLabel}</Label>
              <Input id="identifier" placeholder="Team Name or email@example.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t.passLabel}</Label>
                <button type="button" onClick={() => setIsForgotOpen(true)} className="text-[10px] text-primary hover:underline font-bold uppercase tracking-tighter">
                  {t.forgotPass}
                </button>
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-secondary/50" />
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
            <Button type="button" variant="outline" className="w-full font-bold border-white/10 hover:bg-white/5 h-11" onClick={handleGoogleLogin} disabled={isLoading || isGoogleLoading}>
              {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Chrome className="mr-2 h-4 w-4 text-red-400" />}
              {t.googleBtn}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              {t.newManager} <Link href="/auth/register" className="text-primary hover:underline">{t.registerLink}</Link>
            </p>
          </CardFooter>
        </form>
      </Card>

      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-white/10 text-foreground">
          <form onSubmit={handleForgotPassword}>
            <DialogHeader>
              <DialogTitle className="font-headline uppercase tracking-widest text-primary flex items-center gap-2">
                <HelpCircle className="w-5 h-5" /> {t.forgotTitle}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs pt-2 leading-relaxed">
                {t.forgotDesc}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-6">
              <div className="space-y-2">
                <Label htmlFor="forgotEmail" className="text-xs uppercase font-bold text-accent">{t.emailLabel}</Label>
                <Input id="forgotEmail" type="email" placeholder={t.forgotPlaceholder} value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="bg-secondary/50 border-white/5" required />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full hero-gradient font-bold" disabled={isForgotLoading}>
                {isForgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.forgotSend}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
