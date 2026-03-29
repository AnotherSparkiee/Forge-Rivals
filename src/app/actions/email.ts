
'use server';

/**
 * @fileOverview Server actions for handling email-related logic.
 */

/**
 * Simulates sending a verification email by logging the code to the server console.
 * In a real production app, this would use a service like Resend, SendGrid, or AWS SES.
 */
export async function sendVerificationEmail(email: string, code: string) {
  // LOGGING TO SERVER TERMINAL (Visible in the dashboard/terminal logs)
  const logMessage = `
  ╔════════════════════════════════════════════════════════════╗
  ║                                                            ║
  ║   [MOBA TACTICS] EMAIL VERIFICATION SYSTEM                 ║
  ║                                                            ║
  ║   TO: ${email}                                     
  ║   SUBJECT: Your Tactical Access Code                       ║
  ║                                                            ║
  ║   YOUR CODE: ${code}                                        ║
  ║                                                            ║
  ║   STATUS: SIMULATED TRANSMISSION SUCCESSFUL                ║
  ║   NOTE: This code is visible ONLY in the server logs.      ║
  ║                                                            ║
  ╚════════════════════════════════════════════════════════════╝
  `;

  console.log(logMessage);
  // Using error console as well to ensure visibility in some log aggregators
  console.error(`[VERIFICATION_CODE] for ${email}: ${code}`);

  return { success: true };
}
