import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOTPEmail(email: string, code: string): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'The Caddy <noreply@thecaddy.app>',
    to: email,
    subject: `Your The Caddy login code: ${code}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; background: #1B4332; padding: 40px; border-radius: 12px;">
        <h1 style="color: #D4AF37; font-size: 28px; margin: 0 0 8px;">The Caddy</h1>
        <p style="color: #F5F5DC; font-size: 14px; margin: 0 0 32px;">Your golf social platform</p>
        <div style="background: #0d2b20; border: 1px solid #D4AF37; border-radius: 8px; padding: 24px; text-align: center;">
          <p style="color: #F5F5DC; margin: 0 0 12px; font-size: 14px;">Your one-time login code</p>
          <p style="color: #D4AF37; font-size: 42px; font-weight: bold; letter-spacing: 12px; margin: 0;">${code}</p>
          <p style="color: #999; font-size: 12px; margin: 12px 0 0;">Expires in 10 minutes</p>
        </div>
        <p style="color: #666; font-size: 12px; margin: 24px 0 0; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}
