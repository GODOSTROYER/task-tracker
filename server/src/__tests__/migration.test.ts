import { sequelize } from '../config';
import { migrateDatabase } from '../database/migrate';
import { User, Workspace, Task } from '../models';

describe('explicit database migrations', () => {
  it('adopts an existing schema additively and preserves rows on repeated runs', async () => {
    const user = await User.create({ name: 'Migration fixture', email: 'migration@example.com', password: 'fixture-password' });
    const workspace = await Workspace.create({ name: 'Existing workspace', ownerId: user.id });
    const task = await Task.create({ title: 'Existing task', ownerId: user.id, workspaceId: workspace.id });
    // Simulate the pre-migration production schema on the gated disposable test database.
    await sequelize.getQueryInterface().removeColumn('users', 'verificationAttempts');
    await migrateDatabase(sequelize);
    await migrateDatabase(sequelize);
    expect((await User.findByPk(user.id))?.verificationAttempts).toBe(0);
    expect((await Task.findByPk(task.id))?.title).toBe('Existing task');
    expect(await Workspace.count()).toBe(1);
    const indexes = await sequelize.getQueryInterface().showIndex('tasks') as { name: string }[];
    expect(indexes.some(index => index.name === 'tasks_owner_workspace_order')).toBe(true);
  });
});
