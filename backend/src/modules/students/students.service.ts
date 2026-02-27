import { StudentModel } from '../../database/models/student.model.js';
import { GroupModel } from '../../database/models/group.model.js';
import { NotFoundException, BadRequestException, ConflictException } from '../../common/utils/response/error.responce.js';

export class StudentService {
    
    // Core logic for splitting the full name
    private static parseFullName(fullName: string) {
        const parts = fullName.trim().split(/\s+/);
        if (parts.length < 2) {
            throw BadRequestException({ message: 'الرجاء إدخال الاسم الثنائي على الأقل (اسم الطالب واسم الأب)' });
        }
        const studentName = parts[0];
        const parentName = parts.slice(1).join(' '); // Rejoin the rest of the names
        return { studentName, parentName };
    }

    static async createStudent(teacherId: string, data: any) {
        // 1. Verify group exists and belongs to this teacher
        const group = await GroupModel.findOne({ _id: data.groupId, teacherId }).lean();
        if (!group) {
            throw NotFoundException({ message: 'المجموعة غير موجودة أو لا صلاحية لك عليها' });
        }

        // 2. Parse the name
        const { studentName, parentName } = this.parseFullName(data.fullName);

        // 3. Create
        try {
            return await StudentModel.create({
                ...data,
                studentName,
                parentName,
                teacherId
            });
        } catch (error: any) {
            // Handle duplicate phone number indexing explicitly to give user-friendly message
            if (error.code === 11000) {
                if (error.keyPattern?.studentPhone) {
                    throw ConflictException({ message: 'يوجد طالب آخر مسجل بنفس رقم الهاتف مع هذا المعلم' });
                }
                if (error.keyPattern?.barcode) {
                    throw ConflictException({ message: 'رقم الباركود هذا مستخدم بالفعل لطالب آخر' });
                }
            }
            throw error;
        }
    }

    static async getStudentsByTeacherId(teacherId: string, queryFilters: any) {
        // Build robust filter query dynamically
        const filter: any = { teacherId };
        
        if (queryFilters.groupId) filter.groupId = queryFilters.groupId;
        if (queryFilters.gradeLevel) filter.gradeLevel = queryFilters.gradeLevel;
        if (queryFilters.isActive !== undefined) filter.isActive = queryFilters.isActive === 'true';
        
        // Search by phone or barcode if provided
        if (queryFilters.search) {
             filter.$or = [
                 { studentPhone: new RegExp(queryFilters.search, 'i') },
                 { parentPhone: new RegExp(queryFilters.search, 'i') },
                 { barcode: new RegExp(queryFilters.search, 'i') },
             ];
        }

        // Pagination
        const page  = Math.max(1, parseInt(queryFilters.page)  || 1);
        const limit = Math.min(100, Math.max(1, parseInt(queryFilters.limit) || 20));
        const skip  = (page - 1) * limit;

        // Run both queries in parallel for efficiency
        const [data, total] = await Promise.all([
            StudentModel.find(filter)
                .populate('groupId', 'name schedule')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            StudentModel.countDocuments(filter)
        ]);

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

    static async getStudentById(studentId: string, teacherId: string) {
        const student = await StudentModel.findOne({ _id: studentId, teacherId })
                        .populate('groupId', 'name schedule')
                        .lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });
        return student;
    }

    static async updateStudent(studentId: string, teacherId: string, data: any) {
        // If fullName is updated, we must re-parse it
        let updatePayload = { ...data };
        if (data.fullName) {
            const { studentName, parentName } = this.parseFullName(data.fullName);
            updatePayload.studentName = studentName;
            updatePayload.parentName = parentName;
            delete updatePayload.fullName;
        }

        try {
            const updatedStudent = await StudentModel.findOneAndUpdate(
                { _id: studentId, teacherId },
                updatePayload,
                { new: true, runValidators: true }
            ).lean();

            if (!updatedStudent) throw NotFoundException({ message: 'الطالب غير موجود' });
            return updatedStudent;
            
        } catch (error: any) {
             if (error.code === 11000) {
                 if (error.keyPattern?.studentPhone) throw ConflictException({ message: 'رقم الهاتف مستخدم لطالب آخر' });
                 if (error.keyPattern?.barcode) throw ConflictException({ message: 'الباركود مستخدم لطالب آخر' });
             }
             throw error;
        }
    }

    static async deleteStudent(studentId: string, teacherId: string) {
        const deletedStudent = await StudentModel.findOneAndDelete({ _id: studentId, teacherId }).lean();
        if (!deletedStudent) throw NotFoundException({ message: 'الطالب غير موجود' });
        return deletedStudent;
    }
}
