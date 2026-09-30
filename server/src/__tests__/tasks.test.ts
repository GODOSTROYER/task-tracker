import nodemailer from 'nodemailer';
import request from 'supertest';
import app from '../app';
import Workspace from '../models/Workspace';
import Task from '../models/Task';

async function createVerifiedUser(email: string) {
  await request(app)
    .post('/api/auth/signup')
    .send({ name: email.split('@')[0], email, password: 'Password1!' });

  const sendMail = nodemailer.createTransport({}).sendMail as jest.Mock;
  const html = sendMail.mock.calls[sendMail.mock.calls.length - 1][0].html as string;
  const otp = html.match(/letter-spacing: 8px; color: #4f46e5;">(\d{6})/)?.[1];
  if (!otp) throw new Error('Verification email did not contain an OTP');
  const verify = await request(app)
    .post('/api/auth/verify-email')
    .send({ email, otp });

  await Task.destroy({ where: { ownerId: verify.body.user.id } });
  const workspace = await Workspace.create({ name: 'Test Workspace', ownerId: verify.body.user.id });

  return { token: verify.body.token, userId: verify.body.user.id, workspaceId: workspace.id };
}

describe('Task Endpoints', () => {
  it('creates a task with Kanban metadata', async () => {
    const user = await createVerifiedUser('task@example.com');

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'My Task',
        description: 'Do something',
        status: 'in-progress',
        priority: 'high',
        dueDate: '2026-05-10',
        workspaceId: user.workspaceId,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.ownerId).toBe(user.userId);
    expect(res.body.workspaceId).toBe(user.workspaceId);
    expect(res.body.status).toBe('in-progress');
    expect(res.body.priority).toBe('high');
  });

  it('validates create input and requires auth', async () => {
    const user = await createVerifiedUser('validation@example.com');

    const missingTitle = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ workspaceId: user.workspaceId });
    expect(missingTitle.status).toBe(400);

    const noAuth = await request(app)
      .post('/api/tasks')
      .send({ title: 'No Auth', workspaceId: user.workspaceId });
    expect(noAuth.status).toBe(401);
  });

  it('lists only the authenticated user tasks and filters by workspace', async () => {
    const user = await createVerifiedUser('owner@example.com');
    const other = await createVerifiedUser('other@example.com');

    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Task 1', workspaceId: user.workspaceId });
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Task 2', workspaceId: user.workspaceId });
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ title: 'Other Task', workspaceId: other.workspaceId });

    const res = await request(app)
      .get(`/api/tasks?workspaceId=${user.workspaceId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((task: any) => task.title)).toEqual(['Task 1', 'Task 2']);
  });

  it('updates, batch-reorders, and deletes owned tasks only', async () => {
    const user = await createVerifiedUser('crud@example.com');
    const other = await createVerifiedUser('crud-other@example.com');

    const first = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'First', workspaceId: user.workspaceId });
    const second = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Second', workspaceId: user.workspaceId });

    const blocked = await request(app)
      .put(`/api/tasks/${first.body.id}`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ title: 'Stolen' });
    expect(blocked.status).toBe(404);

    const updated = await request(app)
      .put(`/api/tasks/${first.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Updated', status: 'completed', dueDate: null });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('completed');

    const batch = await request(app)
      .put('/api/tasks/batch')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        tasks: [
          { id: first.body.id, status: 'completed', position: 2048 },
          { id: second.body.id, status: 'todo', position: 1024 },
        ],
      });
    expect(batch.status).toBe(200);

    const deleted = await request(app)
      .delete(`/api/tasks/${second.body.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(deleted.status).toBe(200);

    const remaining = await request(app)
      .get(`/api/tasks?workspaceId=${user.workspaceId}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(remaining.body).toHaveLength(1);
    expect(remaining.body[0].title).toBe('Updated');
  });

  it('does not allow tasks in another user workspace', async () => {
    const user = await createVerifiedUser('creator@example.com');
    const other = await createVerifiedUser('workspace-owner@example.com');

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Cross-user task', workspaceId: other.workspaceId });

    expect(res.status).toBe(404);
  });
});


