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
  ArrowRight, CheckCircle2, User, History as HistoryIcon
} from 'lucide-react';
import Link from 'next/link';
import { getMoscowTime, getMoscowDateString } from '@/app/lib/time-utils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

const TOURNAMENT_FEE = 90000;
const START_TIME = "21:05";
const REG_CLOSE_TIME = "20:50"; 
const MAX_PARTICIPANTS = 16;

/**
 * Deterministic helper to get tournament structure based on date and participants.
 */
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
      let pts = 0;
      for (let r = 1; r <= completedGroupRounds; r++) {
        const roundSeed = (t.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) + seed + r) % 10;
        if (roundSeed < 4) pts += 3;
        else if (roundSeed < 7) pts += 1;
      }
      return { ...t, pts };
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

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const participantsQuery = useMemoFirebase(() => {
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
        setHasFinished(true);
        setIsLive(false);
        setCountdown('00:00:00');
      } else if (mskNow.getTime() >= startTarget.getTime()) {
        setIsLive(true);
        setIsRegClosed(true);
        setCountdown('00:00:00');
      } else if (mskNow.getTime() >= closeTarget.getTime()) {
        setIsLive(false);
        setIsRegClosed(true);
        if (!notifiedRef.current && isJoined) {
          toast({ title: language === 'ru' ? "Регистрация завершена" : "Registration Closed" });
          notifiedRef.current = true;
        }
        setCountdown(formatDiff(startTarget.getTime() - mskNow.getTime()));
      } else {
        setIsLive(false);
        setIsRegClosed(false);
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
      if (!alreadyHasActive) {
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
      updateDoc(userRef, { tournamentHistory: updatedHistory, tournaments: (profile.tournaments || []).filter((t: string) => t !== 'iron-globe') });
      toast({ title: language === 'ru' ? "Турнир окончен" : "Tournament Ended" });
    }
  }, [hasFinished, isJoined, userRef, profile, language, toast, recordMatch, tournamentData]);

  const handleJoin = async () => {
    if (!user || !profile || isJoining || isRegClosed || credits < TOURNAMENT_FEE) return;
    setIsJoining(true);
    try {
      await updateDoc(userRef!, { inGameCurrency: credits - TOURNAMENT_FEE, tournaments: arrayUnion('iron-globe') });
      addCredits(-TOURNAMENT_FEE);
      toast({ title: language === 'ru' ? "Вы зарегистрированы!" : "Successfully registered!" });
    } finally { setIsJoining(false); }
  };

  const t = { title: language === 'ru' ? "ЧУГУННЫЙ ГЛОБУС" : "CHUGUNNY GLOBE", subtitle: language === 'ru' ? "Элитное соревнование 16-ти лучших" : "Elite 16-team competition", results: language === 'ru' ? "ИТОГИ ТУРНИРА" : "TOURNAMENT RESULTS", participants: language === 'ru' ? "СПИСОК УЧАСТНИКОВ" : "PARTICIPANTS LIST", spots: language === 'ru' ? "мест занято" : "spots filled" };

  if (isParticipantsLoading || isUserLoading) return <Loader2 className="w-8 h-8 animate-spin mx-auto mt-20" />;

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-24">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link href="/tournaments/history">
          <Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-primary">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
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
              <Badge variant={isLive ? "destructive" : "outline"} className="mb-2 uppercase text-[8px]">{isLive ? 'LIVE' : isRegClosed ? 'REG CLOSED' : 'REG OPEN'}</Badge>
              <p className="text-4xl font-headline font-bold text-primary">{countdown}</p>
              {!isRegClosed && !isJoined && <Button className="w-full h-12 hero-gradient font-bold mt-4" onClick={handleJoin} disabled={isJoining || currentCount >= MAX_PARTICIPANTS}>REGISTER ({TOURNAMENT_FEE.toLocaleString()} €)</Button>}
            </CardContent>
          </Card>
          {isRegClosed && (
            <Tabs defaultValue="groups" className="w-full">
              <TabsList className="w-full bg-secondary/50 grid grid-cols-2">
                <TabsTrigger value="groups" className="uppercase text-[10px] font-bold">Group Stage</TabsTrigger>
                <TabsTrigger value="playoffs" className="uppercase text-[10px] font-bold">Playoffs</TabsTrigger>
              </TabsList>
              <TabsContent value="groups" className="mt-4 space-y-4">
                {tournamentData?.groups.map((group, idx) => (
                  <Card key={idx} className="glass-card border-white/5">
                    <CardHeader className="py-2 px-4 bg-primary/10 border-b border-white/5"><CardTitle className="text-[10px] font-bold uppercase">Group {String.fromCharCode(65 + idx)}</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      {group.map((team) => (
                        <div key={team.id} className={cn("flex items-center justify-between p-3 border-b border-white/5", team.id === user?.uid && "bg-primary/5")}>
                          <span className="text-xs font-bold uppercase">{team.name}</span>
                          <span className="text-[10px] font-mono text-accent font-bold">{team.pts} PTS</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}