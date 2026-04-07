import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate as any);
router.use(requireAdmin as any);

// GET /api/admin/users — list all users with roles
router.get('/users', async (_req, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, username: true, email: true, phone: true,
      role: true, avatar: true, createdAt: true, isOnboarded: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: users });
});

// PUT /api/admin/users/:id/role — change user role
router.put('/users/:id/role', async (req: AuthRequest, res: Response) => {
  const { role } = req.body as { role: string };
  const allowed = ['USER', 'SCOREKEEPER', 'SUPER_ADMIN'];
  if (!allowed.includes(role)) {
    res.status(400).json({ error: `Invalid role. Allowed: ${allowed.join(', ')}` });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const updated = await prisma.user.update({
    where:  { id: req.params.id },
    data:   { role },
    select: { id: true, name: true, email: true, role: true },
  });
  res.json({ data: updated });
});

// GET /api/admin/invites
router.get('/invites', authenticate, requireAdmin, async (req, res: Response) => {
  const codes = await prisma.inviteCode.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: codes });
});

// POST /api/admin/invites — generate code
router.post('/invites', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const invite = await prisma.inviteCode.create({ data: { code, createdById: req.user!.id } });
  res.json({ data: invite });
});

// GET /api/admin/waitlist
router.get('/waitlist', authenticate, requireAdmin, async (req, res: Response) => {
  const list = await prisma.waitlist.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: list });
});

// GET /api/admin/settings
router.get('/settings', authenticate, requireAdmin, async (req, res: Response) => {
  const settings = await prisma.appSetting.findMany();
  const obj = Object.fromEntries(settings.map((s: any) => [s.key, s.value]));
  res.json({ data: obj });
});

// PUT /api/admin/settings
router.put('/settings', authenticate, requireAdmin, async (req, res: Response) => {
  const { inviteOnly } = req.body;
  await prisma.appSetting.upsert({
    where: { key: 'inviteOnly' },
    update: { value: String(inviteOnly) },
    create: { key: 'inviteOnly', value: String(inviteOnly) },
  });
  res.json({ success: true });
});

// GET /api/admin/stats — platform stats
router.get('/stats', async (_req, res: Response) => {
  const [totalUsers, totalEvents, totalRounds, totalScores, totalPosts, totalMessages] =
    await Promise.all([
      prisma.user.count(),
      prisma.event.count(),
      prisma.round.count(),
      prisma.score.count(),
      prisma.socialPost.count(),
      prisma.message.count(),
    ]);

  const usersByRole = await prisma.user.groupBy({
    by:     ['role'],
    _count: { role: true },
  });

  const eventsByStatus = await prisma.event.groupBy({
    by:     ['status'],
    _count: { status: true },
  });

  res.json({
    data: {
      totalUsers,
      totalEvents,
      totalRounds,
      totalScores,
      totalPosts,
      totalMessages,
      usersByRole:    usersByRole.map(r => ({ role: r.role, count: r._count.role })),
      eventsByStatus: eventsByStatus.map(e => ({ status: e.status, count: e._count.status })),
    },
  });
});

export default router;
