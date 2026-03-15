import { ConflictException, UnauthorizedException } from "../../common/utils/response/error.responce.js";
import { UserModel } from "../../database/models/user.model.js";
import { PasswordUtil } from "../../common/utils/password.util.js";
import { TokenUtil } from "../../common/utils/token.util.js";
import type { ILoginRequest, IAuthResponse } from "../../types/auth.types.js";

export const login = async (data: ILoginRequest): Promise<IAuthResponse> => {
    const { phone, password } = data;

    // [PERFORMANCE OPTIMIZATION] Using .lean() to bypass Mongoose hydration. Faster read times for login.
    const user = await UserModel.findOne({ phone }).select('+password').lean();
    if (!user) {
        throw UnauthorizedException({ message: 'رقم الهاتف أو كلمة المرور غير صحيحة' });
    }

    const isPasswordValid = await PasswordUtil.comparePassword(password, user.password as string);
    if (!isPasswordValid) {
        throw UnauthorizedException({ message: 'رقم الهاتف أو كلمة المرور غير صحيحة' });
    }

    if (!user.isActive) {
        throw UnauthorizedException({ message: 'تم إيقاف هذا الحساب، يرجى مراجعة الإدارة' });
    }

    const payload = {
        userId: user._id.toString(),
        role: user.role,
        teacherId: user.teacherId ? user.teacherId.toString() : null,
        isActive: user.isActive
    };

    const token = TokenUtil.generateAccessToken(payload);
    const refreshToken = TokenUtil.generateRefreshToken(payload);

    // Since we used .lean(), 'user' is already a plain JS object, so we don't need .toObject()
    const userObject: any = { ...user };
    delete userObject.password;

    // BRANDING INHERITANCE: If assistant, merge teacher's center info
    if (user.role === 'assistant' && user.teacherId) {
        const teacher = await UserModel.findById(user.teacherId, { centerName: 1, logoUrl: 1 }).lean();
        if (teacher) {
            userObject.centerName = teacher.centerName;
            userObject.logoUrl = teacher.logoUrl;
        }
    }

    return {
        message: 'تم تسجيل الدخول بنجاح',
        token,
        refreshToken,
        user: userObject
    };
}

export const refreshTokens = async (refreshToken: string) => {
    if (!refreshToken) {
        throw UnauthorizedException({ message: 'Refresh token is required' });
    }

    try {
        const payload = TokenUtil.verifyRefreshToken(refreshToken);
        
        // Remove iat and exp from payload to generate a fresh token
        const newPayload = { ...payload };
        delete (newPayload as any).iat;
        delete (newPayload as any).exp;

        const newToken = TokenUtil.generateAccessToken(newPayload);
        const newRefreshToken = TokenUtil.generateRefreshToken(newPayload);

        return {
            token: newToken,
            refreshToken: newRefreshToken
        };
    } catch (error) {
        throw UnauthorizedException({ message: 'Invalid or expired refresh token' });
    }
}