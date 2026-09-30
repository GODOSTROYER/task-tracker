import { Router } from 'express';
import { batchUpdateTasks, createTask, deleteTask, getTasks, updateTask, moveTask } from '../controllers/taskController';
import { authMiddleware } from '../middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { validate, z, idParams } from '../middleware/validate';

const router = Router();
router.use(authMiddleware);
const statusSchema = z.enum(['todo', 'in-progress', 'in-review', 'completed']);
const prioritySchema = z.enum(['low', 'medium', 'high']);
const positionSchema = z.number().int().nonnegative().max(2147483647);
const titleSchema = z.string().trim().min(1).max(255);
const dueDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date').nullable();
const createSchema = z.object({
  title: titleSchema,
  description: z.string().optional().default(''),
  status: statusSchema.optional().default('todo'),
  priority: prioritySchema.optional().default('medium'),
  dueDate: dueDateSchema.optional(),
  position: positionSchema.optional(),
  workspaceId: z.string().uuid(),
});
const updateSchema = z.object({
  title: titleSchema.optional(), description: z.string().optional(),
  status: statusSchema.optional(), priority: prioritySchema.optional(),
  dueDate: dueDateSchema.optional(), position: positionSchema.optional(),
  workspaceId: z.string().uuid().optional(),
}).refine(value => Object.keys(value).length > 0, 'At least one task field is required');
const batchSchema = z.object({
  tasks: z.array(z.object({ id: z.string().uuid(), status: statusSchema, position: positionSchema }))
    .min(1).max(500).refine(tasks => new Set(tasks.map(task => task.id)).size === tasks.length, 'Task IDs must be unique'),
});
router.get('/', validate(z.object({ workspaceId: z.string().uuid().optional() }), 'query'), asyncHandler(getTasks));
router.post('/', validate(createSchema), asyncHandler(createTask));
router.put('/batch', validate(batchSchema), asyncHandler(batchUpdateTasks));
router.put('/:id/move', validate(idParams, 'params'), validate(z.object({ overId: z.union([z.string().uuid(), statusSchema]) })), asyncHandler(moveTask));
router.put('/:id', validate(idParams, 'params'), validate(updateSchema), asyncHandler(updateTask));
router.delete('/:id', validate(idParams, 'params'), asyncHandler(deleteTask));
export default router;
