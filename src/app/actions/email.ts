'use server';

/**
 * @fileOverview Серверный модуль для работы с Email и кодами подтверждения.
 * Оптимизирован: удалена обязательная системная авторизация для публичных кодов.
 */

import { doc, setDoc, getDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import nodemailer from 'nodemailer';

/**
 * Генерирует и отправляет код подтверждения на Email.
 */
export async function sendVerificationEmail(email: string) {
  const { firestore: db } = initializeFirebase();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60000); // 15 минут

  try {
    // Сохраняем код во временную коллекцию. 
    // Операция разрешена правилами "if true" для этой коллекции.
    await setDoc(doc(db, 'verification_codes', email), {
      code,
      expiresAt: expiresAt.toISOString(),
      createdAt: Timestamp.now()
    }, { merge: true });

    // Попытка отправить реальное письмо, если есть настройки
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: '"Lines of Enmity" <noreply@mobamanageronline.app>',
        to: email,
        subject: "Verification Code",
        text: `Your verification code: ${code}`,
        html: `<b>Your verification code: ${code}</b><p>Expires in 15 minutes.</p>`,
      });
    } else {
      console.log(`[EMAIL DEBUG] Verification code for ${email}: ${code}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("[EMAIL ERROR]:", error.code, error.message);
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
    if (data.code !== inputCode) {
      return { success: false, error: "INVALID_CODE" };
    }

    if (new Date() > new Date(data.expiresAt)) {
      await deleteDoc(codeRef);
      return { success: false, error: "CODE_EXPIRED" };
    }

    // Код верный - удаляем его после проверки
    await deleteDoc(codeRef);
    return { success: true };
  } catch (e: any) {
    console.error("[VERIFY CODE ERROR]:", e.message);
    return { success: false, error: e.message };
  }
}
