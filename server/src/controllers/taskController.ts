import { fn, col, Transaction, Op, QueryTypes } from 'sequelize';
import { Response } from 'express';
import Task, { TaskStatus } from '../models/Task';
import Workspace from '../models/Workspace';
import { AuthRequest } from '../middleware';
import { AppError } from '../middleware/errorHandler';
import { sequelize } from '../config';

async function ensureWorkspace(ownerId: string, workspaceId: string, transaction?: Transaction): Promise<Workspace> {
  const workspace = await Workspace.findOne({
    where: { id: workspaceId, ownerId }, transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!workspace) throw new AppError('Workspace not found', 404);
  return workspace;
}

async function nextPosition(ownerId: string, workspaceId: string, status: TaskStatus, transaction: Transaction): Promise<number> {
  const row = await Task.findOne({
    where: { ownerId, workspaceId, status },
    attributes: [[fn('MAX', col('position')), 'maxPosition']], raw: true, transaction,
  }) as { maxPosition: number | null } | null;
  const position = Number(row?.maxPosition || 0) + 1024;
  if (position > 2147483647) throw new AppError('Task positions are full; reorder this column before adding a task', 409);
  return position;
}

export async function getTasks(req: AuthRequest, res: Response) {
  const userId = req.user!.id;
  const workspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined;
  if (workspaceId) await ensureWorkspace(userId, workspaceId);
  const tasks = await Task.findAll({
    where: workspaceId ? { ownerId: userId, workspaceId } : { ownerId: userId },
    order: [['status', 'ASC'], ['position', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
  });
  res.json(tasks);
}

export async function createTask(req: AuthRequest, res: Response) {
  const userId = req.user!.id;
  const task = await sequelize.transaction(async transaction => {
    // Serialize append allocation even when the column is empty.
    await ensureWorkspace(userId, req.body.workspaceId, transaction);
    const status = req.body.status as TaskStatus;
    return Task.create({
      title: req.body.title, description: req.body.description, status,
      priority: req.body.priority, dueDate: req.body.dueDate ?? null,
      position: req.body.position ?? await nextPosition(userId, req.body.workspaceId, status, transaction),
      ownerId: userId, workspaceId: req.body.workspaceId,
    }, { transaction });
  });
  res.status(201).json(task);
}

async function lockWorkspaces(ownerId: string, ids: string[], transaction: Transaction) {
  const uniqueIds = [...new Set(ids)].sort();
  const workspaces = await Workspace.findAll({
    where: { id: { [Op.in]: uniqueIds }, ownerId },
    order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE,
  });
  if (workspaces.length !== uniqueIds.length) throw new AppError('Workspace not found', 404);
}

export async function updateTask(req: AuthRequest, res: Response) {
  const userId = req.user!.id;
  const task = await sequelize.transaction(async transaction => {
    const snapshot = await Task.findOne({ where: { id: req.params.id, ownerId: userId }, transaction });
    if (!snapshot) throw new AppError('Task not found', 404);
    await lockWorkspaces(userId, [snapshot.workspaceId, req.body.workspaceId || snapshot.workspaceId], transaction);
    const existing = await Task.findOne({ where: { id: req.params.id, ownerId: userId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!existing) throw new AppError('Task not found', 404);
    if (existing.workspaceId !== snapshot.workspaceId) throw new AppError('Task moved; refresh and retry', 409);
    return existing.update(req.body, { transaction });
  });
  res.json(task);
}

export async function batchUpdateTasks(req: AuthRequest, res: Response) {
  const userId = req.user!.id;
  const updates = (req.body.tasks as Array<{ id: string; status: TaskStatus; position: number }>)
    .slice().sort((a, b) => a.id.localeCompare(b.id));
  await sequelize.transaction(async transaction => {
    const where = { id: { [Op.in]: updates.map(update => update.id) }, ownerId: userId };
    const snapshot = await Task.findAll({ where, attributes: ['id', 'workspaceId'], transaction });
    if (snapshot.length !== updates.length) throw new AppError('Task not found', 404);
    await lockWorkspaces(userId, snapshot.map(task => task.workspaceId), transaction);
    const locked = await Task.findAll({ where, order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
    if (locked.length !== updates.length) throw new AppError('Task not found', 404);
    const originalWorkspaces = new Map(snapshot.map(task => [task.id, task.workspaceId]));
    if (locked.some(task => task.workspaceId !== originalWorkspaces.get(task.id))) {
      throw new AppError('Task moved; refresh and retry', 409);
    }
    await writeTaskPositions(userId, updates, transaction);
  });
  res.json({ message: 'Tasks updated' });
}
export async function deleteTask(req: AuthRequest, res: Response) {
  const deleted = await Task.destroy({ where: { id: req.params.id, ownerId: req.user!.id } });
  if (!deleted) throw new AppError('Task not found', 404);
  res.json({ message: 'Task deleted' });
}


type PositionUpdate = { id: string; status: TaskStatus; position: number };
const taskStatuses: TaskStatus[] = ['todo', 'in-progress', 'in-review', 'completed'];

async function writeTaskPositions(ownerId: string, updates: PositionUpdate[], transaction: Transaction) {
  // Bound SQL parameter counts without splitting the transaction or the logical move.
  for (let start = 0; start < updates.length; start += 500) {
    const bind: Array<string | number> = [ownerId];
    const values = updates.slice(start, start + 500).map(update => {
      const offset = bind.length;
      bind.push(update.id, update.status, update.position);
      return `($${offset + 1}::uuid, $${offset + 2}::text, $${offset + 3}::integer)`;
    });
    await sequelize.query(`UPDATE "tasks" AS task
      SET "status" = changes.status::"enum_tasks_status", "position" = changes.position, "updatedAt" = NOW()
      FROM (VALUES ${values.join(', ')}) AS changes(id, status, position)
      WHERE task.id = changes.id AND task."ownerId" = $1::uuid`,
    { bind, transaction, type: QueryTypes.UPDATE });
  }
}

export async function moveTask(req: AuthRequest, res: Response) {
  const ownerId = req.user!.id;
  const activeId = String(req.params.id).toLowerCase();
  const overId = String(req.body.overId).toLowerCase();
  const tasks = await sequelize.transaction(async transaction => {
    const snapshot = await Task.findOne({ where: { id: activeId, ownerId }, transaction });
    if (!snapshot) throw new AppError('Task not found', 404);
    await ensureWorkspace(ownerId, snapshot.workspaceId, transaction);
    // Workspace first, then task IDs, consistently with every other order-changing write.
    const current = await Task.findAll({
      where: { ownerId, workspaceId: snapshot.workspaceId },
      order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE,
    });
    const active = current.find(task => task.id === activeId);
    if (!active) throw new AppError('Task moved or deleted; refresh and retry', 409);
    const target = current.find(task => task.id === overId);
    const status = target?.status ?? (taskStatuses.includes(overId as TaskStatus) ? overId as TaskStatus : undefined);
    if (!status) throw new AppError('Target task not found in workspace', 404);
    if (activeId !== overId) {
      const ordered = current.slice().sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
      const source = ordered.filter(task => task.status === active.status);
      const destination = active.status === status ? source : ordered.filter(task => task.status === status);
      // Capture target index before removal to match a same-column sortable card drop.
      const index = target ? destination.findIndex(task => task.id === overId) : destination.length;
      source.splice(source.findIndex(task => task.id === activeId), 1);
      destination.splice(index, 0, active);
      const affected = active.status === status ? [destination] : [source, destination];
      const updates = affected.flatMap(column => column.map((task, position) => ({
        id: task.id, status: task.id === activeId ? status : task.status, position: (position + 1) * 1024,
      })));
      if (updates.some(update => update.position > 2147483647)) throw new AppError('Workspace has too many tasks to reorder', 409);
      await writeTaskPositions(ownerId, updates, transaction);
    }
    return Task.findAll({
      where: { ownerId, workspaceId: snapshot.workspaceId },
      order: [['status', 'ASC'], ['position', 'ASC'], ['id', 'ASC']], transaction,
    });
  });
  res.json(tasks);
}
