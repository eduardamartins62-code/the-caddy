import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate as requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const BADGE_DEFINITIONS: Record<string, { name: string; description: string }> = {
  FIRST_ROUND:      { name: 'Teed Up',          description: 'Complete your first round' },
  FIRST_BIRDIE:     { name: 'One Under',         description: 'Score your first birdie' },
  EAGLE_SCOUT:      { name: 'Eagle Scout',       description: 'Score your first eagle' },
  ACE:              { name: 'Hole in One',       description: 'Score a hole in one' },
  TEN_ROUNDS:       { name: 'Veteran',           description: 'Complete 10 rounds' },
  FIFTY_ROUNDS:     { name: 'Road Warrior',      description: 'Complete 50 rounds' },
  BIRDIE_MACHINE:   { name: 'Birdie Machine',    description: 'Record 50 total birdies' },
  GLOBE_TROTTER:    { name: 'Globe Trotter',     description: 'Play 5 different courses' },
  SOCIAL_BUTTERFLY: { name: 'Social Butterfly',  description: '50 post likes received' },
  CHAMPION:         { name: 'Champion',          description: 'Win a tournament event' },
};

function buildBadgeList(badges: { type: string; earnedAt: Date }[]) {
  return Object.entries(BADGE_DEFINITIONS).map(([type, def]) => ({
    type,
    ...def,
    earned: badges.find(b => b.type === type) || null,
    locked: !badges.some(b => b.type === type),
  }));
}

// GET /api/badges/me — current user's earned badges + all possible badges
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const badges = await prisma.badge.findMany({
      where: { userId: req.user!.id },
      orderBy: { earnedAt: 'desc' },
    });
    res.json({ earnedCount: badges.length, badges: buildBadgeList(badges) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// GET /api/badges/user/:id — another user's badges
router.get('/user/:id', requireAuth, async (req, res) => {
  try {
    const badges = await prisma.badge.findMany({
      where: { userId: req.params.id },
      orderBy: { earnedAt: 'desc' },
    });
    res.json({ earnedCount: badges.length, badges: buildBadgeList(badges) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// POST /api/badges/check — trigger badge check for current user (or userId in body)
router.post('/check', requireAuth, async (req: AuthRequest, res) => {
  const userId = (req.body?.userId as string) || req.user!.id;
  try {
    const awarded = await checkAndAwardBadges(userId);
    res.json({ awarded });
  } catch (err) {
    res.status(500).json({ error: 'Badge check failed' });
  }
});

// Legacy: GET /api/badges/:userId
router.get('/:userId', requireAuth, async (req, res) => {
  try {
    const badges = await prisma.badge.findMany({
      where: { userId: req.params.userId },
      orderBy: { earnedAt: 'desc' },
    });
    const allBadges = Object.entries(BADGE_DEFINITIONS).map(([type, def]) => ({
      type,
      ...def,
      earned: badges.find(b => b.type === type) || null,
    }));
    res.json(allBadges);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  try {
    const existingBadges = await prisma.badge.findMany({ where: { userId } });
    const earned = new Set(existingBadges.map(b => b.type));
    const toAward: string[] = [];

    const rounds = await prisma.round.findMany({
      where: { scores: { some: { userId } } },
      include: { scores: { where: { userId } } },
    });
    const allScores = rounds.flatMap(r => r.scores);

    // FIRST_ROUND
    if (!earned.has('FIRST_ROUND') && rounds.length >= 1) toAward.push('FIRST_ROUND');

    // TEN_ROUNDS / FIFTY_ROUNDS
    if (!earned.has('TEN_ROUNDS') && rounds.length >= 10) toAward.push('TEN_ROUNDS');
    if (!earned.has('FIFTY_ROUNDS') && rounds.length >= 50) toAward.push('FIFTY_ROUNDS');

    // Score-based badges
    if (allScores.length > 0) {
      const roundHoles = await prisma.roundHole.findMany({
        where: { roundId: { in: rounds.map(r => r.id) } },
      });
      const holeMap = new Map(roundHoles.map(h => [`${h.roundId}:${h.holeNumber}`, h.par]));
      let birdieCount = 0;
      let eagleCount = 0;
      let aceCount = 0;
      for (const score of allScores) {
        const par = holeMap.get(`${score.roundId}:${score.holeNumber}`);
        if (par) {
          if (score.strokes === 1) aceCount++;
          if (score.strokes <= par - 2) eagleCount++;
          if (score.strokes === par - 1) birdieCount++;
        }
      }
      if (!earned.has('FIRST_BIRDIE') && birdieCount >= 1) toAward.push('FIRST_BIRDIE');
      if (!earned.has('EAGLE_SCOUT') && eagleCount >= 1) toAward.push('EAGLE_SCOUT');
      if (!earned.has('ACE') && aceCount >= 1) toAward.push('ACE');
      if (!earned.has('BIRDIE_MACHINE') && birdieCount >= 50) toAward.push('BIRDIE_MACHINE');
    }

    // GLOBE_TROTTER
    const uniqueCourses = new Set(rounds.map(r => r.courseId).filter(Boolean));
    if (!earned.has('GLOBE_TROTTER') && uniqueCourses.size >= 5) toAward.push('GLOBE_TROTTER');

    for (const type of toAward) {
      await prisma.badge.create({ data: { userId, type } }).catch(() => {});
    }

    return toAward;
  } catch (err) {
    console.error('Badge check error:', err);
    return [];
  }
}

export default router;
