import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function sendOTPEmail(email: string, code: string): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    console.log(`[DEV] OTP for ${email}: ${code}`);
    return;
  }

  const from = process.env.SENDGRID_FROM_EMAIL || 'noreply@thecaddy.app';

  await sgMail.send({
    to: email,
    from: { email: from, name: 'The Caddy' },
    subject: `Your The Caddy login code: ${code}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; background: #111; padding: 40px; border-radius: 12px;">
        <h1 style="color: #C9F31D; font-size: 28px; margin: 0 0 8px;">The Caddy</h1>
        <p style="color: #aaa; font-size: 14px; margin: 0 0 32px;">Your golf social platform</p>
        <div style="background: #1a1a1a; border: 1px solid #C9F31D; border-radius: 8px; padding: 32px; text-align: center;">
          <p style="color: #ccc; margin: 0 0 16px; font-size: 14px;">Your one-time login code</p>
          <p style="color: #C9F31D; font-size: 48px; font-weight: bold; letter-spacing: 14px; margin: 0;">${code}</p>
          <p style="color: #666; font-size: 12px; margin: 16px 0 0;">Expires in 10 minutes</p>
        </div>
        <p style="color: #555; font-size: 12px; margin: 24px 0 0; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
    text: `Your The Caddy login code is: ${code}\n\nThis code expires in 10 minutes.`,
  });
}
