import bcrypt from 'bcrypt';
import { logger } from './logger.util.js';

export class PasswordUtil {
   private static readonly SALT_ROUNDS = 10;

  static async hashPassword(password: string): Promise<string> {
    if (!password || typeof password !== 'string' || password.trim() === '') {
      throw new Error("Password must be a non-empty string");
    }

    try {
      return await bcrypt.hash(password, this.SALT_ROUNDS);
    } catch (error) {
      logger.error("Password hashing process failed", { error });
      throw new Error("Internal security error during hashing");
    }
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) return false;

    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error("Password comparison exception", { error });
      return false; 
    }
  }
}
