'use client';

/**
 * @fileOverview Ядро MMO-синхронизации v80.3 (Participants Logic).
 */

import { useEffect, useRef } from 'react';
import { useGameState, LineupSlot } from '@/app/lib/store';
import { useUser, useFirestore } from '@/firebase';
import { 
  doc, getDoc, writeBatch, serverTimestamp, collection, query, where, getDocs, updateDoc, runTransaction, setDoc, increment 
} from 'firebase/firestore';
import { getGlobalSeasonInfo, isMatchOverdue } from '@/app/lib/time-utils';
import { getStableGroupTeams, generateSeasonCalendar, getMatchResult } from '@/app/lib/leagues-data';
import { simulateMobaMatch } from '@/ai/flows/simulate-moba-match';

const SYNC_VERSION = 81; 

export function AutoMatchManager() {
  const { user, isUserLoading } = useUser();
  const { 
    isLoaded, id: userId, displayName, selectedLeagueId, 
    leagueLevel, groupId, setWorldReady, rank, clubLogo, clubName,
    ownedPlayers, lineup, strategy, staff, bootcamp
  } = useGameState();
  const db = useFirestore();
  
  const syncInProgressRef = useRef<string | null>(null);

  useEffect(() => {
    if (isUserLoading || !user?.uid || !isLoaded || !selectedLeagueId) return;

    const syncSharedWorld = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));

      const info = getGlobalSeasonInfo();
      const currentSeason = Number(info.activeSeasonNumber);
      const lId = String(selectedLeagueId);
      const tier = Number(leagueLevel);
      const groupNum = Number(groupId);
      const myRank = Number(rank || 1);

      const tableId = `s${currentSeason}_l${lId}_t${tier}_g${groupNum}`;
      const syncKey = `${userId}_${tableId}_v${SYNC_VERSION}`;
      
      if (syncInProgressRef.current === syncKey) return;
      syncInProgressRef.current = syncKey;

      const tableRef = doc(db, 'league_tables_v1', tableId);

      try {
        let tableSnap = await getDoc(tableRef);
        let teamData = [];

        const currentClubName = clubName || displayName || "Manager";

        if (!tableSnap.exists()) {
          teamData = getStableGroupTeams(tier, groupNum, lId, [{
            id: userId,
            name: currentClubName,
            rank: myRank,
            logo: clubLogo || null,
            isBot: false
          }]);
          
          await setDoc(tableRef, {
            tableId, season: currentSeason, leagueId: lId, tier, group: groupNum,
            teamData, stats: {}, createdAt: serverTimestamp(), version: SYNC_VERSION
          });
        } else {
          const data = tableSnap.data();
          teamData = data.teamData || [];
          
          const mySlotIndex = myRank - 1;
          const mySlot = teamData[mySlotIndex];
          
          if (!mySlot || mySlot.id !== userId || mySlot.logo !== clubLogo || mySlot.name !== currentClubName) {
            teamData[mySlotIndex] = {
              id: userId,
              name: currentClubName,
              rank: myRank,
              logo: clubLogo || null,
              isBot: false
            };
            await updateDoc(tableRef, { teamData, updatedAt: serverTimestamp() });
          }
        }

        const matchesQuery = query(collection(db, 'matches_v1'), where('tableId', '==', tableId));
        const matchesSnap = await getDocs(matchesQuery);

        if (matchesSnap.empty) {
          const batch = writeBatch(db);
          const calendar = generateSeasonCalendar(teamData, currentSeason, lId);
          calendar.forEach(m => {
            const mId = `m_s${currentSeason}_${lId}_t${tier}_g${groupNum}_d${m.day}_h${m.homeId}`;
            const homeT = teamData.find(t => t.id === m.homeId);
            const awayT = teamData.find(t => t.id === m.awayId);
            
            batch.set(doc(db, 'matches_v1', mId), {
              ...m, tableId, season: currentSeason, leagueId: lId, tier, groupId: groupNum,
              status: 'scheduled', isFinished: false, version: SYNC_VERSION,
              homeLogo: homeT?.logo || null,
              awayLogo: awayT?.logo || null,
              participants: [m.homeId, m.awayId] // Critical for Universal Sync
            });
          });
          await batch.commit();
        } else {
          const batch = writeBatch(db);
          let needsUpdate = false;
          
          const leagueIdx = (['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA', 'ETA', 'THETA', 'IOTA', 'KAPPA', 'LAMBDA', 'MU', 'NU', 'XI', 'OMICRON', 'PI'].indexOf(lId) + 1).toString().padStart(2, '0');
          const botIdForMySlot = `BOT${leagueIdx}${tier}${groupNum.toString().padStart(3, '0')}${myRank}`;

          matchesSnap.docs.forEach(d => {
            const m = d.data();
            let changed = false;
            
            if (m.homeId === botIdForMySlot && m.homeId !== userId) {
              m.homeId = userId; m.homeName = currentClubName; changed = true;
            }
            if (m.awayId === botIdForMySlot && m.awayId !== userId) {
              m.awayId = userId; m.awayName = currentClubName; changed = true;
            }

            const homeT = teamData.find(t => t.id === m.homeId);
            const awayT = teamData.find(t => t.id === m.awayId);
            
            const correctHome = homeT?.name || m.homeName;
            const correctAway = awayT?.name || m.awayName;
            const correctHomeLogo = homeT?.logo || m.homeLogo;
            const correctAwayLogo = awayT?.logo || m.awayLogo;
            
            if (m.homeName !== correctHome) { m.homeName = correctHome; changed = true; }
            if (m.awayName !== correctAway) { m.awayName = correctAway; changed = true; }
            if (m.homeLogo !== correctHomeLogo) { m.homeLogo = correctHomeLogo; changed = true; }
            if (m.awayLogo !== correctAwayLogo) { m.awayLogo = correctAwayLogo; changed = true; }

            // Ensure participants array exists
            if (!m.participants) { m.participants = [m.homeId, m.awayId]; changed = true; }

            if (changed) {
              needsUpdate = true;
              batch.update(d.ref, { 
                homeId: m.homeId, awayId: m.awayId, 
                homeName: m.homeName, awayName: m.awayName,
                homeLogo: m.homeLogo, awayLogo: m.awayLogo,
                participants: m.participants
              });
            }
          });
          if (needsUpdate) await batch.commit();
        }

        setWorldReady(true);

        const pendingQuery = query(
          collection(db, 'matches_v1'),
          where('tableId', '==', tableId),
          where('isFinished', '==', false)
        );
        const pendingSnap = await getDocs(pendingQuery);

        for (const mDoc of pendingSnap.docs) {
          const mData = mDoc.data();
          if (isMatchOverdue(mData.startTime)) {
            const isMeHome = mData.homeId === userId;
            const isMeAway = mData.awayId === userId;
            let simulation;

            if (isMeHome || isMeAway) {
              const squad = ownedPlayers.filter(p => Object.values(lineup).includes(p.id)).map(p => ({
                name: p.name, role: p.role, overallRating: p.overallRating, proStats: p.proStats,
                image: p.image, form: p.form, fatigue: p.fatigue,
                isSub: p.id === lineup.sub1 || p.id === lineup.sub2
              }));

              simulation = await simulateMobaMatch({
                teamA: isMeHome ? { name: currentClubName, strategy, heroes: squad, staffBonus: staff.coach?.skills?.primary, infraBonus: (bootcamp.bootcampLevel || 0) } : { name: mData.homeName, strategy: "Balanced Play", heroes: [] },
                teamB: isMeAway ? { name: currentClubName, strategy, heroes: squad, staffBonus: staff.coach?.skills?.primary, infraBonus: (bootcamp.bootcampLevel || 0) } : { name: mData.awayName, strategy: "Balanced Play", heroes: [] },
                isBo2: true
              });
            } else {
              const [sA, sB] = getMatchResult(mData.homeId, mData.awayId, currentSeason, false);
              simulation = { 
                winner: sA > sB ? mData.homeName : (sB > sA ? mData.awayName : "Ничья"), 
                seriesScore: `${sA}-${sB}`, 
                games: [{ scoreA: sA > 0 ? 1 : 0, scoreB: sB > 0 ? 1 : 0, duration: "30:00", mvp: "Bot System", matchSummary: "FMO Absolute Resolution." }] 
              };
            }

            const scoreParts = simulation.seriesScore.split('-');
            const fSA = parseInt(scoreParts[0]);
            const fSB = parseInt(scoreParts[1]);

            await runTransaction(db, async (transaction) => {
              const tCurrentSnap = await transaction.get(tableRef);
              if (tCurrentSnap.exists()) {
                const stats = tCurrentSnap.data().stats || {};
                const updateStat = (tid: string, s: number, os: number) => {
                  if (!stats[tid]) stats[tid] = { points: 0, matchesPlayed: 0, wins: 0, draws: 0, losses: 0, diff: 0 };
                  stats[tid].matchesPlayed++;
                  if (s > os) { stats[tid].wins++; stats[tid].points += 3; }
                  else if (s === os) { stats[tid].draws++; stats[tid].points += 1; }
                  else { stats[tid].losses++; }
                  stats[tid].diff += (s - os);
                };
                updateStat(mData.homeId, fSA, fSB);
                updateStat(mData.awayId, fSB, fSA);
                transaction.update(tableRef, { stats, updatedAt: serverTimestamp() });
              }
              transaction.update(mDoc.ref, {
                scoreA: fSA, scoreB: fSB, status: 'finished', isFinished: true, simulation, finishedAt: serverTimestamp()
              });

              if (isMeHome || isMeAway) {
                const seasonId = `season_${currentSeason}`;
                const prefixedGroupId = `${seasonId}_league_${lId}_group_${groupNum}`;
                const teamRef = doc(db, 'leagues_v2', lId, 'divisions', String(tier), 'groups', prefixedGroupId, 'teams', userId);
                
                const fatigueLoss = 15 + Math.floor(Math.random() * 11);
                
                const coreSlots: LineupSlot[] = ['carry', 'mid', 'offlane', 'support', 'full_support'];
                coreSlots.forEach(slot => {
                  const pId = lineup[slot];
                  if (pId) {
                    const heroRef = doc(teamRef, 'heroes', pId);
                    transaction.update(heroRef, { 
                      fatigue: increment(-fatigueLoss),
                      form: increment(-1) 
                    });
                  }
                });
              }
            });
          }
        }
      } catch (e) {
        console.error("[SYNC ERROR]", e);
        setWorldReady(true);
      }
    };

    syncSharedWorld();
  }, [isLoaded, userId, displayName, selectedLeagueId, leagueLevel, groupId, rank, clubLogo, clubName, ownedPlayers, lineup, strategy, staff, bootcamp, db, isUserLoading, user, setWorldReady]);

  return null;
}
