import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Форматирует числовое значение валюты в сокращенный вид (k, M, B).
 */
export function formatCurrency(val: number): string {
  if (val >= 1000000000) {
    return (val / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (val >= 1000000) {
    return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (val >= 1000) {
    return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return val.toString();
}
