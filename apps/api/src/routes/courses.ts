import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const GOLF_API_BASE = 'https://api.golfcourseapi.com/v1';
const API_KEY = process.env.GOLF_COURSE_API_KEY || '';

// GET /api/courses/search?q=Augusta&type=Public|Private|Resort|Par3|NineHole&holes=9|18
router.get('/search', async (req, res: Response) => {
  try {
    const q     = ((req.query.q as string) || '').trim();
    const type  = req.query.type as string | undefined;
    const holes = req.query.holes as string | undefined;

    if (!q) { res.json({ data: [] }); return; }

    // Build DB filter
    const where: any = { name: { contains: q } };
    // type and holes are not stored as structured fields in our schema,
    // so we apply them as post-filters when using external API,
    // and skip them on the cached query (no structured columns exist).

    // Return cached results first (no type/holes filtering on cache — schema lacks columns)
    const cached = await prisma.golfCourse.findMany({ where, take: 20 });
    if (cached.length > 0) { res.json({ data: cached }); return; }

    // Fetch from Golf Course API if key is configured
    if (API_KEY) {
      try {
        const resp = await fetch(
          `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(q)}&key=${API_KEY}`,
          { headers: { Authorization: `Key ${API_KEY}` } }
        );
        if (resp.ok) {
          const json = (await resp.json()) as any;
          let courses = (json.courses || []) as any[];

          // Filter by type if provided
          if (type) {
            courses = courses.filter((c: any) => {
              const ct = (c.course_type || '').toLowerCase();
              return ct === type.toLowerCase();
            });
          }

          // Filter by holes if provided
          if (holes) {
            const holeCount = parseInt(holes, 10);
            courses = courses.filter((c: any) => {
              const h = c.holes_count || c.number_of_holes;
              return h === holeCount;
            });
          }

          courses = courses.slice(0, 10);

          const saved = await Promise.all(
            courses.map(async (c: any) =>
              prisma.golfCourse.upsert({
                where: { externalId: String(c.id) },
                update: {
                  name:     c.club_name,
                  city:     c.location?.city,
                  state:    c.location?.state,
                  country:  c.location?.country,
                  cachedAt: new Date(),
                },
                create: {
                  externalId: String(c.id),
                  name:       c.club_name,
                  city:       c.location?.city,
                  state:      c.location?.state,
                  country:    c.location?.country,
                  cachedAt:   new Date(),
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
  } catch (err) {
    console.error('GET /courses/search error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/courses/home — set user's home course
router.post('/home', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.body as { courseId?: string };
    if (!courseId) { res.status(400).json({ error: 'courseId is required' }); return; }

    const course = await prisma.golfCourse.findUnique({ where: { id: courseId } });
    if (!course) { res.status(404).json({ error: 'Course not found' }); return; }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data:  { homeCourseId: courseId },
      select: {
        id: true,
        homeCourseId: true,
        homeCourseRel: true,
      },
    });

    res.json({ data: user });
  } catch (err) {
    console.error('POST /courses/home error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/courses/home — get user's home course
router.get('/home', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user!.id },
      select: { homeCourseId: true, homeCourseRel: true },
    });

    if (!user?.homeCourseId || !user.homeCourseRel) {
      res.json({ data: null });
      return;
    }

    res.json({ data: user.homeCourseRel });
  } catch (err) {
    console.error('GET /courses/home error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/courses/:id — get single course detail
router.get('/:id', async (req, res: Response) => {
  try {
    const course = await prisma.golfCourse.findUnique({
      where: { id: req.params.id },
      include: { reviews: { select: { rating: true } } },
    });
    if (!course) { res.status(404).json({ error: 'Course not found' }); return; }
    const { reviews, ...courseData } = course;
    const averageRating = reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;
    res.json({ data: { ...courseData, averageRating, reviewCount: reviews.length } });
  } catch (err) {
    console.error('GET /courses/:id error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/courses — create or upsert a course manually
router.post('/', async (req, res: Response) => {
  try {
    const {
      externalId, name, city, state, country,
      par, scorecard, courseRating, courseSlope,
    } = req.body;
    const key = externalId || `manual-${Date.now()}`;
    const course = await prisma.golfCourse.upsert({
      where:  { externalId: key },
      update: { name, city, state, country, par, scorecard, courseRating, courseSlope, cachedAt: new Date() },
      create: { externalId: key, name, city, state, country, par, scorecard, courseRating, courseSlope },
    });
    res.json({ data: course });
  } catch (err) {
    console.error('POST /courses error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
