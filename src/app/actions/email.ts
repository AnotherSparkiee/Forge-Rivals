'use server';

/**
 * @fileOverview Серверный модуль для работы с Email v2.0 (Security Refined).
 */

import { doc, setDoc, getDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { authenticateAsSystem } from '@/firebase/system-auth';
import nodemailer from 'nodemailer';
import { EmailInputSchema, VerifyCodeSchema } from '@/app/lib/validation-schemas';
import { logger } from '@/app/lib/logger';

const RATE_LIMIT_MS = 60000; 

const transporter = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
}) : null;

export async function sendVerificationEmail(email: string) {
  const validation = EmailInputSchema.safeParse({ email });
  if (!validation.success) return { success: false, error: "INVALID_EMAIL" };

  // Авторизуемся как система для работы с закрытой коллекцией
  const authRes = await authenticateAsSystem();
  if (!authRes.success) {
    logger.error("System Auth failed in sendVerificationEmail", { error: authRes.error });
    // Не возвращаем пользователю детали системной ошибки
    return { success: false, error: "SERVICE_UNAVAILABLE" };
  }

  const { firestore: db } = initializeFirebase();
  const normalizedEmail = email.toLowerCase();
  const codeRef = doc(db, 'verification_codes', normalizedEmail);

  try {
    const existingSnap = await getDoc(codeRef);
    if (existingSnap.exists()) {
      const data = existingSnap.data();
      if (Date.now() - (data.createdAt?.toMillis() || 0) < RATE_LIMIT_MS) {
        return { success: false, error: "RATE_LIMIT_EXCEEDED" };
      }
    }

    // Генерация случайного кода
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60000);

    await setDoc(codeRef, {
      code,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: Timestamp.now()
    }, { merge: true });

    if (transporter) {
      try {
        await transporter.sendMail({
          from: '"Lines of Enmity" <noreply@mobamanageronline.app>',
          to: normalizedEmail,
          subject: "Verification Code",
          text: `Your verification code: ${code}`,
          html: `<div style="background:#0a0d14;color:white;padding:40px;text-align:center;font-family:sans-serif;">
                  <h1 style="color:#0ea5e9;letter-spacing:2px;">SECURITY LINK</h1>
                  <p style="opacity:0.7;">Use the following code to establish command frequency:</p>
                  <div style="background:#1a1f2e;padding:20px;display:inline-block;border-radius:10px;margin:20px 0;">
                    <span style="font-size:32px;font-weight:bold;color:white;letter-spacing:8px;">${code}</span>
                  </div>
                  <p style="font-size:10px;opacity:0.5;margin-top:20px;">Expire time: 15 minutes</p>
                </div>`,
        });
      } catch (e: any) {
        logger.error("SMTP Error", e);
        return { success: true, warning: "SMTP_FAILED" };
      }
    }

    return { success: true };
  } catch (error: any) {
    logger.error("sendVerificationEmail Error", error);
    return { success: false, error: "INTERNAL_ERROR" };
  }
}

export async function verifyEmailCode(email: string, inputCode: string) {
  const validation = VerifyCodeSchema.safeParse({ email, code: inputCode });
  if (!validation.success) return { success: false, error: "INVALID_INPUT" };

  const authRes = await authenticateAsSystem();
  if (!authRes.success) {
    logger.error("System Auth failed in verifyEmailCode", { error: authRes.error });
    return { success: false, error: "SERVICE_UNAVAILABLE" };
  }

  const { firestore: db } = initializeFirebase();
  try {
    const codeRef = doc(db, 'verification_codes', email.toLowerCase());
    const codeSnap = await getDoc(codeRef);

    if (!codeSnap.exists()) return { success: false, error: "CODE_NOT_FOUND" };
    const data = codeSnap.data();
    
    if (Timestamp.now().toMillis() > data.expiresAt.toMillis()) {
      await deleteDoc(codeRef);
      return { success: false, error: "CODE_EXPIRED" };
    }

    if (data.code !== inputCode) return { success: false, error: "INVALID_CODE" };

    await deleteDoc(codeRef);
    return { success: true };
  } catch (e: any) {
    logger.error("verifyEmailCode Error", e);
    return { success: false, error: "INTERNAL_ERROR" };
  }
}
