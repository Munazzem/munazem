import type { IJwtPayload } from '../auth.types.js';

declare global {
  namespace Express {
    interface Request {
      user?: IJwtPayload;
    }
  }
}
