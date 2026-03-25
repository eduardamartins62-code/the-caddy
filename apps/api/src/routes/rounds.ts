import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireScorekeeper, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/rounds
router.post('/', authenticate, requireScorekeeper, async (req: AuthRequest, res: Response) => {
  const { eventId, courseId, courseName, coursePhoto, date, holes } = req.body as {
    eventId:     string;
    courseId?:   string;
    courseName:  string;
    coursePhoto?: string;
    date:        string;
    holes:       { holeNumber: number; par: number }[];
  };

  const round = await prisma.round.create({
    data: {
      eventId,
      courseId:   courseId || null,
      courseName,
      coursePhoto: coursePhoto || null,
      date:        new Date(date),
      holes: {
        create: holes.map(h => ({ holeNumber: h.holeNumber, par: h.par })),
      },
    },
    include: { holes: true },
  });
  res.status(201).json({ data: round });
});

// GET /api/rounds/:id
router.get('/:id', async (req, res: Response) => {
  const round = await prisma.round.findUnique({
    where:   { id: req.params.id },
    include: { holes: { orderBy: { holeNumber: 'asc' } } },
  });
  if (!round) { res.status(404).json({ error: 'Round not found' }); return; }
  res.json({ data: round });
});

// PUT /api/rounds/:id — update round metadata (SCOREKEEPER+)
router.put('/:id', authenticate, requireScorekeeper, async (req: AuthRequest, res: Response) => {
  const { date, status, courseId, courseName, isComplete } = req.body;

  const round = await prisma.round.update({
    where: { id: req.params.id },
    data: {
      ...(date        ? { date: new Date(date) } : {}),
      ...(status      !== undefined ? { status }      : {}),
      ...(courseId    !== undefined ? { courseId }    : {}),
      ...(courseName  !== undefined ? { courseName }  : {}),
      ...(isComplete  !== undefined ? { isComplete }  : {}),
    },
    include: { holes: { orderBy: { holeNumber: 'asc' } } },
  });
  res.json({ data: round });
});

// DELETE /api/rounds/:id — organizer only, emits round:status
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const round = await prisma.round.findUnique({
    where:   { id: req.params.id },
    include: { event: true },
  });
  if (!round) { res.status(404).json({ error: 'Round not found' }); return; }

  const isOrganizer = round.event.createdBy === req.user!.id;
  const isAdmin     = req.user!.role === 'SUPER_ADMIN';
  if (!isOrganizer && !isAdmin) {
    res.status(403).json({ error: 'Only the organizer can delete a round' }); return;
  }

  await prisma.round.delete({ where: { id: req.params.id } });

  // Emit round:status event
  try {
    const { io } = await import('../index');
    io.to(`event:${round.eventId}`).emit('round:status', {
      roundId: req.params.id,
      status:  'deleted',
      eventId: round.eventId,
    });
  } catch { /* socket not available */ }

  res.json({ message: 'Round deleted' });
});

// GET /api/rounds/:id/scorecard
router.get('/:id/scorecard', async (req, res: Response) => {
  const round = await prisma.round.findUnique({
    where:   { id: req.params.id },
    include: {
      holes:  { orderBy: { holeNumber: 'asc' } },
      scores: { include: { user: { select: { id: true, name: true, avatar: true, handicap: true } } } },
      event: {
        include: {
          participants: {
            where:   { status: 'ACCEPTED' },
            include: { user: { select: { id: true, name: true, avatar: true, handicap: true } } },
          },
        },
      },
    },
  });
  if (!round) { res.status(404).json({ error: 'Round not found' }); return; }

  const scoresByUser: Record<string, typeof round.scores> = {};
  for (const score of round.scores) {
    if (!scoresByUser[score.userId]) scoresByUser[score.userId] = [];
    scoresByUser[score.userId].push(score);
  }

  const players = round.event.participants.map(p => p.user);
  res.json({ data: { round, holes: round.holes, scores: scoresByUser, players } });
});

export default router;
