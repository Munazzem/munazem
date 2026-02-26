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

    const token = TokenUtil.generateToken({
        userId: user._id.toString(),
        role: user.role,
        teacherId: user.teacherId ? user.teacherId.toString() : null
    });

    const userObject = user.toObject();
    delete userObject.password;

    return {
        message: 'تم تسجيل الدخول بنجاح',
        token,
        user: userObject
    };
}

export const signup = async(data: any)=>{
    const {name, email , password , phone} = data;

    const exsistUser = await UserModel.findOne({email})
    if (exsistUser) {
        throw ConflictException({ message: "User already exists with this email" })
    }
    const userData = await UserModel.create({name,email,password,phone})
    return userData
}