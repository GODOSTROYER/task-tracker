import type { Task } from './api';

export const TASK_STATUSES = ['todo', 'in-progress', 'in-review', 'completed'] as const;

/** Reorder within the destination column, retaining all other column orders. */
export function moveTask(tasks: Task[], activeId: string, overId: string): Task[] {
  const active = tasks.find(task => task.id === activeId);
  const target = tasks.find(task => task.id === overId);
  const status = target?.status ?? (TASK_STATUSES.includes(overId as Task['status']) ? overId as Task['status'] : undefined);
  if (!active || !status || activeId === overId) return tasks;
  const columns = TASK_STATUSES.map(column => tasks.filter(task => task.status === column).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)));
  const source = columns[TASK_STATUSES.indexOf(active.status)];
  const destination = columns[TASK_STATUSES.indexOf(status)];
  const oldIndex = source.findIndex(task => task.id === activeId);
  const targetIndex = target ? destination.findIndex(task => task.id === overId) : destination.length;
  source.splice(oldIndex, 1);
  destination.splice(targetIndex, 0, { ...active, status });
  return columns.flatMap(column => column.map((task, index) => ({ ...task, position: (index + 1) * 1024 })));
}

/** Due dates represent calendar dates, including when the API serializes UTC midnight. */
export function dueDateLocal(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}
export function isTaskOverdue(dueDate: string | null | undefined, status: string, now = new Date()): boolean {
  if (!dueDate || status === 'completed') return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return dueDateLocal(dueDate).getTime() < today.getTime();
}
