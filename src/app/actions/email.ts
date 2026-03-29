'use server';

/**
 * @fileOverview Серверное действие для отправки реальных писем через SMTP.
 */

export async function sendVerificationEmail(email: string, code: string) {
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;

  // Если конфигурация отсутствует, мы не симулируем успех, а возвращаем ошибку
  if (!SMTP_USER || !SMTP_PASS || !SMTP_HOST) {
    console.error('CRITICAL: SMTP is not configured in .env');
    return { 
      success: false, 
      error: 'SMTP_NOT_CONFIGURED', 
      message: 'SMTP сервер не настроен. Пожалуйста, добавьте SMTP_HOST, SMTP_PORT, SMTP_USER и SMTP_PASS в файл .env.' 
    };
  }

  try {
    // Используем динамический импорт для предотвращения ошибок сборки
    const nodemailer = (await import('nodemailer')).default;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Штаб MOBA Tactics" <${SMTP_USER}>`,
      to: email,
      subject: 'Код доступа - Инициализация профиля',
      text: `Ваш код подтверждения: ${code}. Добро пожаловать в лигу, Командир.`,
      html: `
        <div style="font-family: 'Inter', sans-serif; background-color: #0a0e14; color: #ffffff; padding: 40px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #1e293b;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3b82f6; font-size: 28px; font-weight: 800; letter-spacing: -1px; margin: 0; text-transform: uppercase;">MOBA TACTICS</h1>
            <p style="color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-top: 5px;">Протокол безопасности</p>
          </div>
          
          <p style="font-size: 14px; line-height: 1.6; color: #e2e8f0; text-align: center;">
            Командир, ваши данные синхронизированы. Для завершения инициализации профиля используйте следующий ключ доступа:
          </p>
          
          <div style="background-color: #1e293b; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
            <span style="font-size: 42px; font-weight: 900; letter-spacing: 8px; color: #22d3ee; font-family: monospace;">${code}</span>
          </div>
          
          <div style="background-color: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 30px;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">
              <strong>ВНИМАНИЕ:</strong> Код действителен в течение 15 минут. Если вы не запрашивали этот код, немедленно защитите свою учетную запись.
            </p>
          </div>
          
          <div style="text-align: center; border-top: 1px solid #1e293b; padding-top: 20px;">
            <p style="font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 1px;">
              Связь установлена через Командный Центр
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL_SENT] Real code dispatched to ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('SMTP Transmission failed:', error);
    return { 
      success: false, 
      error: 'TRANSMISSION_FAILED', 
      message: error.message 
    };
  }
}
