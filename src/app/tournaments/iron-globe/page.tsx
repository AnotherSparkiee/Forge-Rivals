'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, collection, query, where, arrayUnion } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Trophy, Clock, Users, Coins, ChevronLeft, 
  ShieldCheck, Loader2, Star, Swords, Medal,
  ArrowRight, CheckCircle2, User, History as HistoryIcon, Target
} from 'lucide-react';
import Link from 'next/link';
import { getMoscowTime, getMoscowDateString } from '@/app/lib/time-utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { LoadingScreen } from '@/components/game/LoadingScreen';

const TOURNAMENT_FEE = 90000;
const START_TIME = "21:05";
const REG_CLOSE_TIME = "20:50"; 
const MAX_PARTICIPANTS = 16;

export function getDeterministicTournament(
  dateStr: string, 
  participants: any[], 
  userId: string, 
  mskNow: Date, 
  startTimeStr: string
) {
  const realPlayers = participants?.map(p => ({ id: p.id, name: p.displayName || "Manager", isPlayer: true })) || [];
  const botNeeded = Math.max(0, MAX_PARTICIPANTS - realPlayers.length);
  const dateSeed = dateStr.split('-').reduce((acc, v) => acc + parseInt(v), 0);
  const bots = Array.from({ length: botNeeded }).map((_, i) => {
    const botIdNum = 4000 + (dateSeed % 500) + (i * 31);
    return { id: `bot${botIdNum}`, name: `bot${botIdNum}`, isPlayer: false };
  });
  const allTeams = [...realPlayers, ...bots].sort((a, b) => a.id.localeCompare(b.id));
  const seed = dateSeed;
  const shuffled = [...allTeams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const groups = [ shuffled.slice(0, 4), shuffled.slice(4, 8), shuffled.slice(8, 12), shuffled.slice(12, 16) ];
  const [sh, sm] = startTimeStr.split(':').map(Number);
  const startDate = new Date(mskNow);
  startDate.setHours(sh, sm, 0, 0);
  const diffMs = mskNow.getTime() - startDate.getTime();
  const elapsedMins = Math.floor(diffMs / 60000);
  const completedGroupRounds = Math.min(3, Math.max(0, Math.floor(elapsedMins / 5)));
  const isPlayoffsVisible = elapsedMins >= 15;

  const processedGroups = groups.map((group) => {
    return group.map(t => {
      let wins = 0;
      let losses = 0;
      for (let r = 1; r <= completedGroupRounds; r++) {
        const roundSeed = (t.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) + seed + r) % 10;
        if (roundSeed < 5) wins++; else losses++;
      }
      return { ...t, wins, losses, played: completedGroupRounds, pts: wins * 3 };
    }).sort((a, b) => b.pts - a.pts || a.id.localeCompare(b.id));
  });

  let myOpponent = null;
  const myGroupIdx = groups.findIndex(g => g.some(t => t.id === userId));
  if (myGroupIdx !== -1) {
    const myGroup = groups[myGroupIdx];
    const myIdx = myGroup.findIndex(t => t.id === userId);
    myOpponent = myGroup[(myIdx + 1) % 4];
  }
  return { groups: processedGroups, qualifiers: processedGroups.flatMap(g => [g[0], g[1]]), myOpponent, isPlayoffsVisible };
}

