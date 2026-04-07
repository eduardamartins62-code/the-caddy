import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/history
router.get('/', async (_req, res: Response) => {
  const entries = await prisma.historyEntry.findMany({
    orderBy: { year: 'desc' },
    include: {
      event: { select: { name: true, type: true } },
      historyPhotos: true,
    },
  });
  res.json({ data: entries });
});

// GET /api/history/:id
router.get('/:id', async (req, res: Response) => {
  const entry = await prisma.historyEntry.findUnique({
    where: { id: req.params.id },
    include: { event: true, historyPhotos: true },
  });
  if (!entry) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ data: entry });
});

// POST /api/history
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { eventId, year, championName, championId, courseId, winningScore, coursePlayed, recap } = req.body;
  if (!championName) { res.status(400).json({ error: 'championName is required' }); return; }
  const entry = await prisma.historyEntry.create({
    data: { eventId, year, championName, championId, courseId, winningScore, coursePlayed, recap },
    include: { historyPhotos: true },
  });
  res.status(201).json({ data: entry });
});

// PUT /api/history/:id
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { year, championName, championId, courseId, winningScore, coursePlayed, recap } = req.body;
  const entry = await prisma.historyEntry.update({
    where: { id: req.params.id },
    data: {
      ...(year !== undefined         ? { year }         : {}),
      ...(championName !== undefined ? { championName } : {}),
      ...(championId !== undefined   ? { championId }   : {}),
      ...(courseId !== undefined     ? { courseId }     : {}),
      ...(winningScore !== undefined ? { winningScore } : {}),
      ...(coursePlayed !== undefined ? { coursePlayed } : {}),
      ...(recap !== undefined        ? { recap }        : {}),
    },
    include: { historyPhotos: true },
  });
  res.json({ data: entry });
});

export default router;
