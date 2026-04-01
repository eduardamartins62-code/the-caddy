import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate as requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Check if invite-only mode is on
async function isInviteOnly(): Promise<boolean> {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'invite_only' } });
  return setting?.value === 'true';
}

// Validate invite code
router.post('/validate', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  const invite = await prisma.inviteCode.findUnique({ where: { code: code.toUpperCase() } });
  if (!invite || !invite.isActive || invite.usedById) {
    return res.status(400).json({ error: 'Invalid or already used invite code' });
  }
  res.json({ valid: true });
});

// Check invite-only status (public)
router.get('/status', async (_req, res) => {
  const inviteOnly = await isInviteOnly();
  res.json({ inviteOnly });
});

// Waitlist signup
router.post('/waitlist', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    await prisma.waitlist.create({ data: { email } });
    res.json({ success: true });
  } catch {
    res.status(409).json({ error: 'Already on waitlist' });
  }
});

// Admin: generate invite code
router.post('/generate', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const invite = await prisma.inviteCode.create({ data: { code, createdById: req.user!.id } });
  res.json(invite);
});

// Admin: list all codes
router.get('/codes', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const codes = await prisma.inviteCode.findMany({
    include: { createdBy: { select: { name: true } }, usedBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(codes);
});

// Admin: toggle invite-only mode
router.put('/toggle', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const { enabled } = req.body;
  await prisma.appSetting.upsert({
    where: { key: 'invite_only' },
    update: { value: String(enabled) },
    create: { key: 'invite_only', value: String(enabled) },
  });
  res.json({ inviteOnly: enabled });
});

export default router;
