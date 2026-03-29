
'use server';

/**
 * @fileOverview Server actions for handling email-related logic.
 */

/**
 * Simulates sending a verification email by logging the code to the server console.
 * In a real production app, this would use a service like Resend, SendGrid, or AWS SES.
 */
export async function sendVerificationEmail(email: string, code: string) {
  // LOGGING TO SERVER TERMINAL (Not visible to the user in the browser)
  console.log(`
  ╔════════════════════════════════════════════════════════════╗
  ║                                                            ║
  ║   [MOBA TACTICS] EMAIL VERIFICATION SYSTEM                 ║
  ║                                                            ║
  ║   TO: ${email}                                     
  ║   SUBJECT: Your Tactical Access Code                       ║
  ║                                                            ║
  ║   YOUR CODE: ${code}                                        ║
  ║                                                            ║
  ║   Please enter this code in the game terminal to verify.   ║
  ║                                                            ║
  ╚════════════════════════════════════════════════════════════╝
  `);

  // To truly send an email, uncomment and configure a provider:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({ ... });

  return { success: true };
}
