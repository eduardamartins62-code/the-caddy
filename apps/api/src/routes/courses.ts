import { Router, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

const GOLF_API_BASE = 'https://api.golfcourseapi.com/v1';
const API_KEY = process.env.GOLF_COURSE_API_KEY || '';

// GET /api/courses/search?q=Augusta
router.get('/search', async (req, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  if (!q) { res.json({ data: [] }); return; }

  // Return cached results first
  const cached = await prisma.golfCourse.findMany({
    where: { name: { contains: q } },
    take: 10,
  });
  if (cached.length > 0) { res.json({ data: cached }); return; }

  // Fetch from Golf Course API if key is configured
  if (API_KEY) {
    try {
      const resp = await fetch(
        `${GOLF_API_BASE}/search?search_query=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Key ${API_KEY}` } }
      );
      if (resp.ok) {
        const json = (await resp.json()) as any;
        const courses = (json.courses || []).slice(0, 10);
        const saved = await Promise.all(
          courses.map(async (c: any) =>
            prisma.golfCourse.upsert({
              where: { externalId: String(c.id) },
              update: {
                name: c.club_name,
                city: c.location?.city,
                state: c.location?.state,
                country: c.location?.country,
                cachedAt: new Date(),
              },
              create: {
                externalId: String(c.id),
                name: c.club_name,
                city: c.location?.city,
                state: c.location?.state,
                country: c.location?.country,
                cachedAt: new Date(),
              },
            })
          )
        );
        res.json({ data: saved });
        return;
      }
    } catch { /* fall through */ }
  }

  res.json({ data: [] });
});

// GET /api/courses/:id
router.get('/:id', async (req, res: Response) => {
  const course = await prisma.golfCourse.findUnique({ where: { id: req.params.id } });
  if (!course) { res.status(404).json({ error: 'Course not found' }); return; }
  res.json({ data: course });
});

// POST /api/courses — create or upsert a course manually
router.post('/', async (req, res: Response) => {
  const {
    externalId, name, city, state, country,
    par, scorecard, courseRating, courseSlope,
  } = req.body;
  const key = externalId || `manual-${Date.now()}`;
  const course = await prisma.golfCourse.upsert({
    where: { externalId: key },
    update: { name, city, state, country, par, scorecard, courseRating, courseSlope, cachedAt: new Date() },
    create: { externalId: key, name, city, state, country, par, scorecard, courseRating, courseSlope },
  });
  res.json({ data: course });
});

export default router;
