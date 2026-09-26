import dotenv from 'dotenv';
dotenv.config();
import app from './app';
import { connectDB, sequelize } from './config';
const PORT = process.env.PORT || 5000;
async function start(): Promise<void> {
  try {
    await connectDB();
    const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    let stopping = false;
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      const deadline = setTimeout(() => process.exit(1), 10000);
      deadline.unref();
      server.close(async () => {
        try { await sequelize.close(); clearTimeout(deadline); process.exitCode = 0; }
        catch (err) { console.error('Failed to close database:', err); process.exitCode = 1; }
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (err) {
    console.error('Failed to start server:', err);
    await sequelize.close();
    process.exitCode = 1;
  }
}
void start();
