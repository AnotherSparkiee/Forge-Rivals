'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Mail, ShieldCheck, ArrowRight, ChevronLeft } from 'lucide-react';
import { useGameState } from '@/app/lib/store';
import { useAuth, initiateEmailSignUp } from '@/firebase';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { sendVerificationEmail, verifyEmailCode } from '@/app/actions/email';

export default function RegisterPage() {
  const [step, setStep] = useState<'initial' | 'verify'>('initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const { language, isLoaded } = useGameState();
  const auth = useAuth();

  const t = {
    en: {
      title: "Initialize Profile", 
      subtitle: "Secure registration with email verification", 
      callsign: "Team Name", 
      email: "Real Email",
      passLabel: "Access Key (min 6 symbols)",
      codeLabel: "Verification Code",
      codeDesc: "Enter the 6-digit code sent to your email",
      submitBtn: "SEND CODE", 
      verifyBtn: "VERIFY & CREATE",
      back: "Change Email",
      alreadyRegistered: "Already registered?", 
      loginLink: "Login",
      errorShort: "Team name too short",
      errorPass: "Password too simple",
      errorEmail: "Invalid email format",
      errorExists: "This email is already in use",
      errorCode: "Invalid or expired code",
      successCode: "Verification code sent!",
      success: "Command link established"
    },
    ru: {
      title: "Инициация профиля", 
      subtitle: "Защищенная регистрация с подтверждением почты", 
      callsign: "Название команды", 
      email: "Ваш Email",
      passLabel: "Ключ доступа (от 6 символов)",
      codeLabel: "Код подтверждения",
      codeDesc: "Введите 6-значный код, отправленный на вашу почту",
      submitBtn: "ОТПРАВИТЬ КОД", 
      verifyBtn: "ПОДТВЕРДИТЬ И СОЗДАТЬ",
      back: "Сменить почту",
      alreadyRegistered: "Уже зарегистрированы?", 
      loginLink: "Войти",
      errorShort: "Название команды слишком короткое",
      errorPass: "Пароль слишком простой",
      errorEmail: "Неверный формат почты",
      errorExists: "Этот Email уже используется",
      errorCode: "Неверный или просроченный код",
      successCode: "Код подтверждения отправлен!",
      success: "Связь со штабом установлена"
    }
  }[language as 'en' | 'ru'] || { title: "Register", subtitle: "Join" };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;

    if (username.trim().length < 3) {
      toast({ variant: "destructive", title: t.errorShort });
      return;
    }
    if (!email.includes('@')) {
      toast({ variant: "destructive", title: t.errorEmail });
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", title: t.errorPass });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await sendVerificationEmail(email);
      if (res.success) {
        toast({ title: t.successCode });
        setStep('verify');
      } else {
        toast({ variant: "destructive", title: "Email Error", description: res.error });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || isProcessing) return;

    if (code.length !== 6) return;

    setIsProcessing(true);
    try {
      // 1. Проверяем код
      const verifyRes = await verifyEmailCode(email, code);
      if (!verifyRes.success) {
        toast({ variant: "destructive", title: t.errorCode });
        setIsProcessing(false);
        return;
      }

      // 2. Создаем аккаунт в Firebase Auth
      await initiateEmailSignUp(auth, email, password);
      
      // Локальное сохранение имени перед переходом в setup
      localStorage.setItem('pending_club_name', username);
      
      toast({ title: t.success });
      router.push('/setup');
    } catch (error: any) {
      setIsProcessing(false);
      const isEmailInUse = error.code === 'auth/email-already-in-use' || error.message?.includes('already-in-use');
      toast({ 
        variant: "destructive", 
        title: "Registration Failed", 
        description: isEmailInUse ? t.errorExists : error.message
      });
    }
  };

  if (!isLoaded) return <LoadingScreen />;

  return (
    <Card className="glass-card w-full max-w-sm">
      <CardHeader>
        <CardTitle className="font-headline text-center uppercase tracking-widest text-accent text-lg">{t.title}</CardTitle>
        <p className="text-[10px] text-center text-muted-foreground uppercase font-bold px-4 leading-relaxed">{t.subtitle}</p>
      </CardHeader>
      
      <CardContent>
        {step === 'initial' ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-2">
              <Label>{t.callsign}</Label>
              <Input 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
                className="bg-secondary/50" 
                placeholder="MyTeamName"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.email}</Label>
              <Input 
                type="email"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                className="bg-secondary/50" 
                placeholder="commander@gmail.com"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.passLabel}</Label>
              <Input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                className="bg-secondary/50" 
                disabled={isProcessing}
              />
            </div>
            <Button type="submit" className="w-full h-12 hero-gradient font-bold mt-2" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin" /> : <><Mail className="w-4 h-4 mr-2" /> {t.submitBtn}</>}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyAndRegister} className="space-y-4">
            <div className="text-center p-4 bg-primary/5 border border-primary/20 rounded-xl mb-4">
              <p className="text-[10px] font-black uppercase text-primary mb-1">EMAIL VERIFICATION</p>
              <p className="text-xs text-white font-bold">{email}</p>
            </div>
            <div className="space-y-2">
              <Label>{t.codeLabel}</Label>
              <Input 
                value={code} 
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                required 
                maxLength={6}
                className="bg-secondary/50 text-center text-2xl font-headline tracking-[0.5em] h-14" 
                placeholder="000000"
                disabled={isProcessing}
              />
              <p className="text-[9px] text-center text-muted-foreground uppercase font-medium">{t.codeDesc}</p>
            </div>
            <Button type="submit" className="w-full h-12 hero-gradient font-bold" disabled={isProcessing || code.length !== 6}>
              {isProcessing ? <Loader2 className="animate-spin" /> : <><ShieldCheck className="w-4 h-4 mr-2" /> {t.verifyBtn}</>}
            </Button>
            <Button variant="ghost" className="w-full text-[9px] uppercase font-black text-muted-foreground" onClick={() => setStep('initial')} disabled={isProcessing}>
              <ChevronLeft className="w-3 h-3 mr-1" /> {t.back}
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-4 border-t border-white/5 pt-6">
        <p className="text-xs text-center text-muted-foreground">
          {t.alreadyRegistered} <Link href="/auth/login" className="text-primary hover:underline font-bold">{t.loginLink}</Link>
        </p>
      </CardFooter>
    </Card>
  );
}
