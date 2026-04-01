import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate as requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const templates = await prisma.eventTemplate.findMany({
    where: { createdById: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(templates);
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const { name, templateData } = req.body;
  if (!name || !templateData) return res.status(400).json({ error: 'name and templateData required' });
  const t = await prisma.eventTemplate.create({
    data: { name, createdById: req.user!.id, templateData: JSON.stringify(templateData) },
  });
  res.json(t);
});

router.post('/:id/use', requireAuth, async (req: AuthRequest, res) => {
  const template = await prisma.eventTemplate.findUnique({ where: { id: req.params.id } });
  if (!template) return res.status(404).json({ error: 'Template not found' });
  const data = JSON.parse(template.templateData);
  await prisma.eventTemplate.update({ where: { id: req.params.id }, data: { usageCount: { increment: 1 } } });
  res.json({ templateData: data });
});

export default router;
