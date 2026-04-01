import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate as requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/skins/round/:roundId
router.get('/round/:roundId', requireAuth, async (req, res) => {
  try {
    const round = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      include: {
        holes: { orderBy: { holeNumber: 'asc' } },
        scores: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        skinsGame: true,
      },
    });
    if (!round) return res.status(404).json({ error: 'Round not found' });
    if (!round.skinsGame) return res.status(404).json({ error: 'No skins game for this round' });

    // Calculate skins
    const players = [...new Set(round.scores.map(s => s.userId))];
    const results: any[] = [];
    let carryover = 0;

    for (const hole of round.holes) {
      const holeScores = round.scores.filter(s => s.holeNumber === hole.holeNumber);
      if (holeScores.length === 0) {
        results.push({ hole: hole.holeNumber, par: hole.par, winner: null, carryover });
        continue;
      }
      const minStrokes = Math.min(...holeScores.map(s => s.strokes));
      const winners = holeScores.filter(s => s.strokes === minStrokes);
      const pot = round.skinsGame!.stake + carryover;
      if (winners.length === 1) {
        const winner = winners[0].user;
        results.push({ hole: hole.holeNumber, par: hole.par, winner, strokes: minStrokes, pot, carryover: 0 });
        carryover = 0;
      } else {
        results.push({ hole: hole.holeNumber, par: hole.par, winner: null, tied: true, pot, carryover: round.skinsGame!.carryover ? pot : 0 });
        carryover = round.skinsGame!.carryover ? pot : 0;
      }
    }

    // Tally winnings
    const winnings: Record<string, number> = {};
    for (const r of results) {
      if (r.winner) winnings[r.winner.id] = (winnings[r.winner.id] || 0) + r.pot;
    }
    const payouts = players.map(pid => {
      const user = round.scores.find(s => s.userId === pid)?.user;
      return {
        userId: pid,
        name: user?.name,
        won: winnings[pid] || 0,
        owed: round.skinsGame!.stake * round.holes.length / players.length,
      };
    });

    res.json({ skinsGame: round.skinsGame, results, payouts, totalPot: round.skinsGame!.stake * round.holes.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate skins' });
  }
});

// POST /api/skins/round/:roundId — create or update skins game
router.post('/round/:roundId', requireAuth, async (req, res) => {
  const { stake, carryover } = req.body;
  try {
    const game = await prisma.skinsGame.upsert({
      where: { roundId: req.params.roundId },
      update: { stake: stake || 0, carryover: carryover ?? true },
      create: { roundId: req.params.roundId, stake: stake || 0, carryover: carryover ?? true },
    });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create skins game' });
  }
});

export default router;
