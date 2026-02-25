import bcrypt from 'bcrypt';
import { envVars } from '../../../config/env.service.js';

export class PasswordUtil {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password,+(envVars.salt || 10));
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
