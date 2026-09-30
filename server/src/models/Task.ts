import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config';

export type TaskStatus = 'todo' | 'in-progress' | 'in-review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskAttrs {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  position: number;
  ownerId: string;
  workspaceId: string;
}

type CreateAttrs = Optional<TaskAttrs, 'id' | 'description' | 'status' | 'priority' | 'dueDate' | 'position'>;

class Task extends Model<TaskAttrs, CreateAttrs> implements TaskAttrs {
  declare id: string; declare title: string; declare description: string; declare status: TaskStatus;
  declare priority: TaskPriority; declare dueDate: string | null; declare position: number;
  declare ownerId: string; declare workspaceId: string;
}

Task.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
  status: { type: DataTypes.ENUM('todo', 'in-progress', 'in-review', 'completed'), allowNull: false, defaultValue: 'todo' },
  priority: { type: DataTypes.ENUM('low', 'medium', 'high'), allowNull: false, defaultValue: 'medium' },
  dueDate: { type: DataTypes.DATEONLY, allowNull: true },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1024 },
  ownerId: { type: DataTypes.UUID, allowNull: false },
  workspaceId: { type: DataTypes.UUID, allowNull: false },
}, {
  sequelize,
  tableName: 'tasks',
  indexes: [
    { fields: ['ownerId'] },
    { fields: ['workspaceId'] },
    { fields: ['status'] },
    { fields: ['workspaceId', 'status', 'position'] },
    { name: 'tasks_owner_workspace_order', fields: ['ownerId', 'workspaceId', 'status', 'position'] },
  ],
});

export default Task;
