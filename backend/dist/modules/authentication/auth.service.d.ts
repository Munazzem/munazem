import type { ILoginRequest, IAuthResponse } from "../../types/auth.types.js";
export declare const login: (data: ILoginRequest) => Promise<IAuthResponse>;
export declare const refreshTokens: (refreshToken: string) => Promise<{
    token: string;
    refreshToken: string;
}>;
//# sourceMappingURL=auth.service.d.ts.map