describe('Task consistency regressions', () => {
  it('assigns distinct append positions to concurrent creates in an empty column', async () => {
    const user = await createVerifiedUser('concurrent@example.com');
    const results = await Promise.all(Array.from({ length: 4 }, (_, index) => request(app)
      .post('/api/tasks').set('Authorization', `Bearer ${user.token}`)
      .send({ title: `Task ${index}`, workspaceId: user.workspaceId })));
    expect(results.map(result => result.status)).toEqual([201, 201, 201, 201]);
    expect(new Set(results.map(result => result.body.position)).size).toBe(4);
  });

  it('rolls back every batch change when one task belongs to another user', async () => {
    const user = await createVerifiedUser('batch-owner@example.com');
    const other = await createVerifiedUser('batch-other@example.com');
    const first = await Task.create({ id: '11111111-1111-4111-8111-111111111111', title: 'Owned', ownerId: user.userId, workspaceId: user.workspaceId });
    const second = await Task.create({ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', title: 'Other', ownerId: other.userId, workspaceId: other.workspaceId });
    const result = await request(app).put('/api/tasks/batch')
      .set('Authorization', `Bearer ${user.token}`).send({ tasks: [
        { id: first.id, status: 'completed', position: 1 },
        { id: second.id, status: 'completed', position: 2 },
      ] });
    expect(result.status).toBe(404);
    await first.reload();
    expect(first.status).toBe('todo');
    expect(first.position).toBe(1024);
  });
});


describe('Batch update capacity', () => {
  it('updates the maximum batch in one request while preserving task fields', async () => {
    const user = await createVerifiedUser('large-batch@example.com');
    const tasks = await Task.bulkCreate(Array.from({ length: 500 }, (_, index) => ({
      title: `Keep ${index}`, description: 'Preserved description', ownerId: user.userId,
      workspaceId: user.workspaceId, position: index,
    })));
    const result = await request(app).put('/api/tasks/batch').set('Authorization', `Bearer ${user.token}`)
      .send({ tasks: tasks.map((task, index) => ({ id: task.id, status: 'completed', position: 500 - index })) });
    expect(result.status).toBe(200);
    expect(await Task.count({ where: { ownerId: user.userId, status: 'completed' } })).toBe(500);
    await tasks[0].reload();
    expect(tasks[0].title).toBe('Keep 0');
    expect(tasks[0].description).toBe('Preserved description');
    expect(tasks[0].position).toBe(500);
  });
});

describe('Atomic move endpoint', () => {
  it('reorders a workspace larger than 500 tasks using an anchor and returns authoritative tasks', async () => {
    const user = await createVerifiedUser('move-large@example.com');
    const tasks = await Task.bulkCreate(Array.from({ length: 503 }, (_, index) => ({
      title: `Task ${index}`, ownerId: user.userId, workspaceId: user.workspaceId, position: (index + 1) * 1024,
    })));
    const result = await request(app).put(`/api/tasks/${tasks[0].id}/move`)
      .set('Authorization', `Bearer ${user.token}`).send({ overId: tasks[502].id });
    expect(result.status).toBe(200);
    expect(result.body).toHaveLength(503);
    expect(result.body.map((task: { id: string }) => task.id)).toEqual([...tasks.slice(1).map(task => task.id), tasks[0].id]);
    expect(result.body.map((task: { position: number }) => task.position)).toEqual(tasks.map((_, index) => (index + 1) * 1024));
    await tasks[0].reload();
    expect(tasks[0].position).toBe(503 * 1024);
    expect(tasks[0].title).toBe('Task 0');
  });

  it('moves before a card in another column and appends onto column targets', async () => {
    const user = await createVerifiedUser('move-columns@example.com');
    const a = await Task.create({ title: 'A', ownerId: user.userId, workspaceId: user.workspaceId, position: 100 });
    const b = await Task.create({ title: 'B', ownerId: user.userId, workspaceId: user.workspaceId, status: 'in-review', position: 100 });
    const c = await Task.create({ title: 'C', ownerId: user.userId, workspaceId: user.workspaceId, status: 'in-review', position: 200 });
    const move = await request(app).put(`/api/tasks/${a.id}/move`).set('Authorization', `Bearer ${user.token}`).send({ overId: c.id });
    expect(move.status).toBe(200);
    expect(move.body.map((task: { title: string }) => task.title)).toEqual(['B', 'A', 'C']);
    const append = await request(app).put(`/api/tasks/${b.id}/move`).set('Authorization', `Bearer ${user.token}`).send({ overId: 'in-review' });
    expect(append.status).toBe(200);
    expect(append.body.map((task: { title: string }) => task.title)).toEqual(['A', 'C', 'B']);
  });

  it('rejects foreign active tasks and foreign or different-workspace anchors', async () => {
    const user = await createVerifiedUser('move-owner@example.com');
    const other = await createVerifiedUser('move-other@example.com');
    const secondWorkspace = await Workspace.create({ name: 'Second', ownerId: user.userId });
    const a = await Task.create({ title: 'A', ownerId: user.userId, workspaceId: user.workspaceId });
    const foreign = await Task.create({ title: 'Foreign', ownerId: other.userId, workspaceId: other.workspaceId });
    const elsewhere = await Task.create({ title: 'Elsewhere', ownerId: user.userId, workspaceId: secondWorkspace.id });
    for (const overId of [foreign.id, elsewhere.id]) {
      expect((await request(app).put(`/api/tasks/${a.id}/move`).set('Authorization', `Bearer ${user.token}`).send({ overId })).status).toBe(404);
    }
    expect((await request(app).put(`/api/tasks/${foreign.id}/move`).set('Authorization', `Bearer ${user.token}`).send({ overId: 'todo' })).status).toBe(404);
    await a.reload();
    expect(a.position).toBe(1024);
    expect(a.status).toBe('todo');
  });

  it('rejects deleted anchors and invalid target statuses without changing the active task', async () => {
    const user = await createVerifiedUser('move-invalid@example.com');
    const a = await Task.create({ title: 'A', ownerId: user.userId, workspaceId: user.workspaceId });
    const deleted = await Task.create({ title: 'Deleted', ownerId: user.userId, workspaceId: user.workspaceId });
    await deleted.destroy();
    expect((await request(app).put(`/api/tasks/${a.id}/move`).set('Authorization', `Bearer ${user.token}`).send({ overId: deleted.id })).status).toBe(404);
    expect((await request(app).put(`/api/tasks/${a.id}/move`).set('Authorization', `Bearer ${user.token}`).send({ overId: 'invalid-status' })).status).toBe(400);
    await a.reload();
    expect(a.status).toBe('todo');
    expect(a.position).toBe(1024);
  });

  it('preserves both simultaneous moves derived from current server state', async () => {
    const user = await createVerifiedUser('move-concurrent@example.com');
    const tasks = await Task.bulkCreate(['A', 'B', 'C'].map((title, index) => ({ title, ownerId: user.userId, workspaceId: user.workspaceId, position: (index + 1) * 1024 })));
    const results = await Promise.all([
      request(app).put(`/api/tasks/${tasks[0].id}/move`).set('Authorization', `Bearer ${user.token}`).send({ overId: 'in-progress' }),
      request(app).put(`/api/tasks/${tasks[1].id}/move`).set('Authorization', `Bearer ${user.token}`).send({ overId: 'completed' }),
    ]);
    expect(results.map(result => result.status)).toEqual([200, 200]);
    await Promise.all(tasks.map(task => task.reload()));
    expect(tasks.map(task => task.status)).toEqual(['in-progress', 'completed', 'todo']);
    expect(tasks.map(task => task.position)).toEqual([1024, 1024, 1024]);
  });

  it('rolls back earlier SQL chunks if a later move chunk fails', async () => {
    const user = await createVerifiedUser('move-rollback@example.com');
    const tasks = await Task.bulkCreate(Array.from({ length: 501 }, (_, index) => ({
      title: `Task ${index}`, ownerId: user.userId, workspaceId: user.workspaceId, position: index + 1,
    })));
    const { sequelize } = await import('../config');
    const query = sequelize.query.bind(sequelize);
    let chunks = 0;
    const spy = jest.spyOn(sequelize, 'query').mockImplementation(((sql: string, options: any) => {
      if (typeof sql === 'string' && sql.startsWith('UPDATE "tasks" AS task') && ++chunks === 2) return Promise.reject(new Error('second chunk failed'));
      return query(sql, options);
    }) as typeof sequelize.query);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = await request(app).put(`/api/tasks/${tasks[0].id}/move`).set('Authorization', `Bearer ${user.token}`).send({ overId: 'completed' });
      expect(result.status).toBe(500);
      expect(chunks).toBe(2);
      await tasks[0].reload();
      await tasks[499].reload();
      expect(tasks[0].status).toBe('todo');
      expect(tasks[0].position).toBe(1);
      expect(tasks[499].position).toBe(500);
    } finally { spy.mockRestore(); log.mockRestore(); }
  });
});
