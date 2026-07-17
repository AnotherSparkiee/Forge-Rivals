'use client';

/**
 * @fileOverview ТУРНИР "CYBER ATHLETIC CUP" v3.9.
 * Исправлена передача фотографий игроков в ядро симуляции.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, collection, query, where, arrayUnion, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Trophy, Clock, Users, ChevronLeft, 
  Loader2, Swords, CheckCircle2, User, 
  History as HistoryIcon, Coffee, Target, Info, ChevronRight, Medal
} from 'lucide-react';
import Link from 'next/link';
import { getMoscowTime, getMoscowDateString } from '@/app/lib/time-utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';
import { generateBotSquad } from '@/app/lib/moba-data';

const TOURNAMENT_FEE = 50000;
const TOURNAMENT_REWARD = 250000;
const MAX_PARTICIPANTS = 16;
const TOUR_ID = 'iron-kettle';
const SCHEDULE = [10, 14, 18, 22]; // Часы начала (MSK)
const ROUND_INTERVAL = 15; // минут

export default function IronKettlePage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { 
    credits, addCredits, language, isLoaded, recordMatch, 
    ownedPlayers, lineup, strategy, staff, bootcamp, addTrophy 
  } = useGameState();
  const { toast } = useToast();
  
  const [isJoining, setIsJoining] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'REG_OPEN' | 'REG_CLOSED' | 'LIVE' | 'FINISHED'>('IDLE');
  const [activeTourHour, setActiveTourHour] = useState<number | null>(null);
  
  const simLockRef = useRef<Set<string>>(new Set());
  const rewardClaimedRef = useRef<string | null>(null);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  // Уникальный ID инстанса турнира для текущего часа
  const tournamentInstanceId = useMemo(() => {
    const now = getMoscowTime();
    const today = getMoscowDateString();
    
    let targetHour = SCHEDULE.find(h => {
      const currentHour = now.getHours();
      return currentHour >= h - 3 && currentHour < h + 2; 
    });

    if (targetHour === undefined) return `kettle_${today}_idle`;
    return `kettle_${today}_h${targetHour}`;
  }, []);

  const participantsQuery = useMemoFirebase(() => {
    return query(collection(db, 'players_v10'), where('tournaments', 'array-contains', tournamentInstanceId));
  }, [db, tournamentInstanceId]);

  const { data: participants, isLoading: isParticipantsLoading } = useCollection(participantsQuery);

  const isJoined = useMemo(() => {
    if (!profile?.tournaments) return false;
    return profile.tournaments.includes(tournamentInstanceId);
  }, [profile, tournamentInstanceId]);

  useEffect(() => {
    const updateTime = () => {
      const now = getMoscowTime();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();

      const foundHour = SCHEDULE.find(h => {
        const start = h;
        const visibleFrom = h - 3;
        return currentHour >= visibleFrom && (currentHour < start || (currentHour === start && currentMin < 90));
      });

      if (foundHour === undefined) {
        setStatus('IDLE');
        setCountdown('--:--:--');
        setActiveTourHour(null);
        return;
      }

      setActiveTourHour(foundHour);
      const startTarget = new Date(now);
      startTarget.setHours(foundHour, 0, 0, 0);
      
      const regCloseTarget = new Date(startTarget.getTime() - 15 * 60000);
      const endTarget = new Date(startTarget.getTime() + 90 * 60000);

      if (now < regCloseTarget) {
        setStatus('REG_OPEN');
        setCountdown(formatDiff(regCloseTarget.getTime() - now.getTime()));
      } else if (now < startTarget) {
        setStatus('REG_CLOSED');
        setCountdown(formatDiff(startTarget.getTime() - now.getTime()));
      } else if (now < endTarget) {
        setStatus('LIVE');
        setCountdown('LIVE');
      } else {
        setStatus('FINISHED');
        setCountdown('ENDED');
      }
    };

    const formatDiff = (diff: number) => {
      const hh = Math.floor(diff / 3600000);
      const mm = Math.floor((diff % 3600000) / 60000);
      const ss = Math.floor((diff % 60000) / 1000);
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const tournamentData = useMemo(() => {
    if (status === 'IDLE' || !activeTourHour || !user) return null;
    return getKettleTournamentData(getMoscowDateString(), activeTourHour, participants || [], user.uid, getMoscowTime());
  }, [status, activeTourHour, participants, user]);

  useEffect(() => {
    if (status !== 'LIVE' || !tournamentData || !isJoined || !user || !tournamentInstanceId) return;

    const runAutoSim = async () => {
      const now = getMoscowTime();
      const start = new Date(now);
      start.setHours(activeTourHour!, 0, 0, 0);
      
      const minsPassed = Math.floor((now.getTime() - start.getTime()) / 60000);
      const currentRoundIdx = Math.floor(minsPassed / ROUND_INTERVAL); 
      
      if (currentRoundIdx < 0 || currentRoundIdx > 5) return;

      const tourKey = `${tournamentInstanceId}_r${currentRoundIdx}`;
      if (simLockRef.current.has(tourKey)) return;
      simLockRef.current.add(tourKey);

      let opponent = null;
      const isFinal = currentRoundIdx === 5;
      
      if (currentRoundIdx < 3) {
        opponent = tournamentData.myOpponent;
      } else {
        if (tournamentData.isPlayoffsVisible) {
          opponent = tournamentData.qualifiers[0]; 
        }
      }

      if (!opponent) return;

      const matchId = `match_${tourKey}_u${user.uid}`;
      const matchRef = doc(db, 'matches_v1', matchId);
      const snap = await getDoc(matchRef);

      if (!snap.exists()) {
        try {
          const squad = ownedPlayers.filter(p => Object.values(lineup).includes(p.id)).map(p => ({
            name: p.name, role: p.role, overallRating: p.overallRating, proStats: p.proStats,
            image: p.image,
            isSub: p.id === lineup.sub1 || p.id === lineup.sub2
          }));

          const clubIdent = profile?.clubName || profile?.displayName || "My Club";

          // Ослабляем турнирного бота до OVR 12
          const simulation = await simulateMobaMatch({
            teamA: { 
              name: clubIdent, 
              strategy, heroes: squad, 
              staffBonus: staff.coach?.skills?.primary || 0,
              infraBonus: (bootcamp.bootcampLevel || 0)
            },
            teamB: { name: opponent.name, strategy: "Balanced Play", heroes: generateBotSquad(12) },
            isBo2: false
          });

          const matchRecord = {
            id: matchId,
            homeName: clubIdent,
            awayName: opponent.name,
            scoreA: simulation.games[0].scoreA,
            scoreB: simulation.games[0].scoreB,
            status: 'finished',
            isFinished: true,
            simulation,
            type: 'tournament',
            playedAt: now.toISOString(),
            version: 76
          };

          await setDoc(matchRef, matchRecord);
          recordMatch(
            simulation.games[0].scoreA > simulation.games[0].scoreB ? matchRecord.homeName : opponent.name,
            simulation, 0, opponent.name, 'tournament', now.toISOString(), matchId
          );

          if (isFinal && simulation.games[0].scoreA > simulation.games[0].scoreB) {
            if (rewardClaimedRef.current !== tournamentInstanceId) {
              rewardClaimedRef.current = tournamentInstanceId;
              addCredits(TOURNAMENT_REWARD);
              addTrophy({
                id: tournamentInstanceId,
                name: "Cyber Athletic Cup",
                type: 'kettle',
                date: now.toISOString(),
                reward: TOURNAMENT_REWARD
              });
              toast({ 
                title: language === 'ru' ? "ЧЕМПИОН КУБКА!" : "CUP CHAMPION!",
                description: language === 'ru' ? `Вы получили ${TOURNAMENT_REWARD.toLocaleString()} € и трофей!` : `You earned ${TOURNAMENT_REWARD.toLocaleString()} € and a trophy!`
              });
            }
          }

          toast({ title: language === 'ru' ? "Матч турнира завершен!" : "Cup Match Finished!" });
        } catch (e) {
          console.error("Cup Sim Error:", e);
          simLockRef.current.delete(tourKey);
        }
      }
    };

    runAutoSim();
  }, [status, tournamentData, isJoined, user, activeTourHour, ownedPlayers, lineup, strategy, staff, bootcamp, db, profile, recordMatch, language, tournamentInstanceId, addCredits, addTrophy, toast]);

  const handleJoin = async () => {
    if (!user || !profile || isJoining || status !== 'REG_OPEN' || credits < TOURNAMENT_FEE) return;
    setIsJoining(true);
    try {
      await updateDoc(userRef!, { 
        tournaments: arrayUnion(tournamentInstanceId) 
      });
      addCredits(-TOURNAMENT_FEE);
      toast({ title: language === 'ru' ? "Вы зарегистрированы!" : "Successfully registered!" });
    } finally { setIsJoining(false); }
  };

  const t = {
    title: "CYBER ATHLETIC CUP",
    subtitle: language === 'ru' ? "Регулярный кубок (Группы + Плей-офф)" : "Regular Cup (Groups + Playoffs)",
    regOpen: language === 'ru' ? "РЕГИСТРАЦИЯ ОТКРЫТА" : "REG OPEN",
    regClosed: language === 'ru' ? "РЕГИСТРАЦИЯ ЗАКРЫТА" : "REG CLOSED",
    live: language === 'ru' ? "В ЭФИРЕ" : "LIVE",
    idle: language === 'ru' ? "ОЖИДАНИЕ ЦИКЛА" : "AWAITING CYCLE",
    participants: language === 'ru' ? "СПИСОК УЧАСТНИКОВ" : "PARTICIPANTS LIST",
    table: { team: "Команда", wl: "В-П", games: "Игр", pts: "Очк" }
  };

  if (isParticipantsLoading || isUserLoading || !isLoaded) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/tournaments/open">
            <Button variant="ghost" size="icon" className="rounded-full border border-white/5"><ChevronLeft className="w-6 h-6" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-primary">{t.title}</h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50">{t.subtitle}</p>
          </div>
        </div>
      </header>

      <Card className={cn("glass-card mb-6 border-primary/30 overflow-hidden", status === 'LIVE' && "bg-primary/5 shadow-[0_0_20px_rgba(var(--primary),0.1)]")}>
        <CardContent className="p-0">
          <div className="p-6 text-center border-b border-white/5">
            <div className="w-24 h-24 mx-auto mb-4 flex items-center justify-center relative">
               <img src="https://i.postimg.cc/8cpvcNZ9/logo-lote.png" alt="Cup" className={cn("w-full h-full object-contain drop-shadow-[0_0_15px_rgba(var(--primary),0.3)]", status === 'LIVE' && "animate-pulse")} />
            </div>
            <Badge variant={status === 'LIVE' ? "destructive" : "outline"} className="mb-2 uppercase text-[8px] tracking-widest">
              {status === 'REG_OPEN' ? t.regOpen : status === 'REG_CLOSED' ? t.regClosed : status === 'LIVE' ? t.live : t.idle}
            </Badge>
            <p className="text-4xl font-headline font-bold text-primary tabular-nums">{countdown}</p>
            <p className="text-[9px] text-muted-foreground uppercase font-black mt-2 tracking-widest">
              {activeTourHour ? `Next Session: ${activeTourHour}:00 MSK` : 'Check back later'}
            </p>
          </div>
          {status === 'REG_OPEN' && !isJoined && (
            <div className="p-4 bg-secondary/20">
              <div className="flex justify-between text-[8px] font-bold uppercase mb-1">
                <span>{t.participants}</span>
                <span>{participants?.length || 0} / {MAX_PARTICIPANTS}</span>
              </div>
              <Progress value={((participants?.length || 0) / MAX_PARTICIPANTS) * 100} className="h-1 mb-4" />
              <Button className="w-full h-12 hero-gradient font-black text-xs tracking-widest uppercase shadow-xl" onClick={handleJoin} disabled={isJoining || (participants?.length || 0) >= MAX_PARTICIPANTS}>
                {isJoining ? <Loader2 className="animate-spin mr-2" /> : <Swords className="w-4 h-4 mr-2" />} 
                ВСТУПИТЬ ({TOURNAMENT_FEE.toLocaleString()} €)
              </Button>
            </div>
          )}
          {isJoined && status !== 'FINISHED' && (
             <div className="p-3 bg-green-500/10 text-green-400 text-center text-[10px] font-black uppercase tracking-widest border-t border-white/5">
               <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> ВЫ УЧАСТНИК
             </div>
          )}
        </CardContent>
      </Card>

      {status === 'REG_OPEN' && (
        <section className="space-y-3 mb-8">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-accent px-1 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> {t.participants}
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {participants && participants.length > 0 ? participants.map((p) => (
              <Card key={p.id} className={cn("glass-card border-white/5 bg-secondary/10", p.id === user?.uid && "border-primary/30 bg-primary/5")}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center border border-white/10 shrink-0 overflow-hidden">
                      {p.clubLogo ? <img src={p.clubLogo} alt="" className="w-full h-full object-contain p-1" /> : <User className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <span className={cn("text-xs font-bold uppercase truncate", p.id === user?.uid ? "text-primary font-black" : "text-white")}>
                      {p.clubName || p.displayName || "Manager"}
                    </span>
                  </div>
                  {p.id === user?.uid && <Badge className="text-[7px] bg-primary text-primary-foreground font-black uppercase">YOU</Badge>}
                </CardContent>
              </Card>
            )) : (
              <div className="py-8 text-center opacity-30 border border-dashed border-white/5 rounded-2xl">
                 <p className="text-[9px] font-bold uppercase tracking-widest">No managers registered yet</p>
              </div>
            )}
          </div>
        </section>
      )}

      {tournamentData && (status === 'REG_CLOSED' || status === 'LIVE' || status === 'FINISHED') && (
        <Tabs defaultValue="groups" className="w-full">
          <TabsList className="w-full bg-secondary/50 grid grid-cols-2 h-12 p-1 rounded-xl">
            <TabsTrigger value="groups" className="uppercase text-[10px] font-black rounded-lg">Группы</TabsTrigger>
            <TabsTrigger value="playoffs" className="uppercase text-[10px] font-black rounded-lg">Сетка</TabsTrigger>
          </TabsList>
          
          <TabsContent value="groups" className="mt-4 space-y-3">
            {tournamentData.groups.map((group, idx) => (
              <Card key={idx} className="glass-card border-white/5 bg-secondary/10 overflow-hidden">
                <CardHeader className="py-2 px-4 bg-primary/10 border-b border-white/5 flex justify-between flex-row items-center">
                  <CardTitle className="text-[10px] font-black uppercase text-primary">Group {String.fromCharCode(65 + idx)}</CardTitle>
                  <div className="flex gap-4 text-[7px] font-black text-muted-foreground uppercase">
                    <span className="w-6 text-center">{t.table.games}</span>
                    <span className="w-8 text-center">{t.table.wl}</span>
                    <span className="w-6 text-center">{t.table.pts}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {group.map((team, tIdx) => (
                    <div key={team.id} className={cn("flex items-center justify-between p-3 border-b border-white/5 last:border-0", team.id === user?.uid && "bg-primary/10 border-l-2 border-l-primary")}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-[10px] font-black text-muted-foreground w-3">{tIdx + 1}</span>
                        <span className={cn("text-xs font-bold uppercase truncate", team.id === user?.uid ? "text-primary" : "text-white")}>{team.name}</span>
                      </div>
                      <div className="flex gap-4 items-center shrink-0">
                        <span className="w-6 text-center text-[10px] font-mono text-muted-foreground">{team.played}</span>
                        <span className="w-8 text-center text-[10px] font-mono text-white/80">{team.wins}-{team.losses}</span>
                        <span className="w-6 text-center text-[10px] font-mono text-accent font-black">{team.pts}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="playoffs" className="mt-4">
            {!tournamentData.isPlayoffsVisible ? (
              <div className="py-20 text-center opacity-40 border border-dashed border-white/10 rounded-3xl p-10 flex flex-col items-center gap-4">
                 <Target className="w-12 h-12 text-muted-foreground animate-pulse" />
                 <p className="uppercase text-[10px] font-black tracking-widest leading-relaxed">Ожидание завершения<br/>группового этапа</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-accent uppercase tracking-widest px-1">1/4 Финала</h3>
                <div className="grid gap-2">
                  {[0, 1, 2, 3].map(i => (
                    <Card key={i} className="glass-card border-white/5 bg-secondary/20">
                      <CardContent className="p-4 flex items-center justify-between">
                         <span className="text-[10px] font-bold uppercase truncate flex-1">{tournamentData.qualifiers[i*2]?.name || 'TBD'}</span>
                         <div className="px-3 text-[10px] font-black italic text-primary">VS</div>
                         <span className="text-[10px] font-bold uppercase truncate flex-1 text-right">{tournamentData.qualifiers[i*2+1]?.name || 'TBD'}</span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function getKettleTournamentData(dateStr: string, hour: number, participants: any[], userId: string, mskNow: Date) {
  const seedBase = dateStr.split('-').reduce((acc, v) => acc + parseInt(v), 0) + hour;
  const realPlayers = participants.map(p => ({ id: p.id, name: p.clubName || p.displayName || "Manager", isPlayer: true }));
  const botNeeded = Math.max(0, MAX_PARTICIPANTS - realPlayers.length);
  const bots = Array.from({ length: botNeeded }).map((_, i) => {
    const botIdNum = 5000 + (seedBase % 1000) + (i * 17);
    return { id: `bot${botIdNum}`, name: `bot${botIdNum}`, isPlayer: false };
  });
  const allTeams = [...realPlayers, ...bots].sort((a, b) => a.id.localeCompare(b.id));
  const shuffled = [...allTeams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seedBase + i) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const groups = [ shuffled.slice(0, 4), shuffled.slice(4, 8), shuffled.slice(8, 12), shuffled.slice(12, 16) ];
  const start = new Date(mskNow); start.setHours(hour, 0, 0, 0);
  const minsPassed = Math.floor((mskNow.getTime() - start.getTime()) / 60000);
  const completedRounds = Math.min(3, Math.max(0, Math.floor(minsPassed / ROUND_INTERVAL)));
  
  const processedGroups = groups.map((group) => {
    return group.map(t => {
      let wins = 0;
      for (let r = 1; r <= completedRounds; r++) {
        const roundSeed = (t.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) + seedBase + r) % 10;
        if (roundSeed < 5) wins++;
      }
      return { ...t, wins, losses: completedRounds - wins, played: completedRounds, pts: wins * 3 };
    }).sort((a, b) => b.pts - a.pts || a.id.localeCompare(b.id));
  });

  const myGroupIdx = groups.findIndex(g => g.some(t => t.id === userId));
  let myOpponent = null;
  if (myGroupIdx !== -1) {
    const myGroup = groups[myGroupIdx];
    const myIdx = myGroup.findIndex(t => t.id === userId);
    myOpponent = myGroup[(myIdx + 1) % 4];
  }

  return { 
    groups: processedGroups, 
    qualifiers: processedGroups.flatMap(g => [g[0], g[1]]), 
    isPlayoffsVisible: minsPassed >= 45,
    myOpponent
  };
}