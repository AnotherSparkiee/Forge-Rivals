'use server';

import nodemailer from 'nodemailer';

/**
 * @fileOverview Server actions for handling real email sending via SMTP.
 */

export async function sendVerificationEmail(email: string, code: string) {
  // CRITICAL: Ensure SMTP credentials exist in .env
  const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
  const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;

  if (!SMTP_USER || !SMTP_PASS) {
    console.error('ERROR: SMTP credentials missing in environment variables.');
    // Fallback for development visibility
    console.warn(`[VERIFICATION_CODE_FALLBACK] for ${email}: ${code}`);
    return { 
      success: false, 
      error: 'SMTP_CONFIG_MISSING', 
      message: 'Server mail configuration is incomplete.' 
    };
  }

  // Create reusable transporter object using the default SMTP transport
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"MOBA Tactics Admin" <${SMTP_USER}>`,
    to: email,
    subject: 'Tactical Access Code - Identity Verification',
    text: `Your verification code is: ${code}. Welcome to the league, Commander.`,
    html: `
      <div style="font-family: 'Inter', sans-serif; background-color: #0a0e14; color: #ffffff; padding: 40px; border-radius: 12px; max-width: 500px; margin: 0 auto; border: 1px solid #1e293b;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; font-size: 28px; font-weight: 800; letter-spacing: -1px; margin: 0; text-transform: uppercase;">MOBA TACTICS</h1>
          <p style="color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-top: 5px;">Operational Security Protocol</p>
        </div>
        
        <p style="font-size: 14px; line-height: 1.6; color: #e2e8f0; text-align: center;">
          Commander, your credentials have been synchronized. To finalize profile initialization, use the following access key:
        </p>
        
        <div style="background-color: #1e293b; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
          <span style="font-size: 42px; font-weight: 900; letter-spacing: 8px; color: #22d3ee; font-family: monospace;">${code}</span>
        </div>
        
        <div style="background-color: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 30px;">
          <p style="font-size: 11px; color: #94a3b8; margin: 0;">
            <strong>NOTICE:</strong> This code is valid for 15 minutes. If you did not initiate this request, secure your email account immediately.
          </p>
        </div>
        
        <div style="text-align: center; border-top: 1px solid #1e293b; pt: 20px;">
          <p style="font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 1px;">
            Sync established via Command Center
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL_SENT] Verification code dispatched to ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('CRITICAL: Email transmission failed:', error);
    return { 
      success: false, 
      error: 'TRANSMISSION_FAILED', 
      message: error.message 
    };
  }
}
