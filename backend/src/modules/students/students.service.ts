import { StudentModel } from '../../database/models/student.model.js';
import { GroupModel } from '../../database/models/group.model.js';
import { NotFoundException, BadRequestException, ConflictException } from '../../common/utils/response/error.responce.js';
import type { CreateStudentDTO, UpdateStudentDTO } from '../../types/dto.types.js';
import { GRADE_LETTER, GradeLevel } from '../../common/enums/enum.service.js';
import { nextSequence } from '../../database/models/counter.model.js';

export class StudentService {
    
    // Core logic for splitting the full name
    private static parseFullName(fullName: string): { studentName: string; parentName: string } {
        const parts = fullName.trim().split(/\s+/);
        if (parts.length < 2) {
            throw BadRequestException({ message: 'الرجاء إدخال الاسم الثنائي على الأقل (اسم الطالب واسم الأب)' });
        }
        const studentName = parts[0] as string; // safe: length >= 2 guaranteed above
        const parentName = parts.slice(1).join(' ');
        return { studentName, parentName };
    }

    static async createStudent(teacherId: string, data: CreateStudentDTO) {
        // 1. Verify group exists and belongs to this teacher
        const group = await GroupModel.findOne({ _id: data.groupId, teacherId }).lean();
        if (!group) {
            throw NotFoundException({ message: 'المجموعة غير موجودة أو لا صلاحية لك عليها' });
        }

        // 2. Parse the name
        const { studentName, parentName } = this.parseFullName(data.fullName);

        // 3. Generate sequential code per grade level per teacher
        const letter = GRADE_LETTER[data.gradeLevel as GradeLevel];
        const count  = await nextSequence(`${teacherId}_${data.gradeLevel}`);
        const studentCode = `${count}${letter}`;  // e.g. 1A, 25C

        // 4. Create — explicit fields only (no spread of DTO to avoid fullName leaking into model)
        try {
            return await StudentModel.create({
                studentName,
                parentName,
                studentPhone: data.studentPhone,
                parentPhone:  data.parentPhone,
                gradeLevel:   data.gradeLevel,
                groupId:      data.groupId,
                teacherId,
                studentCode,
                ...(data.barcode ? { barcode: data.barcode } : {}),
            });
        } catch (error: any) {
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
        
        // Search by phone or barcode — anchored prefix regex (^) leverages the existing index
        // Unlike /search/i which does a full collection scan, /^search/ uses the B-tree index
        if (queryFilters.search) {
            const prefixRegex = new RegExp(`^${queryFilters.search}`);
            filter.$or = [
                { studentPhone: prefixRegex },
                { parentPhone:  prefixRegex },
                { barcode:      prefixRegex },
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

    static async updateStudent(studentId: string, teacherId: string, data: UpdateStudentDTO) {
        // Build a typed update payload — extend with parsed name fields if needed
        type UpdatePayload = Omit<UpdateStudentDTO, 'fullName'> & {
            studentName?: string;
            parentName?: string;
        };
        const updatePayload: UpdatePayload = { ...data };
        delete (updatePayload as any).fullName;

        if (data.fullName) {
            const { studentName, parentName } = this.parseFullName(data.fullName);
            updatePayload.studentName = studentName;
            updatePayload.parentName = parentName;
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
