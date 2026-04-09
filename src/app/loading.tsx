'use client';

import { LoadingScreen } from "@/components/game/LoadingScreen";

/**
 * Стандартный загрузчик Next.js.
 * Срабатывает МГНОВЕННО при переходе между любыми маршрутами (вкладками).
 */
export default function Loading() {
  return <LoadingScreen />;
}
