import { ConflictException, UnauthorizedException } from "../../common/utils/response/error.responce.js";
import { UserModel } from "../../database/models/user.model.js";
import { PasswordUtil } from "../../common/utils/password.util.js";
import { TokenUtil } from "../../common/utils/token.util.js";
import type { ILoginRequest, IAuthResponse } from "../../types/auth.types.js";

export const login = async (data: ILoginRequest): Promise<IAuthResponse> => {
    const { phone, password } = data;

    const user = await UserModel.findOne({ phone }).select('+password');
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
        teacherId: user.teacherId ? user.teacherId.toString() : null
    };

    const token = TokenUtil.generateAccessToken(payload);
    const refreshToken = TokenUtil.generateRefreshToken(payload);

    const userObject = user.toObject();
    delete userObject.password;

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

export const signup = async(data: any)=>{
    const {name, email , password , phone} = data;

    const exsistUser = await UserModel.findOne({email})
    if (exsistUser) {
        throw ConflictException({ message: "User already exists with this email" })
    }
    
    const hashedPassword = await PasswordUtil.hashPassword(password);
    
    const userData = await UserModel.create({name, email, password: hashedPassword, phone})
    
    const userObject = userData.toObject();
    delete userObject.password;
    
    return userObject;
}