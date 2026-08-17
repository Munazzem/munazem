import mongoose from 'mongoose';
import { StudentModel } from '../../database/models/student.model.js';
import { GroupModel } from '../../database/models/group.model.js';
import { TransactionModel } from '../../database/models/transaction.model.js';
import { CycleEnrollmentModel } from '../../database/models/cycle-enrollment.model.js';
import { NotFoundException, BadRequestException, ConflictException } from '../../common/utils/response/error.responce.js';
import type { CreateStudentDTO, UpdateStudentDTO } from '../../types/dto.types.js';
import { GRADE_LETTER, GradeLevel, TransactionType, TransactionCategory, CycleEnrollmentStatus } from '../../common/enums/enum.service.js';
import { nextSequence, nextSequenceBulk } from '../../database/models/counter.model.js';
import { trackEvent } from '../../common/utils/activity.service.js';
import { withTransaction } from '../../common/utils/transaction.util.js';
import { cache, CacheKeys } from '../../infrastructure/cache/cache.service.js';
import { Types } from 'mongoose';
import crypto from 'crypto';

export class StudentService {
    
    // Core logic for splitting the full name
    private static parseFullName(fullName: string): { studentName: string; parentName: string } {
        const parts = fullName.trim().split(/\s+/);
        if (parts.length < 2) {
            throw BadRequestException({ message: 'الرجاء إدخال الاسم الثنائي على الأقل (اسم الطالب واسم الأب)' });
        }
        // studentName = full name as entered (so "محمد أحمد علي" is stored and displayed in full)
        // parentName  = everything after the first word (used for parent contact reference)
        const studentName = parts.join(' ');
        const parentName  = parts.slice(1).join(' ');
        return { studentName, parentName };
    }

    static async createStudent(teacherId: string, data: CreateStudentDTO) {
        // 1. Verify group exists and belongs to this teacher
        const group = await GroupModel.findOne({ _id: data.groupId, teacherId }).lean();
        if (!group) {
            throw NotFoundException({ message: 'المجموعة غير موجودة أو لا صلاحية لك عليها' });
        }

        // 2. Enforce grade-level match
        if (group.gradeLevel !== data.gradeLevel) {
            throw BadRequestException({ message: 'عفواً، هذه المجموعة لمرحلة دراسية مختلفة' });
        }

        // 3. Enforce capacity limit
        const capacity = group.capacity ?? 50;
        const currentCount = await StudentModel.countDocuments({ groupId: data.groupId, teacherId });
        if (currentCount >= capacity) {
            throw BadRequestException({ message: `عفواً، وصلت المجموعة إلى أقصى عدد متاح (الطاقة: ${capacity} طالب)` });
        }

        // 2. Parse the name
        const { studentName, parentName } = this.parseFullName(data.fullName);

        // 3. Generate sequential code per grade level per teacher
        const letter = GRADE_LETTER[data.gradeLevel as GradeLevel];
        const count  = await nextSequence(`${teacherId}_${data.gradeLevel}`);
        const studentCode = `${count}${letter}`;  // e.g. 1A, 25C

        // 4. Create — explicit fields only (no spread of DTO to avoid fullName leaking into model)
        try {
            const student = await StudentModel.create({
                studentName,
                parentName,
                studentPhone: data.studentPhone,
                parentPhone:  data.parentPhone,
                gradeLevel:   data.gradeLevel,
                groupId:      data.groupId,
                teacherId,
                studentCode,
                barcode: data.barcode || crypto.randomUUID(),
                monthlySessionsQuota: (group.schedule?.length ?? 2) * 4, // Dynamic from schedule
            });

            trackEvent('student_created', {
                tenantId: teacherId,
                userId:   teacherId,
                targetId: student._id.toString(),
                meta:     { studentName, studentCode, groupName: group.name },
            });

            // Invalidate teacher cache (dashboard stats, student counts)
            await cache.invalidate(CacheKeys.teacherAll(teacherId));

            return student;
        } catch (error: any) {
            if (error.code === 11000) {
                if (error.keyPattern?.barcode) {
                    throw ConflictException({ message: 'رقم الباركود هذا مستخدم بالفعل لطالب آخر' });
                }
            }
            throw error;
        }
    }

