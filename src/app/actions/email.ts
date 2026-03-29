'use server';

/**
 * @fileOverview Серверное действие для отправки реальных писем через SMTP.
 * Требует настройки SMTP_HOST, SMTP_PORT, SMTP_USER и SMTP_PASS в .env.
 */

export async function sendVerificationEmail(email: string, code: string) {
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;

  // Проверка конфигурации
  if (!SMTP_USER || !SMTP_PASS || !SMTP_HOST) {
    console.error('CRITICAL: SMTP is not configured in .env');
    // Мы возвращаем код ошибки, чтобы UI мог подсказать разработчику, что делать
    return { 
      success: false, 
      error: 'SMTP_NOT_CONFIGURED', 
      message: 'SMTP сервер не настроен. Пожалуйста, добавьте SMTP_HOST, SMTP_PORT, SMTP_USER и SMTP_PASS в файл .env.' 
    };
  }

  try {
    const nodemailer = (await import('nodemailer')).default;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true для 465, false для других
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    // Настройка письма
    const mailOptions = {
      from: `"MOBA Tactics HQ" <${SMTP_USER}>`,
      to: email,
      subject: 'Код доступа - Инициализация профиля',
      text: `Ваш код подтверждения: ${code}. Добро пожаловать в лигу, Командир.`,
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; background-color: #0a0e14; color: #ffffff; padding: 40px; border-radius: 16px; max-width: 500px; margin: 20px auto; border: 1px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3b82f6; font-size: 28px; font-weight: 800; letter-spacing: -1px; margin: 0; text-transform: uppercase;">MOBA TACTICS</h1>
            <p style="color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-top: 5px;">Протокол безопасности системы</p>
          </div>
          
          <div style="padding: 20px; background-color: rgba(30, 41, 59, 0.5); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.1);">
            <p style="font-size: 14px; line-height: 1.6; color: #e2e8f0; text-align: center; margin-bottom: 25px;">
              Командир, ваши данные синхронизированы. Для завершения инициализации профиля используйте следующий ключ доступа:
            </p>
            
            <div style="background-color: #0f172a; border: 2px solid #3b82f6; border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0;">
              <span style="font-size: 48px; font-weight: 900; letter-spacing: 10px; color: #22d3ee; font-family: 'Courier New', monospace; text-shadow: 0 0 15px rgba(34, 211, 238, 0.3);">${code}</span>
            </div>
            
            <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 20px;">
              Этот код действителен в течение 15 минут.<br>
              Если вы не запрашивали инициализацию, проигнорируйте это сообщение.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; border-top: 1px solid #1e293b; padding-top: 20px;">
            <p style="font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 1px;">
              Связь установлена через Командный Центр MOBA
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL_SUCCESS] Verification code dispatched to ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('[EMAIL_ERROR] SMTP Transmission failed:', error);
    return { 
      success: false, 
      error: 'TRANSMISSION_FAILED', 
      message: error.message || 'Ошибка при отправке письма. Проверьте настройки SMTP.'
    };
  }
}
