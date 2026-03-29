
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
import { Loader2, Chrome, Mail, ShieldCheck } from 'lucide-react';
import { useGameState } from '@/app/lib/store';
import { cn } from '@/lib/utils';
import { sendVerificationEmail } from '@/app/actions/email';

type RegisterStep = 'info' | 'verify';

export default function RegisterPage() {
  const [step, setStep] = useState<RegisterStep>('info');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
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
      verifyTitle: "Security Clearance",
      verifyDesc: "A 6-digit access code has been dispatched to your email frequency.",
      codeLabel: "Verification Code",
      callsign: "Team Name",
      emailLabel: "Email Address",
      passLabel: "Access Key (Password)",
      submitBtn: "REQUEST CODE",
      verifyBtn: "CONFIRM & INITIALIZE",
      googleBtn: "SIGN UP WITH GOOGLE",
      orLabel: "OR",
      alreadyRegistered: "Already registered?",
      loginLink: "Synchronize Link",
      successTitle: "Profile Initialized",
      successDesc: "Welcome to the league, Commander. Prepare for deployment.",
      errorTitle: "Registration Failed",
      invalidCode: "Invalid verification code. Access denied.",
      usernameTaken: "This team name is already assigned to another commander.",
      codeSent: "Code Dispatched",
      codeSentDesc: "Check your email inbox for the transmission."
    },
    ru: {
      title: "Инициация профиля",
      verifyTitle: "Проверка безопасности",
      verifyDesc: "6-значный код доступа был отправлен на вашу электронную почту.",
      codeLabel: "Код подтверждения",
      callsign: "Название команды",
      emailLabel: "Почта (Email)",
      passLabel: "Ключ доступа (Пароль)",
      submitBtn: "ПОЛУЧИТЬ КОД",
      verifyBtn: "ПОДТВЕРДИТЬ И СОЗДАТЬ",
      googleBtn: "РЕГИСТРАЦИЯ ЧЕРЕЗ GOOGLE",
      orLabel: "ИЛИ",
      alreadyRegistered: "Уже зарегистрированы?",
      loginLink: "Установить связь",
      successTitle: "Профиль инициализирован",
      successDesc: "Добро пожаловать в лигу, Командир. Приготовьтесь к развертыванию.",
      errorTitle: "Ошибка регистрации",
      invalidCode: "Неверный код подтверждения. Доступ отклонен.",
      usernameTaken: "Это название команды уже занято другим командиром.",
      codeSent: "Код отправлен",
      codeSentDesc: "Проверьте входящие сообщения на вашей почте."
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Check if username is taken in players_v5
      const usersRef = collection(db, 'players_v5');
      const q = query(usersRef, where('displayName', '==', username), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        throw new Error(t.usernameTaken);
      }

      // 2. Generate code and "send" it via server action
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(code);
      
      // CALL SERVER ACTION (This will log to the SERVER console, not client)
      await sendVerificationEmail(email, code);
      
      toast({
        title: t.codeSent,
        description: t.codeSentDesc,
      });

      setStep('verify');
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

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode !== generatedCode) {
      toast({ variant: "destructive", title: t.errorTitle, description: t.invalidCode });
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const profileData = {
        id: user.uid,
        displayName: username,
        email: email,
        inGameCurrency: 10000000,
        crystals: 0,
        experiencePoints: 0,
        lastLoginDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ownedHeroIds: ['h1', 'h2', 'h3', 'h4', 'h5', 'h_sub1', 'h_sub2'],
        leagueLevel: 9,
        divisionSubId: 1,
        groupId: 1,
      };

      // Store in players_v5
      await setDoc(doc(db, 'players_v5', user.uid), profileData);

      toast({ title: t.successTitle, description: t.successDesc });
      router.push('/setup');
    } catch (error: any) {
      toast({ variant: "destructive", title: t.errorTitle, description: error.message });
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

      const userProfileRef = doc(db, 'players_v5', user.uid);
      const userSnap = await getDoc(userProfileRef);

      if (!userSnap.exists()) {
        const profileData = {
          id: user.uid,
          displayName: user.displayName || `Manager_${user.uid.slice(0, 5)}`,
          email: user.email,
          inGameCurrency: 10000000,
          crystals: 0,
          experiencePoints: 0,
          lastLoginDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          ownedHeroIds: ['h1', 'h2', 'h3', 'h4', 'h5', 'h_sub1', 'h_sub2'],
          leagueLevel: 9,
          divisionSubId: 1,
          groupId: 1,
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
    } catch (error: any) {
      toast({ variant: "destructive", title: t.errorTitle, description: error.message });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="space-y-4">
      {step === 'info' && (
        <div className="flex justify-center gap-2 mb-4 bg-secondary/20 p-1 rounded-lg border border-white/5">
          <Button variant="ghost" size="sm" className="flex-1 text-xs font-bold h-8 uppercase tracking-widest text-muted-foreground" onClick={() => router.push('/auth/login')}>
            {language === 'ru' ? 'ВХОД' : 'LOGIN'}
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 text-xs font-bold h-8 uppercase tracking-widest bg-white/10 text-primary">
            {language === 'ru' ? 'РЕГИСТРАЦИЯ' : 'REGISTER'}
          </Button>
        </div>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-headline text-center uppercase tracking-widest text-accent text-lg">
            {step === 'info' ? t.title : t.verifyTitle}
          </CardTitle>
          {step === 'verify' && (
            <p className="text-[10px] text-center text-muted-foreground uppercase font-bold px-4">
              {t.verifyDesc}
            </p>
          )}
        </CardHeader>

        {step === 'info' ? (
          <form onSubmit={handleInitialSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t.callsign}</Label>
                <Input id="username" placeholder="Team X" value={username} onChange={(e) => setUsername(e.target.value)} required className="bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t.emailLabel}</Label>
                <Input id="email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-secondary/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t.passLabel}</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-secondary/50" />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full hero-gradient font-bold h-12" disabled={isLoading || isGoogleLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><Mail className="w-4 h-4 mr-2" /> {t.submitBtn}</>}
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
                {t.alreadyRegistered} <Link href="/auth/login" className="text-primary hover:underline">{t.loginLink}</Link>
              </p>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleVerifyAndRegister}>
            <CardContent className="space-y-6 py-6">
              <div className="space-y-3">
                <Label htmlFor="code" className="text-center block uppercase tracking-widest text-primary font-black">{t.codeLabel}</Label>
                <Input 
                  id="code" 
                  placeholder="000000" 
                  value={verificationCode} 
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                  className="bg-secondary/50 h-16 text-3xl text-center font-headline tracking-[0.5em] font-bold border-primary/20 focus:border-primary"
                  required 
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full hero-gradient font-bold h-14 text-lg" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><ShieldCheck className="w-5 h-5 mr-2" /> {t.verifyBtn}</>}
              </Button>
              <Button type="button" variant="ghost" className="text-xs text-muted-foreground uppercase font-bold" onClick={() => setStep('info')} disabled={isLoading}>
                {language === 'ru' ? 'ВЕРНУТЬСЯ НАЗАД' : 'BACK TO INFO'}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