    static async bulkCreateStudents(teacherId: string, students: CreateStudentDTO[]) {
        const result = await withTransaction(async (dbSession) => {
            // ── Phase 1: جلب كل المجموعات الفريدة دفعة واحدة (1 query) ──────────────
            const uniqueGroupIds = [...new Set(students.map(s => s.groupId))];
            const groups = await GroupModel.find(
                { _id: { $in: uniqueGroupIds }, teacherId },
            ).session(dbSession).lean();
            const groupMap = new Map(groups.map(g => [g._id.toString(), g]));

            // ── Phase 2: حساب عدد الطلاب الحاليين لكل مجموعة (1 query) ─────────────
            const countAgg = await StudentModel.aggregate([
                { $match: { groupId: { $in: uniqueGroupIds.map(id => new Types.ObjectId(id)) }, teacherId } },
                { $group: { _id: '$groupId', count: { $sum: 1 } } },
            ]).session(dbSession);
            const countMap = new Map(countAgg.map(c => [c._id.toString(), c.count]));

            // ── Phase 3: التحقق من كل طالب على حدة ────────────────────────────────
            const pendingPerGroup = new Map<string, number>();

            for (let i = 0; i < students.length; i++) {
                const s = students[i]!;
                const rowNum = i + 1;

                // التحقق من الاسم
                this.parseFullName(s.fullName);

                // التحقق من المجموعة
                const group = groupMap.get(s.groupId);
                if (!group) {
                    throw NotFoundException({ message: `المجموعة غير موجودة في السطر ${rowNum}` });
                }

                // التحقق من مطابقة المرحلة
                if (group.gradeLevel !== s.gradeLevel) {
                    throw BadRequestException({ message: `المرحلة غير مطابقة للمجموعة للطالب ${s.fullName} في السطر ${rowNum}` });
                }

                // التحقق من سعة المجموعة
                const currentCount = countMap.get(s.groupId) ?? 0;
                const pendingCount = pendingPerGroup.get(s.groupId) ?? 0;
                const capacity = group.capacity ?? 50;

                if (currentCount + pendingCount >= capacity) {
                    throw BadRequestException({
                        message: `المجموعة "${group.name}" وصلت للحد الأقصى (${capacity} طالب) عند السطر ${rowNum}`
                    });
                }

                pendingPerGroup.set(s.groupId, pendingCount + 1);
            }

            // ── Phase 4: توليد الأكواد التسلسلية دفعة واحدة لكل مرحلة ──────────────
            const studentsByGrade = new Map<GradeLevel, CreateStudentDTO[]>();
            for (const s of students) {
                const list = studentsByGrade.get(s.gradeLevel as GradeLevel) ?? [];
                list.push(s);
                studentsByGrade.set(s.gradeLevel as GradeLevel, list);
            }

            const codeMap = new Map<CreateStudentDTO, string>();

            for (const [grade, gradeStudents] of studentsByGrade.entries()) {
                const letter = GRADE_LETTER[grade];
                const startSeq = await nextSequenceBulk(`${teacherId}_${grade}`, gradeStudents.length);
                gradeStudents.forEach((s, idx) => {
                    codeMap.set(s, `${startSeq + idx}${letter}`);
                });
            }

            // ── Phase 5: تجهيز المستندات للإدخال ────────────────────────────────────
            const preparedDocs = students.map(data => {
                const { studentName, parentName } = this.parseFullName(data.fullName);
                const group = groupMap.get(data.groupId)!;
                return {
                    studentName,
                    parentName,
                    studentPhone: data.studentPhone,
                    parentPhone:  data.parentPhone,
                    gradeLevel:   data.gradeLevel,
                    groupId:      data.groupId,
                    teacherId,
                    studentCode:  codeMap.get(data)!,
                    barcode:      data.barcode || crypto.randomUUID(),
                    monthlySessionsQuota: (group.schedule?.length ?? 2) * 4,
                };
            });

            // ── Phase 6: الإدخال دفعة واحدة (1 query) ───────────────────────────────
            try {
                const created = await StudentModel.insertMany(preparedDocs, { session: dbSession });

                return {
                    results: created.map((s, idx) => ({ index: idx, success: true, studentName: s.studentName, studentCode: s.studentCode })),
                    successCount: created.length,
                    failCount:    0,
                    total:        students.length,
                };
            } catch (error: any) {
                // استخراج رقم السطر الدقيق من BulkWriteError
                let message = 'حدث خطأ أثناء الإضافة';
                if (error.code === 11000) {
                    const failedIndex: number = error.writeErrors?.[0]?.index ?? 0;
                    const failedStudent = students[failedIndex]!;
                    const rowNum = failedIndex + 1;
                    if (error.writeErrors?.[0]?.err?.keyPattern?.barcode) {
                        message = `الباركود مستخدم مسبقاً للطالب ${failedStudent.fullName} في السطر ${rowNum}`;
                    } else if (error.writeErrors?.[0]?.err?.keyPattern?.studentCode) {
                        message = `كود الطالب مستخدم مسبقاً في السطر ${rowNum}`;
                    } else {
                        message = `رقم الهاتف مسجل مسبقاً للطالب ${failedStudent.fullName} في السطر ${rowNum}`;
                    }
                }
                throw BadRequestException({ message });
            }
        });

        // Invalidate teacher cache
        await cache.invalidate(CacheKeys.teacherAll(teacherId));

        return result;
    }

