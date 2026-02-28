import jwt from 'jsonwebtoken';
import { envVars } from '../../../config/env.service.js';
import type { IJwtPayload } from '../../types/auth.types.js';

export class TokenUtil {
  static generateAccessToken(payload: IJwtPayload, expiresIn: string | number = '1d'): string {
    const secret = envVars.jwtSecret;
    if (!secret) {
      throw new Error('JWT Secret is not defined in environment variables');
    }
    return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
  }

  static generateRefreshToken(payload: IJwtPayload, expiresIn: string | number = '1y'): string {
    const secret = envVars.jwtRefreshSecret;
    if (!secret) {
      throw new Error('JWT Refresh Secret is not defined in environment variables');
    }
    return jwt.sign(payload, secret, { expiresIn: expiresIn as any });
  }

  static verifyAccessToken(token: string): IJwtPayload {
    const secret = envVars.jwtSecret;
    if (!secret) {
      throw new Error('JWT Secret is not defined in environment variables');
    }
    return jwt.verify(token, secret) as IJwtPayload;
  }

  static verifyRefreshToken(token: string): IJwtPayload {
    const secret = envVars.jwtRefreshSecret;
    if (!secret) {
      throw new Error('JWT Refresh Secret is not defined in environment variables');
    }
    return jwt.verify(token, secret) as IJwtPayload;
  }
}
