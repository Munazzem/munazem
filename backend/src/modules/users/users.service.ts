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
            // Force the role to Assistant (ignoring whatever was sent)
            data.role = UserRole.assistant;
            data.teacherId = creatorId;
        }

        if (creatorRole === UserRole.superAdmin) {
            // Force the role to Teacher (ignoring whatever was sent)
            data.role = UserRole.teacher;
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