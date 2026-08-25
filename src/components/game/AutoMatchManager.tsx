'use client';

import { useEffect, useRef } from 'react';
import { useGameState } from '@/app/lib/store';
import { getGlobalSeasonInfo, isMatchOverdue } from '@/app/lib/time-utils';
import { 
  getStableGroupTeams, 
  generateSeasonCalendar, 
  getMatchResult,
  getPromotionTarget,
  getRelegationTarget
} from '@/app/lib/leagues-data';
import { useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';

/**
 * ГЛОБАЛЬНЫЙ МЕНЕДЖЕР МАТЧЕЙ v8.0 (Season Start & Calendar Seeding)
 * Управляет жизненным циклом лиги: публикация календаря, расчет матчей и переход между сезонами.
 */
export function AutoMatchManager() {
  const { 
    isLoaded, isDataReady, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady, rank, clubLogo, clubName,
    allSeasonMatches, saveToLocal, lastProcessedSeason, id: userId
  } = useGameState();
  
  const db = useFirestore();
  const initRef = useRef(false);
  const seedingRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !selectedLeagueId || !db) return;

    const info = getGlobalSeasonInfo();
    const currentSeason = info.activeSeasonNumber;

    // 1. СИНХРОНИЗАЦИЯ СЕЗОНОВ И ПЕРЕХОД
    if (lastProcessedSeason < currentSeason && lastProcessedSeason > 0) {
      console.log(`[SEASON ENGINE] Transitioning from S${lastProcessedSeason} to S${currentSeason}...`);
      
      const oldTeams = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
        id: userId, name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
      }]);

      const finalStandings = oldTeams.map(t => {
        let pts = 0;
        let wins = 0;
        for (let tour = 1; tour <= 14; tour++) {
          const [sA, sB] = getMatchResult(t.rank, 99, leagueLevel, groupId, lastProcessedSeason, tour);
          pts += (sA > sB ? 3 : (sA === sB ? 1 : 0));
          if (sA > sB) wins++;
        }
        return { id: t.id, pts, wins };
      }).sort((a, b) => b.pts - a.pts || b.wins - a.wins);

      const playerPos = finalStandings.findIndex(s => s.id === userId) + 1;
      let nextLevel = leagueLevel;
      let nextGroup = groupId;

      if (playerPos === 1 && leagueLevel > 1) {
        const target = getPromotionTarget(leagueLevel, groupId);
        nextLevel = target.level; nextGroup = target.group;
      } else if (playerPos >= 7 && leagueLevel < 9) {
        const target = getRelegationTarget(leagueLevel, groupId, playerPos);
        nextLevel = target.level; nextGroup = target.group;
      }

      saveToLocal({
        leagueLevel: nextLevel,
        groupId: nextGroup,
        lastProcessedSeason: currentSeason,
        allSeasonMatches: [], 
        lastSeenMatchDay: 0
      });
      return;
    }

    // 2. ГЛОБАЛЬНОЕ СИДИРОВАНИЕ КАЛЕНДАРЯ (Публикация в БД)
    const seedCalendarIfNeeded = async () => {
      if (seedingRef.current) return;
      seedingRef.current = true;

      try {
        const groupCheckId = `v11_s${currentSeason}_l${selectedLeagueId}_lv${leagueLevel}_g${groupId}_t1_hR1_aR8`;
        const checkSnap = await getDoc(doc(db, 'matches_v11', groupCheckId));

        if (!checkSnap.exists()) {
          console.log(`[SEEDER] Group ${leagueLevel}.${groupId} calendar not found. Publishing to DB...`);
          
          const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
            id: userId, name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
          }]);
          const calendar = generateSeasonCalendar(teamData, currentSeason, selectedLeagueId);

          calendar.forEach(m => {
            const mId = `v11_s${currentSeason}_l${selectedLeagueId}_lv${leagueLevel}_g${groupId}_t${m.tour}_hR${m.homeRank}_aR${m.awayRank}`;
            setDocumentNonBlocking(doc(db, 'matches_v11', mId), {
              id: mId,
              leagueId: selectedLeagueId,
              level: leagueLevel,
              groupId: groupId,
              season: currentSeason,
              tour: m.tour,
              homeRank: m.homeRank,
              awayRank: m.awayRank,
              homeId: m.homeId,
              awayId: m.awayId,
              homeName: m.homeName,
              awayName: m.awayName,
              scoreA: 0,
              scoreB: 0,
              status: 'scheduled',
              isFinished: false,
              version: 11,
              startTime: m.startTime
            });
          });
          
          saveToLocal({ allSeasonMatches: calendar, lastProcessedSeason: currentSeason });
        } else {
          // Если календарь в БД уже есть, просто грузим его локально
          const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
            id: userId, name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null, isBot: false
          }]);
          const calendar = generateSeasonCalendar(teamData, currentSeason, selectedLeagueId);
          saveToLocal({ allSeasonMatches: calendar, lastProcessedSeason: currentSeason });
        }
      } catch (e) {
        console.error("[SEEDER ERROR]", e);
      } finally {
        setWorldReady(true);
      }
    };

    if (!initRef.current) {
      initRef.current = true;
      seedCalendarIfNeeded();
    }

    // 3. ГЛОБАЛЬНЫЙ РЕЗОЛВЕР
    const resolveTimer = setInterval(async () => {
      if (!db || !allSeasonMatches || allSeasonMatches.length === 0) return;

      const overdueMatches = allSeasonMatches.filter(m => !m.isFinished && isMatchOverdue(m.startTime));
      if (overdueMatches.length === 0) return;

      let hasLocalChanges = false;
      const updatedMatches = [...allSeasonMatches];

      for (let i = 0; i < updatedMatches.length; i++) {
        const m = updatedMatches[i];
        if (m.isFinished || !isMatchOverdue(m.startTime)) continue;

        const globalMatchId = `v11_s${currentSeason}_l${selectedLeagueId}_lv${leagueLevel}_g${groupId}_t${m.tour}_hR${m.homeRank}_aR${m.awayRank}`;
        const matchRef = doc(db, 'matches_v11', globalMatchId);
        
        try {
          const snap = await getDoc(matchRef);
          let finalScoreA = 0, finalScoreB = 0;

          if (snap.exists()) {
            const data = snap.data();
            if (data?.status === 'finished') {
              finalScoreA = data.scoreA;
              finalScoreB = data.scoreB;
            } else {
              const [sA, sB] = getMatchResult(m.homeRank, m.awayRank, leagueLevel, groupId, currentSeason, m.tour);
              finalScoreA = sA; finalScoreB = sB;
              setDocumentNonBlocking(matchRef, {
                scoreA: sA, scoreB: sB, status: 'finished', isFinished: true,
                winnerId: sA > sB ? m.homeId : (sB > sA ? m.awayId : null),
                resolvedAt: new Date().toISOString()
              }, { merge: true });
            }

            updatedMatches[i] = { ...m, isFinished: true, scoreA: finalScoreA, scoreB: finalScoreB, status: 'finished' };
            hasLocalChanges = true;
          }
        } catch (e) { console.error("[RESOLVE ERROR]", e); }
      }

      if (hasLocalChanges) saveToLocal({ allSeasonMatches: updatedMatches });
    }, 20000);

    return () => clearInterval(resolveTimer);
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, rank, clubLogo, clubName, allSeasonMatches, saveToLocal, setWorldReady, lastProcessedSeason, userId, db]);

  return null;
}
