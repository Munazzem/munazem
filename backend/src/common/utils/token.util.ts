import jwt from "jsonwebtoken";
import { envVars } from "../../../config/env.service.js";
import type { IJwtPayload } from "../../types/auth.types.js";

const JWT_SECRET = envVars.jwtSecret;
const REFRESH_SECRET = envVars.jwtRefreshSecret;

if (!JWT_SECRET || !REFRESH_SECRET) {
  throw new Error(
    "Critical: JWT Secrets are missing from environment variables!",
  );
}

export class TokenUtil {
  static generateAccessToken(
    payload: IJwtPayload,
    expiresIn: string | number = "1d",
  ): string {
    return jwt.sign(payload, JWT_SECRET as string, {
      expiresIn: expiresIn as any,
    });
  }

  static generateRefreshToken(
    payload: IJwtPayload,
    expiresIn: string | number = "1y",
  ): string {
    return jwt.sign(payload, REFRESH_SECRET as string, {
      expiresIn: expiresIn as any,
    });
  }

  static verifyAccessToken(token: string): IJwtPayload {
    return jwt.verify(token, JWT_SECRET as string) as IJwtPayload;
  }

  static verifyRefreshToken(token: string): IJwtPayload {
    return jwt.verify(token, REFRESH_SECRET as string) as IJwtPayload;
  }
}
