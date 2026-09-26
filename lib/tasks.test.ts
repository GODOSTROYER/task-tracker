import assert from 'node:assert/strict';
import { test } from 'node:test';
import { moveTask, dueDateLocal, isTaskOverdue } from './tasks.ts';
import type { Task } from './api';
const task = (id: string, status: Task['status'], position: number): Task => ({ id, status, position, title: id, priority: 'medium', workspaceId: 'workspace', ownerId: 'user', createdAt: '2026-01-01' });
test('same-column reorder updates persisted positions without mutating the input', () => {
  const original = [task('a', 'todo', 1024), task('b', 'todo', 2048), task('c', 'todo', 3072)];
  const moved = moveTask(original, 'a', 'c');
  assert.deepEqual(moved.map(t => t.id), ['b', 'c', 'a']);
  assert.deepEqual(moved.map(t => t.position), [1024, 2048, 3072]);
  assert.deepEqual(original.map(t => t.id), ['a', 'b', 'c']);
});
test('column drops append without an invalid negative array index', () => {
  const moved = moveTask([task('a', 'todo', 1024), task('b', 'in-review', 1024)], 'a', 'in-review');
  assert.deepEqual(moved.map(t => [t.id, t.status, t.position]), [['b', 'in-review', 1024], ['a', 'in-review', 2048]]);
  assert.equal(moveTask(moved, 'a', 'completed').find(t => t.id === 'a')?.status, 'completed');
});
test('card drops insert before cards in another column and preserve untouched order', () => {
  const moved = moveTask([task('a', 'todo', 1024), task('b', 'in-review', 1024), task('c', 'in-review', 2048)], 'a', 'c');
  assert.deepEqual(moved.map(t => t.id), ['b', 'a', 'c']);
});
test('invalid or self drops are no-ops', () => {
  const tasks = [task('a', 'todo', 1024)];
  assert.equal(moveTask(tasks, 'a', 'a'), tasks);
  assert.equal(moveTask(tasks, 'a', 'missing'), tasks);
});
test('calendar due dates stay on the selected day and become overdue the following day', () => {
  const due = '2026-09-26T00:00:00.000Z';
  assert.equal(dueDateLocal(due).getDate(), 26);
  assert.equal(dueDateLocal(due).getHours(), 0);
  assert.equal(isTaskOverdue(due, 'todo', new Date(2026, 8, 26, 23, 59)), false);
  assert.equal(isTaskOverdue(due, 'todo', new Date(2026, 8, 27)), true);
  assert.equal(isTaskOverdue(due, 'completed', new Date(2026, 8, 27)), false);
  assert.equal(isTaskOverdue(null, 'todo'), false);
});

test('equal positions use the same stable id ordering as the server', () => {
  const moved = moveTask([task('c', 'todo', 1024), task('b', 'todo', 1024), task('a', 'todo', 1024)], 'c', 'a');
  assert.deepEqual(moved.map(t => t.id), ['c', 'a', 'b']);
});
