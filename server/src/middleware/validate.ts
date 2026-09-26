import { NextFunction, Request, Response } from 'express';
import { z, ZodTypeAny } from 'zod';

export const validate = (schema: ZodTypeAny, source: 'body' | 'params' | 'query' = 'body') =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return res.status(400).json({ message: 'Validation error', errors: result.error.flatten().fieldErrors, formErrors: result.error.flatten().formErrors });
    // Express may expose query/params as getters; only bodies need normalized defaults.
    if (source === 'body') req.body = result.data;
    next();
  };

export const idParams = z.object({ id: z.string().uuid() });
export { z };
