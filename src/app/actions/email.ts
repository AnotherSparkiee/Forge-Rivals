'use server';

/**
 * @fileOverview Серверный модуль для работы с Email и кодами подтверждения.
 * Оптимизирован: добавлен тестовый режим для @test.com и расширенная диагностика.
 */

import { doc, setDoc, getDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import nodemailer from 'nodemailer';

/**
 * Генерирует и отправляет код подтверждения на Email.
 */
export async function sendVerificationEmail(email: string) {
  const { firestore: db } = initializeFirebase();
  
  // ТЕСТОВЫЙ РЕЖИМ: для почты @test.com всегда код 123456
  const isTestEmail = email.toLowerCase().endsWith('@test.com');
  const code = isTestEmail ? "123456" : Math.floor(100000 + Math.random() * 900000).toString();
  
  const expiresAt = new Date(Date.now() + 15 * 60000); // 15 минут

  try {
    // 1. Сохраняем код в Firestore
    await setDoc(doc(db, 'verification_codes', email), {
      code,
      expiresAt: expiresAt.toISOString(),
      createdAt: Timestamp.now()
    }, { merge: true });

    // 2. Логируем в консоль сервера (обязательно для дебага)
    console.log(`\n--- [EMAIL VERIFICATION SYSTEM] ---`);
    console.log(`TARGET EMAIL: ${email}`);
    console.log(`GENERATED CODE: ${code}`);
    if (isTestEmail) console.log(`MODE: TEST (BYPASS ACTIVE)`);
    console.log(`-----------------------------------\n`);

    // 3. Если это тестовый email, письмо не отправляем
    if (isTestEmail) return { success: true, isTest: true };

    // 4. Попытка отправить реальное письмо
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 465,
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          connectionTimeout: 10000, // 10 сек таймаут
        });

        await transporter.sendMail({
          from: '"Lines of Enmity HQ" <noreply@mobamanageronline.app>',
          to: email,
          subject: "Command Access Code",
          text: `Your verification code: ${code}`,
          html: `
            <div style="font-family: sans-serif; background: #0a0d14; color: white; padding: 40px; border-radius: 20px; text-align: center;">
              <h1 style="color: #0ea5e9; margin-bottom: 20px;">SECURITY PROTOCOL</h1>
              <p style="font-size: 16px; color: #94a3b8;">Your club initialization code:</p>
              <div style="font-size: 42px; font-weight: bold; letter-spacing: 10px; color: #38bdf8; margin: 30px 0; background: rgba(56, 189, 248, 0.1); padding: 20px; border-radius: 10px;">
                ${code}
              </div>
              <p style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 2px;">Expires in 15 minutes</p>
            </div>
          `,
        });
      } catch (smtpError: any) {
        console.error("[SMTP ERROR]:", smtpError.message);
        // Возвращаем успех, но с описанием ошибки, чтобы клиент знал, что смотреть логи
        return { 
          success: true, 
          warning: "SMTP_FAILED", 
          errorDetail: smtpError.message 
        };
      }
    } else {
      return { success: true, warning: "SMTP_NOT_CONFIGURED" };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[DATABASE ERROR]:", error.code, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Проверяет код подтверждения.
 */
export async function verifyEmailCode(email: string, inputCode: string) {
  const { firestore: db } = initializeFirebase();
  
  try {
    const codeRef = doc(db, 'verification_codes', email);
    const codeSnap = await getDoc(codeRef);

    if (!codeSnap.exists()) {
      return { success: false, error: "CODE_NOT_FOUND" };
    }

    const data = codeSnap.data();
    
    // Проверка срока жизни
    if (new Date() > new Date(data.expiresAt)) {
      await deleteDoc(codeRef);
      return { success: false, error: "CODE_EXPIRED" };
    }

    if (data.code !== inputCode) {
      return { success: false, error: "INVALID_CODE" };
    }

    // Код верный - удаляем его после проверки
    await deleteDoc(codeRef);
    return { success: true };
  } catch (e: any) {
    console.error("[VERIFY CODE ERROR]:", e.message);
    return { success: false, error: e.message };
  }
}
