import sgMail from '@sendgrid/mail';

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@thecaddy.app';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  console.log(`[DEV] OTP for ${email}: ${otp}`);

  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[Email] SENDGRID_API_KEY not set — OTP logged to console only');
    return;
  }

  await sgMail.send({
    to: email,
    from: FROM_EMAIL,
    subject: 'Your Caddy verification code',
    html: `
      <div style="background:#080C14;padding:40px;font-family:sans-serif;max-width:480px;margin:0 auto;border-radius:12px;border:1px solid rgba(212,168,67,0.2)">
        <h1 style="color:#D4A843;font-size:24px;margin-bottom:8px;letter-spacing:2px">THE CADDY</h1>
        <p style="color:#8A8FA8;margin-bottom:32px">Your game. Your people.</p>
        <p style="color:#F4EFE6;font-size:16px;margin-bottom:16px">Your verification code:</p>
        <div style="background:#1E2640;border-radius:12px;padding:24px;text-align:center;margin-bottom:32px;border:1px solid rgba(212,168,67,0.3)">
          <span style="font-family:monospace;font-size:40px;letter-spacing:12px;color:#D4A843;font-weight:700">${otp}</span>
        </div>
        <p style="color:#8A8FA8;font-size:13px">This code expires in 10 minutes. Do not share it.</p>
      </div>
    `,
  });
}

// Keep backward-compatible alias
export const sendOTPEmail = sendOtpEmail;
