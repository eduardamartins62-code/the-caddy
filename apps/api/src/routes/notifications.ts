import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/notifications
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const notes = await prisma.notification.findMany({
    where:   { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take:    50,
  });
  res.json({ data: notes });
});

// GET /api/notifications/unread-count
router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response) => {
  const count = await prisma.notification.count({
    where: { userId: req.user!.id, isRead: false },
  });
  res.json({ data: { count } });
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id },
    data:  { isRead: true },
  });
  res.json({ data: { success: true } });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!n) { res.status(404).json({ error: 'Notification not found' }); return; }
  if (n.userId !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return; }

  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data:  { isRead: true },
  });
  res.json({ data: updated });
});

// DELETE /api/notifications/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!n) { res.status(404).json({ error: 'Notification not found' }); return; }
  if (n.userId !== req.user!.id && req.user!.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  await prisma.notification.delete({ where: { id: req.params.id } });
  res.json({ message: 'Notification deleted' });
});

export default router;
