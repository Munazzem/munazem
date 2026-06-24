import type { IJwtPayload } from "../../types/auth.types.js";
export declare class TokenUtil {
    static generateAccessToken(payload: IJwtPayload, expiresIn?: string | number): string;
    static generateRefreshToken(payload: IJwtPayload, expiresIn?: string | number): string;
    static verifyAccessToken(token: string): IJwtPayload;
    static verifyRefreshToken(token: string): IJwtPayload;
}
//# sourceMappingURL=token.util.d.ts.map