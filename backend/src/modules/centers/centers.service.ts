import { Types } from 'mongoose';
import { CenterModel } from '../../database/models/center.model.js';
import { CenterTeacherModel } from '../../database/models/center-teacher.model.js';
import { CenterPackageModel } from '../../database/models/center-package.model.js';
import { CenterGroupModel } from '../../database/models/center-group.model.js';
import { CenterAttendanceModel } from '../../database/models/center-attendance.model.js';
import { CenterEnrollmentModel } from '../../database/models/center-enrollment.model.js';
import { UserModel } from '../../database/models/user.model.js';
import { StudentModel } from '../../database/models/student.model.js';
import { TransactionModel } from '../../database/models/transaction.model.js';
import { UserRole, CenterSupervisorType, TransactionType, TransactionCategory } from '../../common/enums/enum.service.js';
import { ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '../../common/utils/response/error.responce.js';
import { PasswordUtil } from '../../common/utils/password.util.js';
import type { ISupervisorPermissions } from '../../types/center.types.js';

export class CenterService {
    // ── Helper: Resolve Center ID & Verify Ownership ──────────────────────────
    static async resolveCenter(user: any, requestedCenterId?: string) {
        if (user.role === UserRole.centerSupervisor) {
            if (!user.centerId) {
                throw ForbiddenException({ message: 'حساب المشرف غير مرتبط بفرع' });
            }
            return user.centerId.toString();
        }

        if (user.role === UserRole.centerOwner) {
            // If requested branch specified, verify owner owns it
            if (requestedCenterId) {
                const center = await CenterModel.findOne({
                    _id: requestedCenterId,
                    ownerId: user.userId,
                    isActive: true,
                }).lean();
                if (!center) {
                    throw NotFoundException({ message: 'الفرع غير موجود أو غير تابع لك' });
                }
                return requestedCenterId;
            }

            // Fallback to main center (parentCenterId: null) or user.centerId
            const mainCenter = await CenterModel.findOne({
                ownerId: user.userId,
                parentCenterId: null,
                isActive: true,
            }).lean();

            if (mainCenter) return mainCenter._id.toString();

            // Any active center for this owner
            const anyCenter = await CenterModel.findOne({
                ownerId: user.userId,
                isActive: true,
            }).lean();

            if (anyCenter) return anyCenter._id.toString();

            throw NotFoundException({ message: 'لم يتم العثور على أي سنتر مسجل لهذا الحساب' });
        }

        if (user.role === UserRole.superAdmin) {
            if (!requestedCenterId) {
                throw BadRequestException({ message: 'معرف السنتر مطلوب للأدمن' });
            }
            return requestedCenterId;
        }

        throw ForbiddenException({ message: 'غير مصرح لك بإدارة هذا السنتر' });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 1. Centers & Branches
    // ══════════════════════════════════════════════════════════════════════════

    static async createCenter(ownerId: string, data: any) {
        const existingMain = await CenterModel.findOne({
            ownerId,
            parentCenterId: null,
            isActive: true,
        }).lean();

        if (existingMain) {
            throw ConflictException({ message: 'لديك سنتر رئيسي بالفعل. يمكنك إضافة فروع جديدة.' });
        }

        const center = await CenterModel.create({
            name: data.name,
            ownerId,
            phone: data.phone || null,
            address: data.address || null,
            logoUrl: data.logoUrl || null,
            parentCenterId: null,
            isActive: true,
        });

        // Link centerId to user
        await UserModel.findByIdAndUpdate(ownerId, { centerId: center._id });

        return center;
    }

    static async createBranch(ownerId: string, data: any) {
        const mainCenter = await CenterModel.findOne({
            ownerId,
            parentCenterId: null,
            isActive: true,
        }).lean();

        if (!mainCenter) {
            throw BadRequestException({ message: 'يجب إنشاء السنتر الرئيسي أولاً قبل إنشاء الفروع' });
        }

        const branch = await CenterModel.create({
            name: data.name,
            ownerId,
            phone: data.phone || null,
            address: data.address || null,
            parentCenterId: mainCenter._id,
            isActive: true,
        });

        return branch;
    }

    static async getMyCenters(ownerId: string, role: UserRole, userCenterId?: string) {
        if (role === UserRole.centerSupervisor) {
            const center = await CenterModel.findById(userCenterId).lean();
            return center ? [center] : [];
        }

        // Return main center and all branches for owner
        return await CenterModel.find({
            ownerId,
            isActive: true,
        }).sort({ parentCenterId: 1, createdAt: 1 }).lean();
    }

    static async getCenterById(centerId: string) {
        const center = await CenterModel.findById(centerId).lean();
        if (!center) throw NotFoundException({ message: 'السنتر غير موجود' });
        return center;
    }

    static async updateCenter(centerId: string, ownerId: string, data: any) {
        const center = await CenterModel.findOneAndUpdate(
            { _id: centerId, ownerId },
            { $set: data },
            { new: true }
        ).lean();

        if (!center) throw NotFoundException({ message: 'السنتر غير موجود أو غير مصرح بتعديله' });
        return center;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 2. Center Teachers (Entities, NOT user accounts)
    // ══════════════════════════════════════════════════════════════════════════

    static async createTeacher(centerId: string, data: any) {
        return await CenterTeacherModel.create({
            centerId,
            name: data.name,
            subject: data.subject,
            privateMonthlyPrice: data.privateMonthlyPrice ?? null,
            isActive: true,
        });
    }

    static async getTeachers(centerId: string, query: any = {}) {
        const filter: any = { centerId };
        if (query.isActive !== undefined) {
            filter.isActive = query.isActive === 'true' || query.isActive === true;
        } else {
            filter.isActive = true;
        }
        if (query.search) {
            filter.name = { $regex: query.search, $options: 'i' };
        }
        if (query.subject) {
            filter.subject = { $regex: query.subject, $options: 'i' };
        }

        return await CenterTeacherModel.find(filter).sort({ name: 1 }).lean();
    }

    static async getTeacherById(teacherId: string, centerId: string) {
        const teacher = await CenterTeacherModel.findOne({ _id: teacherId, centerId }).lean();
        if (!teacher) throw NotFoundException({ message: 'المدرس غير موجود بالسنتر' });
        return teacher;
    }

    static async updateTeacher(teacherId: string, centerId: string, data: any) {
        const teacher = await CenterTeacherModel.findOneAndUpdate(
            { _id: teacherId, centerId },
            { $set: data },
            { new: true }
        ).lean();

        if (!teacher) throw NotFoundException({ message: 'المدرس غير موجود بالسنتر' });
        return teacher;
    }

    static async deleteTeacher(teacherId: string, centerId: string) {
        const teacher = await CenterTeacherModel.findOneAndUpdate(
            { _id: teacherId, centerId },
            { $set: { isActive: false } },
            { new: true }
        ).lean();

        if (!teacher) throw NotFoundException({ message: 'المدرس غير موجود بالسنتر' });
        return teacher;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 3. Center Packages
    // ══════════════════════════════════════════════════════════════════════════

    static async createPackage(centerId: string, data: any) {
        const existing = await CenterPackageModel.findOne({
            centerId,
            gradeLevel: data.gradeLevel,
            isActive: true,
        }).lean();

        if (existing) {
            throw ConflictException({ message: 'يوجد باكيدج مسجل بالفعل لهذه المرحلة الدراسية في هذا السنتر' });
        }

        // Verify all teacher IDs exist in this center
        const teacherIds = data.teachers.map((t: any) => t.teacherId);
        const count = await CenterTeacherModel.countDocuments({
            _id: { $in: teacherIds },
            centerId,
            isActive: true,
        });

        if (count !== teacherIds.length) {
            throw BadRequestException({ message: 'بعض المدرسين المحددين غير موجودين أو غير نشطين في هذا السنتر' });
        }

        return await CenterPackageModel.create({
            centerId,
            name: data.name,
            gradeLevel: data.gradeLevel,
            teachers: data.teachers,
            monthlyPrice: data.monthlyPrice,
            isActive: true,
        });
    }

    static async getPackages(centerId: string, query: any = {}) {
        const filter: any = { centerId };
        if (query.gradeLevel) filter.gradeLevel = query.gradeLevel;
        if (query.isActive !== undefined) {
            filter.isActive = query.isActive === 'true' || query.isActive === true;
        } else {
            filter.isActive = true;
        }

        return await CenterPackageModel.find(filter)
            .populate('teachers.teacherId', 'name subject')
            .sort({ gradeLevel: 1 })
            .lean();
    }

    static async getPackageById(packageId: string, centerId: string) {
        const pkg = await CenterPackageModel.findOne({ _id: packageId, centerId })
            .populate('teachers.teacherId', 'name subject')
            .lean();
        if (!pkg) throw NotFoundException({ message: 'الباكيدج غير موجود' });
        return pkg;
    }

    static async updatePackage(packageId: string, centerId: string, data: any) {
        const pkg = await CenterPackageModel.findOneAndUpdate(
            { _id: packageId, centerId },
            { $set: data },
            { new: true }
        ).populate('teachers.teacherId', 'name subject').lean();

        if (!pkg) throw NotFoundException({ message: 'الباكيدج غير موجود' });
        return pkg;
    }

    static async deletePackage(packageId: string, centerId: string) {
        const pkg = await CenterPackageModel.findOneAndUpdate(
            { _id: packageId, centerId },
            { $set: { isActive: false } },
            { new: true }
        ).lean();

        if (!pkg) throw NotFoundException({ message: 'الباكيدج غير موجود' });
        return pkg;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 4. Center Groups
    // ══════════════════════════════════════════════════════════════════════════

    static async createGroup(centerId: string, data: any) {
        // Validate teacher belongs to center
        const teacher = await CenterTeacherModel.findOne({
            _id: data.centerTeacherId,
            centerId,
            isActive: true,
        }).lean();

        if (!teacher) {
            throw NotFoundException({ message: 'المدرس غير موجود بالسنتر' });
        }

        const price = data.privateMonthlyPrice ?? teacher.privateMonthlyPrice ?? null;

        return await CenterGroupModel.create({
            centerId,
            centerTeacherId: data.centerTeacherId,
            name: data.name,
            gradeLevel: data.gradeLevel,
            groupType: data.groupType,
            schedule: data.schedule,
            capacity: data.capacity || 50,
            privateMonthlyPrice: price,
            isActive: true,
        });
    }

    static async getGroups(centerId: string, query: any = {}) {
        const filter: any = { centerId };
        if (query.centerTeacherId) filter.centerTeacherId = query.centerTeacherId;
        if (query.gradeLevel) filter.gradeLevel = query.gradeLevel;
        if (query.groupType) filter.groupType = query.groupType;
        if (query.isActive !== undefined) {
            filter.isActive = query.isActive === 'true' || query.isActive === true;
        } else {
            filter.isActive = true;
        }

        return await CenterGroupModel.find(filter)
            .populate('centerTeacherId', 'name subject')
            .sort({ gradeLevel: 1, name: 1 })
            .lean();
    }

    static async getGroupById(groupId: string, centerId: string) {
        const group = await CenterGroupModel.findOne({ _id: groupId, centerId })
            .populate('centerTeacherId', 'name subject privateMonthlyPrice')
            .lean();
        if (!group) throw NotFoundException({ message: 'المجموعة غير موجودة' });
        return group;
    }

    static async updateGroup(groupId: string, centerId: string, data: any) {
        const group = await CenterGroupModel.findOneAndUpdate(
            { _id: groupId, centerId },
            { $set: data },
            { new: true }
        ).populate('centerTeacherId', 'name subject').lean();

        if (!group) throw NotFoundException({ message: 'المجموعة غير موجودة' });
        return group;
    }

    static async deleteGroup(groupId: string, centerId: string) {
        const group = await CenterGroupModel.findOneAndUpdate(
            { _id: groupId, centerId },
            { $set: { isActive: false } },
            { new: true }
        ).lean();

        if (!group) throw NotFoundException({ message: 'المجموعة غير موجودة' });
        return group;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 5. Center Supervisors
    // ══════════════════════════════════════════════════════════════════════════

    static getDefaultPermissionsForType(type: CenterSupervisorType): ISupervisorPermissions {
        switch (type) {
            case CenterSupervisorType.FINANCIAL:
                return {
                    canViewFinancials: true,
                    canRecordPayments: true,
                    canManageExpenses: true,
                    canViewReports: true,
                    canTakeAttendance: false,
                    canEditAttendance: false,
                    canViewAttendance: true,
                    canManageStudents: true,
                    canManageTeachers: false,
                    canManagePackages: false,
                    canCreateExams: false,
                    canSendNotifications: false,
                };
            case CenterSupervisorType.ATTENDANCE:
                return {
                    canViewFinancials: false,
                    canRecordPayments: false,
                    canManageExpenses: false,
                    canViewReports: false,
                    canTakeAttendance: true,
                    canEditAttendance: true,
                    canViewAttendance: true,
                    canManageStudents: true,
                    canManageTeachers: false,
                    canManagePackages: false,
                    canCreateExams: false,
                    canSendNotifications: true,
                };
            case CenterSupervisorType.CUSTOM:
            default:
                return {
                    canViewFinancials: false,
                    canRecordPayments: false,
                    canManageExpenses: false,
                    canViewReports: false,
                    canTakeAttendance: false,
                    canEditAttendance: false,
                    canViewAttendance: false,
                    canManageStudents: false,
                    canManageTeachers: false,
                    canManagePackages: false,
                    canCreateExams: false,
                    canSendNotifications: false,
                };
        }
    }

    static async createSupervisor(ownerId: string, defaultCenterId: string, data: any) {
        const existingPhone = await UserModel.findOne({ phone: data.phone }).lean();
        if (existingPhone) {
            throw ConflictException({ message: 'رقم الهاتف مسجل بالفعل في النظام' });
        }

        const targetCenterId = data.branchId || defaultCenterId;
        const center = await CenterModel.findOne({ _id: targetCenterId, ownerId, isActive: true }).lean();
        if (!center) {
            throw NotFoundException({ message: 'الفرع المحدد غير موجود أو غير تابع لك' });
        }

        const hashedPassword = await PasswordUtil.hashPassword(data.password);
        const defaults = CenterService.getDefaultPermissionsForType(data.supervisorType);
        const permissions: ISupervisorPermissions = {
            ...defaults,
            ...(data.supervisorPermissions || {}),
        };

        const supervisor = await UserModel.create({
            name: data.name,
            phone: data.phone,
            password: hashedPassword,
            role: UserRole.centerSupervisor,
            teacherId: new Types.ObjectId(ownerId), // tenantId scoping
            centerId: new Types.ObjectId(targetCenterId),
            supervisorType: data.supervisorType,
            supervisorPermissions: permissions,
            isActive: true,
            stages: [],
            salary: null,
        });

        const supervisorObj: any = supervisor.toObject();
        delete supervisorObj.password;
        return supervisorObj;
    }

    static async getSupervisors(ownerId: string, centerId?: string) {
        const filter: any = {
            role: UserRole.centerSupervisor,
            teacherId: ownerId,
        };
        if (centerId) filter.centerId = centerId;

        return await UserModel.find(filter)
            .select('-password')
            .populate('centerId', 'name address')
            .sort({ createdAt: -1 })
            .lean();
    }

    static async updateSupervisor(supervisorId: string, ownerId: string, data: any) {
        const updateData: any = {};
        if (data.name) updateData.name = data.name;
        if (data.phone) updateData.phone = data.phone;
        if (data.password) {
            updateData.password = await PasswordUtil.hashPassword(data.password);
        }
        if (data.supervisorType) updateData.supervisorType = data.supervisorType;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        if (data.supervisorPermissions) {
            updateData.supervisorPermissions = data.supervisorPermissions;
        }

        const supervisor = await UserModel.findOneAndUpdate(
            { _id: supervisorId, teacherId: ownerId, role: UserRole.centerSupervisor },
            { $set: updateData },
            { new: true }
        ).select('-password').lean();

        if (!supervisor) throw NotFoundException({ message: 'المشرف غير موجود' });
        return supervisor;
    }

    static async deleteSupervisor(supervisorId: string, ownerId: string) {
        const supervisor = await UserModel.findOneAndUpdate(
            { _id: supervisorId, teacherId: ownerId, role: UserRole.centerSupervisor },
            { $set: { isActive: false } },
            { new: true }
        ).select('-password').lean();

        if (!supervisor) throw NotFoundException({ message: 'المشرف غير موجود' });
        return supervisor;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 6. Center Enrollments (Package, Private, or Both)
    // ══════════════════════════════════════════════════════════════════════════

    static async enrollStudent(centerId: string, ownerId: string, data: any) {
        const student = await StudentModel.findById(data.studentId);
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });

        // Link student to this center if not linked
        if (!student.centerId) {
            student.centerId = new Types.ObjectId(centerId);
            student.teacherId = new Types.ObjectId(ownerId);
            await student.save();
        }

        // Check if student already enrolled in this center
        const existingEnrollment = await CenterEnrollmentModel.findOne({
            centerId,
            studentId: data.studentId,
        });

        let packageMonthlyPrice: number | null = null;
        if (data.packageId) {
            const pkg = await CenterPackageModel.findOne({ _id: data.packageId, centerId, isActive: true }).lean();
            if (!pkg) throw NotFoundException({ message: 'الباكيدج المحدد غير موجود' });
            packageMonthlyPrice = pkg.monthlyPrice;
        }

        if (existingEnrollment) {
            // Update enrollment details
            existingEnrollment.type = data.type;
            if (data.packageId !== undefined) existingEnrollment.packageId = data.packageId;
            if (packageMonthlyPrice !== null) existingEnrollment.packageMonthlyPrice = packageMonthlyPrice;
            if (data.packageDiscount) existingEnrollment.packageDiscount = data.packageDiscount;
            if (data.privateTeachers) existingEnrollment.privateTeachers = data.privateTeachers;
            if (data.privateDiscount) existingEnrollment.privateDiscount = data.privateDiscount;
            if (data.combinedDiscount) existingEnrollment.combinedDiscount = data.combinedDiscount;
            existingEnrollment.isActive = true;
            await existingEnrollment.save();
            return existingEnrollment;
        }

        return await CenterEnrollmentModel.create({
            centerId,
            studentId: data.studentId,
            type: data.type,
            packageId: data.packageId || null,
            packageMonthlyPrice,
            packageDiscount: data.packageDiscount || { type: null, value: 0 },
            privateTeachers: data.privateTeachers || [],
            privateDiscount: data.privateDiscount || { type: null, value: 0 },
            combinedDiscount: data.combinedDiscount || { type: null, value: 0 },
            isActive: true,
            startDate: new Date(),
        });
    }

    static async getEnrollments(centerId: string, query: any = {}) {
        const filter: any = { centerId };
        if (query.type) filter.type = query.type;
        if (query.packageId) filter.packageId = query.packageId;
        if (query.isActive !== undefined) {
            filter.isActive = query.isActive === 'true' || query.isActive === true;
        } else {
            filter.isActive = true;
        }

        return await CenterEnrollmentModel.find(filter)
            .populate('studentId', 'studentName studentCode studentPhone gradeLevel parentPhone barcode')
            .populate('packageId', 'name gradeLevel monthlyPrice')
            .populate('privateTeachers.centerTeacherId', 'name subject')
            .populate('privateTeachers.groupId', 'name schedule')
            .sort({ createdAt: -1 })
            .lean();
    }

    static async getStudentEnrollment(centerId: string, studentId: string) {
        const enrollment = await CenterEnrollmentModel.findOne({ centerId, studentId })
            .populate('studentId', 'studentName studentCode studentPhone gradeLevel parentPhone barcode')
            .populate('packageId', 'name gradeLevel monthlyPrice teachers')
            .populate('privateTeachers.centerTeacherId', 'name subject')
            .populate('privateTeachers.groupId', 'name schedule')
            .lean();

        if (!enrollment) throw NotFoundException({ message: 'اشتراك الطالب غير موجود في هذا السنتر' });
        return enrollment;
    }

    static async updateEnrollment(enrollmentId: string, centerId: string, data: any) {
        const enrollment = await CenterEnrollmentModel.findOneAndUpdate(
            { _id: enrollmentId, centerId },
            { $set: data },
            { new: true }
        ).populate('studentId packageId privateTeachers.centerTeacherId').lean();

        if (!enrollment) throw NotFoundException({ message: 'الاشتراك غير موجود' });
        return enrollment;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 7. Center Attendance (Quick Attendance — no sessions)
    // ══════════════════════════════════════════════════════════════════════════

    static async recordAttendance(centerId: string, recordedBy: string, data: any) {
        // Normalize date to start of day UTC
        const recordDate = new Date(data.date);
        recordDate.setUTCHours(0, 0, 0, 0);

        // Verify group belongs to center
        const group = await CenterGroupModel.findOne({ _id: data.groupId, centerId, isActive: true }).lean();
        if (!group) throw NotFoundException({ message: 'المجموعة غير موجودة بالسنتر' });

        return await CenterAttendanceModel.findOneAndUpdate(
            {
                groupId: data.groupId,
                studentId: data.studentId,
                date: recordDate,
            },
            {
                $set: {
                    centerId,
                    groupId: data.groupId,
                    studentId: data.studentId,
                    date: recordDate,
                    status: data.status,
                    source: data.source || 'MANUAL',
                    notes: data.notes || '',
                    scannedAt: new Date(),
                    recordedBy,
                },
            },
            { upsert: true, new: true }
        ).lean();
    }

    static async bulkRecordAttendance(centerId: string, recordedBy: string, data: any) {
        const recordDate = new Date(data.date);
        recordDate.setUTCHours(0, 0, 0, 0);

        const group = await CenterGroupModel.findOne({ _id: data.groupId, centerId, isActive: true }).lean();
        if (!group) throw NotFoundException({ message: 'المجموعة غير موجودة بالسنتر' });

        const operations = data.records.map((r: any) => ({
            updateOne: {
                filter: {
                    groupId: data.groupId,
                    studentId: r.studentId,
                    date: recordDate,
                },
                update: {
                    $set: {
                        centerId,
                        groupId: data.groupId,
                        studentId: r.studentId,
                        date: recordDate,
                        status: r.status,
                        source: r.source || 'MANUAL',
                        notes: r.notes || '',
                        scannedAt: new Date(),
                        recordedBy,
                    },
                },
                upsert: true,
            },
        }));

        await CenterAttendanceModel.bulkWrite(operations);
        return { success: true, count: operations.length };
    }

    static async getGroupAttendance(centerId: string, groupId: string, dateStr: string) {
        const recordDate = new Date(dateStr);
        recordDate.setUTCHours(0, 0, 0, 0);

        return await CenterAttendanceModel.find({
            centerId,
            groupId,
            date: recordDate,
        })
            .populate('studentId', 'studentName studentCode barcode')
            .populate('recordedBy', 'name role')
            .lean();
    }

    static async getStudentAttendance(centerId: string, studentId: string, query: any = {}) {
        const filter: any = { centerId, studentId };
        if (query.groupId) filter.groupId = query.groupId;
        if (query.startDate && query.endDate) {
            const start = new Date(query.startDate);
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(query.endDate);
            end.setUTCHours(23, 59, 59, 999);
            filter.date = { $gte: start, $lte: end };
        }

        return await CenterAttendanceModel.find(filter)
            .populate('groupId', 'name gradeLevel groupType')
            .sort({ date: -1 })
            .lean();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 8. Financials & Reports
    // ══════════════════════════════════════════════════════════════════════════

    static async recordPayment(centerId: string, ownerId: string, recordedBy: string, data: any) {
        const center = await CenterModel.findById(centerId).lean();
        if (!center) throw NotFoundException({ message: 'السنتر غير موجود' });

        const student = await StudentModel.findById(data.studentId).lean();

        const transactionData: any = {
            teacherId: new Types.ObjectId(ownerId),
            createdBy: new Types.ObjectId(recordedBy),
            centerId: new Types.ObjectId(centerId),
            centerTeacherId: data.centerTeacherId ? new Types.ObjectId(data.centerTeacherId) : null,
            type: TransactionType.INCOME,
            category: data.category, // CENTER_PACKAGE, CENTER_PRIVATE, or CENTER_COMBINED
            originalAmount: data.originalAmount,
            discountAmount: data.discountAmount || 0,
            paidAmount: data.paidAmount,
            remainingAmount: data.remainingAmount || 0,
            description: data.description || '',
            date: data.date ? new Date(data.date) : new Date(),
        };

        if (student) {
            transactionData.studentId = student._id;
            transactionData.studentName = student.studentName;
            transactionData.gradeLevel = student.gradeLevel;
        }

        const transaction = await TransactionModel.create(transactionData);
        return transaction;
    }

    static async getFinancialSummary(centerId: string, startDate?: string, endDate?: string) {
        const filter: any = {
            centerId: new Types.ObjectId(centerId),
        };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            filter.date = { $gte: start, $lte: end };
        }

        const stats = await TransactionModel.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$category',
                    totalPaid: { $sum: '$paidAmount' },
                    totalRemaining: { $sum: '$remainingAmount' },
                    totalOriginal: { $sum: '$originalAmount' },
                    count: { $sum: 1 },
                },
            },
        ]);

        let packageRevenue = 0;
        let privateRevenue = 0;
        let combinedRevenue = 0;
        let totalRevenue = 0;
        let totalDebt = 0;

        for (const s of stats) {
            if (s._id === TransactionCategory.CENTER_PACKAGE) packageRevenue += s.totalPaid;
            if (s._id === TransactionCategory.CENTER_PRIVATE) privateRevenue += s.totalPaid;
            if (s._id === TransactionCategory.CENTER_COMBINED) combinedRevenue += s.totalPaid;
            totalRevenue += s.totalPaid;
            totalDebt += s.totalRemaining;
        }

        return {
            packageRevenue,
            privateRevenue,
            combinedRevenue,
            totalRevenue,
            totalDebt,
            breakdown: stats,
        };
    }

    static async getTeacherFinancialReport(centerId: string, teacherId: string, startDate?: string, endDate?: string) {
        const filter: any = {
            centerId: new Types.ObjectId(centerId),
            centerTeacherId: new Types.ObjectId(teacherId),
        };

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            filter.date = { $gte: start, $lte: end };
        }

        const transactions = await TransactionModel.find(filter)
            .populate('studentId', 'studentName studentCode')
            .sort({ date: -1 })
            .lean();

        const totalPaid = transactions.reduce((acc, t) => acc + (t.paidAmount || 0), 0);
        const totalRemaining = transactions.reduce((acc, t) => acc + (t.remainingAmount || 0), 0);

        return {
            teacherId,
            transactions,
            totalPaid,
            totalRemaining,
            transactionCount: transactions.length,
        };
    }
}
