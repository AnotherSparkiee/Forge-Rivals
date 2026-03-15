
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LEAGUES, League } from '@/app/lib/leagues-data';
import { Loader2, Trophy, Clock, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useMemoFirebase } from '@/firebase';

export default function SetupPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const userRef = useMemoFirebase(() => user ? doc(db, 'user_profiles', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (profile?.selectedLeagueId) {
      router.push('/');
    }
  }, [profile, router]);

  const handleSelect = async () => {
    if (!user || !selectedId) return;

    setIsUpdating(true);
    try {
      const profileRef = doc(db, 'user_profiles', user.uid);
      await updateDoc(profileRef, {
        selectedLeagueId: selectedId
      });
      
      toast({
        title: "Лига выбрана!",
        description: `Вы зачислены в ${selectedId}. Подготовка к первому матчу завершена.`,
      });
      router.push('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось сохранить выбор лиги.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-headline font-bold text-primary mb-4 tracking-tight uppercase">Выберите вашу пирамиду</h1>
        <p className="text-muted-foreground text-lg">Каждая лига сражается в свое фиксированное время. Выберите ту, которая подходит вашему графику.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {LEAGUES.map((league) => (
          <Card 
            key={league.id} 
            className={cn(
              "glass-card cursor-pointer transition-all hover:scale-105",
              selectedId === league.id ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:border-white/20"
            )}
            onClick={() => setSelectedId(league.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="font-headline text-xl">{league.id}</CardTitle>
                <Clock className={cn("w-4 h-4", selectedId === league.id ? "text-primary" : "text-muted-foreground")} />
              </div>
              <CardDescription className="text-accent font-bold">{league.startTime}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">{league.description}</p>
              {selectedId === league.id && (
                <div className="mt-4 flex justify-center">
                  <CheckCircle2 className="text-primary w-6 h-6 animate-in zoom-in" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center sticky bottom-8">
        <Button 
          size="lg" 
          disabled={!selectedId || isUpdating} 
          onClick={handleSelect}
          className="w-full max-w-sm hero-gradient text-lg font-headline font-bold h-14"
        >
          {isUpdating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'ПОДТВЕРДИТЬ ВЫБОР'}
        </Button>
      </div>
    </div>
  );
}
