import jwt from 'jsonwebtoken';
import { envVars } from '../../../config/env.service.js';
import type { IJwtPayload } from '../../types/auth.types.js';

export class TokenUtil {
  static generateToken(payload: IJwtPayload, expiresIn: string | number = '7d'): string {
    const secret = envVars.jwtSecret;
    if (!secret) {
      throw new Error('JWT Secret is not defined in environment variables');
    }
    return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
  }

  static verifyToken(token: string): IJwtPayload {
    const secret = envVars.jwtSecret;
    if (!secret) {
      throw new Error('JWT Secret is not defined in environment variables');
    }
    return jwt.verify(token, secret) as IJwtPayload;
  }
}
