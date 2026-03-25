import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

function parsePhotos(entry: { photos: string }) {
  try { return JSON.parse(entry.photos); } catch { return []; }
}

function withPhotos<T extends { photos: string }>(entry: T) {
  return { ...entry, photos: parsePhotos(entry) };
}

// GET /api/history
router.get('/', async (_req, res: Response) => {
  const entries = await prisma.historyEntry.findMany({
    orderBy: { year: 'desc' },
    include: { event: { select: { name: true, type: true } } },
  });
  res.json({ data: entries.map(withPhotos) });
});

// GET /api/history/:id
router.get('/:id', async (req, res: Response) => {
  const entry = await prisma.historyEntry.findUnique({
    where: { id: req.params.id },
    include: { event: true },
  });
  if (!entry) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ data: withPhotos(entry) });
});

// POST /api/history
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { eventId, year, champion, recap, photos } = req.body;
  const entry = await prisma.historyEntry.create({
    data: { eventId, year, champion, recap, photos: JSON.stringify(photos || []) },
  });
  res.status(201).json({ data: withPhotos(entry) });
});

// PUT /api/history/:id
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { year, champion, recap, photos } = req.body;
  const entry = await prisma.historyEntry.update({
    where: { id: req.params.id },
    data: { year, champion, recap, photos: photos ? JSON.stringify(photos) : undefined },
  });
  res.json({ data: withPhotos(entry) });
});

export default router;
