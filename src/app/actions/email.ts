
'use server';

/**
 * @fileOverview Серверное действие для реальной отправки писем через SMTP.
 * 
 * Требует настройки SMTP_HOST, SMTP_PORT, SMTP_USER и SMTP_PASS в файле .env.
 */

export async function sendVerificationEmail(email: string, code: string) {
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;

  // Проверка конфигурации
  if (!SMTP_USER || !SMTP_PASS || !SMTP_HOST) {
    console.error('❌ [EMAIL_ERROR] SMTP credentials are not configured in .env');
    return { 
      success: false, 
      error: 'SMTP_NOT_CONFIGURED', 
      message: 'Сервер почты не настроен. Пожалуйста, добавьте SMTP_HOST, SMTP_USER и SMTP_PASS в файл .env.' 
    };
  }

  try {
    // Используем динамический импорт для избежания проблем с компиляцией на стороне клиента
    const nodemailer = (await import('nodemailer')).default;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true для порта 465, false для других
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"MOBA Tactics HQ" <${SMTP_USER}>`,
      to: email,
      subject: 'Код доступа - Инициализация профиля',
      text: `Ваш код подтверждения: ${code}. Добро пожаловать в лигу, Командир.`,
      html: `
        <div style="font-family: sans-serif; background-color: #0a0e14; color: #ffffff; padding: 40px; border-radius: 16px; max-width: 500px; margin: 20px auto; border: 1px solid #1e293b;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3b82f6; font-size: 28px; font-weight: 800; margin: 0;">MOBA TACTICS</h1>
            <p style="color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">Протокол безопасности</p>
          </div>
          <div style="padding: 20px; background-color: rgba(30, 41, 59, 0.5); border-radius: 12px; text-align: center;">
            <p style="font-size: 14px; color: #e2e8f0; margin-bottom: 25px;">Используйте следующий ключ для активации вашего профиля менеджера:</p>
            <div style="background-color: #0f172a; border: 2px solid #3b82f6; border-radius: 12px; padding: 20px;">
              <span style="font-size: 42px; font-weight: 900; letter-spacing: 8px; color: #22d3ee;">${code}</span>
            </div>
            <p style="font-size: 10px; color: #64748b; margin-top: 25px; text-transform: uppercase;">Это автоматическое сообщение. Не отвечайте на него.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ [EMAIL_SUCCESS] Verification code sent to ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('❌ [EMAIL_ERROR] SMTP Error:', error);
    return { 
      success: false, 
      error: 'TRANSMISSION_FAILED', 
      message: error.message || 'Ошибка почтового сервера. Проверьте правильность пароля и настроек SMTP.'
    };
  }
}
