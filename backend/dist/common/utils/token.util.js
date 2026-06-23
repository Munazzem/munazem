import jwt from "jsonwebtoken";
import { envVars } from "../../../config/env.service.js";
const JWT_SECRET = envVars.jwtSecret;
const REFRESH_SECRET = envVars.jwtRefreshSecret;
if (!JWT_SECRET || !REFRESH_SECRET) {
    throw new Error("Critical: JWT Secrets are missing from environment variables!");
}
export class TokenUtil {
    static generateAccessToken(payload, expiresIn = "1d") {
        return jwt.sign(payload, JWT_SECRET, {
            expiresIn: expiresIn,
        });
    }
    static generateRefreshToken(payload, expiresIn = "1y") {
        return jwt.sign(payload, REFRESH_SECRET, {
            expiresIn: expiresIn,
        });
    }
    static verifyAccessToken(token) {
        return jwt.verify(token, JWT_SECRET);
    }
    static verifyRefreshToken(token) {
        return jwt.verify(token, REFRESH_SECRET);
    }
}
//# sourceMappingURL=token.util.js.map