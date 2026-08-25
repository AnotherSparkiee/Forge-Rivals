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
 * ГЛОБАЛЬНЫЙ МЕНЕДЖЕР МАТЧЕЙ v8.5 (Unified Calendar)
 * Обеспечивает единое расписание для всей группы через коллекцию matches_v11.
 */
export function AutoMatchManager() {
  const { 
    isLoaded, selectedLeagueId, 
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

    // 1. ПЕРЕХОД МЕЖДУ СЕЗОНАМИ
    if (lastProcessedSeason < currentSeason && lastProcessedSeason > 0) {
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

    // 2. ЕДИНЫЙ КАЛЕНДАРЬ ГРУППЫ (Публикация)
    const seedCalendar = async () => {
      if (seedingRef.current) return;
      seedingRef.current = true;

      try {
        // Проверяем первый матч группы в БД
        const checkId = `v11_s${currentSeason}_l${selectedLeagueId}_lv${leagueLevel}_g${groupId}_t1_hR1_aR8`;
        const checkSnap = await getDoc(doc(db, 'matches_v11', checkId));

        if (!checkSnap.exists()) {
          console.log(`[SEEDER] Publishing unified calendar for Group ${leagueLevel}.${groupId}...`);
          
          // Получаем всех реальных игроков группы для корректных имен в первичной записи
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
            });
          });
          
          saveToLocal({ allSeasonMatches: calendar, lastProcessedSeason: currentSeason });
        } else {
          // Календарь уже в БД - просто синхронизируем локально
          const teamData = getStableGroupTeams(leagueLevel, groupId, selectedLeagueId, []);
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
      seedCalendar();
    }

    // 3. ГЛОБАЛЬНЫЙ РЕЗОЛВЕР (Фиксация результатов)
    const resolveTimer = setInterval(async () => {
      if (!db || !allSeasonMatches || allSeasonMatches.length === 0) return;

      const overdue = allSeasonMatches.filter(m => !m.isFinished && isMatchOverdue(m.startTime));
      if (overdue.length === 0) return;

      for (const m of overdue) {
        const mId = `v11_s${currentSeason}_l${selectedLeagueId}_lv${leagueLevel}_g${groupId}_t${m.tour}_hR${m.homeRank}_aR${m.awayRank}`;
        const matchRef = doc(db, 'matches_v11', mId);
        
        try {
          const snap = await getDoc(matchRef);
          if (snap.exists() && !snap.data().isFinished) {
            const [sA, sB] = getMatchResult(m.homeRank, m.awayRank, leagueLevel, groupId, currentSeason, m.tour);
            setDocumentNonBlocking(matchRef, {
              scoreA: sA, scoreB: sB, status: 'finished', isFinished: true,
              winnerId: sA > sB ? snap.data().homeId : (sB > sA ? snap.data().awayId : null),
              resolvedAt: new Date().toISOString()
            }, { merge: true });
          }
        } catch (e) { console.error("[RESOLVE ERROR]", e); }
      }
    }, 30000);

    return () => clearInterval(resolveTimer);
  }, [isLoaded, selectedLeagueId, leagueLevel, groupId, rank, clubLogo, clubName, allSeasonMatches, saveToLocal, setWorldReady, lastProcessedSeason, userId, db]);

  return null;
}
