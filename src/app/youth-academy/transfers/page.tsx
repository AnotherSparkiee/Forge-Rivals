'use client';

import { useRouter } from 'next/navigation';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, ShoppingCart, Users, 
  Loader2, Radar
} from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import Link from 'next/link';

export default function YouthTransfersPage() {
  const { language, isLoaded: isStoreLoaded } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();

  // Базовый запрос: ищем только юниоров
  const marketQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(collection(db, 'market_v2'), where('isYouth', '==', true));
  }, [db, user?.uid]);

  const { data: agents, isLoading: isMarketLoading } = useCollection(marketQuery);

  if (isUserLoading || !isStoreLoaded) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? 'ТРАНСФЕРЫ ЮНИОРОВ' : 'YOUTH TRANSFERS',
    subtitle: language === 'ru' ? 'Рынок молодых талантов' : 'Youth talent market',
    scanning: language === 'ru' ? 'СКАНИРОВАНИЕ РЫНКА...' : 'SCANNING MARKET...',
    empty: language === 'ru' ? 'На рынке юниоров пока пусто' : 'Youth market is currently empty',
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push('/youth-academy')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold opacity-60">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-4">
        {isMarketLoading ? (
          <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] uppercase font-bold tracking-[0.2em]">{t.scanning}</p>
          </div>
        ) : agents && agents.length > 0 ? (
          <div className="space-y-3">
            {agents.map((agent) => (
              <Card key={agent.id} className="glass-card border-white/5 overflow-hidden">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shrink-0">
                      <img src={agent.heroData?.image} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase text-white truncate max-w-[150px]">{agent.heroData?.name}</h3>
                      <p className="text-[8px] text-muted-foreground font-black uppercase tracking-widest mt-0.5">{agent.heroData?.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-headline font-bold text-accent italic leading-none">{agent.heroData?.overallRating}</p>
                    <p className="text-[10px] font-bold text-primary mt-1">€{agent.currentBid?.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center opacity-30 border border-dashed border-white/10 rounded-2xl flex flex-col items-center gap-4 p-10">
            <Radar className="w-12 h-12 text-muted-foreground animate-pulse" />
            <p className="text-[10px] uppercase font-black tracking-widest text-center leading-relaxed">
              {t.empty}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
