import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { BadRequestException } from '../common/utils/response/error.responce.js';

export const validate = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        // Collect all error messages from Zod
        const errorMessage = (error as any).issues.map((err: any) => err.message).join(', ');
        // Pass the error to the global error handler
        return next(BadRequestException({ message: errorMessage, extra: (error as any).issues }));
      }
      next(error);
    }
  };
};
