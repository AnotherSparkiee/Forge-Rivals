'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Loader2, ChevronLeft, Shield, 
  ArrowRight, Sparkles, Rocket
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGameState, LineupSlot } from '@/app/lib/store';
import { getRandomStartingSquad } from '@/app/lib/moba-data';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { initializeClubComplete } from '@/app/actions/season-init';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';

export default function SetupPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const { language, isLoaded, saveToLocal } = useGameState();
  
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/auth/login');
  }, [user, isUserLoading, router]);

  const handleCompleteSetup = async () => {
    if (isUpdating || !user) return;
    setIsUpdating(true);
    
    try {
      const targetLeagueId = "ALPHA";
      
      // 1. Атомарная серверная инициализация (v14) через Admin SDK
      const result = await initializeClubComplete(user.uid, user.email || '');

      if (!result.success) {
        // Не удаляем аккаунт пользователя при ошибке инициализации клуба, 
        // чтобы он мог попробовать еще раз или обратиться в поддержку.
        throw new Error(result.error || "INITIALIZATION_FAILED");
      }

      const startingSquad = getRandomStartingSquad();
      const initialLineup: Record<LineupSlot, string | null> = {
        carry: startingSquad.filter(p => p.role === 'Carry')[0]?.id || null,
        mid: startingSquad.filter(p => p.role === 'Midlaner')[0]?.id || null,
        offlane: startingSquad.filter(p => p.role === 'Tank')[0]?.id || null,
        support: startingSquad.filter(p => p.role === 'Jungler')[0]?.id || null,
        full_support: startingSquad.filter(p => p.role === 'Support')[0]?.id || null,
        sub_carry: startingSquad.filter(p => p.role === 'Carry')[1]?.id || null,
        sub_mid: startingSquad.filter(p => p.role === 'Midlaner')[1]?.id || null,
        sub_offlane: startingSquad.filter(p => p.role === 'Tank')[1]?.id || null,
        sub_support: startingSquad.filter(p => p.role === 'Jungler')[1]?.id || null,
        sub_full_support: startingSquad.filter(p => p.role === 'Support')[1]?.id || null,
        res1: null, res2: null, res3: null, res4: null, res5: null, res6: null, res7: null, res8: null
      };

      // 2. Сохранение в локальный стор для мгновенного доступа
      saveToLocal({
        id: user.uid,
        numericId: Number(result.numericId),
        selectedLeagueId: targetLeagueId,
        leagueLevel: Number(result.tier),
        groupId: Number(result.group),
        rank: Number(result.rank),
        country: result.country || 'International',
        clubName: result.clubName,
        displayName: result.clubName,
        clubLogo: result.clubLogo || null,
        ownedPlayers: startingSquad,
        lineup: initialLineup,
        isDataReady: true,
        isTeamLoaded: true,
        version: 140
      });

      toast({ title: language === 'ru' ? "Клуб инициализирован!" : "Club Initialized!" });
      router.replace('/');
    } catch (e: any) {
      console.error("[SETUP ERROR]:", e);
      toast({ 
        variant: "destructive", 
        title: language === 'ru' ? "Ошибка развертывания" : "Deployment Error",
        description: e.message 
      });
      setIsUpdating(false);
    }
  };

  const t = {
    ru: {
      title: 'ПОДГОТОВКА БАЗЫ',
      subtitle: 'Система настраивает ваш штаб и резервирует место в лиге',
      finalize: 'СОЗДАТЬ КЛУБ',
      desc: 'Ваш тактический позывной, флаг и логотип будут сгенерированы автоматически. Вы сможете изменить их в любое время в настройках профиля.'
    },
    en: {
      title: 'BASE PREPARATION',
      subtitle: 'System is configuring your HQ and finding a league slot',
      finalize: 'INITIALIZE CLUB',
      desc: 'Your tactical callsign, flag, and logo will be generated automatically. You can update them at any time in your profile settings.'
    }
  }[language === 'ru' ? 'ru' : 'en'];

  if (!isLoaded || isUserLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]" />
      <div className="relative z-10 w-full max-w-md mx-auto px-4 flex flex-col min-h-screen justify-center pb-20">
        
        <div className="text-center space-y-6 animate-in fade-in zoom-in duration-700">
          <div className="relative mx-auto w-32 h-32">
             <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
             <div className="relative w-full h-full bg-secondary/30 rounded-3xl border-2 border-primary/50 flex items-center justify-center shadow-[0_0_50px_rgba(var(--primary),0.2)]">
                <Rocket className="w-16 h-16 text-primary" />
             </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-headline font-bold text-white uppercase tracking-tighter">
              {t.title}
            </h1>
            <p className="text-muted-foreground text-xs uppercase tracking-widest font-black opacity-80 px-8">
              {t.subtitle}
            </p>
          </div>

          <Card className="glass-card border-white/5 bg-secondary/10 mx-4">
            <CardContent className="p-6">
               <p className="text-[10px] text-muted-foreground leading-relaxed italic uppercase font-bold">
                 "{t.desc}"
               </p>
            </CardContent>
          </Card>

          <Button 
            disabled={isUpdating} 
            onClick={handleCompleteSetup}
            className="w-full max-w-[280px] h-16 hero-gradient font-black text-sm tracking-[0.2em] uppercase shadow-2xl active:scale-95 transition-all mx-auto"
          >
            {isUpdating ? <Loader2 className="animate-spin" /> : <>{t.finalize} <ArrowRight className="ml-2 w-5 h-5" /></>}
          </Button>
        </div>

      </div>
    </div>
  );
}
