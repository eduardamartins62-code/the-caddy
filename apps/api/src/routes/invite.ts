import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate as requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Check if invite-only mode is on
async function isInviteOnly(): Promise<boolean> {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'invite_only' } });
  return setting?.value === 'true';
}

// Validate invite code
router.post('/validate', async (req, res: Response) => {
  const { code } = req.body;
  if (!code) { res.json({ valid: false }); return; }
  const invite = await prisma.inviteCode.findUnique({ where: { code: code.toUpperCase() } });
  res.json({ valid: !!(invite?.isActive && !invite.usedById) });
});

// Check invite-only status (public)
router.get('/status', async (_req, res) => {
  const inviteOnly = await isInviteOnly();
  res.json({ inviteOnly });
});

// Waitlist signup
router.post('/waitlist', async (req, res: Response) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: 'Email required' }); return; }
  try {
    await prisma.waitlist.upsert({ where: { email }, update: {}, create: { email } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
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

// GET /api/invite/settings — returns { inviteOnly: boolean }
router.get('/settings', async (_req, res) => {
  const inviteOnly = await isInviteOnly();
  res.json({ inviteOnly });
});

// GET /api/invite/waitlist — SUPER_ADMIN lists waitlist
router.get('/waitlist', requireAuth, async (req: AuthRequest, res) => {
  if (req.user!.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const waitlist = await prisma.waitlist.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(waitlist);
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
