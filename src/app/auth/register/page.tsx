
'use client';

import { useState, useEffect } from 'react';
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
import { Loader2, Chrome, Mail, ShieldCheck, Info } from 'lucide-react';
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

  // Load saved state if available (prevents loss on refresh)
  useEffect(() => {
    const savedStep = sessionStorage.getItem('reg_step');
    const savedCode = sessionStorage.getItem('reg_code');
    const savedEmail = sessionStorage.getItem('reg_email');
    const savedUsername = sessionStorage.getItem('reg_username');

    if (savedStep === 'verify' && savedCode && savedEmail) {
      setStep('verify');
      setGeneratedCode(savedCode);
      setEmail(savedEmail);
      if (savedUsername) setUsername(savedUsername);
    }
  }, []);

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
      successDesc: "Welcome to the league, Commander.",
      errorTitle: "Registration Failed",
      invalidCode: "Invalid verification code. Access denied.",
      usernameTaken: "This team name is already assigned.",
      codeSent: "Code Dispatched",
      codeSentDesc: "Check your email (simulated in server logs)."
    },
    ru: {
      title: "Инициация профиля",
      verifyTitle: "Проверка безопасности",
      verifyDesc: "6-значный код доступа был отправлен на вашу почту.",
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
      successDesc: "Добро пожаловать в лигу, Командир.",
      errorTitle: "Ошибка регистрации",
      invalidCode: "Неверный код подтверждения.",
      usernameTaken: "Это название команды уже занято.",
      codeSent: "Код отправлен",
      codeSentDesc: "Проверьте почту (симуляция в логах сервера)."
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

      // 2. Generate code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(code);
      
      // Save progress to session storage
      sessionStorage.setItem('reg_step', 'verify');
      sessionStorage.setItem('reg_code', code);
      sessionStorage.setItem('reg_email', email);
      sessionStorage.setItem('reg_username', username);
      
      // 3. CALL SERVER ACTION
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

      await setDoc(doc(db, 'players_v5', user.uid), profileData);

      // Clear session storage
      sessionStorage.removeItem('reg_step');
      sessionStorage.removeItem('reg_code');
      sessionStorage.removeItem('reg_email');
      sessionStorage.removeItem('reg_username');

      toast({ title: t.successTitle, description: t.successDesc });
      router.push('/setup');
    } catch (error: any) {
      toast({ variant: "destructive", title: t.errorTitle, description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('info');
    sessionStorage.removeItem('reg_step');
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
            <p className="text-[10px] text-center text-muted-foreground uppercase font-bold px-4 leading-relaxed">
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
              <Button type="button" variant="outline" className="w-full font-bold border-white/10 hover:bg-white/5 h-11" onClick={() => {}} disabled={isLoading || isGoogleLoading}>
                <Chrome className="mr-2 h-4 w-4 text-red-400" />
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
              
              <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 flex items-start gap-3">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[9px] text-muted-foreground uppercase font-bold leading-tight">
                  {language === 'ru' 
                    ? "ВНИМАНИЕ: В режиме прототипа код отправляется в системный журнал сервера (терминал)." 
                    : "NOTICE: In prototype mode, the code is sent to the server's system log (terminal)."}
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full hero-gradient font-bold h-14 text-lg" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><ShieldCheck className="w-5 h-5 mr-2" /> {t.verifyBtn}</>}
              </Button>
              <Button type="button" variant="ghost" className="text-xs text-muted-foreground uppercase font-bold" onClick={handleBack} disabled={isLoading}>
                {language === 'ru' ? 'ВЕРНУТЬСЯ НАЗАД' : 'BACK TO INFO'}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
