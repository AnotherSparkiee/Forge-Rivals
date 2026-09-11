/**
 * @fileOverview Version Constants v2
 * Централизованное управление версиями всех компонентов системы.
 * Обновляйте эти значения при изменении схемы данных.
 */

export const VERSIONS = {
  // Cloud Functions версии
  REGISTRATION: 'v165',
  CLUB_INITIALIZATION: 'v165',
  
  // Firestore Collection версии
  PLAYERS_SCHEMA: 'v14',
  MATCHES_SCHEMA: 'v2',
  LEAGUE_TABLES: 'v2',
  LEAGUE_SLOTS: 'v1',
  MARKET: 'v7',
  GLOBAL_CHAT: 'v2',
  FRIEND_REQUESTS: 'v4',
  PRIVATE_MESSAGES: 'v3',
  SYSTEM_CONFIG: 'v1',
  GLOBAL_STATS: 'v1',
  
  // App версия
  APP: '1.0.61',
} as const;

export const COLLECTION_NAMES = {
  PLAYERS: `players_${VERSIONS.PLAYERS_SCHEMA}`,
  MATCHES: `matches_${VERSIONS.MATCHES_SCHEMA}`,
  LEAGUE_TABLES: `league_tables_${VERSIONS.LEAGUE_TABLES}`,
  LEAGUE_SLOTS: `league_slots_${VERSIONS.LEAGUE_SLOTS}`,
  MARKET: `market_${VERSIONS.MARKET}`,
  GLOBAL_CHAT: `global_chat_${VERSIONS.GLOBAL_CHAT}`,
  FRIEND_REQUESTS: `friend_requests_${VERSIONS.FRIEND_REQUESTS}`,
  PRIVATE_MESSAGES: `private_messages_${VERSIONS.PRIVATE_MESSAGES}`,
  SYSTEM_CONFIG: `system_${VERSIONS.SYSTEM_CONFIG}`,
} as const;

export const FIREBASE_CONFIG = {
  DEFAULT_LEAGUE: 'ALPHA',
  STARTING_DIVISION: 4,
  STARTING_CREDITS: 1000000,
  STARTING_CRYSTALS: 50,
  STARTING_SQUAD_SIZE: 10,
} as const;

/**
 * Проверить версию Cloud Function
 */
export function checkFunctionVersion(
  receivedVersion: string,
  expectedVersion: string = VERSIONS.REGISTRATION
): boolean {
  return receivedVersion === expectedVersion;
}

/**
 * Получить имя коллекции с правильной версией
 */
export function getCollectionName(
  collectionType: keyof typeof COLLECTION_NAMES
): string {
  return COLLECTION_NAMES[collectionType];
}
