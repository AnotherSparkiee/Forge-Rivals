'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Mail, ShieldCheck, ArrowRight, ChevronLeft, Shield, KeyRound, Info } from 'lucide-react';
import { useGameState } from '@/app/lib/store';
import { useAuth, initiateEmailSignUp } from '@/firebase';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { sendVerificationEmail, verifyEmailCode } from '@/app/actions/email';
import { cn } from '@/lib/utils';

type RegisterStep = 'credentials' | 'verification';

export default function RegisterPage() {
  const [step, setStep] = useState<RegisterStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const { language, isLoaded } = useGameState();
  const auth = useAuth();

  const t = {
    en: {
      titleInit: "Initialize Profile",
      titleVerify: "Security Link",
      subtitleInit: "Step 1: Define your tactical identity",
      subtitleVerify: "Step 2: Confirm operational email",
      callsign: "Team Name",
      passLabel: "Access Key",
      emailLabel: "Operational Email",
      codeLabel: "Verification Code",
      codeDesc: "Enter the 6-digit code from your inbox",
      nextBtn: "CONTINUE",
      sendCodeBtn: "SEND CODE",
      verifyBtn: "VERIFY & CREATE",
      back: "Change Email",
      changeCreds: "Edit Identity",
      alreadyRegistered: "Already registered?",
      loginLink: "Login",
      errorShort: "Team name too short (min 3)",
      errorPass: "Password too simple (min 6)",
      errorEmail: "Invalid email format",
      errorCode: "Invalid or expired code",
      successCode: "Verification process initialized!",
      success: "Command link established"
    },
    ru: {
      titleInit: "Инициация профиля",
      titleVerify: "Узел безопасности",
      subtitleInit: "Этап 1: Определение тактического позывного",
      subtitleVerify: "Этап 2: Подтверждение почты связи",
      callsign: "Название команды",
      passLabel: "Ключ доступа",
      emailLabel: "Ваш Email",
      codeLabel: "Код подтверждения",
      codeDesc: "Введите 6 цифр из письма",
      nextBtn: "ПРОДОЛЖИТЬ",
      sendCodeBtn: "ОТПРАВИТЬ КОД",
      verifyBtn: "ПОДТВЕРДИТЬ И СОЗДАТЬ",
      back: "Сменить почту",
      changeCreds: "Изменить данные",
      alreadyRegistered: "Уже зарегистрированы?",
      loginLink: "Войти",
      errorShort: "Название слишком короткое (мин. 3)",
      errorPass: "Пароль слишком простой (мин. 6)",
      errorEmail: "Неверный формат почты",
      errorCode: "Неверный или просроченный код",
      successCode: "Процесс верификации запущен!",
      success: "Связь со штабом установлена"
    }
  }[language as 'en' | 'ru'] || { titleInit: "Register", subtitleInit: "Join" };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length < 3) {
      toast({ variant: "destructive", title: t.errorShort });
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", title: t.errorPass });
      return;
    }
    setStep('verification');
  };

  const handleSendCode = async () => {
    if (!email.includes('@')) {
      toast({ variant: "destructive", title: t.errorEmail });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await sendVerificationEmail(email);
      if (res.success) {
        toast({ 
          title: t.successCode, 
          description: res.warning ? "Mail server busy. Retrying recommended." : "Check your inbox for code." 
        });
        setIsCodeSent(true);
      } else {
        toast({ 
          variant: "destructive", 
          title: "System Error", 
          description: res.error || "Could not initialize verification process." 
        });
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
      const verifyRes = await verifyEmailCode(email, code);
      if (!verifyRes.success) {
        toast({ variant: "destructive", title: t.errorCode });
        setIsProcessing(false);
        return;
      }

      await initiateEmailSignUp(auth, email, password);
      localStorage.setItem('pending_club_name', username);
      
      toast({ title: t.success });
      router.push('/setup');
    } catch (error: any) {
      setIsProcessing(false);
      toast({ 
        variant: "destructive", 
        title: "Registration Failed", 
        description: error.message
      });
    }
  };

  if (!isLoaded) return <LoadingScreen />;

  return (
    <Card className="glass-card w-full max-w-sm border-primary/20 shadow-[0_0_40px_rgba(var(--primary),0.1)] overflow-hidden">
      <div className="h-1.5 w-full bg-secondary/30">
        <div 
          className="h-full bg-primary transition-all duration-500 shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
          style={{ width: step === 'credentials' ? '50%' : '100%' }} 
        />
      </div>

      <CardHeader className="pt-8">
        <CardTitle className="font-headline text-center uppercase tracking-[0.2em] text-primary text-xl">
          {step === 'credentials' ? t.titleInit : t.titleVerify}
        </CardTitle>
        <p className="text-[10px] text-center text-muted-foreground uppercase font-black tracking-widest mt-2 px-4 leading-relaxed">
          {step === 'credentials' ? t.subtitleInit : t.subtitleVerify}
        </p>
      </CardHeader>
      
      <CardContent className="px-8">
        {step === 'credentials' ? (
          <form onSubmit={handleNextStep} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest flex items-center gap-2">
                <Shield className="w-3 h-3" /> {t.callsign}
              </Label>
              <Input 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
                className="bg-secondary/40 border-white/5 h-12 text-sm font-bold uppercase tracking-tight focus-visible:ring-primary" 
                placeholder="COMMANDER_X"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest flex items-center gap-2">
                <KeyRound className="w-3 h-3" /> {t.passLabel}
              </Label>
              <Input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                className="bg-secondary/40 border-white/5 h-12 text-sm focus-visible:ring-primary" 
                placeholder="••••••••"
                disabled={isProcessing}
              />
            </div>
            <Button type="submit" className="w-full h-14 hero-gradient font-black text-xs tracking-widest shadow-xl uppercase mt-4">
              {t.nextBtn} <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyAndRegister} className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-500">
            {!isCodeSent ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest flex items-center gap-2">
                    <Mail className="w-3 h-3" /> {t.emailLabel}
                  </Label>
                  <Input 
                    type="email"
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                    className="bg-secondary/40 border-white/5 h-12 text-sm font-bold" 
                    placeholder="commander@hq.net"
                    disabled={isProcessing}
                  />
                </div>
                <Button 
                  type="button"
                  onClick={handleSendCode}
                  className="w-full h-14 hero-gradient font-black text-xs tracking-widest shadow-xl uppercase" 
                  disabled={isProcessing || !email.includes('@')}
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : <>{t.sendCodeBtn} <ArrowRight className="ml-2 w-4 h-4" /></>}
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full text-[9px] uppercase font-black text-muted-foreground hover:text-white" 
                  onClick={() => setStep('credentials')}
                  disabled={isProcessing}
                >
                  <ChevronLeft className="w-3 h-3 mr-1" /> {t.changeCreds}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                  <p className="text-[8px] font-black uppercase text-primary mb-1 tracking-widest">EMAIL VERIFICATION</p>
                  <p className="text-xs text-white font-bold truncate">{email}</p>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground text-center block tracking-widest">
                    {t.codeLabel}
                  </Label>
                  <Input 
                    value={code} 
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                    required 
                    maxLength={6}
                    className="bg-secondary/40 border-primary/30 text-center text-3xl font-headline tracking-[0.6em] h-16 rounded-xl text-primary" 
                    placeholder="000000"
                    disabled={isProcessing}
                  />
                  <p className="text-[9px] text-center text-muted-foreground uppercase font-bold tracking-tighter opacity-60">
                    {t.codeDesc}
                  </p>
                </div>

                <div className="space-y-2">
                  <Button 
                    type="submit" 
                    className="w-full h-14 hero-gradient font-black text-xs tracking-widest shadow-xl uppercase" 
                    disabled={isProcessing || code.length !== 6}
                  >
                    {isProcessing ? <Loader2 className="animate-spin" /> : <><ShieldCheck className="w-4 h-4 mr-2" /> {t.verifyBtn}</>}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full text-[9px] uppercase font-black text-muted-foreground hover:text-white" 
                    onClick={() => setIsCodeSent(false)}
                    disabled={isProcessing}
                  >
                    <ChevronLeft className="w-3 h-3 mr-1" /> {t.back}
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-4 border-t border-white/5 pt-6 pb-8 px-8 bg-secondary/10">
        <p className="text-[10px] text-center text-muted-foreground font-bold uppercase tracking-widest">
          {t.alreadyRegistered} <Link href="/auth/login" className="text-primary hover:text-accent transition-colors underline-offset-4 underline">{t.loginLink}</Link>
        </p>
      </CardFooter>
    </Card>
  );
}
