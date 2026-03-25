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
      role: true, avatar: true, createdAt: true, onboardingComplete: true,
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
