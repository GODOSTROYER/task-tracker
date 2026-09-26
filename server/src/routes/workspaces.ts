import { Response, Router } from 'express';
import Workspace from '../models/Workspace';
import Task from '../models/Task';
import { authMiddleware, AuthRequest } from '../middleware';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { sequelize } from '../config';
import { validate, z, idParams } from '../middleware/validate';

const router = Router();
router.use(authMiddleware);

const nameSchema = z.object({ name: z.string().trim().min(1).max(255) });

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const workspaces = await Workspace.findAll({
    where: { ownerId: req.user!.id },
    order: [['createdAt', 'DESC']],
  });
  res.json(workspaces);
}));

router.post('/demo', asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const workspace = await sequelize.transaction(async transaction => {
    const workspace = await Workspace.create({ name: 'Getting Started', ownerId: userId }, { transaction });
    await Task.bulkCreate([
      {
        title: 'Plan your first sprint',
        description: 'Capture a few tasks, then drag them through the board.',
        status: 'todo',
        priority: 'high',
        position: 1024,
        ownerId: userId,
        workspaceId: workspace.id,
      },
      {
        title: 'Review the task workflow',
        description: 'Try due dates, priorities, and status changes.',
        status: 'in-review',
        priority: 'medium',
        position: 2048,
        ownerId: userId,
        workspaceId: workspace.id,
      },
    ], { transaction });
    return workspace;
  });
  res.status(201).json(workspace);
}));

router.post('/', validate(nameSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const workspace = await Workspace.create({ name: req.body.name, ownerId: req.user!.id });
  res.status(201).json(workspace);
}));

router.get('/:id', validate(idParams, 'params'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const workspace = await Workspace.findOne({ where: { id: req.params.id, ownerId: req.user!.id } });
  if (!workspace) throw new AppError('Workspace not found', 404);
  res.json(workspace);
}));

router.put('/:id', validate(idParams, 'params'), validate(nameSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const workspace = await Workspace.findOne({ where: { id: req.params.id, ownerId: req.user!.id } });
  if (!workspace) throw new AppError('Workspace not found', 404);
  workspace.name = req.body.name;
  await workspace.save();
  res.json(workspace);
}));

router.delete('/:id', validate(idParams, 'params'), asyncHandler(async (req: AuthRequest, res: Response) => {
  // The database's workspace foreign key cascades tasks in the same statement.
  const deleted = await Workspace.destroy({ where: { id: req.params.id, ownerId: req.user!.id } });
  if (!deleted) throw new AppError('Workspace not found', 404);
  res.json({ message: 'Workspace deleted' });
}));

export default router;
