
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowRight, Rocket, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGameState } from '@/app/lib/store';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { useUser, useFirebase } from '@/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * СТРАНИЦА ИНИЦИАЛИЗАЦИИ v140.
 * Использует единственную Cloud Function для создания клуба.
 */
export default function SetupPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const { firebaseApp } = useFirebase();
  const { toast } = useToast();
  const { language, isLoaded } = useGameState();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/auth/login');
  }, [user, isUserLoading, router]);

  const handleCompleteSetup = async () => {
    if (isUpdating || !user || !firebaseApp) return;
    setIsUpdating(true);
    setError(null);
    
    try {
      const functions = getFunctions(firebaseApp);
      const initializeClubFn = httpsCallable(functions, 'initializeClub');
      
      const clubName = localStorage.getItem('pending_club_name') || `Manager_${Math.floor(Math.random()*9000)}`;
      
      const response = await initializeClubFn({ clubName });
      const result = response.data as any;

      if (!result.success) {
        throw new Error(result.error || "REGISTRATION_FAILED");
      }

      toast({ title: language === 'ru' ? "Клуб развернут!" : "Club Deployed!" });
      
      // Даем время на синхронизацию snapshot
      setTimeout(() => {
        router.replace('/');
      }, 1000);

    } catch (e: any) {
      console.error("[SETUP ERROR]:", e);
      const msg = e.message === 'NO_FREE_SLOTS' 
        ? (language === 'ru' ? "Нет свободных мест в лиге" : "League is full")
        : (language === 'ru' ? "Ошибка связи с центром" : "HQ Connection Error");
      
      setError(msg);
      toast({ variant: "destructive", title: "Deployment Failed", description: msg });
      setIsUpdating(false);
    }
  };

  if (!isLoaded || isUserLoading) return <LoadingScreen />;

  const t = {
    ru: {
      title: 'РАЗВЕРТЫВАНИЕ БАЗЫ',
      subtitle: 'Система подготавливает ваш штаб и ростер',
      finalize: 'ПОЛУЧИТЬ ДОПУСК',
      desc: 'Ваш профиль будет создан на сервере. Вы получите стартовый состав из 10 героев и место в 4-м дивизионе.'
    },
    en: {
      title: 'BASE DEPLOYMENT',
      subtitle: 'System is provisioning your HQ and roster',
      finalize: 'AUTHORIZE ACCESS',
      desc: 'Your profile will be created on the server. You will receive a starting squad of 10 heroes and a slot in Division 4.'
    }
  }[language === 'ru' ? 'ru' : 'en'];

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]" />
      <div className="relative z-10 w-full max-w-md mx-auto px-4 flex flex-col min-h-screen justify-center">
        
        <div className="text-center space-y-8 animate-in fade-in zoom-in duration-700">
          <div className="relative mx-auto w-32 h-32">
             <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
             <div className="relative w-full h-full bg-secondary/30 rounded-3xl border-2 border-primary/50 flex items-center justify-center">
                <Rocket className="w-16 h-16 text-primary" />
             </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">{t.title}</h1>
            <p className="text-muted-foreground text-xs uppercase tracking-widest font-black opacity-80">{t.subtitle}</p>
          </div>

          <Card className="glass-card border-white/5 bg-secondary/10 mx-4">
            <CardContent className="p-6">
               <p className="text-[10px] text-muted-foreground leading-relaxed italic uppercase font-bold">"{t.desc}"</p>
               {error && (
                 <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-400">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-black uppercase">{error}</span>
                 </div>
               )}
            </CardContent>
          </Card>

          <Button 
            disabled={isUpdating} 
            onClick={handleCompleteSetup}
            className="w-full max-w-[280px] h-16 hero-gradient font-black text-sm tracking-[0.2em] uppercase shadow-2xl mx-auto"
          >
            {isUpdating ? <Loader2 className="animate-spin" /> : t.finalize}
          </Button>
        </div>
      </div>
    </div>
  );
}
