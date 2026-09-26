import request from 'supertest';
import express from 'express';
import tasks from '../routes/tasks';
import workspaces from '../routes/workspaces';
import { errorHandler } from '../middleware/errorHandler';
import Task from '../models/Task';
import Workspace from '../models/Workspace';
import { sequelize } from '../config';

jest.mock('../config', () => ({ sequelize: { transaction: jest.fn(), query: jest.fn() } }));
jest.mock('../models/Task', () => ({ __esModule: true, default: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), update: jest.fn(), bulkCreate: jest.fn() } }));
jest.mock('../models/Workspace', () => ({ __esModule: true, default: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), destroy: jest.fn() } }));
jest.mock('../middleware', () => ({ authMiddleware: (req: any, _res: any, next: any) => { req.user = { id: 'owner' }; next(); } }));
const app = express();
app.use(express.json());
app.use('/api/tasks', tasks);
app.use('/api/workspaces', workspaces);
app.use(errorHandler);
const id = '11111111-1111-4111-8111-111111111111';
const id2 = '22222222-2222-4222-8222-222222222222';
const transaction = { LOCK: { UPDATE: 'UPDATE' } };
beforeEach(() => {
  jest.clearAllMocks();
  (sequelize.transaction as jest.Mock).mockImplementation(async callback => callback(transaction));
});

describe('API validation and transaction boundaries', () => {
  it.each([
    { title: '   ', workspaceId: id },
    { title: 'Task', workspaceId: id, dueDate: '2026-02-30' },
    { title: 'Task', workspaceId: id, position: 2147483648 },
    { title: 'x'.repeat(256), workspaceId: id },
  ])('rejects invalid create fields before database access: %j', async body => {
    expect((await request(app).post('/api/tasks').send(body)).status).toBe(400);
    expect(Workspace.findOne).not.toHaveBeenCalled();
  });
  it('rejects malformed route and workspace query IDs', async () => {
    expect((await request(app).delete('/api/tasks/bad')).status).toBe(400);
    expect((await request(app).get('/api/tasks?workspaceId=bad')).status).toBe(400);
    expect((await request(app).get('/api/workspaces/bad')).status).toBe(400);
    expect(Task.findAll).not.toHaveBeenCalled();
  });
  it('rejects duplicate batch IDs and unknown-field-only updates', async () => {
    expect((await request(app).put('/api/tasks/batch').send({ tasks: [
      { id, status: 'todo', position: 1 }, { id, status: 'completed', position: 2 },
    ] })).status).toBe(400);
    expect((await request(app).put(`/api/tasks/${id}`).send({ ownerId: id2 })).status).toBe(400);
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });
  it('allocates append positions under a workspace lock in the insert transaction', async () => {
    (Workspace.findOne as jest.Mock).mockResolvedValue({ id });
    (Task.findOne as jest.Mock).mockResolvedValue({ maxPosition: 1024 });
    (Task.create as jest.Mock).mockResolvedValue({ id: id2, position: 2048 });
    const result = await request(app).post('/api/tasks').send({ title: 'Task', workspaceId: id });
    expect(result.status).toBe(201);
    expect(Workspace.findOne).toHaveBeenCalledWith(expect.objectContaining({ transaction, lock: 'UPDATE', where: { id, ownerId: 'owner' } }));
    expect(Task.create).toHaveBeenCalledWith(expect.objectContaining({ position: 2048, ownerId: 'owner' }), { transaction });
  });
  it('locks workspaces and tasks in order before one owner-scoped bulk update', async () => {
    (Task.findAll as jest.Mock).mockResolvedValue([{ id, workspaceId: id }, { id: id2, workspaceId: id }]);
    (Workspace.findAll as jest.Mock).mockResolvedValue([{ id }]);
    const result = await request(app).put('/api/tasks/batch').send({ tasks: [
      { id: id2, status: 'todo', position: 1 }, { id, status: 'todo', position: 2 },
    ] });
    expect(result.status).toBe(200);
    expect(Workspace.findAll).toHaveBeenCalledWith(expect.objectContaining({ order: [['id', 'ASC']], lock: 'UPDATE', transaction }));
    expect(Task.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ order: [['id', 'ASC']], lock: 'UPDATE', transaction }));
    expect(sequelize.query).toHaveBeenCalledTimes(1);
    expect(sequelize.query).toHaveBeenCalledWith(expect.stringContaining('task."ownerId" = $1::uuid'), expect.objectContaining({ bind: ['owner', id, 'todo', 2, id2, 'todo', 1], transaction }));
  });
  it('rejects a concurrent workspace move before applying a batch', async () => {
    (Task.findAll as jest.Mock).mockResolvedValueOnce([{ id, workspaceId: id }]).mockResolvedValueOnce([{ id, workspaceId: id2 }]);
    (Workspace.findAll as jest.Mock).mockResolvedValue([{ id }]);
    const result = await request(app).put('/api/tasks/batch').send({ tasks: [{ id, status: 'todo', position: 1 }] });
    expect(result.status).toBe(409);
    expect(sequelize.query).not.toHaveBeenCalled();
  });  it('seeds demo workspace and tasks in the same transaction', async () => {
    (Workspace.create as jest.Mock).mockResolvedValue({ id });
    (Task.bulkCreate as jest.Mock).mockResolvedValue([]);
    expect((await request(app).post('/api/workspaces/demo')).status).toBe(201);
    expect(Workspace.create).toHaveBeenCalledWith(expect.anything(), { transaction });
    expect(Task.bulkCreate).toHaveBeenCalledWith(expect.anything(), { transaction });
  });
  it('deletes an owned workspace with one atomic cascading statement', async () => {
    (Workspace.destroy as jest.Mock).mockResolvedValue(1);
    expect((await request(app).delete(`/api/workspaces/${id}`)).status).toBe(200);
    expect(Workspace.destroy).toHaveBeenCalledWith({ where: { id, ownerId: 'owner' } });
  });
  it('returns a client error for malformed JSON', async () => {
    expect((await request(app).post('/api/tasks').set('Content-Type', 'application/json').send('{')).status).toBe(400);
  });
  it('does not expose unexpected database error messages', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    (Workspace.findOne as jest.Mock).mockRejectedValue(new Error('postgres password=secret'));
    const result = await request(app).get(`/api/workspaces/${id}`);
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ message: 'Server error' });
    log.mockRestore();
  });
});
