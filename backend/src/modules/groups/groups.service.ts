import { GroupModel } from '../../database/models/group.model.js';
import { NotFoundException } from '../../common/utils/response/error.responce.js';

export class GroupService {
    
    // Create a new group (Only Assistants can trigger this in the controller)
    static async createGroup(teacherId: string, data: any) {
        return await GroupModel.create({
            ...data,
            teacherId
        });
    }

    // Get all groups for a specific teacher (Both Assistants and Teachers can access this)
    static async getGroupsByTeacherId(teacherId: string) {
        // [PERFORMANCE OPTIMIZATION] Using .lean() to drastically reduce memory usage
        return await GroupModel.find({ teacherId }).lean();
    }

    // Get a specific group details
    static async getGroupById(groupId: string, teacherId: string) {
        // [PERFORMANCE OPTIMIZATION] Using .lean()
        const group = await GroupModel.findOne({ _id: groupId, teacherId }).lean();
        if (!group) throw NotFoundException({ message: 'المجموعة غير موجودة' });
        return group;
    }

    // Update group
    static async updateGroup(groupId: string, teacherId: string, data: any) {
        // [NOTE] Re-fetching without .lean() here because we might need Mongoose validation upon save if complex logic is added later.
        // Or we can just use findOneAndUpdate for atomic fast updates and return the new document.
        const updatedGroup = await GroupModel.findOneAndUpdate(
            { _id: groupId, teacherId },
            data,
            { new: true, runValidators: true }
        ).lean();

        if (!updatedGroup) throw NotFoundException({ message: 'المجموعة غير موجودة' });
        return updatedGroup;
    }

    // Delete group (or soft delete)
    static async deleteGroup(groupId: string, teacherId: string) {
        const deletedGroup = await GroupModel.findOneAndDelete({ _id: groupId, teacherId }).lean();
        if (!deletedGroup) throw NotFoundException({ message: 'المجموعة غير موجودة' });
        return deletedGroup;
    }
}