export default function IronGlobePage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { credits, addCredits, language, isLoaded, recordMatch } = useGameState();
  const { toast } = useToast();
  
  const [isJoining, setIsJoining] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [isRegClosed, setIsRegClosed] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const notifiedRef = useRef(false);
  const activeRecordRef = useRef(false);
  const finalResultRef = useRef(false);

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'players_v10', user.uid);
  }, [db, user]);
  
  const { data: profile } = useDoc(userRef);

  const participantsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'players_v10'), where('tournaments', 'array-contains', 'iron-globe'));
  }, [db]);

  const { data: participants, isLoading: isParticipantsLoading } = useCollection(participantsQuery);

  const isJoined = useMemo(() => profile?.tournaments?.includes('iron-globe'), [profile]);
  const currentCount = participants?.length || 0;

  useEffect(() => {
    const updateTime = () => {
      const mskNow = getMoscowTime();
      const [sh, sm] = START_TIME.split(':').map(Number);
      const startTarget = new Date(mskNow);
      startTarget.setHours(sh, sm, 0, 0);
      const [ch, cm] = REG_CLOSE_TIME.split(':').map(Number);
      const closeTarget = new Date(mskNow);
      closeTarget.setHours(ch, cm, 0, 0);
      const finishTarget = new Date(startTarget.getTime() + 35 * 60 * 1000);

      if (mskNow.getTime() >= finishTarget.getTime()) {
        setHasFinished(true); setIsLive(false); setCountdown('00:00:00');
      } else if (mskNow.getTime() >= startTarget.getTime()) {
        setIsLive(true); setIsRegClosed(true); setCountdown('00:00:00');
      } else if (mskNow.getTime() >= closeTarget.getTime()) {
        setIsLive(false); setIsRegClosed(true);
        if (!notifiedRef.current && isJoined) {
          toast({ title: language === 'ru' ? "Регистрация завершена" : "Registration Closed" });
          notifiedRef.current = true;
        }
        setCountdown(formatDiff(startTarget.getTime() - mskNow.getTime()));
      } else {
        setIsLive(false); setIsRegClosed(false);
        setCountdown(formatDiff(closeTarget.getTime() - mskNow.getTime()));
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
  }, [isJoined, language, toast]);

  const tournamentData = useMemo(() => {
    if (!isRegClosed || !user) return null;
    return getDeterministicTournament(getMoscowDateString(), participants || [], user.uid, getMoscowTime(), START_TIME);
  }, [isRegClosed, participants, user]);

  useEffect(() => {
    if (isRegClosed && isJoined && !hasFinished && !activeRecordRef.current && userRef && profile) {
      const today = getMoscowDateString();
      const alreadyHasActive = (profile.tournamentHistory || []).some(
        (h: any) => h.tournamentId === 'iron-globe' && h.status === 'active' && h.startDate.includes(today)
      );
      if (!alreadyHasActive && userRef) {
        activeRecordRef.current = true;
        const activeRecord = {
          tournamentId: 'iron-globe',
          tournamentName: language === 'ru' ? "Чугунный Глобус" : "Cast Iron Globe",
          result: language === 'ru' ? "В процессе" : "In Progress",
          startDate: new Date(getMoscowTime().setHours(21, 5)).toISOString(),
          status: 'active'
        };
        updateDoc(userRef, { tournamentHistory: arrayUnion(activeRecord) }).catch(() => {});
      }
    }
  }, [isRegClosed, isJoined, hasFinished, userRef, profile, language]);

  useEffect(() => {
    if (hasFinished && isJoined && !finalResultRef.current && userRef && profile && tournamentData) {
      finalResultRef.current = true;
      const mskNow = getMoscowTime();
      const today = getMoscowDateString();
      const opponent = tournamentData.myOpponent;
      const mockResult = { scoreA: 2, scoreB: 1, matchSummary: "Intense battle.", teamStats: { teamA: { kills: 25, towersDestroyed: 11 }, teamB: { kills: 20, towersDestroyed: 8 } }, heroPerformance: [] };
      recordMatch(profile.displayName || "Manager", mockResult, 0, opponent?.name || "Tournament Rival", 'tournament', mskNow.toISOString());
      const updatedHistory = (profile.tournamentHistory || []).map((h: any) => {
        if (h.tournamentId === 'iron-globe' && h.status === 'active' && h.startDate.includes(today)) {
          return { ...h, status: 'completed', endDate: mskNow.toISOString(), result: language === 'ru' ? "Завершено" : "Completed" };
        }
        return h;
      });
      if (userRef) {
        updateDoc(userRef, { tournamentHistory: updatedHistory, tournaments: (profile.tournaments || []).filter((t: string) => t !== 'iron-globe') });
      }
      toast({ title: language === 'ru' ? "Турнир окончен" : "Tournament Ended" });
    }
  }, [hasFinished, isJoined, userRef, profile, language, toast, recordMatch, tournamentData]);

  const handleJoin = async () => {
    if (!user || !profile || isJoining || isRegClosed || credits < TOURNAMENT_FEE || !userRef) return;
    setIsJoining(true);
    try {
      await updateDoc(userRef, { tournaments: arrayUnion('iron-globe') });
      addCredits(-TOURNAMENT_FEE);
      toast({ title: language === 'ru' ? "Вы зарегистрированы!" : "Successfully registered!" });
    } finally { setIsJoining(false); }
  };

  const t = { 
    title: language === 'ru' ? "ЧУГУННЫЙ ГЛОБУС" : "CHUGUNNY GLOBE", 
    subtitle: language === 'ru' ? "Ежедневный турнир (Группы + Плей-офф)" : "Daily Tournament (Groups + Playoffs)", 
    results: language === 'ru' ? "ИТОГИ ТУРНИРА" : "TOURNAMENT RESULTS", 
    participants: language === 'ru' ? "СПИСОК УЧАСТНИКОВ" : "PARTICIPANTS LIST",
    table: { team: "Команда", wl: "В-П", games: "Игр", pts: "Очк" }
  };

  if (isParticipantsLoading || isUserLoading || !isLoaded) return <LoadingScreen />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link href="/tournaments/open">
          <Button variant="ghost" size="icon" className="rounded-full border border-white/5"><ChevronLeft className="w-6 h-6" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-primary">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50">{t.subtitle}</p>
        </div>
      </header>
      {hasFinished ? (
        <Card className="glass-card border-yellow-500/30 bg-yellow-500/5 text-center p-8">
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-headline font-bold text-white uppercase">{t.results}</h2>
          <Link href="/tournaments/history" className="block mt-6"><Button className="w-full hero-gradient font-bold uppercase text-[10px]">СМОТРЕТЬ ИСТОРИЮ</Button></Link>
        </Card>
      ) : (
        <>
          <Card className="glass-card mb-6 border-primary/30 bg-primary/5 overflow-hidden">
            <CardContent className="p-6 text-center">
              <Trophy className={cn("w-10 h-10 text-primary mx-auto mb-4", isLive && "animate-pulse")} />
              <Badge variant={isLive ? "destructive" : "outline"} className="mb-2 uppercase text-[8px] tracking-widest">{isLive ? 'LIVE' : isRegClosed ? 'REG CLOSED' : 'REG OPEN'}</Badge>
              <p className="text-4xl font-headline font-bold text-primary">{countdown}</p>
              {!isRegClosed && !isJoined && <Button className="w-full h-12 hero-gradient font-bold mt-4" onClick={handleJoin} disabled={isJoining || currentCount >= MAX_PARTICIPANTS}>REGISTER ({TOURNAMENT_FEE.toLocaleString()} €)</Button>}
            </CardContent>
          </Card>
          {isRegClosed && (
            <Tabs defaultValue="groups" className="w-full">
              <TabsList className="w-full bg-secondary/50 grid grid-cols-2 h-12 p-1 rounded-xl">
                <TabsTrigger value="groups" className="uppercase text-[10px] font-black rounded-lg">Групповой этап</TabsTrigger>
                <TabsTrigger value="playoffs" className="uppercase text-[10px] font-black rounded-lg">Плей-офф</TabsTrigger>
              </TabsList>
              <TabsContent value="groups" className="mt-4 space-y-3">
                {tournamentData?.groups.map((group, idx) => (
                  <Card key={idx} className="glass-card border-white/5 bg-secondary/10 overflow-hidden">
                    <CardHeader className="py-2 px-4 bg-primary/10 border-b border-white/5 flex justify-between flex-row items-center">
                      <CardTitle className="text-[10px] font-black uppercase text-primary tracking-widest">Group {String.fromCharCode(65 + idx)}</CardTitle>
                      <div className="flex gap-4 text-[7px] font-black text-muted-foreground uppercase tracking-tighter">
                        <span className="w-6 text-center">{t.table.games}</span>
                        <span className="w-8 text-center">{t.table.wl}</span>
                        <span className="w-6 text-center">{t.table.pts}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {group.map((team, tIdx) => (
                        <div key={team.id} className={cn("flex items-center justify-between p-3 border-b border-white/5 last:border-0", team.id === user?.uid && "bg-primary/5")}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                             <span className="text-[10px] font-black text-muted-foreground w-3">{tIdx + 1}</span>
                             <span className="text-xs font-bold uppercase text-white truncate pr-2">{team.name}</span>
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
                {!tournamentData?.isPlayoffsVisible ? (
                  <div className="py-20 text-center opacity-40 border border-dashed border-white/10 rounded-3xl p-10">
                    <Target className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                    <p className="uppercase text-[10px] font-black tracking-widest">Ожидание завершения группового этапа</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-accent uppercase">1/4 Финала</h3>
                    <div className="grid gap-2">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className="bg-secondary/30 p-4 rounded-2xl border border-white/5 flex items-center justify-between shadow-inner">
                          <span className="text-[10px] font-bold text-white uppercase truncate flex-1">{tournamentData?.qualifiers[i*2].name}</span>
                          <div className="px-3 text-[10px] font-black italic text-primary">VS</div>
                          <span className="text-[10px] font-bold text-white uppercase truncate flex-1 text-right">{tournamentData?.qualifiers[i*2+1].name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}