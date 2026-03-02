import type { NextApiRequest, NextApiResponse } from 'next';
import app from '../../server/src/app';
import { ensureConnections } from '../../server/src/config';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  try {
    await ensureConnections();
    await new Promise<void>((resolve, reject) => {
      app(req, res, (err?: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } catch (error) {
    console.error('API bootstrap error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server initialization failed' });
    }
  }
}
