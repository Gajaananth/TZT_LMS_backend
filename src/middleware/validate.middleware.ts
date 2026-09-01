import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { sendError } from '../utils/api-response';

export const validate = (schema: ZodTypeAny, source: 'body' | 'query' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = source === 'query' ? req.query : req.body;
      await schema.parseAsync(data);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return sendError(res, 'Validation failed', 400, error.errors);
      }
      return sendError(res, 'Internal server error', 500);
    }
  };
};
