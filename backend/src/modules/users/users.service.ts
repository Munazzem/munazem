import { UserModel } from '../../database/models/user.model.js';
import { PasswordUtil } from '../../common/utils/password.util.js';
import { UserRole } from '../../common/enums/enum.service.js';
import { UnauthorizedException, BadRequestException } from '../../common/utils/response/error.responce.js';

export class UserService {
    static async createUser(creatorRole: string, creatorId: string, data: any) {

        if (creatorRole === UserRole.assistant) {
            throw UnauthorizedException({ message: 'غير مصرح لك بإضافة مستخدمين للنظام' });
        }

        if (creatorRole === UserRole.teacher) {
            if (data.role !== UserRole.assistant) {
                throw UnauthorizedException({ message: 'المدرس صلاحياته تقتصر على إضافة مساعدين فقط' });
            }
            data.teacherId = creatorId;
        }

        if (creatorRole === UserRole.superAdmin && data.role === UserRole.teacher) {
            data.teacherId = null;
        }

        const existingUser = await UserModel.findOne({ phone: data.phone });
        if (existingUser) {
            throw BadRequestException({ message: 'رقم الهاتف مسجل بالفعل في النظام' });
        }
        const hashedPassword = await PasswordUtil.hashPassword(data.password);

        const newUser = await UserModel.create({
            ...data,
            password: hashedPassword,
        });

        const userObject = newUser.toObject();
        delete userObject.password;

        return userObject;
    }
}