import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate as requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/templates — return own templates
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const templates = await prisma.eventTemplate.findMany({
    where: { createdById: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(templates);
});

// POST /api/templates — save new template with templateData JSON
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const { name, templateData } = req.body;
  if (!name || !templateData) return res.status(400).json({ error: 'name and templateData required' });
  const t = await prisma.eventTemplate.create({
    data: { name, createdById: req.user!.id, templateData: JSON.stringify(templateData) },
  });
  res.json(t);
});

// POST /api/templates/:id/use — create a new event from template
router.post('/:id/use', requireAuth, async (req: AuthRequest, res) => {
  try {
    const template = await prisma.eventTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const data = JSON.parse(template.templateData);

    // Build event fields from template data, falling back to sensible defaults.
    // The template may contain overrides from the request body (e.g. name, startDate).
    const {
      name        = template.name,
      description,
      type          = data.type || 'TOURNAMENT',
      recurrence    = data.recurrence || 'ONE_TIME',
      privacy       = data.privacy || 'INVITE_ONLY',
      scoringFormat = data.scoringFormat || 'GROSS',
      startDate     = data.startDate || new Date().toISOString(),
      endDate       = data.endDate,
      location      = data.location,
      courseId      = data.courseId,
    } = { ...data, ...req.body };

    const newEvent = await prisma.event.create({
      data: {
        name,
        description: description || data.description,
        type,
        recurrence,
        privacy,
        scoringFormat,
        startDate: new Date(startDate),
        endDate:   endDate ? new Date(endDate) : null,
        location,
        courseId,
        createdBy: req.user!.id,
      },
    });

    // Increment usage counter
    await prisma.eventTemplate.update({
      where: { id: req.params.id },
      data:  { usageCount: { increment: 1 } },
    });

    res.json({ data: newEvent });
  } catch (err) {
    console.error('POST /templates/:id/use error', err);
    res.status(500).json({ error: 'Failed to create event from template' });
  }
});

export default router;
