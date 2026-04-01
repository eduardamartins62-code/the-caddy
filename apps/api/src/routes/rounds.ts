import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireScorekeeper, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/rounds
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { eventId, courseName, courseId, date, holes, roundNumber } = req.body;
    if (!eventId || !courseName || !date) {
      res.status(400).json({ error: 'eventId, courseName, and date are required' }); return;
    }

    // Check permission: must be event organizer or SCOREKEEPER participant
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) { res.status(404).json({ error: 'Event not found' }); return; }

    const isOrganizer = event.createdBy === req.user!.id;
    const isScorekeeper = await prisma.eventParticipant.findFirst({
      where: { eventId, userId: req.user!.id, role: 'SCOREKEEPER' }
    });
    if (!isOrganizer && !isScorekeeper) {
      res.status(403).json({ error: 'Only the event organizer or scorekeeper can create rounds' }); return;
    }

    const round = await prisma.round.create({
      data: {
        eventId,
        courseName,
        courseId,
        date: new Date(date),
        roundNumber,
        holes: holes?.length ? {
          create: holes.map((h: { holeNumber: number; par: number }) => ({
            holeNumber: h.holeNumber,
            par: h.par,
          }))
        } : undefined,
      },
      include: { holes: true },
    });
    res.status(201).json({ data: round });
  } catch (err) {
    console.error('POST /rounds error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rounds/active — get the user's currently active (in-progress) round
router.get('/active', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const round = await prisma.round.findFirst({
      where: {
        isComplete: false,
        event: {
          participants: { some: { userId: req.user!.id, status: 'ACCEPTED' } },
        },
      },
      include: {
        event:  { select: { id: true, name: true } },
        scores: { where: { userId: req.user!.id } },
        holes:  true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!round) { res.json({ data: null }); return; }

    const userScores  = round.scores;
    const holesPlayed = userScores.length;
    const gross       = userScores.reduce((sum, s) => sum + s.strokes, 0);
    const parThru     = round.holes
      .filter(h => userScores.some(s => s.holeNumber === h.holeNumber))
      .reduce((sum, h) => sum + h.par, 0);
    const toPar = gross - parThru;

    res.json({ data: { round, holesPlayed, gross, toPar } });
  } catch (err) {
    console.error('GET /rounds/active error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rounds/:id
router.get('/:id', async (req, res: Response) => {
  const round = await prisma.round.findUnique({
    where:   { id: req.params.id },
    include: {
      holes: { orderBy: { holeNumber: 'asc' } },
      event: { select: { id: true, name: true } },
    },
  });
  if (!round) { res.status(404).json({ error: 'Round not found' }); return; }
  res.json({ data: round });
});

// PUT /api/rounds/:id — update round metadata (organizer or SCOREKEEPER)
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const round = await prisma.round.findUnique({ where: { id: req.params.id }, include: { event: true } });
  if (!round) { res.status(404).json({ error: 'Round not found' }); return; }
  const isOrganizer = round.event.createdBy === req.user!.id;
  const isScorekeeper = await prisma.eventParticipant.findFirst({
    where: { eventId: round.eventId, userId: req.user!.id, role: 'SCOREKEEPER' }
  });
  if (!isOrganizer && !isScorekeeper) { res.status(403).json({ error: 'Insufficient permissions' }); return; }

  const { date, status, courseId, courseName, isComplete } = req.body;

  const updated = await prisma.round.update({
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
  res.json({ data: updated });
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

// GET /api/rounds/:id/stats — post-round statistics
router.get('/:id/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const round = await prisma.round.findUnique({
      where:   { id: req.params.id },
      include: {
        holes:  { orderBy: { holeNumber: 'asc' } },
        scores: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!round) { res.status(404).json({ error: 'Round not found' }); return; }

    const holeParMap = new Map<number, number>();
    for (const h of round.holes) holeParMap.set(h.holeNumber, h.par);

    // Group scores by userId
    const byUser = new Map<string, { userId: string; name: string; scores: typeof round.scores }>();
    for (const score of round.scores) {
      if (!byUser.has(score.userId)) {
        byUser.set(score.userId, { userId: score.userId, name: score.user.name, scores: [] });
      }
      byUser.get(score.userId)!.scores.push(score);
    }

    let totalScore    = 0;
    let totalPar      = 0;
    let holesPlayed   = 0;
    let eagles        = 0;
    let birdies       = 0;
    let pars          = 0;
    let bogeys        = 0;
    let doubles       = 0;
    let triplePlus    = 0;
    let fairwaysHit   = 0;
    let fairwaysTotal = 0;
    let greensInReg   = 0;
    let greensTotal   = 0;
    let totalPutts    = 0;
    let puttsHoles    = 0;

    // Aggregate across all players and holes
    for (const score of round.scores) {
      const par = holeParMap.get(score.holeNumber);
      if (!par) continue;
      const diff = score.strokes - par;
      totalScore += score.strokes;
      totalPar   += par;
      holesPlayed++;
      if (diff <= -2)     eagles++;
      else if (diff === -1) birdies++;
      else if (diff === 0)  pars++;
      else if (diff === 1)  bogeys++;
      else if (diff === 2)  doubles++;
      else                  triplePlus++;

      if (score.fairwayHit !== null && score.fairwayHit !== undefined && par > 3) {
        fairwaysTotal++;
        if (score.fairwayHit) fairwaysHit++;
      }
      greensTotal++;
      if (score.greenInReg) greensInReg++;

      if (score.putts !== null && score.putts !== undefined) {
        totalPutts += score.putts;
        puttsHoles++;
      }
    }

    const scoreToPar   = totalScore - totalPar;
    const fairwayPct   = fairwaysTotal > 0 ? Math.round((fairwaysHit / fairwaysTotal) * 1000) / 10 : 0;
    const girPct       = greensTotal   > 0 ? Math.round((greensInReg / greensTotal)   * 1000) / 10 : 0;
    const puttsPerHole = puttsHoles    > 0 ? Math.round((totalPutts  / puttsHoles)    * 100)  / 100 : 0;

    // Per-player stats
    const perPlayerStats = Array.from(byUser.values()).map(player => {
      let pTotalScore = 0, pPar = 0;
      let pBirdies = 0, pPars = 0, pBogeys = 0, pDoubles = 0, pTriplePlus = 0;
      let pFairwaysHit = 0, pFairwaysTotal = 0, pGreensInReg = 0, pTotalPutts = 0;

      for (const score of player.scores) {
        const par = holeParMap.get(score.holeNumber);
        if (!par) continue;
        const diff = score.strokes - par;
        pTotalScore += score.strokes;
        pPar        += par;
        if (diff === -1)  pBirdies++;
        else if (diff === 0) pPars++;
        else if (diff === 1) pBogeys++;
        else if (diff === 2) pDoubles++;
        else if (diff >= 3)  pTriplePlus++;

        if (score.fairwayHit !== null && score.fairwayHit !== undefined && par > 3) {
          pFairwaysTotal++;
          if (score.fairwayHit) pFairwaysHit++;
        }
        if (score.greenInReg) pGreensInReg++;
        if (score.putts !== null && score.putts !== undefined) pTotalPutts += score.putts;
      }

      return {
        userId:       player.userId,
        name:         player.name,
        totalScore:   pTotalScore,
        scoreToPar:   pTotalScore - pPar,
        birdies:      pBirdies,
        pars:         pPars,
        bogeys:       pBogeys,
        doubles:      pDoubles,
        triplePlus:   pTriplePlus,
        fairwaysHit:  pFairwaysHit,
        fairwaysTotal: pFairwaysTotal,
        greensInReg:  pGreensInReg,
        totalPutts:   pTotalPutts,
      };
    });

    res.json({
      data: {
        totalScore, scoreToPar, holesPlayed,
        eagles, birdies, pars, bogeys, doubles, triplePlus,
        fairwaysHit, fairwaysTotal, fairwayPct,
        greensInReg, greensTotal, girPct,
        totalPutts, puttsPerHole,
        perPlayerStats,
      },
    });
  } catch (err) {
    console.error('GET /rounds/:id/stats error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rounds/:id/skins — skins game results
router.get('/:id/skins', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const round = await prisma.round.findUnique({
      where:   { id: req.params.id },
      include: {
        holes:  { orderBy: { holeNumber: 'asc' } },
        scores: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!round) { res.status(404).json({ error: 'Round not found' }); return; }

    const holeParMap = new Map<number, number>();
    for (const h of round.holes) holeParMap.set(h.holeNumber, h.par);

    // Collect scores per hole
    const scoresByHole = new Map<number, { userId: string; name: string; strokes: number }[]>();
    for (const score of round.scores) {
      if (!scoresByHole.has(score.holeNumber)) scoresByHole.set(score.holeNumber, []);
      scoresByHole.get(score.holeNumber)!.push({
        userId:  score.userId,
        name:    score.user.name,
        strokes: score.strokes,
      });
    }

    const holeNumbers = Array.from(holeParMap.keys()).sort((a, b) => a - b);
    const skinsWon    = new Map<string, number>(); // userId -> skins won

    let carryover  = 0;
    const holeResults: {
      holeNumber: number;
      par: number;
      winner: string | null;
      winnerName: string | null;
      carryover: boolean;
      skinValue: number;
      scores: { userId: string; name: string; strokes: number }[];
    }[] = [];

    for (const holeNumber of holeNumbers) {
      const par     = holeParMap.get(holeNumber) ?? 4;
      const entries = scoresByHole.get(holeNumber) ?? [];
      const skinValue = 1 + carryover;

      if (entries.length === 0) {
        holeResults.push({ holeNumber, par, winner: null, winnerName: null, carryover: false, skinValue, scores: [] });
        continue;
      }

      const minStrokes = Math.min(...entries.map(e => e.strokes));
      const tied       = entries.filter(e => e.strokes === minStrokes);

      if (tied.length === 1) {
        const winner = tied[0];
        skinsWon.set(winner.userId, (skinsWon.get(winner.userId) ?? 0) + skinValue);
        holeResults.push({ holeNumber, par, winner: winner.userId, winnerName: winner.name, carryover: false, skinValue, scores: entries });
        carryover = 0;
      } else {
        // Tie — skin carries over
        holeResults.push({ holeNumber, par, winner: null, winnerName: null, carryover: true, skinValue, scores: entries });
        carryover++;
      }
    }

    // Build per-player totals
    const playerSkins = Array.from(skinsWon.entries()).map(([userId, skins]) => {
      const name = round.scores.find(s => s.userId === userId)?.user.name ?? '';
      return { userId, name, skinsWon: skins };
    });

    res.json({ data: { holes: holeResults, playerSkins } });
  } catch (err) {
    console.error('GET /rounds/:id/skins error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rounds/:id/nassau — Nassau betting results
router.get('/:id/nassau', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const round = await prisma.round.findUnique({
      where:   { id: req.params.id },
      include: {
        holes:  { orderBy: { holeNumber: 'asc' } },
        scores: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!round) { res.status(404).json({ error: 'Round not found' }); return; }

    // Collect total strokes per player per segment
    const playerMap = new Map<string, { userId: string; name: string; front: number; back: number; total: number }>();

    for (const score of round.scores) {
      if (!playerMap.has(score.userId)) {
        playerMap.set(score.userId, { userId: score.userId, name: score.user.name, front: 0, back: 0, total: 0 });
      }
      const p = playerMap.get(score.userId)!;
      p.total += score.strokes;
      if (score.holeNumber >= 1 && score.holeNumber <= 9)  p.front += score.strokes;
      if (score.holeNumber >= 10 && score.holeNumber <= 18) p.back  += score.strokes;
    }

    const players = Array.from(playerMap.values());

    function getWinner(players: { userId: string; name: string; score: number }[]) {
      if (players.length === 0) return null;
      const min = Math.min(...players.map(p => p.score));
      const tied = players.filter(p => p.score === min);
      if (tied.length > 1) return null; // tie — no winner
      return tied[0];
    }

    const frontPlayers   = players.map(p => ({ userId: p.userId, name: p.name, score: p.front }));
    const backPlayers    = players.map(p => ({ userId: p.userId, name: p.name, score: p.back  }));
    const overallPlayers = players.map(p => ({ userId: p.userId, name: p.name, score: p.total }));

    const frontWinner   = getWinner(frontPlayers);
    const backWinner    = getWinner(backPlayers);
    const overallWinner = getWinner(overallPlayers);

    res.json({
      data: {
        front:   { winner: frontWinner,   scores: frontPlayers   },
        back:    { winner: backWinner,    scores: backPlayers    },
        overall: { winner: overallWinner, scores: overallPlayers },
      },
    });
  } catch (err) {
    console.error('GET /rounds/:id/nassau error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
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

  // Return scores as a flat array so the mobile scorecard can iterate directly
  const flatScores = round.scores;

  // Players come from event participants (safe fallback if round has no event)
  const players = round.event?.participants?.map(p => ({
    ...p.user,
    userId: p.user.id,
  })) ?? [];

  res.json({ data: { round, holes: round.holes, scores: flatScores, players } });
});

export default router;
