import app from '../server/src/app';
import { ensureConnections } from '../server/src/config';

type Req = Parameters<typeof app>[0];
type Res = Parameters<typeof app>[1];

export default async function handler(req: Req, res: Res): Promise<void> {
  try {
    await ensureConnections();
    app(req, res);
  } catch (error) {
    console.error('API bootstrap error:', error);
    res.status(500).json({ message: 'Server initialization failed' });
  }
}
