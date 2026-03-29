
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, collection, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Trophy, Clock, Users, Coins, ChevronLeft, 
  ShieldCheck, Loader2, Star, Swords, Medal,
  ArrowRight, CheckCircle2, User, UserCheck, AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { getMoscowTime } from '@/app/lib/time-utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

const TOURNAMENT_FEE = 90000;
const START_TIME = "21:05";
const REG_CLOSE_TIME = "20:50"; // 15 mins before start
const MAX_PARTICIPANTS = 16;

export default function IronGlobePage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { credits, addCredits, language, isLoaded } = useGameState();
  const { toast } = useToast();
  
  const [isJoining, setIsJoining] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [isRegClosed, setIsRegClosed] = useState(false);
  const notifiedRef = useRef(false);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const participantsQuery = useMemoFirebase(() => {
    return query(collection(db, 'players_v5'), where('tournaments', 'array-contains', 'iron-globe'));
  }, [db]);

  const { data: participants, isLoading: isParticipantsLoading } = useCollection(participantsQuery);

  const isJoined = profile?.tournaments?.includes('iron-globe') || false;
  const currentCount = participants?.length || 0;
  const spotsLeft = Math.max(0, MAX_PARTICIPANTS - currentCount);

  useEffect(() => {
    const updateTime = () => {
      const mskNow = getMoscowTime();
      
      // Check start time
      const [sh, sm] = START_TIME.split(':').map(Number);
      const startTarget = new Date(mskNow);
      startTarget.setHours(sh, sm, 0, 0);

      // Check registration close time
      const [ch, cm] = REG_CLOSE_TIME.split(':').map(Number);
      const closeTarget = new Date(mskNow);
      closeTarget.setHours(ch, cm, 0, 0);

      if (mskNow.getTime() >= startTarget.getTime()) {
        setIsLive(true);
        setIsRegClosed(true);
        setCountdown('00:00:00');
      } else if (mskNow.getTime() >= closeTarget.getTime()) {
        setIsLive(false);
        setIsRegClosed(true);
        
        // Notify once when registration closes
        if (!notifiedRef.current && isJoined) {
          toast({
            title: language === 'ru' ? "Регистрация завершена" : "Registration Closed",
            description: language === 'ru' ? "Группы сформированы! Изучите соперников." : "Groups are formed! Check your rivals.",
          });
          notifiedRef.current = true;
        }

        const diff = startTarget.getTime() - mskNow.getTime();
        const hh = Math.floor(diff / 3600000);
        const mm = Math.floor((diff % 3600000) / 60000);
        const ss = Math.floor((diff % 60000) / 1000);
        setCountdown(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`);
      } else {
        setIsLive(false);
        setIsRegClosed(false);
        const diff = closeTarget.getTime() - mskNow.getTime();
        const hh = Math.floor(diff / 3600000);
        const mm = Math.floor((diff % 3600000) / 60000);
        const ss = Math.floor((diff % 60000) / 1000);
        setCountdown(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`);
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [isJoined, language, toast]);

  const handleJoin = async () => {
    if (!user || !profile || isJoining) return;
    if (isRegClosed) {
      toast({ title: language === 'ru' ? "Регистрация закрыта" : "Registration closed", variant: "destructive" });
      return;
    }
    if (credits < TOURNAMENT_FEE) {
      toast({ title: language === 'ru' ? "Недостаточно средств" : "Insufficient credits", variant: "destructive" });
      return;
    }
    if (spotsLeft <= 0) {
      toast({ title: language === 'ru' ? "Нет свободных мест" : "No spots left", variant: "destructive" });
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
        description: language === 'ru' ? "Сетку турнира можно будет увидеть в 20:50" : "Tournament bracket will be visible at 20:50"
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsJoining(false);
    }
  };

  const tournamentData = useMemo(() => {
    // Show groups if registration is closed (even if match hasn't started)
    if (!isRegClosed) return null;
    
    const realPlayers = participants?.map(p => ({ id: p.id, name: p.displayName || "Manager", isPlayer: true })) || [];
    const botNeeded = Math.max(0, MAX_PARTICIPANTS - realPlayers.length);
    const botNames = ["AlphaBot", "ZetaUnit", "CyberLink", "VoidRunner", "SteelGear", "NexusPrime", "EchoTeam", "Quantum", "ShadowOps", "Blitz", "Titan", "Vanguard", "Rogue", "Omega", "Spectre", "Ghost"];
    
    const bots = botNames.slice(0, botNeeded).map((n, i) => ({ id: `bot-${i}`, name: n, isPlayer: false }));
    const teams = [...realPlayers, ...bots];
    
    const shuffled = [...teams].sort((a, b) => a.id.localeCompare(b.id)); // Deterministic sort for the bracket
    
    const groups = [
      shuffled.slice(0, 4),
      shuffled.slice(4, 8),
      shuffled.slice(8, 12),
      shuffled.slice(12, 16)
    ];

    const groupResults = groups.map(group => {
      return group.map(t => {
        // Mock results based on status
        const pts = isLive ? Math.floor(Math.random() * 10) : 0;
        return { ...t, pts, w: Math.floor(pts/3), d: pts % 3, l: Math.max(0, 3 - Math.floor(pts/3)) };
      }).sort((a, b) => b.pts - a.pts);
    });

    const qualifiers = groupResults.flatMap(g => [g[0], g[1]]);

    return { groups: groupResults, qualifiers };
  }, [isRegClosed, isLive, participants]);

  const t = {
    title: language === 'ru' ? "ЧУГУННЫЙ ГЛОБУС" : "CAST IRON GLOBE",
    subtitle: language === 'ru' ? "Элитное соревнование 16-ти лучших" : "Elite 16-team competition",
    regClosed: language === 'ru' ? "РЕГИСТРАЦИЯ ЗАКРЫТА" : "REGISTRATION CLOSED",
    regOpen: language === 'ru' ? "ИДЕТ РЕГИСТРАЦИЯ" : "REGISTRATION OPEN",
    joined: language === 'ru' ? "ВЫ УЧАСТВУЕТЕ" : "YOU ARE REGISTERED",
    joinBtn: language === 'ru' ? "УЧАСТВОВАТЬ" : "REGISTER",
    fee: language === 'ru' ? "Взнос:" : "Entry:",
    startsIn: language === 'ru' ? "ДО НАЧАЛА:" : "STARTS IN:",
    regEndsIn: language === 'ru' ? "РЕГИСТРАЦИЯ ДО:" : "REGISTRATION ENDS:",
    groupStage: language === 'ru' ? "Групповой этап" : "Group Stage",
    playoffs: language === 'ru' ? "Плей-офф" : "Playoffs",
    participants: language === 'ru' ? "Список участников" : "Participants List",
    spotsLeft: language === 'ru' ? "Осталось мест" : "Spots left",
    full: language === 'ru' ? "МЕСТ НЕТ" : "FULL",
    winner: language === 'ru' ? "ПОБЕДИТЕЛЬ" : "CHAMPION",
    waitStart: language === 'ru' ? "ОЖИДАНИЕ МАТЧЕЙ" : "WAITING FOR START"
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

      <Card className="glass-card mb-6 border-primary/30 bg-primary/5 overflow-hidden">
        <CardContent className="p-0">
          <div className="p-6 text-center border-b border-white/5">
            <div className="w-20 h-20 rounded-full bg-secondary/50 border-2 border-primary mx-auto mb-4 flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary),0.2)]">
              <Trophy className={cn("w-10 h-10 text-primary", isLive && "animate-pulse")} />
            </div>
            <Badge variant={isLive ? "destructive" : isRegClosed ? "outline" : "secondary"} className="mb-2 uppercase text-[8px] tracking-widest">
              {isLive ? (language === 'ru' ? 'ТУРНИР ИДЕТ' : 'TOURNAMENT LIVE') : isRegClosed ? t.regClosed : (isJoined ? t.joined : t.regOpen)}
            </Badge>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">{isRegClosed && !isLive ? t.startsIn : isLive ? (language === 'ru' ? 'ВРЕМЯ ИГРЫ' : 'MATCH TIME') : t.regEndsIn}</p>
              <p className={cn("text-4xl font-headline font-bold tabular-nums tracking-tighter", isRegClosed ? "text-accent" : "text-primary")}>
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

          {!isRegClosed && (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase">
                  <span className="text-muted-foreground">{language === 'ru' ? 'Заполнено' : 'Filled'}</span>
                  <span className="text-primary">{currentCount} / {MAX_PARTICIPANTS} {language === 'ru' ? 'мест' : 'spots'}</span>
                </div>
                <Progress value={(currentCount / MAX_PARTICIPANTS) * 100} className="h-1.5" />
              </div>

              {isJoined ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center justify-center gap-2 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">{t.joined}</span>
                </div>
              ) : (
                <Button 
                  className="w-full h-12 hero-gradient font-bold uppercase tracking-widest text-xs shadow-lg"
                  onClick={handleJoin}
                  disabled={isJoining || credits < TOURNAMENT_FEE || spotsLeft <= 0}
                >
                  {isJoining ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Swords className="w-4 h-4 mr-2" />}
                  {spotsLeft <= 0 ? t.full : t.joinBtn}
                </Button>
              )}
            </div>
          )}

          {isRegClosed && !isLive && (
            <div className="p-4 bg-accent/10 border-t border-white/5 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-accent animate-pulse" />
              <p className="text-[10px] font-bold uppercase text-accent leading-tight">
                {language === 'ru' ? 'Регистрация окончена. Группы сформированы! Матчи начнутся в 21:05.' : 'Registration ended. Groups formed! Matches start at 21:05.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {!isRegClosed ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h2 className="text-xs font-headline font-bold text-accent uppercase tracking-[0.2em] px-1 flex items-center gap-2">
            <Users className="w-4 h-4" /> {t.participants}
          </h2>
          <Card className="glass-card border-white/5">
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
                {isParticipantsLoading ? (
                  <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : participants && participants.length > 0 ? (
                  participants.map((p, idx) => (
                    <div key={p.id} className={cn("flex items-center justify-between p-4", p.id === user?.uid && "bg-primary/5")}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center border border-white/10">
                          {p.id === user?.uid ? <UserCheck className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div>
                          <p className={cn("text-xs font-bold uppercase", p.id === user?.uid ? "text-primary" : "text-foreground")}>
                            {p.displayName || "Manager"}
                          </p>
                          <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">
                            {p.country || "International"} • DIV {p.leagueLevel || 9}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[8px] border-white/10 opacity-50 font-mono">#{idx + 1}</Badge>
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center text-muted-foreground italic text-xs">
                    {language === 'ru' ? 'Будь первым, кто вступит в бой!' : 'Be the first to join the battle!'}
                  </div>
                )}
                
                {spotsLeft > 0 && !isParticipantsLoading && (
                  <div className="p-4 bg-secondary/10 flex items-center justify-center gap-2 opacity-30">
                    <Star className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      {spotsLeft} {language === 'ru' ? 'СЛОТОВ ОСТАЛОСЬ' : 'SLOTS REMAINING'}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
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
                    <span className="text-[8px] font-bold opacity-50 uppercase">{isLive ? 'In Progress' : t.waitStart}</span>
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
                              {team.name} {team.isPlayer && team.id === user?.uid && "(YOU)"}
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
              {!isLive ? (
                <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                  <Clock className="w-12 h-12 mb-4" />
                  <p className="text-xs uppercase font-bold tracking-widest">{language === 'ru' ? 'ПЛЕЙ-ОФФ ДОСТУПЕН ПОСЛЕ СТАРТА' : 'PLAYOFFS AVAILABLE AFTER START'}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                      <Swords className="w-3 h-3" /> Quarter-Finals
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className="bg-secondary/30 p-3 rounded-lg border border-white/5 flex items-center justify-between text-xs">
                          <span className="font-bold opacity-80 truncate max-w-[100px]">{tournamentData?.qualifiers[i*2].name}</span>
                          <div className="flex gap-2 font-black text-accent italic">
                            <span>{Math.floor(Math.random()*3)}</span>
                            <span className="opacity-20">:</span>
                            <span>{Math.floor(Math.random()*3)}</span>
                          </div>
                          <span className="font-bold opacity-80 truncate max-w-[100px]">{tournamentData?.qualifiers[i*2+1].name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5">
                    <div className="bg-gradient-to-br from-yellow-500/20 to-transparent border border-yellow-500/30 rounded-2xl p-6 text-center">
                      <Medal className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">{t.winner}</p>
                      <h2 className="text-2xl font-headline font-bold text-white mt-1">
                        {tournamentData?.qualifiers[Math.floor(Math.random()*8)].name}
                      </h2>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
