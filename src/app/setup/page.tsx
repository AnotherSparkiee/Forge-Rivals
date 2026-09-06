'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Rocket, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGameState } from '@/app/lib/store';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { useUser, useFirebase } from '@/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * СТРАНИЦА ИНИЦИАЛИЗАЦИИ v164.
 * Вызывает Cloud Function initializeClub в регионе us-central1.
 */
export default function SetupPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const { firebaseApp } = useFirebase();
  const { toast } = useToast();
  const { language, isLoaded, isTeamLoaded, isInitialSyncDone } = useGameState();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [step, setStep] = useState<'IDLE' | 'PROVISIONING' | 'SUCCESS'>('IDLE');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isInitialSyncDone && isTeamLoaded) {
      router.replace('/');
    }
  }, [isInitialSyncDone, isTeamLoaded, router]);

  const handleCompleteSetup = async () => {
    if (isUpdating || !user || !firebaseApp) return;
    
    setIsUpdating(true);
    setStep('PROVISIONING');
    setError(null);
    
    try {
      // Явно указываем регион us-central1
      const functions = getFunctions(firebaseApp, 'us-central1');
      const initializeClubFn = httpsCallable(functions, 'initializeClub');
      
      const clubName = localStorage.getItem('pending_club_name') || "";
      
      const response = await initializeClubFn({ clubName });
      const result = response.data as any;

      // Проверка версии функции
      if (result.version !== 'v164') {
        throw new Error("REGISTRATION_FUNCTION_OUTDATED");
      }

      if (!result.success) {
        throw new Error(result.error || "REGISTRATION_FAILED");
      }

      setStep('SUCCESS');
      toast({ title: language === 'ru' ? "Штаб развернут!" : "HQ Fully Operational!" });
      
      setTimeout(() => {
        router.replace('/');
      }, 1500);

    } catch (e: any) {
      console.error("[SETUP ERROR DETAILS]", {
        code: e.code,
        message: e.message,
        details: e.details,
        name: e.name
      });
      
      let errorMsg = "CLUB_INITIALIZATION_FAILED";
      
      // Анализ кода ошибки или сообщения
      const msg = e.message || "";
      
      if (msg.includes('SEASON_CONFIG_MISSING')) errorMsg = "SEASON_CONFIG_MISSING";
      else if (msg.includes('SEASON_TRANSITION_IN_PROGRESS')) errorMsg = "SEASON_TRANSITION_IN_PROGRESS";
      else if (msg.includes('LEAGUE_TABLE_MISSING')) errorMsg = "LEAGUE_TABLE_MISSING";
      else if (msg.includes('LEAGUE_TABLE_MISMATCH')) errorMsg = "LEAGUE_TABLE_MISMATCH";
      else if (msg.includes('BOT_NOT_FOUND_IN_SLOT')) errorMsg = "BOT_NOT_FOUND_IN_SLOT";
      else if (msg.includes('NO_FREE_SLOTS_IN_STARTING_DIVISION')) errorMsg = "NO_FREE_SLOTS_IN_STARTING_DIVISION";
      else if (msg.includes('REGISTRATION_FUNCTION_OUTDATED')) errorMsg = "REGISTRATION_FUNCTION_OUTDATED";
      else if (e.code === 'functions/unauthenticated') errorMsg = "AUTHENTICATION_REQUIRED";
      
      setError(errorMsg);
      setIsUpdating(false);
      setStep('IDLE');
      
      toast({ 
        variant: "destructive", 
        title: language === 'ru' ? "Ошибка регистрации" : "Registration Error",
        description: errorMsg
      });
    }
  };

  if (!isLoaded || isUserLoading) return <LoadingScreen />;

  const t = {
    ru: {
      title: 'РАЗВЕРТЫВАНИЕ БАЗЫ',
      subtitle: 'Подготовка систем и личного состава',
      finalize: 'ПОЛУЧИТЬ ДОПУСК',
      desc: 'Ваш профиль создается на сервере. Вы получите стартовый состав и место в Дивизионе 4.',
      loading: 'Идет синхронизация с лигой...',
      success: 'ДОСТУП РАЗРЕШЕН'
    },
    en: {
      title: 'BASE DEPLOYMENT',
      subtitle: 'Provisioning systems and personnel',
      finalize: 'AUTHORIZE ACCESS',
      desc: 'Your profile is being created on the server. You will receive a starting squad and a slot in Division 4.',
      loading: 'Syncing with league server...',
      success: 'ACCESS AUTHORIZED'
    }
  }[language === 'ru' ? 'ru' : 'en'];

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]" />
      <div className="relative z-10 w-full max-w-md mx-auto px-4 flex flex-col min-h-screen justify-center">
        
        <div className="text-center space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="relative mx-auto w-32 h-32">
             <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
             <div className="relative w-full h-full bg-secondary/30 rounded-3xl border-2 border-primary/50 flex items-center justify-center overflow-hidden">
                {step === 'SUCCESS' ? (
                  <CheckCircle2 className="w-16 h-16 text-green-400 animate-in zoom-in" />
                ) : step === 'PROVISIONING' ? (
                  <Loader2 className="w-16 h-16 text-primary animate-spin" />
                ) : (
                  <Rocket className="w-16 h-16 text-primary" />
                )}
             </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">
              {step === 'SUCCESS' ? t.success : t.title}
            </h1>
            <p className="text-muted-foreground text-xs uppercase tracking-widest font-black opacity-80">{t.subtitle}</p>
          </div>

          <Card className="glass-card border-white/5 bg-secondary/10 mx-4">
            <CardContent className="p-6">
               {step === 'PROVISIONING' ? (
                 <div className="space-y-4">
                   <p className="text-[10px] text-primary font-black uppercase animate-pulse">{t.loading}</p>
                   <Progress value={66} className="h-1" />
                 </div>
               ) : (
                 <p className="text-[10px] text-muted-foreground leading-relaxed italic uppercase font-bold">"{t.desc}"</p>
               )}
               {error && (
                 <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-black uppercase">{error}</span>
                 </div>
               )}
            </CardContent>
          </Card>

          {step === 'IDLE' && (
            <Button 
              disabled={isUpdating} 
              onClick={handleCompleteSetup}
              className="w-full max-w-[280px] h-16 hero-gradient font-black text-sm tracking-[0.2em] uppercase shadow-2xl mx-auto"
            >
              {t.finalize}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
