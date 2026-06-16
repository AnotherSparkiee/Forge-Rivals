'use server';

/**
 * @fileOverview Глобальный MMO-Двигатель (Cloud Functions Logic).
 * Управляет Лигой Чемпионов, Ротацией Пирамиды и Генерацией Сезонов.
 */

import { 
  collection, doc, getDocs, getDoc, writeBatch, 
  query, where, serverTimestamp, setDoc, updateDoc, 
  orderBy, limit 
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { getMoscowTime, getGlobalSeasonInfo } from '@/app/lib/time-utils';
import { generateSeasonCalendar, LEAGUES } from '@/app/lib/leagues-data';

const CL_GROUP_TIMES = ["09:00", "11:00", "13:00"];
const CL_PLAYOFF_TIMES = { "1/8": "15:00", "1/4": "17:00", "semi": "19:00", "final": "21:00" };

/**
 * 1. Жеребьевка Лиги Чемпионов (32 команды)
 * Запускается на 15-й день в 00:00.
 */
export async function initiateChampionsLeague() {
  const { firestore: db } = initializeFirebase();
  const { seasonNumber } = getGlobalSeasonInfo();
  const batch = writeBatch(db);

  console.log(`[LCH] Initiating Draw for Season ${seasonNumber}`);

  // 1. Отбор участников (Топ-2 из Div 1.1 каждой из 16 лиг)
  const participants: any[] = [];
  for (const league of LEAGUES) {
    const q = query(
      collection(db, 'players_v10'),
      where('selectedLeagueId', '==', league.id),
      where('leagueLevel', '==', 1),
      where('groupId', '==', 1),
      limit(2)
    );
    const snap = await getDocs(q);
    snap.forEach(d => participants.push({ id: d.id, leagueId: league.id, name: d.data().displayName }));
  }

  // Если команд меньше 32 (новые сервера), добиваем ботами
  while (participants.length < 32) {
    participants.push({ id: `cl_bot_${participants.length}`, leagueId: 'SYSTEM', name: `Elite Bot ${participants.length}` });
  }

  // 2. Жеребьевка по 8 группам (A-H)
  const groups: string[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const groupTeams: Record<string, any[]> = {};
  groups.forEach(g => groupTeams[g] = []);

  // Алгоритм распределения с защитой от одной лиги
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  shuffled.forEach((team) => {
    const targetGroup = groups.find(g => 
      groupTeams[g].length < 4 && 
      !groupTeams[g].some(t => t.leagueId === team.leagueId)
    ) || groups.find(g => groupTeams[g].length < 4);
    
    if (targetGroup) groupTeams[targetGroup].push(team);
  });

  // 3. Генерация матчей группового этапа
  const today = new Date();
  today.setHours(0,0,0,0);

  for (const gId of groups) {
    const teams = groupTeams[gId];
    // Круговая система на 4 команды (3 тура)
    const clMatches = [
      [ [0,1], [2,3] ], // Тур 1
      [ [0,2], [1,3] ], // Тур 2
      [ [0,3], [1,2] ]  // Тур 3
    ];

    clMatches.forEach((round, rIdx) => {
      const timeStr = CL_GROUP_TIMES[rIdx];
      const [hh, mm] = timeStr.split(':').map(Number);
      const matchTime = new Date(today);
      matchTime.setHours(hh, mm);

      round.forEach((pair, pIdx) => {
        const h = teams[pair[0]];
        const a = teams[pair[1]];
        const mId = `cl_s${seasonNumber}_g${gId}_r${rIdx}_m${pIdx}`;
        
        batch.set(doc(db, 'cl_matches_v1', mId), {
          id: mId,
          seasonNumber,
          stage: 'group',
          groupId: gId,
          homeId: h.id,
          homeName: h.name,
          awayId: a.id,
          awayName: a.name,
          status: 'pending',
          startTime: matchTime.toISOString(),
          createdAt: serverTimestamp()
        });
      });
    });
  }

  await batch.commit();
  return { success: true };
}

/**
 * 2. Реактивная генерация Плей-офф
 * Проверяет завершение группового этапа.
 */
export async function checkAndGenerateCLPlayoffs() {
  const { firestore: db } = initializeFirebase();
  const { seasonNumber } = getGlobalSeasonInfo();

  const q = query(
    collection(db, 'cl_matches_v1'),
    where('seasonNumber', '==', seasonNumber),
    where('stage', '==', 'group'),
    where('status', '==', 'pending')
  );
  
  const pending = await getDocs(q);
  if (!pending.empty) return; // Еще есть игры

  console.log("[LCH] Group stage finished. Generating Playoffs...");

  // Расчет таблиц и выход в 1/8
  // (Логика сокращена: берем топ-2 из каждой группы)
  // ... расчет очков ...
  
  const qualifiers: any[] = []; // Сюда попадают 16 команд
  
  const batch = writeBatch(db);
  const playoffTimes = Object.entries(CL_PLAYOFF_TIMES);
  
  // Генерация 1/8 (Пример)
  qualifiers.forEach((team, idx) => {
    if (idx % 2 === 0) {
      const mId = `cl_s${seasonNumber}_1-8_m${idx/2}`;
      batch.set(doc(db, 'cl_matches_v1', mId), {
        stage: '1/8',
        homeId: qualifiers[idx].id,
        awayId: qualifiers[idx+1].id,
        status: 'pending',
        startTime: new Date().toISOString() // 15:00
      });
    }
  });

  await batch.commit();
}

/**
 * 3. Ротация Пирамиды (15-й день, 16:00)
 */
export async function rotatePyramid() {
  const { firestore: db } = initializeFirebase();
  const batch = writeBatch(db);

  for (const league of LEAGUES) {
    for (let lvl = 1; lvl < 9; lvl++) {
      // 1. Собираем чемпионов (на повышение)
      const upQ = query(collection(db, 'players_v10'), 
        where('selectedLeagueId', '==', league.id),
        where('leagueLevel', '==', lvl + 1),
        where('rank', '==', 1)
      );
      
      // 2. Собираем аутсайдеров (на понижение)
      const downQ = query(collection(db, 'players_v10'), 
        where('selectedLeagueId', '==', league.id),
        where('leagueLevel', '==', lvl),
        where('rank', '>=', 7)
      );

      const [upSnap, downSnap] = await Promise.all([getDocs(upQ), getDocs(downQ)]);
      
      // Логика перемешивания и обновления divisionId/groupId
      // ...
    }
  }
  await batch.commit();
}

/**
 * 4. Правило "Часа тишины"
 */
export async function checkSilenceHour(teamId: string) {
  const { firestore: db } = initializeFirebase();
  const mskNow = getMoscowTime();
  const limit = new Date(mskNow.getTime() + 60 * 60 * 1000);

  // Ищем любые официальные матчи в ближайший час
  const q = query(
    collection(db, 'matches_v1'),
    where('status', '==', 'pending'),
    where('startTime', '<=', limit.toISOString())
  );

  const snap = await getDocs(q);
  const isBusy = snap.docs.some(d => {
    const m = d.data();
    return m.homeId === teamId || m.awayId === teamId;
  });

  if (isBusy) {
    throw new Error("Action blocked: Official match starting within 60 minutes.");
  }
}
