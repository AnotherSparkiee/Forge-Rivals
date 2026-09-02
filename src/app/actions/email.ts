'use server';

/**
 * @fileOverview Серверный модуль для работы с Email.
 * Добавлена валидация Zod и Rate Limiting (1 код в 60 сек).
 */

import { doc, setDoc, getDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import nodemailer from 'nodemailer';
import { EmailInputSchema, VerifyCodeSchema } from '@/app/lib/validation-schemas';
import { logger } from '@/app/lib/logger';

const RATE_LIMIT_MS = 60000; // 1 минута

export async function sendVerificationEmail(email: string) {
  // 1. Валидация входа
  const validation = EmailInputSchema.safeParse({ email });
  if (!validation.success) {
    return { success: false, error: "INVALID_EMAIL" };
  }

  const { firestore: db } = initializeFirebase();
  const normalizedEmail = email.toLowerCase();
  const codeRef = doc(db, 'verification_codes', normalizedEmail);

  try {
    // 2. Проверка Rate Limit
    const existingSnap = await getDoc(codeRef);
    if (existingSnap.exists()) {
      const data = existingSnap.data();
      const lastSent = data.createdAt?.toMillis() || 0;
      if (Date.now() - lastSent < RATE_LIMIT_MS) {
        logger.warn("Email Rate Limit Triggered", { email: normalizedEmail });
        return { success: false, error: "RATE_LIMIT_EXCEEDED" };
      }
    }

    // 3. Генерация кода
    const isTestEmail = normalizedEmail.endsWith('@test.com');
    const code = isTestEmail ? "123456" : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60000);

    // 4. Сохранение (используем Timestamp для консистентности)
    await setDoc(codeRef, {
      code,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: Timestamp.now()
    }, { merge: true });

    logger.info("Verification code generated", { email: normalizedEmail, isTest: isTestEmail });

    if (isTestEmail) return { success: true, isTest: true };

    // 5. Отправка (SMTP)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 465,
          secure: true,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          connectionTimeout: 10000,
        });

        await transporter.sendMail({
          from: '"Lines of Enmity HQ" <noreply@mobamanageronline.app>',
          to: normalizedEmail,
          subject: "Command Access Code",
          html: `<div style="background:#0a0d14;color:white;padding:40px;text-align:center;">
                  <h1 style="color:#0ea5e9;">SECURITY PROTOCOL</h1>
                  <p>Verification Code: <strong>${code}</strong></p>
                </div>`,
        });
      } catch (smtpError: any) {
        logger.error("SMTP Delivery Failed", smtpError, { email: normalizedEmail });
        return { success: true, warning: "SMTP_FAILED" };
      }
    }

    return { success: true };
  } catch (error: any) {
    logger.error("Database Error in sendVerificationEmail", error);
    return { success: false, error: "INTERNAL_ERROR" };
  }
}

export async function verifyEmailCode(email: string, inputCode: string) {
  const validation = VerifyCodeSchema.safeParse({ email, code: inputCode });
  if (!validation.success) return { success: false, error: "INVALID_INPUT" };

  const { firestore: db } = initializeFirebase();
  try {
    const codeRef = doc(db, 'verification_codes', email.toLowerCase());
    const codeSnap = await getDoc(codeRef);

    if (!codeSnap.exists()) return { success: false, error: "CODE_NOT_FOUND" };
    const data = codeSnap.data();
    
    // Сравнение через Timestamp
    if (Timestamp.now().toMillis() > data.expiresAt.toMillis()) {
      await deleteDoc(codeRef);
      return { success: false, error: "CODE_EXPIRED" };
    }

    if (data.code !== inputCode) return { success: false, error: "INVALID_CODE" };

    await deleteDoc(codeRef);
    return { success: true };
  } catch (e: any) {
    logger.error("Verify Code Critical Error", e);
    return { success: false, error: "INTERNAL_ERROR" };
  }
}
