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
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * ГЛОБАЛЬНЫЙ МЕНЕДЖЕР МАТЧЕЙ v11.3 (Auto-Seeding enabled)
 * Обеспечивает единство календаря. Автоматически публикует сетку в фазе подготовки.
 */
export function AutoMatchManager() {
  const { 
    isLoaded, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady, rank, clubLogo, clubName,
    allSeasonMatches, saveToLocal, lastProcessedSeason, id: userId
  } = useGameState();
  
  const db = useFirestore();
  const seedingRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !selectedLeagueId || !db) return;

    const info = getGlobalSeasonInfo();
    const currentSeason = info.activeSeasonNumber;

    // 1. ПЕРЕХОД МЕЖДУ СЕЗОНАМИ
    if (lastProcessedSeason < currentSeason && lastProcessedSeason > 0) {
      console.log(`[SEASON ENGINE] Transition detected. New Season: ${currentSeason}`);
      
      const oldTeams = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, [{
        id: userId, name: clubName || "Local Club", rank: rank || 1, logo: clubLogo || null
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

    // 2. ГЛОБАЛЬНОЕ СИДИРОВАНИЕ КАЛЕНДАРЯ
    const syncCalendar = async () => {
      if (seedingRef.current) return;
      seedingRef.current = true;

      try {
        const firstMatchId = `v11_s${currentSeason}_l${selectedLeagueId}_lv${leagueLevel}_g${groupId}_t1_hR1_aR8`;
        const snap = await getDoc(doc(db, 'matches_v11', firstMatchId));

        if (!snap.exists()) {
          console.log(`[SEEDER v11] PRE-GENERATING OFFICIAL CALENDAR for Group ${leagueLevel}.${groupId}`);
          
          const q = query(collection(db, 'players_v11'), 
            where('selectedLeagueId', '==', selectedLeagueId),
            where('leagueLevel', '==', leagueLevel),
            where('groupId', '==', groupId)
          );
          const playersSnap = await getDocs(q);
          const realPlayers = playersSnap.docs.map(d => ({ ...d.data(), id: d.id }));

          const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, realPlayers);
          const calendar = generateSeasonCalendar(teamData, currentSeason, selectedLeagueId);

          calendar.forEach(m => {
            if (m.homeRank === undefined || m.awayRank === undefined) return;
            const mId = `v11_s${currentSeason}_l${selectedLeagueId}_lv${leagueLevel}_g${groupId}_t${m.tour}_hR${m.homeRank}_aR${m.awayRank}`;
            setDocumentNonBlocking(doc(db, 'matches_v11', mId), {
              ...m,
              id: mId,
              leagueId: selectedLeagueId,
              level: leagueLevel,
              groupId: groupId,
              season: currentSeason,
              status: 'scheduled',
              isFinished: false,
              version: 11
            }, { merge: true });
          });
          
          saveToLocal({ allSeasonMatches: calendar });
        } else {
          // Календарь уже в облаке - загружаем
          const q = query(collection(db, 'matches_v11'), 
            where('leagueId', '==', selectedLeagueId),
            where('level', '==', leagueLevel),
            where('groupId', '==', groupId),
            where('season', '==', currentSeason)
          );
          const matchesSnap = await getDocs(q);
          const officialMatches = matchesSnap.docs.map(d => d.data());
          if (officialMatches.length > 0) {
            saveToLocal({ allSeasonMatches: officialMatches.sort((a, b) => a.tour - b.tour) });
          }
        }
      } catch (e) {
        console.error("[SYNC ERROR]", e);
      } finally {
        setWorldReady(true);
      }
    };

    syncCalendar();

    // 3. АВТО-РЕЗОЛВЕР (Фиксация результатов по времени)
    const resolveTimer = setInterval(async () => {
      if (!db || !allSeasonMatches || allSeasonMatches.length === 0) return;

      const overdue = allSeasonMatches.filter(m => !m.isFinished && isMatchOverdue(m.startTime));
      if (overdue.length === 0) return;

      for (const m of overdue) {
        const mId = `v11_s${currentSeason}_l${selectedLeagueId}_lv${leagueLevel}_g${groupId}_t${m.tour}_hR${m.homeRank}_aR${m.awayRank}`;
        const matchRef = doc(db, 'matches_v11', mId);
        
        try {
          const mSnap = await getDoc(matchRef);
          if (mSnap.exists() && !mSnap.data().isFinished) {
            const [sA, sB] = getMatchResult(m.homeRank, m.awayRank, leagueLevel, groupId, currentSeason, m.tour);
            setDocumentNonBlocking(matchRef, {
              scoreA: sA, scoreB: sB, status: 'finished', isFinished: true,
              winnerId: sA > sB ? (mSnap.data().homeId || null) : (sB > sA ? (mSnap.data().awayId || null) : null),
              resolvedAt: new Date().toISOString()
            }, { merge: true });
            
            // Локальный апдейт
            const updated = allSeasonMatches.map(am => am.id === mId ? { ...am, isFinished: true, scoreA: sA, scoreB: sB } : am);
            saveToLocal({ allSeasonMatches: updated });
          }
        } catch (e) { console.error("[RESOLVER] Fail:", e); }
      }
    }, 20000);

    return () => clearInterval(resolveTimer);
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, allSeasonMatches, saveToLocal, setWorldReady, lastProcessedSeason, userId, db, clubLogo, clubName, rank]);

  return null;
}