    static async getPaidStudentIds(teacherId: string): Promise<string[]> {
        // Fetch all groups to know their current cycle number
        const groups = await GroupModel.find({ teacherId }, { 'cycle.currentCycleNumber': 1 }).lean();
        const paidIds = new Set<string>();

        const orConditions = groups.map(g => ({
            groupId: g._id,
            cycleNumber: g.cycle?.currentCycleNumber || 1,
            status: CycleEnrollmentStatus.PAID
        }));

        if (orConditions.length > 0) {
            const enrollments = await CycleEnrollmentModel.find({
                teacherId,
                $or: orConditions
            }, { studentId: 1 }).lean();

            for (const e of enrollments) {
                paidIds.add(e.studentId.toString());
            }
        }

        return Array.from(paidIds);
    }

    static async getUnpaidStudentIds(teacherId: string): Promise<string[]> {
        const paidIds = await StudentService.getPaidStudentIds(teacherId);
        const activeStudents = await StudentModel.find({ teacherId, isActive: true }, { _id: 1 }).lean();
        
        const paidSet = new Set(paidIds);
        const unpaidIds = activeStudents
            .map(s => s._id.toString())
            .filter(id => !paidSet.has(id));
            
        return unpaidIds;
    }

    static async getStudentsByTeacherId(teacherId: string, queryFilters: any) {
        // Build robust filter query dynamically
        const filter: any = { teacherId };
        
        if (queryFilters.groupId) filter.groupId = queryFilters.groupId;
        if (queryFilters.gradeLevel) filter.gradeLevel = queryFilters.gradeLevel;
        if (queryFilters.isActive !== undefined) filter.isActive = queryFilters.isActive === 'true';

        // Student Affairs Filters
        if (queryFilters.hasDebt === 'true') {
            filter.totalDebt = { $gt: 0 };
        }
        if (queryFilters.hasNoActiveSubscription === 'true') {
            const paidIds = await StudentService.getPaidStudentIds(teacherId);
            filter._id = { $nin: paidIds.map((id: string) => new mongoose.Types.ObjectId(id)) };
        }
        if (queryFilters.isDroppedOut === 'true') {
            filter.consecutiveAbsences = { $gte: 3 };
        }
        
        if (queryFilters.search) {
            // Check if search term is possibly a studentCode (e.g., "1A", "12C")
            // Or just a general string. We'll use regex for all to be safe and flexible.
            const searchTerm = queryFilters.search.trim();
            const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const prefixRegex = new RegExp(`^${escaped}`, 'i');
            const anywhereRegex = new RegExp(escaped, 'i');

            filter.$or = [
                { studentCode:  prefixRegex },
                { studentPhone: prefixRegex },
                { parentPhone:  prefixRegex },
                { barcode:      prefixRegex },
                { studentName:  anywhereRegex }, // Allow searching ANY part of the name
            ];
        }

        // Pagination
        const page  = Math.max(1, parseInt(queryFilters.page)  || 1);
        const limit = Math.min(1000, Math.max(1, parseInt(queryFilters.limit) || 20));
        const skip  = (page - 1) * limit;

        // Run queries in parallel for efficiency
        const [students, total] = await Promise.all([
            StudentModel.find(filter)
                .populate('groupId', 'name schedule')
                .sort({ studentName: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            StudentModel.countDocuments(filter)
        ]);

        // Determine active subscription via cycle rules (dynamically)
        const studentIds = students.map((s: any) => s._id.toString());
        let paidIdsList: string[] = [];
        if (studentIds.length > 0) {
            paidIdsList = await StudentService.getPaidStudentIds(teacherId);
        }
        const paidSet = new Set(paidIdsList);

        const data = students.map((s: any) => ({
            ...s,
            hasActiveSubscription: paidSet.has(s._id.toString()),
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

        // If groupId is being changed, make sure the new group belongs to this teacher
        if (data.groupId) {
            const group = await GroupModel.findOne({ _id: data.groupId, teacherId }).lean();
            if (!group) {
                throw NotFoundException({ message: 'المجموعة الجديدة غير موجودة أو لا صلاحية لك عليها' });
            }
        }

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

            // Invalidate teacher cache
            await cache.invalidate(CacheKeys.teacherAll(teacherId));

            return updatedStudent;
            
        } catch (error: any) {
             if (error.code === 11000) {
                 if (error.keyPattern?.barcode) throw ConflictException({ message: 'الباركود مستخدم لطالب آخر' });
             }
             throw error;
        }
    }

    static async deleteStudent(studentId: string, teacherId: string) {
        const deletedStudent = await StudentModel.findOneAndDelete({ _id: studentId, teacherId }).lean();
        if (!deletedStudent) throw NotFoundException({ message: 'الطالب غير موجود' });

        trackEvent('student_deleted', {
            tenantId: teacherId,
            userId:   teacherId,
            targetId: studentId,
            meta:     { studentName: deletedStudent.studentName, studentCode: deletedStudent.studentCode },
        });

        // Invalidate teacher cache
        await cache.invalidate(CacheKeys.teacherAll(teacherId));

        return deletedStudent;
    }
}
