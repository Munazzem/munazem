import { GroupModel } from '../../database/models/group.model.js';
import { StudentModel } from '../../database/models/student.model.js';
import { NotFoundException, BadRequestException } from '../../common/utils/response/error.responce.js';
import type { CreateGroupDTO, UpdateGroupDTO } from '../../types/dto.types.js';
import { UserModel } from '../../database/models/user.model.js';
import { STAGE_GRADES, GradeLevel, TeacherStage } from '../../common/enums/enum.service.js';

export class GroupService {
    
    // Create a new group (Only Assistants can trigger this in the controller)
    static async createGroup(teacherId: string, data: CreateGroupDTO) {
        // Enforce teacher stage limits
        const teacher = await UserModel.findById(teacherId, { stage: 1 }).lean();
        if (!teacher) throw NotFoundException({ message: 'المعلم غير موجود' });

        if (teacher.stage) {
            const allowedGrades = STAGE_GRADES[teacher.stage as TeacherStage];
            if (!allowedGrades.includes(data.gradeLevel as GradeLevel)) {
                const stageName = teacher.stage === TeacherStage.PREPARATORY ? 'الإعدادية' : 'الثانوية';
                throw BadRequestException({ message: `هذا المعلم مسجل للمرحلة ${stageName} فقط. لا يمكن إنشاء مجموعة لهذه المرحلة الدراسية.` });
            }
        }

        return await GroupModel.create({
            name:       data.name,
            gradeLevel: data.gradeLevel,
            schedule:   data.schedule,
            teacherId,
            ...(data.capacity ? { capacity: data.capacity } : {}),
        });
    }

    // Get all groups for a specific teacher with pagination
    static async getGroupsByTeacherId(teacherId: string, queryFilters: any = {}) {
        const page  = Math.max(1, parseInt(queryFilters.page)  || 1);
        const limit = Math.min(100, Math.max(1, parseInt(queryFilters.limit) || 20));
        const skip  = (page - 1) * limit;

        const [groups, total] = await Promise.all([
            GroupModel.find({ teacherId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            GroupModel.countDocuments({ teacherId })
        ]);

        // Attach studentsCount to each group in one aggregation query
        const groupIds = groups.map(g => g._id);
        const countAgg = groupIds.length > 0
            ? await StudentModel.aggregate([
                { $match: { groupId: { $in: groupIds } } },
                { $group: { _id: '$groupId', count: { $sum: 1 } } },
            ])
            : [];
        const countMap = new Map(countAgg.map(c => [c._id.toString(), c.count]));

        const data = groups.map(g => ({
            ...g,
            studentsCount: countMap.get(g._id.toString()) ?? 0,
        }));

        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    // Get a specific group details
    static async getGroupById(groupId: string, teacherId: string) {
        const group = await GroupModel.findOne({ _id: groupId, teacherId }).lean();
        if (!group) throw NotFoundException({ message: 'المجموعة غير موجودة' });
        return group;
    }

    // Update group
    static async updateGroup(groupId: string, teacherId: string, data: UpdateGroupDTO) {
        const updatedGroup = await GroupModel.findOneAndUpdate(
            { _id: groupId, teacherId },
            data,
            { new: true, runValidators: true }
        ).lean();

        if (!updatedGroup) throw NotFoundException({ message: 'المجموعة غير موجودة' });
        return updatedGroup;
    }

    // Delete group — guarded: refuses if students still exist in the group
    static async deleteGroup(groupId: string, teacherId: string) {
        const group = await GroupModel.findOne({ _id: groupId, teacherId }).lean();
        if (!group) throw NotFoundException({ message: 'المجموعة غير موجودة' });

        const studentsCount = await StudentModel.countDocuments({ groupId, teacherId });
        if (studentsCount > 0) {
            throw BadRequestException({ message: `لا يمكن حذف المجموعة، يوجد بها ${studentsCount} طالب. يرجى نقل الطلاب أولاً` });
        }

        await GroupModel.findOneAndDelete({ _id: groupId, teacherId });
        return group;
    }
}
