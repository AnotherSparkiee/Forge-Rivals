
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs, limit, doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Chrome, HelpCircle, ArrowRight, ShieldCheck } from 'lucide-react';
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
  const { language, isLoaded: storeIsLoaded } = useGameState();
  const { user, isUserLoading } = useUser();

  const translations = {
    en: {
      title: "Sync Credentials",
      navLogin: "Login",
      navRegister: "Register",
      emailLabel: "Email or Team Name",
      passLabel: "Access Key (Password)",
      submitBtn: "ESTABLISH LINK",
      googleBtn: "LOG IN WITH GOOGLE",
      orLabel: "OR",
      newManager: "New manager?",
      registerLink: "Initialize new profile",
      welcomeBack: "Authorized Session Detected",
      enterHub: "ENTER COMMAND CENTER"
    },
    ru: {
      title: "Синхронизация данных",
      navLogin: "Вход",
      navRegister: "Регистрация",
      emailLabel: "Почта или Название команды",
      passLabel: "Ключ доступа (Пароль)",
      submitBtn: "УСТАНОВИТЬ СВЯЗЬ",
      googleBtn: "ВОЙТИ ЧЕРЕЗ GOOGLE",
      orLabel: "ИЛИ",
      newManager: "Новый менеджер?",
      registerLink: "Создать новый профиль",
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    let emailToUse = identifier;
    try {
      if (!identifier.includes('@')) {
        const usersRef = collection(db, 'players_v10');
        const q = query(usersRef, where('displayName', '==', identifier), limit(1));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) throw new Error("Team not found");
        emailToUse = querySnapshot.docs[0].data().email;
      }
      await signInWithEmailAndPassword(auth, emailToUse, password);
      handleEnter();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Denied", description: error.message });
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
              <Input id="identifier" placeholder="Team Name or Email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.passLabel}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-secondary/50" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full hero-gradient font-bold" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t.submitBtn}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              {t.newManager} <Link href="/auth/register" className="text-primary hover:underline">{t.registerLink}</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
