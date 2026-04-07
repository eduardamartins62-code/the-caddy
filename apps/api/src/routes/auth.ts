import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { sendOTPEmail } from '../lib/email';

const router = Router();

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isPhone(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 && !/[@.]/.test(input);
}

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  return '+' + digits;
}

const USER_SELECT = {
  id: true, email: true, phone: true, name: true, username: true, avatar: true,
  bio: true, handicap: true, homeCourse: true, location: true,
  role: true, createdAt: true, isOnboarded: true, isPrivate: true,
};

// POST /api/auth/request-otp
router.post('/request-otp', async (req: Request, res: Response) => {
  const { email, phone } = req.body as { email?: string; phone?: string };

  const raw = (email || phone || '').trim();
  if (!raw) {
    res.status(400).json({ error: 'Email or phone number required' });
    return;
  }

  const usePhone = isPhone(raw);
  const isEmail  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);

  if (!usePhone && !isEmail) {
    res.status(400).json({ error: 'Enter a valid email or phone number' });
    return;
  }

  const code      = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  if (usePhone) {
    const normalized = normalizePhone(raw);
    await prisma.user.upsert({
      where:  { phone: normalized },
      update: { otpCode: code, otpExpiresAt: expiresAt },
      create: {
        email: `phone_${normalized.replace(/\+/g, '')}@thecaddy.local`,
        phone: normalized,
        name: '',
        isOnboarded: false,
        otpCode: code,
        otpExpiresAt: expiresAt,
      },
    });

    console.log(`\n[DEV] SMS OTP for ${normalized}: ${code}\n`);
    res.json({ message: 'OTP sent', via: 'sms', contact: normalized });
    return;
  }

  // Email path
  const emailLower = raw.toLowerCase();
  await prisma.user.upsert({
    where:  { email: emailLower },
    update: { otpCode: code, otpExpiresAt: expiresAt },
    create: {
      email: emailLower,
      name: '',
      isOnboarded: false,
      otpCode: code,
      otpExpiresAt: expiresAt,
    },
  });

  console.log(`\n[DEV] OTP for ${emailLower}: ${code}\n`);

  // Fire-and-forget — don't block the response on SMTP delivery
  sendOTPEmail(emailLower, code).catch(() => { /* SMTP not configured */ });

  res.json({ message: 'OTP sent to email', via: 'email', contact: emailLower });
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req: Request, res: Response) => {
  const { email, phone, code } = req.body as { email?: string; phone?: string; code: string };

  const raw = (email || phone || '').trim();
  if (!raw || !code) {
    res.status(400).json({ error: 'Contact and code required' });
    return;
  }

  let user;
  if (isPhone(raw)) {
    const normalized = normalizePhone(raw);
    user = await prisma.user.findUnique({ where: { phone: normalized } });
  } else {
    user = await prisma.user.findUnique({ where: { email: raw.toLowerCase() } });
  }

  if (!user) {
    res.status(400).json({ error: 'Invalid code' });
    return;
  }

  if (user.otpCode !== code || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    res.status(400).json({ error: 'Invalid or expired code' });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data:  { otpCode: null, otpExpiresAt: null },
  });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any
  );

  res.json({
    token,
    user: {
      id:                 user.id,
      email:              user.email,
      phone:              user.phone,
      name:               user.name,
      username:           user.username,
      avatar:             user.avatar,
      bio:                user.bio,
      handicap:           user.handicap,
      homeCourse:         user.homeCourse,
      location:           user.location,
      role:               user.role,
      isOnboarded: user.isOnboarded,
      isPrivate:          user.isPrivate,
      createdAt:          user.createdAt,
    },
  });
});

// POST /api/auth/social  — Google or Apple OAuth
router.post('/social', async (req: Request, res: Response) => {
  const { provider, token } = req.body as { provider: 'google' | 'apple'; token: string };
  if (!provider || !token) {
    res.status(400).json({ error: 'provider and token required' });
    return;
  }

  let email: string | null = null;
  let name: string | null  = null;
  let avatar: string | null = null;
  let googleId: string | null = null;
  let appleId: string | null = null;

  try {
    if (provider === 'google') {
      const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) { res.status(401).json({ error: 'Invalid Google token' }); return; }
      const info = await resp.json() as { email?: string; name?: string; picture?: string; sub?: string };
      email    = info.email ?? null;
      name     = info.name  ?? null;
      avatar   = info.picture ?? null;
      googleId = info.sub ?? null;
    } else if (provider === 'apple') {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString('utf8')
      );
      email   = payload.email ?? null;
      appleId = payload.sub ?? null;
    }
  } catch {
    res.status(401).json({ error: 'Failed to verify social token' });
    return;
  }

  if (!email) {
    res.status(400).json({ error: 'Could not retrieve email from provider' });
    return;
  }

  const emailLower = email.toLowerCase();
  const user = await prisma.user.upsert({
    where:  { email: emailLower },
    update: {
      ...(avatar   ? { avatar }   : {}),
      ...(googleId ? { googleId } : {}),
      ...(appleId  ? { appleId }  : {}),
    },
    create: {
      email:              emailLower,
      name:               name ?? '',
      avatar:             avatar ?? null,
      googleId:           googleId ?? null,
      appleId:            appleId ?? null,
      isOnboarded: false,
    },
    select: USER_SELECT,
  });

  const jwtToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any
  );

  res.json({ token: jwtToken, user });
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: 'Token required' });
    return;
  }

  try {
    // Verify allowing expired tokens within a 7-day grace window
    const payload = jwt.verify(token, process.env.JWT_SECRET!, {
      ignoreExpiration: true,
    }) as { id: string; email: string; role: string; exp?: number; iat?: number };

    // Reject if token is more than 7 days past expiry
    const now = Math.floor(Date.now() / 1000);
    const gracePeriod = 7 * 24 * 60 * 60; // 7 days in seconds
    if (payload.exp && now - payload.exp > gracePeriod) {
      res.status(401).json({ error: 'Token expired beyond grace period' });
      return;
    }

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: USER_SELECT,
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const newToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as any
    );

    res.json({ token: newToken, user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  // Stateless JWT — client deletes token; nothing to invalidate server-side
  res.json({ message: 'Logged out' });
});

export default router;
