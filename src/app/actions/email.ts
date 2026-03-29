'use server';

/**
 * @fileOverview Серверное действие для отправки писем (отключено, так как подтверждение больше не требуется).
 */

export async function sendVerificationEmail(email: string, code: string) {
  // Функция оставлена для обратной совместимости, если где-то остались вызовы, 
  // но теперь она ничего не делает.
  return { success: true, isSimulated: true };
}
