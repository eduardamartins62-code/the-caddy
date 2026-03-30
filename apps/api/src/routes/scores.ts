import { Router, Response } from 'express';
import { io } from '../index';
import prisma from '../lib/prisma';
import { emitLeaderboardUpdate } from '../lib/socket';
import { authenticate, requireScorekeeper, AuthRequest } from '../middleware/auth';

const router = Router();

async function buildAndEmitLeaderboard(roundId: string) {
  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) return;

  const event = await prisma.event.findUnique({
    where:   { id: round.eventId },
    include: {
      participants: { where: { status: 'ACCEPTED' }, include: { user: true } },
      rounds:       { include: { scores: true, holes: true } },
    },
  });
  if (!event) return;

  const leaderboard = event.participants.map(p => {
    const u        = p.user;
    const handicap = u.handicap || 0;
    let grossScore = 0;
    const roundScores: Record<string, number> = {};
    for (const r of event.rounds) {
      const userScores = r.scores.filter(s => s.userId === u.id);
      const rg = userScores.reduce((sum, s) => sum + s.strokes, 0);
      if (rg > 0) { roundScores[r.id] = rg; grossScore += rg; }
    }
    return {
      user:       { id: u.id, name: u.name, avatar: u.avatar },
      grossScore, netScore: grossScore - handicap, roundScores,
    };
  });

  const sorted = leaderboard.sort((a, b) => a.netScore - b.netScore).map((e, i) => ({ rank: i + 1, ...e }));
  emitLeaderboardUpdate(io, event.id, sorted);
}

// POST /api/scores — submit or update a hole score
router.post('/', authenticate, requireScorekeeper, async (req: AuthRequest, res: Response) => {
  const { roundId, userId, holeNumber, strokes, fairwayHit, greenInReg, putts } = req.body as {
    roundId:    string;
    userId:     string;
    holeNumber: number;
    strokes:    number;
    fairwayHit?: boolean | null;
    greenInReg?: boolean | null;
    putts?:      number | null;
  };

  const score = await prisma.score.upsert({
    where:  { roundId_userId_holeNumber: { roundId, userId, holeNumber } },
    update: {
      strokes,
      ...(fairwayHit !== undefined ? { fairwayHit } : {}),
      ...(greenInReg !== undefined ? { greenInReg } : {}),
      ...(putts      !== undefined ? { putts }      : {}),
    },
    create: {
      roundId, userId, holeNumber, strokes,
      fairwayHit: fairwayHit ?? null,
      greenInReg: greenInReg ?? null,
      putts:      putts ?? null,
    },
  });

  await buildAndEmitLeaderboard(roundId);

  res.status(201).json({ data: score });
});

// GET /api/scores/round/:roundId — all scores for a round grouped by userId
router.get('/round/:roundId', async (req, res: Response) => {
  const scores = await prisma.score.findMany({
    where:   { roundId: req.params.roundId },
    orderBy: [{ userId: 'asc' }, { holeNumber: 'asc' }],
    include: { user: { select: { id: true, name: true, avatar: true, handicap: true } } },
  });

  // Group by userId
  const grouped: Record<string, any> = {};
  for (const score of scores) {
    if (!grouped[score.userId]) {
      grouped[score.userId] = { user: score.user, scores: [] };
    }
    grouped[score.userId].scores.push({
      id: score.id, holeNumber: score.holeNumber, strokes: score.strokes,
    });
  }

  res.json({ data: Object.values(grouped) });
});

// GET /api/scores/round/:roundId/user/:userId — one player's scores
router.get('/round/:roundId/user/:userId', async (req, res: Response) => {
  const scores = await prisma.score.findMany({
    where:   { roundId: req.params.roundId, userId: req.params.userId },
    orderBy: { holeNumber: 'asc' },
    include: { user: { select: { id: true, name: true, avatar: true, handicap: true } } },
  });
  res.json({ data: scores });
});

// DELETE /api/scores/:id — delete a score (SCOREKEEPER+)
router.delete('/:id', authenticate, requireScorekeeper, async (req: AuthRequest, res: Response) => {
  const score = await prisma.score.findUnique({ where: { id: req.params.id } });
  if (!score) { res.status(404).json({ error: 'Score not found' }); return; }

  await prisma.score.delete({ where: { id: req.params.id } });
  await buildAndEmitLeaderboard(score.roundId);

  res.json({ message: 'Score deleted' });
});

export default router;
