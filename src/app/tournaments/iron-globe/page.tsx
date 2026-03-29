
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Trophy, Clock, Users, Coins, ChevronLeft, 
  ShieldCheck, Loader2, Star, Swords, Medal,
  ArrowRight, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { getMoscowTime } from '@/app/lib/time-utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TOURNAMENT_FEE = 90000;
const START_TIME = "21:05";

export default function IronGlobePage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { credits, addCredits, language, isLoaded } = useGameState();
  const { toast } = useToast();
  
  const [isJoining, setIsJoining] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [isLive, setIsLive] = useState(false);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const isJoined = profile?.tournaments?.includes('iron-globe') || false;

  useEffect(() => {
    const updateTime = () => {
      const mskNow = getMoscowTime();
      const [h, m] = START_TIME.split(':').map(Number);
      const target = new Date(mskNow);
      target.setHours(h, m, 0, 0);

      if (mskNow.getTime() >= target.getTime()) {
        setIsLive(true);
        setCountdown('00:00:00');
      } else {
        setIsLive(false);
        const diff = target.getTime() - mskNow.getTime();
        const hh = Math.floor(diff / 3600000);
        const mm = Math.floor((diff % 3600000) / 60000);
        const ss = Math.floor((diff % 60000) / 1000);
        setCountdown(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`);
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleJoin = async () => {
    if (!user || !profile || isJoining) return;
    if (credits < TOURNAMENT_FEE) {
      toast({ 
        title: language === 'ru' ? "Недостаточно средств" : "Insufficient credits", 
        variant: "destructive" 
      });
      return;
    }

    setIsJoining(true);
    try {
      const newTournaments = [...(profile.tournaments || []), 'iron-globe'];
      await updateDoc(userRef!, {
        inGameCurrency: credits - TOURNAMENT_FEE,
        tournaments: newTournaments
      });
      addCredits(-TOURNAMENT_FEE);
      toast({ 
        title: language === 'ru' ? "Вы зарегистрированы!" : "Successfully registered!",
        description: language === 'ru' ? "Турнир начнется в 21:05" : "Tournament starts at 21:05"
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsJoining(false);
    }
  };

  // Mock Tournament Logic
  const tournamentData = useMemo(() => {
    if (!isLive) return null;
    
    // Stable random seed based on today's date
    const date = new Date().toISOString().split('T')[0];
    const botNames = ["AlphaBot", "ZetaUnit", "CyberLink", "VoidRunner", "SteelGear", "NexusPrime", "EchoTeam", "Quantum", "ShadowOps", "Blitz", "Titan", "Vanguard", "Rogue", "Omega", "Spectre"];
    const teams = [{ id: user?.uid, name: profile?.displayName || "Player", isPlayer: true }, ...botNames.map((n, i) => ({ id: `bot-${i}`, name: n, isPlayer: false }))];
    
    // Shuffle teams
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    
    // 4 Groups of 4
    const groups = [
      shuffled.slice(0, 4),
      shuffled.slice(4, 8),
      shuffled.slice(8, 12),
      shuffled.slice(12, 16)
    ];

    const groupResults = groups.map(group => {
      return group.map(t => {
        const pts = Math.floor(Math.random() * 10);
        return { ...t, pts, w: Math.floor(pts/3), d: pts % 3, l: Math.max(0, 3 - Math.floor(pts/3)) };
      }).sort((a, b) => b.pts - a.pts);
    });

    const qualifiers = groupResults.flatMap(g => [g[0], g[1]]);

    return { groups: groupResults, qualifiers };
  }, [isLive, user?.uid, profile?.displayName]);

  const t = {
    title: language === 'ru' ? "ЧУГУННЫЙ ГЛОБУС" : "CAST IRON GLOBE",
    subtitle: language === 'ru' ? "Элитное соревнование 16-ти лучших" : "Elite 16-team competition",
    regClosed: language === 'ru' ? "РЕГИСТРАЦИЯ ЗАКРЫТА" : "REGISTRATION CLOSED",
    regOpen: language === 'ru' ? "ИДЕТ РЕГИСТРАЦИЯ" : "REGISTRATION OPEN",
    joined: language === 'ru' ? "ВЫ УЧАСТВУЕТЕ" : "YOU ARE REGISTERED",
    joinBtn: language === 'ru' ? "УЧАСТВОВАТЬ" : "REGISTER",
    fee: language === 'ru' ? "Взнос:" : "Entry:",
    startsIn: language === 'ru' ? "ДО НАЧАЛА:" : "STARTS IN:",
    groupStage: language === 'ru' ? "Групповой этап" : "Group Stage",
    playoffs: language === 'ru' ? "Плей-офф" : "Playoffs",
    bracket: language === 'ru' ? "Сетка турнира" : "Bracket",
    finalists: language === 'ru' ? "Финалисты" : "Finalists",
    winner: language === 'ru' ? "ПОБЕДИТЕЛЬ" : "CHAMPION"
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/tournaments/open">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-primary">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      {/* Hero Tournament Card */}
      <Card className="glass-card mb-8 border-primary/30 bg-primary/5 overflow-hidden">
        <CardContent className="p-0">
          <div className="p-6 text-center border-b border-white/5">
            <div className="w-20 h-20 rounded-full bg-secondary/50 border-2 border-primary mx-auto mb-4 flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary),0.2)]">
              <Trophy className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <Badge variant={isLive ? "destructive" : "secondary"} className="mb-2 uppercase text-[8px] tracking-widest">
              {isLive ? (language === 'ru' ? 'ТУРНИР ИДЕТ' : 'TOURNAMENT LIVE') : (isJoined ? t.joined : t.regOpen)}
            </Badge>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">{t.startsIn}</p>
              <p className="text-4xl font-headline font-bold text-primary tabular-nums tracking-tighter">
                {countdown}
              </p>
            </div>
          </div>

          <div className="p-4 grid grid-cols-2 gap-4 bg-secondary/20">
            <div className="text-center border-r border-white/5">
              <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1">{t.fee}</p>
              <div className="flex items-center justify-center gap-1">
                <Coins className="w-3 h-3 text-accent" />
                <span className="text-sm font-bold">90,000 €</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1">{language === 'ru' ? 'ФОРМАТ' : 'FORMAT'}</p>
              <div className="flex items-center justify-center gap-1">
                <Users className="w-3 h-3 text-primary" />
                <span className="text-sm font-bold">16 TEAMS</span>
              </div>
            </div>
          </div>

          {!isLive && (
            <div className="p-4">
              {isJoined ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center justify-center gap-2 text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">{t.joined}</span>
                </div>
              ) : (
                <Button 
                  className="w-full h-12 hero-gradient font-bold uppercase tracking-widest text-xs"
                  onClick={handleJoin}
                  disabled={isJoining || credits < TOURNAMENT_FEE}
                >
                  {isJoining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Swords className="w-4 h-4 mr-2" />}
                  {t.joinBtn}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tournament Results Section */}
      {isLive ? (
        <div className="space-y-6 animate-in fade-in duration-700">
          <Tabs defaultValue="groups" className="w-full">
            <TabsList className="w-full bg-secondary/50 grid grid-cols-2">
              <TabsTrigger value="groups" className="uppercase text-[10px] font-bold">{t.groupStage}</TabsTrigger>
              <TabsTrigger value="playoffs" className="uppercase text-[10px] font-bold">{t.playoffs}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="groups" className="mt-4 space-y-4">
              {tournamentData?.groups.map((group, idx) => (
                <Card key={idx} className="glass-card border-white/5">
                  <CardHeader className="py-2 px-4 bg-primary/10 border-b border-white/5 flex flex-row justify-between items-center">
                    <CardTitle className="text-[10px] font-bold uppercase text-primary">Group {String.fromCharCode(65 + idx)}</CardTitle>
                    <span className="text-[8px] font-bold opacity-50 uppercase">Stage 1/2</span>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-white/5">
                      {group.map((team, tIdx) => (
                        <div key={team.id} className={cn(
                          "flex items-center justify-between p-3",
                          team.isPlayer && "bg-primary/5",
                          tIdx < 2 && "border-l-2 border-l-green-500"
                        )}>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono opacity-50">{tIdx + 1}</span>
                            <span className={cn("text-xs font-bold uppercase", team.isPlayer && "text-primary")}>
                              {team.name} {team.isPlayer && "(YOU)"}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] font-mono">
                            <span className="opacity-50">{team.w}-{team.d}-{team.l}</span>
                            <span className="text-accent font-bold">{team.pts} PTS</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="playoffs" className="mt-4 space-y-6">
              {/* Quarter Finals */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <Swords className="w-3 h-3" /> Quarter-Finals
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="bg-secondary/30 p-3 rounded-lg border border-white/5 flex items-center justify-between text-xs">
                      <span className="font-bold opacity-80">{tournamentData?.qualifiers[i*2].name}</span>
                      <div className="flex gap-2 font-black text-accent italic">
                        <span>{Math.floor(Math.random()*3)}</span>
                        <span className="opacity-20">:</span>
                        <span>{Math.floor(Math.random()*3)}</span>
                      </div>
                      <span className="font-bold opacity-80">{tournamentData?.qualifiers[i*2+1].name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Final Winner Placeholder */}
              <div className="pt-6 border-t border-white/5">
                <div className="bg-gradient-to-br from-yellow-500/20 to-transparent border border-yellow-500/30 rounded-2xl p-6 text-center">
                  <Medal className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">{t.winner}</p>
                  <h2 className="text-2xl font-headline font-bold text-white mt-1">
                    {tournamentData?.qualifiers[Math.floor(Math.random()*8)].name}
                  </h2>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="bg-secondary/20 border-white/5">
            <CardContent className="p-6 text-center space-y-4">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto" />
              <div>
                <h3 className="text-sm font-bold uppercase tracking-tight">System Initialization</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1 italic">
                  "Tournament logic will execute precisely at 21:05 MSK. Teams will be assigned to groups A-D randomly."
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
