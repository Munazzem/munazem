import crypto from 'crypto';
import { Types } from 'mongoose';
import { CenterModel } from '../../database/models/center.model.js';
import { CardModel } from '../../database/models/card.model.js';
import { CenterTeacherModel } from '../../database/models/center-teacher.model.js';
import { CenterPackageModel } from '../../database/models/center-package.model.js';
import { CenterGroupModel } from '../../database/models/center-group.model.js';
import { CenterAttendanceModel } from '../../database/models/center-attendance.model.js';
import { CenterCheckInModel } from '../../database/models/center-checkin.model.js';
import { CenterEnrollmentModel } from '../../database/models/center-enrollment.model.js';
import { CenterStudentModel } from '../../database/models/center-student.model.js';
import { nextSequence, nextSequenceBulk } from '../../database/models/counter.model.js';
import { UserModel } from '../../database/models/user.model.js';
import { StudentModel } from '../../database/models/student.model.js';
import { TransactionModel } from '../../database/models/transaction.model.js';
import { SubscriptionModel } from '../../database/models/subscription.model.js';
import { UserRole, CenterSupervisorType, TransactionType, TransactionCategory, SubscriptionStatus, SubscriptionPlan, GradeLevel, GRADE_LETTER, CenterEnrollmentType } from '../../common/enums/enum.service.js';
import { ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '../../common/utils/response/error.responce.js';
import { PasswordUtil } from '../../common/utils/password.util.js';
import { ParentPushService } from '../parent/parent-push.service.js';
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

    static async onboardCenterByAdmin(data: {
        centerName: string;
        ownerName: string;
        phone: string;
        password: string;
        email?: string;
        address?: string | null;
        centerPhone?: string | null;
        planTier?: string;
    }) {
        const existingUser = await UserModel.findOne({ phone: data.phone.trim() }).lean();
        if (existingUser) {
            throw BadRequestException({ message: 'رقم الهاتف مسجل بالفعل في النظام' });
        }

        const hashedPassword = await PasswordUtil.hashPassword(data.password);
        const userEmail = data.email && data.email.trim()
            ? data.email.trim()
            : `center-owner-${Date.now()}-${Math.floor(Math.random() * 10000)}@system.local`;

        const [owner] = await UserModel.create([{
            name: data.ownerName.trim(),
            phone: data.phone.trim(),
            password: hashedPassword,
            email: userEmail,
            role: UserRole.centerOwner,
            isActive: true,
        }]);

        if (!owner) {
            throw BadRequestException({ message: 'فشل في إنشاء حساب المالك' });
        }

        const center = await CenterModel.create({
            name: data.centerName.trim(),
            ownerId: owner._id,
            phone: data.centerPhone?.trim() || data.phone.trim(),
            address: data.address?.trim() || null,
            parentCenterId: null,
            isActive: true,
        });

        // Link centerId to owner
        await UserModel.findByIdAndUpdate(owner._id, { centerId: center._id });

        // Default 30-day active subscription
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        await SubscriptionModel.create({
            teacherId: owner._id,
            planTier: data.planTier || SubscriptionPlan.CENTER,
            status: SubscriptionStatus.ACTIVE,
            startDate: new Date(),
            endDate: thirtyDaysFromNow,
            amount: 0,
            durationMonths: 1,
            studentsCount: 1000,
            isFreeTrial: true,
        });

        return {
            center,
            owner: {
                id: owner._id,
                name: owner.name,
                phone: owner.phone,
                role: owner.role,
                centerId: center._id,
            },
        };
    }

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

        // Price comes from the request — required for PRIVATE/MIXED groups
        return await CenterGroupModel.create({
            centerId,
            centerTeacherId: data.centerTeacherId,
            name: data.name,
            gradeLevel: data.gradeLevel,
            groupType: data.groupType,
            schedule: data.schedule,
            capacity: data.capacity || 50,
            privateMonthlyPrice: data.privateMonthlyPrice ?? null,
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
    // 5.5 Center Students (Directory & Management)
    // ══════════════════════════════════════════════════════════════════════════

    static async createStudent(centerId: string, data: any) {
        const letter = GRADE_LETTER[data.gradeLevel as GradeLevel] || 'A';
        const count = await nextSequence(`${centerId}_${data.gradeLevel}`);
        const studentCode = `${count}${letter}`;

        const barcode = data.barcode?.trim() || `${studentCode}-${Date.now().toString(36).toUpperCase()}`;

        const studentName = data.studentName.trim();
        let parentName = data.parentName?.trim();
        if (!parentName) {
            const parts = studentName.split(/\s+/);
            parentName = parts.length > 1 ? parts.slice(1).join(' ') : `ولي أمر ${studentName}`;
        }

        return await CenterStudentModel.create({
            centerId: new Types.ObjectId(centerId),
            studentName,
            parentName,
            studentPhone: data.studentPhone?.trim() || null,
            parentPhone: data.parentPhone?.trim() || null,
            gradeLevel: data.gradeLevel,
            studentCode,
            barcode,
            notes: data.notes?.trim() || null,
            isActive: true,
        });
    }

    static async bulkCreateStudents(centerId: string, data: { students: any[] }) {
        if (!data.students || data.students.length === 0) {
            throw BadRequestException({ message: 'قائمة الطلاب فارغة' });
        }

        const byGrade: Record<string, any[]> = {};
        for (const s of data.students) {
            const g = s.gradeLevel;
            if (!byGrade[g]) byGrade[g] = [];
            byGrade[g].push(s);
        }

        const docsToInsert: any[] = [];
        const cid = new Types.ObjectId(centerId);

        for (const [grade, list] of Object.entries(byGrade)) {
            const letter = GRADE_LETTER[grade as GradeLevel] || 'A';
            const startSeq = await nextSequenceBulk(`${centerId}_${grade}`, list.length);

            list.forEach((s, idx) => {
                const count = startSeq + idx;
                const studentCode = `${count}${letter}`;
                const barcode = s.barcode?.trim() || `${studentCode}-${Date.now().toString(36).toUpperCase()}`;

                const studentName = s.studentName.trim();
                let parentName = s.parentName?.trim();
                if (!parentName) {
                    const parts = studentName.split(/\s+/);
                    parentName = parts.length > 1 ? parts.slice(1).join(' ') : `ولي أمر ${studentName}`;
                }

                docsToInsert.push({
                    centerId: cid,
                    studentName,
                    parentName,
                    studentPhone: s.studentPhone?.trim() || null,
                    parentPhone: s.parentPhone?.trim() || null,
                    gradeLevel: s.gradeLevel,
                    studentCode,
                    barcode,
                    notes: s.notes?.trim() || null,
                    isActive: true,
                });
            });
        }

        const created = await CenterStudentModel.insertMany(docsToInsert);
        return {
            count: created.length,
            students: created,
        };
    }

    static async getStudents(centerId: string, query: any = {}) {
        const centerObjId = new Types.ObjectId(centerId);
        const filter: any = { centerId: centerObjId };

        const secondaryGrades: string[] = [
            GradeLevel.SEC_1, GradeLevel.SEC_2, GradeLevel.SEC_3,
            'الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي',
            'SEC_1', 'SEC_2', 'SEC_3',
        ];
        const prepGrades: string[] = [
            GradeLevel.PREP_1, GradeLevel.PREP_2, GradeLevel.PREP_3,
            'الصف الأول الإعدادي', 'الصف الثاني الإعدادي', 'الصف الثالث الإعدادي',
            'PREP_1', 'PREP_2', 'PREP_3',
        ];
        const primaryGrades: string[] = [
            GradeLevel.PRIM_1, GradeLevel.PRIM_2, GradeLevel.PRIM_3, GradeLevel.PRIM_4, GradeLevel.PRIM_5, GradeLevel.PRIM_6,
            'الصف الأول الابتدائي', 'الصف الثاني الابتدائي', 'الصف الثالث الابتدائي',
            'الصف الرابع الابتدائي', 'الصف الخامس الابتدائي', 'الصف السادس الابتدائي',
            'PRIM_1', 'PRIM_2', 'PRIM_3', 'PRIM_4', 'PRIM_5', 'PRIM_6',
        ];

        if (query.gradeLevel && query.gradeLevel !== 'ALL') {
            filter.gradeLevel = query.gradeLevel;
        } else if (query.stage && query.stage !== 'ALL') {
            if (query.stage === 'SECONDARY') {
                filter.gradeLevel = { $in: secondaryGrades };
            } else if (query.stage === 'PREPARATORY') {
                filter.gradeLevel = { $in: prepGrades };
            } else if (query.stage === 'PRIMARY') {
                filter.gradeLevel = { $in: primaryGrades };
            } else if (query.stage === 'OTHER') {
                filter.gradeLevel = { $nin: [...secondaryGrades, ...prepGrades, ...primaryGrades] };
            }
        }

        if (query.isActive !== undefined) {
            filter.isActive = query.isActive === 'true' || query.isActive === true;
        }

        if (query.search) {
            const s = query.search.trim();
            const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const anywhereRegex = new RegExp(escaped, 'i');
            const prefixRegex = new RegExp(`^${escaped}`, 'i');
            filter.$or = [
                { studentName: anywhereRegex },
                { parentName: anywhereRegex },
                { studentCode: prefixRegex },
                { studentPhone: prefixRegex },
                { parentPhone: prefixRegex },
                { barcode: prefixRegex },
            ];
        }

        const page = Math.max(1, parseInt(query.page || '1', 10));
        const limit = Math.max(1, Math.min(100, parseInt(query.limit || '50', 10)));
        const skip = (page - 1) * limit;

        const needStageCounts =
            query.includeCounts === 'true' ||
            query.includeCounts === true ||
            (!query.stage && !query.gradeLevel && !query.search && page === 1);

        const promises: Promise<any>[] = [
            CenterStudentModel.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CenterStudentModel.countDocuments(filter),
        ];

        if (needStageCounts) {
            promises.push(
                CenterStudentModel.countDocuments({ centerId: centerObjId }),
                CenterStudentModel.countDocuments({ centerId: centerObjId, gradeLevel: { $in: secondaryGrades } }),
                CenterStudentModel.countDocuments({ centerId: centerObjId, gradeLevel: { $in: prepGrades } }),
                CenterStudentModel.countDocuments({ centerId: centerObjId, gradeLevel: { $in: primaryGrades } })
            );
        }

        const [students, total, totalCenter, secCount, prepCount, primCount] = await Promise.all(promises);

        return {
            data: students,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            stageCounts: needStageCounts
                ? {
                      total: totalCenter || 0,
                      secondary: secCount || 0,
                      preparatory: prepCount || 0,
                      primary: primCount || 0,
                  }
                : undefined,
        };
    }

    static async getStudentById(centerId: string, studentId: string) {
        const student = await CenterStudentModel.findOne({ _id: studentId, centerId }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });
        return student;
    }

    static async updateStudent(centerId: string, studentId: string, data: any) {
        const student = await CenterStudentModel.findOneAndUpdate(
            { _id: studentId, centerId },
            { $set: data },
            { new: true }
        ).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });
        return student;
    }

    static async deleteStudent(centerId: string, studentId: string) {
        const student = await CenterStudentModel.findOneAndDelete({ _id: studentId, centerId }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });

        // Clean up student's enrollments and attendance records
        await Promise.all([
            CenterEnrollmentModel.deleteMany({ studentId, centerId }),
            CenterAttendanceModel.deleteMany({ studentId, centerId }),
        ]);

        return student;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 6. Center Enrollments (Package, Private, or Both)
    // ══════════════════════════════════════════════════════════════════════════

    static async enrollStudent(centerId: string, ownerId: string, data: any) {
        // Find student in CenterStudentModel (or fallback to StudentModel)
        let student = await CenterStudentModel.findOne({ _id: data.studentId, centerId });
        if (!student) {
            const fallbackStudent = await StudentModel.findById(data.studentId);
            if (!fallbackStudent) {
                throw NotFoundException({ message: 'الطالب غير موجود' });
            }
            if (!fallbackStudent.centerId) {
                fallbackStudent.centerId = new Types.ObjectId(centerId);
                fallbackStudent.teacherId = new Types.ObjectId(ownerId);
                await fallbackStudent.save();
            }
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
            const studentDoc = await CenterStudentModel.findById(data.studentId).lean();
            if (studentDoc && pkg.gradeLevel !== studentDoc.gradeLevel) {
                throw BadRequestException({ message: `الباكيدج المحدد (${pkg.gradeLevel}) لا يطابق المرحلة الدراسية للطالب (${studentDoc.gradeLevel})` });
            }
            packageMonthlyPrice = pkg.monthlyPrice;
        }

        // ── Private: snapshot price from each group ───────────────────────
        // Price is determined per-group (not per-teacher) because each group
        // targets a specific grade level with its own price.
        let resolvedPrivateTeachers = data.privateTeachers || [];
        if (resolvedPrivateTeachers.length > 0) {
            resolvedPrivateTeachers = await Promise.all(
                resolvedPrivateTeachers.map(async (pt: any) => {
                    if (!pt.groupId) throw NotFoundException({ message: 'يجب تحديد المجموعة لكل مدرس برايفت' });
                    const group = await CenterGroupModel.findOne({ _id: pt.groupId, centerId }).lean();
                    if (!group) throw NotFoundException({ message: `المجموعة ${pt.groupId} غير موجودة` });
                    return {
                        centerTeacherId: pt.centerTeacherId,
                        groupId: pt.groupId,
                        subject: pt.subject || null,
                        // Store price snapshot from group at enrollment time
                        monthlyPrice: group.privateMonthlyPrice ?? 0,
                        sessionsPerWeek: pt.sessionsPerWeek || 1,
                    };
                })
            );
        }

        const derivedType = data.type === CenterEnrollmentType.PACKAGE ? 'PACKAGE' : (data.type === CenterEnrollmentType.BOTH ? 'BOTH' : 'PRIVATE');

        if (existingEnrollment) {
            existingEnrollment.type = data.type;
            if (data.packageId !== undefined) existingEnrollment.packageId = data.packageId;
            if (packageMonthlyPrice !== null) existingEnrollment.packageMonthlyPrice = packageMonthlyPrice;
            if (data.packageDiscount) existingEnrollment.packageDiscount = data.packageDiscount;
            if (data.packageGroups !== undefined) existingEnrollment.packageGroups = data.packageGroups;
            if (data.privateTeachers) existingEnrollment.privateTeachers = resolvedPrivateTeachers;
            if (data.privateDiscount) existingEnrollment.privateDiscount = data.privateDiscount;
            if (data.combinedDiscount) existingEnrollment.combinedDiscount = data.combinedDiscount;
            existingEnrollment.isActive = true;
            await existingEnrollment.save();
            await CenterStudentModel.findByIdAndUpdate(data.studentId, { studentType: derivedType });
            return existingEnrollment;
        }

        const newEnrollment = await CenterEnrollmentModel.create({
            centerId,
            studentId: data.studentId,
            type: data.type,
            packageId: data.packageId || null,
            packageMonthlyPrice,
            packageDiscount: data.packageDiscount || { type: null, value: 0 },
            packageGroups: data.packageGroups || [],
            privateTeachers: resolvedPrivateTeachers,
            privateDiscount: data.privateDiscount || { type: null, value: 0 },
            combinedDiscount: data.combinedDiscount || { type: null, value: 0 },
            isActive: true,
            startDate: new Date(),
        });
        await CenterStudentModel.findByIdAndUpdate(data.studentId, { studentType: derivedType });
        return newEnrollment;
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
            .populate({
                path: 'packageGroups',
                select: 'name schedule gradeLevel centerTeacherId groupType',
                populate: { path: 'centerTeacherId', select: 'name subject' },
            })
            .populate('privateTeachers.centerTeacherId', 'name subject')
            .populate('privateTeachers.groupId', 'name schedule')
            .sort({ createdAt: -1 })
            .lean();
    }

    static async getStudentEnrollment(centerId: string, studentId: string) {
        const enrollment = await CenterEnrollmentModel.findOne({ centerId, studentId })
            .populate('studentId', 'studentName studentCode studentPhone gradeLevel parentPhone barcode')
            .populate('packageId', 'name gradeLevel monthlyPrice teachers')
            .populate({
                path: 'packageGroups',
                select: 'name schedule gradeLevel centerTeacherId groupType',
                populate: { path: 'centerTeacherId', select: 'name subject' },
            })
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
        )
            .populate('studentId packageId packageGroups privateTeachers.centerTeacherId')
            .lean();

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

    // ── Gate / Reception Daily Check-In ──────────────────────────────────────

    static async checkInStudent(centerId: string, recordedBy: string, data: any) {
        let rawCode = String(data.studentIdOrCode || '').trim();
        if (!rawCode) throw BadRequestException({ message: 'كود أو باركود أو هاتف الطالب مطلوب' });

        // If rawCode is a full URL or contains /card/<token>, extract the token/code
        if (rawCode.includes('/card/')) {
            rawCode = rawCode.split('/card/').pop()?.split(/[?#]/)[0]?.trim() || rawCode;
        }

        // 1. Resolve student by direct ObjectId
        let student: any = null;
        if (Types.ObjectId.isValid(rawCode)) {
            student = await CenterStudentModel.findOne({ _id: rawCode, centerId }).lean();
        }

        // 2. Check if rawCode matches a Card in this center (by cardNumber or cardToken)
        if (!student) {
            const matchedCard = await CardModel.findOne({
                centerId,
                $or: [{ cardNumber: rawCode }, { cardToken: rawCode }],
            }).lean();
            if (matchedCard?.centerStudentId) {
                student = await CenterStudentModel.findOne({ _id: matchedCard.centerStudentId, centerId }).lean();
            }
        }

        // 3. Resolve student by barcode, studentCode, or phone
        if (!student) {
            student = await CenterStudentModel.findOne({
                centerId,
                $or: [
                    { barcode: rawCode },
                    { studentCode: { $regex: new RegExp(`^${rawCode}$`, 'i') } },
                    { studentPhone: rawCode },
                    { parentPhone: rawCode },
                ],
            }).lean();
        }
        if (!student) {
            // Fallback to legacy/teacher StudentModel
            student = await StudentModel.findOne({
                centerId,
                $or: [
                    { barcode: rawCode },
                    { studentCode: { $regex: new RegExp(`^${rawCode}$`, 'i') } },
                    { phone: rawCode },
                ],
            }).lean();
        }

        if (!student) {
            throw NotFoundException({ message: `لم يتم العثور على طالب بالكود أو الباركود: "${rawCode}"` });
        }

        // 2. Normalize date to start of day UTC
        const checkDate = data.date ? new Date(data.date) : new Date();
        checkDate.setUTCHours(0, 0, 0, 0);

        // 3. Determine today's day name in Arabic (Cairo timezone)
        const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const localDate = data.date ? new Date(data.date) : new Date();
        const dayIndex = new Date(localDate.toLocaleString('en-US', { timeZone: 'Africa/Cairo' })).getDay();
        const todayArabicDay = ARABIC_DAYS[dayIndex];

        // 4. Find active enrollment in this center
        const enrollment = await CenterEnrollmentModel.findOne({
            centerId,
            studentId: student._id,
            isActive: true,
        }).lean();

        // 5. Gather enrolled group IDs
        const candidateGroupIds: Types.ObjectId[] = [];
        if (enrollment) {
            if (enrollment.packageGroups && enrollment.packageGroups.length > 0) {
                candidateGroupIds.push(...enrollment.packageGroups);
            }
            if (enrollment.privateTeachers && enrollment.privateTeachers.length > 0) {
                for (const pt of enrollment.privateTeachers) {
                    if (pt.groupId) candidateGroupIds.push(pt.groupId);
                }
            }
        }

        let allEnrolledGroups: any[] = [];
        if (candidateGroupIds.length > 0) {
            allEnrolledGroups = await CenterGroupModel.find({
                _id: { $in: candidateGroupIds },
                centerId,
                isActive: true,
            })
                .populate('centerTeacherId', 'name subject')
                .lean();
        } else if (enrollment && (enrollment.type === 'PACKAGE' || enrollment.type === 'BOTH')) {
            // Fallback for packages with no explicit packageGroups specified
            allEnrolledGroups = await CenterGroupModel.find({
                centerId,
                gradeLevel: student.gradeLevel,
                groupType: { $in: ['PACKAGE', 'MIXED'] },
                isActive: true,
            })
                .populate('centerTeacherId', 'name subject')
                .lean();
        }

        // 6. Partition groups into scheduled today vs other days
        const scheduledTodayGroups: any[] = [];
        const otherEnrolledGroups: any[] = [];

        for (const group of allEnrolledGroups) {
            const scheduleEntry = group.schedule?.find((s: any) => s.day === todayArabicDay);
            const tch = group.centerTeacherId;
            const groupInfo = {
                _id: group._id,
                name: group.name,
                gradeLevel: group.gradeLevel,
                groupType: group.groupType,
                centerTeacher: tch ? { _id: tch._id, name: tch.name, subject: tch.subject } : null,
                scheduleTime: scheduleEntry?.time || null,
                schedule: group.schedule,
                isAttended: false,
            };

            if (scheduleEntry) {
                scheduledTodayGroups.push(groupInfo);
            } else {
                otherEnrolledGroups.push(groupInfo);
            }
        }

        // 7. Check if student already checked in today
        const existingCheckIn = await CenterCheckInModel.findOne({
            centerId,
            studentId: student._id,
            date: checkDate,
        }).lean();

        const isNewCheckIn = !existingCheckIn;

        // 8. Get attendances already recorded in CenterAttendanceModel for today
        const existingAttendances = await CenterAttendanceModel.find({
            centerId,
            studentId: student._id,
            date: checkDate,
        }).lean();

        const attendedGroupSet = new Set<string>(
            existingAttendances
                .filter((a) => a.status === 'PRESENT' || a.status === 'LATE')
                .map((a) => a.groupId.toString())
        );

        if (existingCheckIn?.attendedGroups) {
            for (const gid of existingCheckIn.attendedGroups) {
                attendedGroupSet.add(gid.toString());
            }
        }

        // 9. If request passed explicit groupIds, mark them as PRESENT
        if (Array.isArray(data.groupIds) && data.groupIds.length > 0) {
            for (const gid of data.groupIds) {
                attendedGroupSet.add(gid.toString());
                await CenterAttendanceModel.findOneAndUpdate(
                    { centerId, groupId: gid, studentId: student._id, date: checkDate },
                    {
                        $set: {
                            status: 'PRESENT',
                            source: data.source || 'GATE_CHECKIN',
                            scannedAt: new Date(),
                            recordedBy,
                        },
                    },
                    { upsert: true, new: true }
                );
            }
        }

        // 10. Upsert CenterCheckIn
        const attendedGroupIdsArray = Array.from(attendedGroupSet).map((id) => new Types.ObjectId(id));
        const checkIn = await CenterCheckInModel.findOneAndUpdate(
            {
                centerId,
                studentId: student._id,
                date: checkDate,
            },
            {
                $set: {
                    checkInTime: existingCheckIn ? existingCheckIn.checkInTime : new Date(),
                    source: data.source || 'QR_SCAN',
                    attendedGroups: attendedGroupIdsArray,
                    recordedBy,
                    notes: data.notes || existingCheckIn?.notes || null,
                },
            },
            { upsert: true, new: true }
        ).lean();

        // 10.1 Notify parents via push & in-app notification on new check-in
        if (!existingCheckIn) {
            CenterModel.findById(centerId).select('name').lean().then((centerDoc) => {
                ParentPushService.notifyCenterCheckIn({
                    studentId: student._id.toString(),
                    studentName: student.studentName,
                    centerId: centerId.toString(),
                    centerName: centerDoc?.name || 'السنتر',
                    checkInTime: checkIn?.checkInTime || new Date(),
                    source: data.source || 'QR_SCAN',
                });
            }).catch(() => {});
        }

        // 11. Annotate isAttended on groups
        for (const g of scheduledTodayGroups) {
            g.isAttended = attendedGroupSet.has(g._id.toString());
        }
        for (const g of otherEnrolledGroups) {
            g.isAttended = attendedGroupSet.has(g._id.toString());
        }

        // 12. Financial calculation
        const transactions = await TransactionModel.find({
            centerId: new Types.ObjectId(centerId),
            studentId: student._id,
        }).lean();

        const totalPaid = transactions.reduce((acc, t) => acc + (t.paidAmount || 0), 0);
        const totalRemaining = transactions.reduce((acc, t) => acc + (t.remainingAmount || 0), 0);

        let packageName: string | null = null;
        if (enrollment?.packageId) {
            const pkg = await CenterPackageModel.findById(enrollment.packageId).select('name').lean();
            packageName = pkg?.name || null;
        }

        const privateTeachersSummary: string[] = [];
        if (enrollment?.privateTeachers && enrollment.privateTeachers.length > 0) {
            for (const pt of enrollment.privateTeachers) {
                const tch = allEnrolledGroups.find((g) => g._id.toString() === pt.groupId?.toString())?.centerTeacherId
                    || (pt.centerTeacherId ? await CenterTeacherModel.findById(pt.centerTeacherId).select('name subject').lean() : null);
                if (tch) {
                    privateTeachersSummary.push(`${tch.name}${tch.subject ? ` (${tch.subject})` : ''}`);
                }
            }
        }

        return {
            student,
            checkIn,
            isNewCheckIn,
            todayArabicDay,
            scheduledTodayGroups,
            otherEnrolledGroups,
            attendedGroupIds: Array.from(attendedGroupSet),
            financialStatus: {
                totalPaid,
                totalRemaining,
                hasDebt: totalRemaining > 0,
                hasActiveEnrollment: !!enrollment,
                enrollmentType: enrollment?.type || null,
            },
            enrollmentSummary: {
                type: enrollment?.type || null,
                packageName,
                privateTeachersSummary,
            },
        };
    }

    static async updateCheckInGroups(centerId: string, recordedBy: string, data: any) {
        const studentId = data.studentId;
        const checkDate = data.date ? new Date(data.date) : new Date();
        checkDate.setUTCHours(0, 0, 0, 0);

        const groupIds: string[] = data.groupIds || [];
        const groupObjectIds = groupIds.map((id) => new Types.ObjectId(id));

        // 1. Update check-in record
        const checkIn = await CenterCheckInModel.findOneAndUpdate(
            { centerId, studentId, date: checkDate },
            { $set: { attendedGroups: groupObjectIds, recordedBy } },
            { upsert: true, new: true }
        ).lean();

        // 2. Mark PRESENT in CenterAttendance for selected groups
        for (const gid of groupIds) {
            await CenterAttendanceModel.findOneAndUpdate(
                { centerId, groupId: gid, studentId, date: checkDate },
                {
                    $set: {
                        status: 'PRESENT',
                        source: 'GATE_CHECKIN',
                        scannedAt: new Date(),
                        recordedBy,
                    },
                },
                { upsert: true }
            );
        }

        // 3. Remove GATE_CHECKIN attendances for groups that were deselected
        await CenterAttendanceModel.deleteMany({
            centerId,
            studentId,
            date: checkDate,
            groupId: { $nin: groupObjectIds },
            source: 'GATE_CHECKIN',
        });

        return { success: true, checkIn };
    }

    static async getDailyCheckIns(centerId: string, query: any = {}) {
        const checkDate = query.date ? new Date(query.date) : new Date();
        checkDate.setUTCHours(0, 0, 0, 0);

        const filter: any = {
            centerId: new Types.ObjectId(centerId),
            date: checkDate,
        };

        const checkIns = await CenterCheckInModel.find(filter)
            .populate('studentId', 'studentName studentCode studentPhone parentPhone gradeLevel barcode')
            .populate({
                path: 'attendedGroups',
                select: 'name gradeLevel centerTeacherId groupType schedule',
                populate: { path: 'centerTeacherId', select: 'name subject' },
            })
            .populate('recordedBy', 'name')
            .sort({ checkInTime: -1 })
            .lean();

        // In-memory search filter if search term provided
        let filtered = checkIns;
        if (query.search && query.search.trim()) {
            const s = query.search.trim().toLowerCase();
            filtered = checkIns.filter((ci: any) => {
                const st = ci.studentId;
                if (!st) return false;
                return (
                    st.studentName?.toLowerCase().includes(s) ||
                    st.studentCode?.toLowerCase().includes(s) ||
                    st.studentPhone?.includes(s) ||
                    st.parentPhone?.includes(s) ||
                    st.barcode?.includes(s)
                );
            });
        }

        const totalCheckedIn = filtered.length;
        const totalWithAttendedClasses = filtered.filter(
            (ci: any) => ci.attendedGroups && ci.attendedGroups.length > 0
        ).length;

        // Enrich with active enrollment details and debt status for each student
        const studentIds = filtered.map((ci: any) => ci.studentId?._id).filter(Boolean);
        const enrollments = await CenterEnrollmentModel.find({
            centerId: new Types.ObjectId(centerId),
            studentId: { $in: studentIds },
            isActive: true,
        })
            .populate('packageId', 'name')
            .populate('privateTeachers.centerTeacherId', 'name subject')
            .populate('packageGroups', 'name')
            .lean();

        const enrollmentMap = new Map<string, any>();
        for (const e of enrollments) {
            enrollmentMap.set(e.studentId.toString(), e);
        }

        const debtAgg = await TransactionModel.aggregate([
            {
                $match: {
                    centerId: new Types.ObjectId(centerId),
                    studentId: { $in: studentIds },
                },
            },
            {
                $group: {
                    _id: '$studentId',
                    totalRemaining: { $sum: '$remainingAmount' },
                },
            },
        ]);
        const debtMap = new Map<string, number>();
        for (const d of debtAgg) {
            debtMap.set(d._id.toString(), d.totalRemaining || 0);
        }

        const enrichedCheckIns = filtered.map((ci: any) => {
            const sid = ci.studentId?._id?.toString();
            return {
                ...ci,
                enrollment: sid ? enrollmentMap.get(sid) || null : null,
                totalRemainingDebt: sid ? debtMap.get(sid) || 0 : 0,
            };
        });

        return {
            checkIns: enrichedCheckIns,
            total: totalCheckedIn,
            stats: {
                totalCheckedIn,
                totalWithAttendedClasses,
                totalGeneralOnly: totalCheckedIn - totalWithAttendedClasses,
            },
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 8. Financials & Reports
    // ══════════════════════════════════════════════════════════════════════════

    static async recordPayment(centerId: string, ownerId: string, recordedBy: string, data: any) {
        const center = await CenterModel.findById(centerId).lean();
        if (!center) throw NotFoundException({ message: 'السنتر غير موجود' });

        const student = (await CenterStudentModel.findOne({ _id: data.studentId, centerId }).lean())
            || (await StudentModel.findById(data.studentId).lean());

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

    static async getStudentFinancialReport(centerId: string, studentId: string) {
        const filter: any = {
            centerId: new Types.ObjectId(centerId),
            studentId: new Types.ObjectId(studentId),
        };

        const transactions = await TransactionModel.find(filter)
            .populate('centerTeacherId', 'name subject')
            .populate('createdBy', 'name')
            .sort({ date: -1 })
            .lean();

        const totalPaid = transactions.reduce((acc, t) => acc + (t.paidAmount || 0), 0);
        const totalRemaining = transactions.reduce((acc, t) => acc + (t.remainingAmount || 0), 0);
        const totalOriginal = transactions.reduce((acc, t) => acc + (t.originalAmount || 0), 0);

        return {
            studentId,
            transactions,
            totalPaid,
            totalRemaining,
            totalOriginal,
            transactionCount: transactions.length,
        };
    }

    static async getDailyTally(centerId: string, dateStr?: string) {
        const centerObjId = new Types.ObjectId(centerId);

        let startOfDay: Date;
        let endOfDay: Date;

        if (dateStr) {
            const parts = dateStr.split('-');
            const y = parseInt(parts[0] || '2026', 10);
            const m = parseInt(parts[1] || '1', 10);
            const d = parseInt(parts[2] || '1', 10);
            startOfDay = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
            endOfDay = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
        } else {
            const now = new Date();
            startOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
            endOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
        }

        const dateFilter = {
            centerId: centerObjId,
            date: { $gte: startOfDay, $lte: endOfDay },
        };

        const [stats, transactions] = await Promise.all([
            TransactionModel.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: '$category',
                        totalPaid: { $sum: '$paidAmount' },
                        totalRemaining: { $sum: '$remainingAmount' },
                        totalOriginal: { $sum: '$originalAmount' },
                        count: { $sum: 1 },
                    },
                },
            ]),
            TransactionModel.find(dateFilter)
                .populate('centerTeacherId', 'name subject')
                .populate('createdBy', 'name role')
                .sort({ date: -1, createdAt: -1 })
                .lean(),
        ]);

        const studentIds = transactions.map((t: any) => t.studentId).filter(Boolean);
        const centerStudents = await CenterStudentModel.find({ _id: { $in: studentIds } } as any)
            .select('studentName studentCode gradeLevel studentPhone parentPhone')
            .lean();
        const studentMap = new Map(centerStudents.map((s) => [s._id.toString(), s]));

        const enrichedTransactions = transactions.map((t: any) => {
            const st = t.studentId ? studentMap.get(t.studentId.toString()) : null;
            return {
                ...t,
                studentCode: st?.studentCode || '',
                studentPhone: st?.studentPhone || '',
                parentPhone: st?.parentPhone || '',
                studentName: t.studentName || st?.studentName || 'طالب',
                gradeLevel: t.gradeLevel || st?.gradeLevel || '',
            };
        });

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
            date: dateStr || startOfDay.toISOString().split('T')[0],
            totalPaid: totalRevenue,
            packageRevenue,
            privateRevenue,
            combinedRevenue,
            totalDebt,
            transactionCount: enrichedTransactions.length,
            transactions: enrichedTransactions,
        };
    }

    static async getMonthlyTally(centerId: string, year?: number, month?: number) {
        const centerObjId = new Types.ObjectId(centerId);
        const now = new Date();
        const y = Number(year) || now.getFullYear();
        const m = Number(month) || (now.getMonth() + 1);

        const startOfMonth = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
        const endOfMonth = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

        const dateFilter = {
            centerId: centerObjId,
            date: { $gte: startOfMonth, $lte: endOfMonth },
        };

        const [overallStats, dailyStats, transactions] = await Promise.all([
            TransactionModel.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: '$category',
                        totalPaid: { $sum: '$paidAmount' },
                        totalRemaining: { $sum: '$remainingAmount' },
                        totalOriginal: { $sum: '$originalAmount' },
                        count: { $sum: 1 },
                    },
                },
            ]),
            TransactionModel.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: {
                            $dayOfMonth: {
                                date: '$date',
                                timezone: '+03:00',
                            },
                        },
                        dayDate: { $first: '$date' },
                        totalPaid: { $sum: '$paidAmount' },
                        packageRevenue: {
                            $sum: { $cond: [{ $eq: ['$category', TransactionCategory.CENTER_PACKAGE] }, '$paidAmount', 0] },
                        },
                        privateRevenue: {
                            $sum: { $cond: [{ $eq: ['$category', TransactionCategory.CENTER_PRIVATE] }, '$paidAmount', 0] },
                        },
                        combinedRevenue: {
                            $sum: { $cond: [{ $eq: ['$category', TransactionCategory.CENTER_COMBINED] }, '$paidAmount', 0] },
                        },
                        totalDebt: { $sum: '$remainingAmount' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { '_id': 1 } },
            ]),
            TransactionModel.find(dateFilter)
                .populate('centerTeacherId', 'name subject')
                .populate('createdBy', 'name role')
                .sort({ date: -1, createdAt: -1 })
                .limit(300)
                .lean(),
        ]);

        const studentIds = transactions.map((t: any) => t.studentId).filter(Boolean);
        const centerStudents = await CenterStudentModel.find({ _id: { $in: studentIds } } as any)
            .select('studentName studentCode gradeLevel studentPhone parentPhone')
            .lean();
        const studentMap = new Map(centerStudents.map((s) => [s._id.toString(), s]));

        const enrichedTransactions = transactions.map((t: any) => {
            const st = t.studentId ? studentMap.get(t.studentId.toString()) : null;
            return {
                ...t,
                studentCode: st?.studentCode || '',
                studentPhone: st?.studentPhone || '',
                parentPhone: st?.parentPhone || '',
                studentName: t.studentName || st?.studentName || 'طالب',
                gradeLevel: t.gradeLevel || st?.gradeLevel || '',
            };
        });

        let packageRevenue = 0;
        let privateRevenue = 0;
        let combinedRevenue = 0;
        let totalRevenue = 0;
        let totalDebt = 0;
        let transactionCount = 0;

        for (const s of overallStats) {
            if (s._id === TransactionCategory.CENTER_PACKAGE) packageRevenue += s.totalPaid;
            if (s._id === TransactionCategory.CENTER_PRIVATE) privateRevenue += s.totalPaid;
            if (s._id === TransactionCategory.CENTER_COMBINED) combinedRevenue += s.totalPaid;
            totalRevenue += s.totalPaid;
            totalDebt += s.totalRemaining;
            transactionCount += s.count;
        }

        const dailyBreakdown = dailyStats.map((d) => ({
            day: d._id,
            date: d.dayDate,
            totalPaid: d.totalPaid,
            packageRevenue: d.packageRevenue,
            privateRevenue: d.privateRevenue,
            combinedRevenue: d.combinedRevenue,
            totalDebt: d.totalDebt,
            count: d.count,
        }));

        return {
            year: y,
            month: m,
            totalPaid: totalRevenue,
            packageRevenue,
            privateRevenue,
            combinedRevenue,
            totalDebt,
            transactionCount,
            dailyBreakdown,
            transactions: enrichedTransactions,
        };
    }

    static async getCenterTransactions(centerId: string, query: any = {}) {
        const centerObjId = new Types.ObjectId(centerId);
        const filter: any = { centerId: centerObjId };

        if (query.startDate && query.endDate) {
            const start = new Date(query.startDate);
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(query.endDate);
            end.setUTCHours(23, 59, 59, 999);
            filter.date = { $gte: start, $lte: end };
        } else if (query.date) {
            const parts = query.date.split('-').map(Number);
            const y = parts[0];
            const m = parts[1];
            const d = parts[2];
            const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
            const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
            filter.date = { $gte: start, $lte: end };
        }

        if (query.category) {
            filter.category = query.category;
        }
        if (query.centerTeacherId) {
            filter.centerTeacherId = new Types.ObjectId(query.centerTeacherId);
        }
        if (query.search) {
            filter.$or = [
                { studentName: { $regex: query.search.trim(), $options: 'i' } },
                { description: { $regex: query.search.trim(), $options: 'i' } },
            ];
        }

        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
        const skip = (page - 1) * limit;

        const [total, transactions] = await Promise.all([
            TransactionModel.countDocuments(filter),
            TransactionModel.find(filter)
                .populate('centerTeacherId', 'name subject')
                .populate('createdBy', 'name role')
                .sort({ date: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);

        const studentIds = transactions.map((t: any) => t.studentId).filter(Boolean);
        const centerStudents = await CenterStudentModel.find({ _id: { $in: studentIds } } as any)
            .select('studentName studentCode gradeLevel studentPhone parentPhone')
            .lean();
        const studentMap = new Map(centerStudents.map((s) => [s._id.toString(), s]));

        const enrichedTransactions = transactions.map((t: any) => {
            const st = t.studentId ? studentMap.get(t.studentId.toString()) : null;
            return {
                ...t,
                studentCode: st?.studentCode || '',
                studentPhone: st?.studentPhone || '',
                parentPhone: st?.parentPhone || '',
                studentName: t.studentName || st?.studentName || 'طالب',
                gradeLevel: t.gradeLevel || st?.gradeLevel || '',
            };
        });

        return {
            transactions: enrichedTransactions,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 9. Comprehensive Reports (Financials, Teachers, Groups)
    // ══════════════════════════════════════════════════════════════════════════

    static async getReportsOverview(centerId: string, startDate?: string, endDate?: string) {
        const centerObjId = new Types.ObjectId(centerId);

        const dateFilter: any = { centerId: centerObjId };
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            dateFilter.date = { $gte: start, $lte: end };
        }

        const [stats, transactions, totalStudents, activeStudents, secCount, prepCount, primCount, checkInsToday] = await Promise.all([
            TransactionModel.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: '$category',
                        totalPaid: { $sum: '$paidAmount' },
                        totalRemaining: { $sum: '$remainingAmount' },
                        totalOriginal: { $sum: '$originalAmount' },
                        count: { $sum: 1 },
                    },
                },
            ]),
            TransactionModel.find(dateFilter)
                .populate('centerTeacherId', 'name subject')
                .populate('createdBy', 'name')
                .sort({ date: -1 })
                .limit(50)
                .lean(),
            CenterStudentModel.countDocuments({ centerId: centerObjId }),
            CenterStudentModel.countDocuments({ centerId: centerObjId, isActive: true }),
            CenterStudentModel.countDocuments({ centerId: centerObjId, gradeLevel: { $regex: /ثانوي|SEC/i } }),
            CenterStudentModel.countDocuments({ centerId: centerObjId, gradeLevel: { $regex: /إعدادي|PREP/i } }),
            CenterStudentModel.countDocuments({ centerId: centerObjId, gradeLevel: { $regex: /ابتدائي|PRIM/i } }),
            CenterCheckInModel.countDocuments({
                centerId: centerObjId,
                date: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    $lte: new Date(new Date().setHours(23, 59, 59, 999)),
                },
            }),
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
            financials: {
                totalRevenue,
                packageRevenue,
                privateRevenue,
                combinedRevenue,
                totalDebt,
                transactionsCount: transactions.length,
                breakdown: stats,
            },
            students: {
                total: totalStudents,
                active: activeStudents,
                stages: {
                    secondary: secCount,
                    preparatory: prepCount,
                    primary: primCount,
                },
            },
            attendance: {
                checkInsToday,
            },
            recentTransactions: transactions,
        };
    }

    static async getTeachersReport(centerId: string, startDate?: string, endDate?: string) {
        const centerObjId = new Types.ObjectId(centerId);
        const teachers = await CenterTeacherModel.find({ centerId: centerObjId }).sort({ name: 1 }).lean();

        const dateFilter: any = { centerId: centerObjId };
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            dateFilter.date = { $gte: start, $lte: end };
        }

        const teacherReports = await Promise.all(
            teachers.map(async (teacher) => {
                const teacherObjId = teacher._id;

                const [groups, teacherTx, attendanceRecords] = await Promise.all([
                    CenterGroupModel.find({ centerId: centerObjId, centerTeacherId: teacherObjId }).lean(),
                    TransactionModel.find({ ...dateFilter, centerTeacherId: teacherObjId }).lean(),
                    CenterAttendanceModel.find({ centerId: centerObjId, centerTeacherId: teacherObjId }).lean(),
                ]);

                const groupIds = groups.map((g) => g._id);

                const enrollments = await CenterEnrollmentModel.find({
                    centerId: centerObjId,
                    status: 'ACTIVE',
                    $or: [
                        { packageGroups: { $in: groupIds } },
                        { 'privateTeachers.centerTeacherId': teacherObjId },
                    ],
                }).lean();

                const totalPaid = teacherTx.reduce((sum, tx) => sum + (tx.paidAmount || 0), 0);
                const totalRemaining = teacherTx.reduce((sum, tx) => sum + (tx.remainingAmount || 0), 0);

                let totalPresent = 0;
                let totalAbsent = 0;
                for (const att of attendanceRecords) {
                    if (att.status === 'PRESENT' || att.status === 'LATE') totalPresent++;
                    else if (att.status === 'ABSENT') totalAbsent++;
                }

                return {
                    teacher: {
                        _id: teacher._id,
                        name: teacher.name,
                        subject: teacher.subject,
                        isActive: teacher.isActive,
                    },
                    groupsCount: groups.length,
                    studentsCount: enrollments.length,
                    revenue: totalPaid,
                    remainingDebt: totalRemaining,
                    transactionsCount: teacherTx.length,
                    attendance: {
                        totalSessions: attendanceRecords.length,
                        present: totalPresent,
                        absent: totalAbsent,
                        attendanceRate: attendanceRecords.length > 0 ? Math.round((totalPresent / attendanceRecords.length) * 100) : 100,
                    },
                };
            })
        );

        return teacherReports;
    }

    static async getGroupsReport(centerId: string) {
        const centerObjId = new Types.ObjectId(centerId);
        const groups = await CenterGroupModel.find({ centerId: centerObjId })
            .populate('centerTeacherId', 'name subject')
            .sort({ gradeLevel: 1, name: 1 })
            .lean();

        const groupReports = await Promise.all(
            groups.map(async (group) => {
                const groupObjId = group._id;

                const [activeEnrollments, attendanceRecords, transactions] = await Promise.all([
                    CenterEnrollmentModel.countDocuments({
                        centerId: centerObjId,
                        status: 'ACTIVE',
                        $or: [
                            { packageGroups: groupObjId },
                            { 'privateTeachers.groupId': groupObjId },
                        ],
                    }),
                    CenterAttendanceModel.find({ centerId: centerObjId, groupId: groupObjId }).lean(),
                    TransactionModel.find({ centerId: centerObjId, description: { $regex: new RegExp(group.name, 'i') } }).lean(),
                ]);

                let totalPresent = 0;
                let totalAbsent = 0;
                for (const att of attendanceRecords) {
                    if (att.status === 'PRESENT' || att.status === 'LATE') totalPresent++;
                    else if (att.status === 'ABSENT') totalAbsent++;
                }

                const totalPaid = transactions.reduce((sum, tx) => sum + (tx.paidAmount || 0), 0);
                const fillRate = group.capacity ? Math.round((activeEnrollments / group.capacity) * 100) : null;

                return {
                    group: {
                        _id: group._id,
                        name: group.name,
                        teacher: (group.centerTeacherId as any)?.name || 'غير محدد',
                        subject: (group.centerTeacherId as any)?.subject || 'عام',
                        gradeLevel: group.gradeLevel,
                        groupType: group.groupType,
                        capacity: group.capacity,
                        schedule: group.schedule || [],
                        privateMonthlyPrice: group.privateMonthlyPrice,
                    },
                    enrolledCount: activeEnrollments,
                    fillRate,
                    revenue: totalPaid,
                    attendance: {
                        totalRecords: attendanceRecords.length,
                        present: totalPresent,
                        absent: totalAbsent,
                        attendanceRate: attendanceRecords.length > 0 ? Math.round((totalPresent / attendanceRecords.length) * 100) : 100,
                    },
                };
            })
        );

        return groupReports;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 10. Center Smart Cards Management & Batch PVC Generation
    // ══════════════════════════════════════════════════════════════════════════

    static async generateCards(centerId: string, count: number, createdBy: string) {
        if (!count || count < 1 || count > 1000) {
            throw BadRequestException({ message: 'عدد الكروت يجب أن يكون بين 1 و 1000' });
        }

        const centerObjId = new Types.ObjectId(centerId);
        const center = await CenterModel.findById(centerId).lean();
        if (!center) throw NotFoundException({ message: 'السنتر غير موجود' });

        const batchId = crypto.randomUUID();
        const counterKey = `cards:center:${centerId}`;

        const firstSeq = await nextSequenceBulk(counterKey, count);

        const docs = Array.from({ length: count }, (_, i) => {
            const seq = firstSeq + i;
            const cardNumber = `CTR-${String(seq).padStart(5, '0')}`;
            const cardToken = crypto.randomUUID();
            return {
                cardNumber,
                cardToken,
                centerId: centerObjId,
                batchId,
                status: 'NEW' as const,
                linkedBy: new Types.ObjectId(createdBy),
            };
        });

        const created = await CardModel.insertMany(docs);

        return {
            batchId,
            count: created.length,
            cards: created.map((c) => ({ cardNumber: c.cardNumber, cardToken: c.cardToken })),
        };
    }

    static async getCardsStats(centerId: string) {
        const centerObjId = new Types.ObjectId(centerId);
        const [counts, total] = await Promise.all([
            CardModel.aggregate([
                { $match: { centerId: centerObjId } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            CardModel.countDocuments({ centerId: centerObjId }),
        ]);

        const stats: Record<string, number> = { NEW: 0, LINKED: 0, DISABLED: 0, total };
        for (const item of counts) {
            stats[item._id] = item.count;
        }

        return stats;
    }

    static async getCards(centerId: string, query: any = {}) {
        const centerObjId = new Types.ObjectId(centerId);
        const filter: any = { centerId: centerObjId };

        if (query.status && query.status !== 'ALL') {
            filter.status = query.status;
        }
        if (query.batchId) {
            filter.batchId = query.batchId;
        }
        if (query.search) {
            const s = query.search.trim();
            filter.$or = [
                { cardNumber: { $regex: s, $options: 'i' } },
                { cardToken: { $regex: s, $options: 'i' } },
            ];
        }

        const page = Math.max(1, parseInt(query.page || '1', 10));
        const limit = Math.max(1, Math.min(100, parseInt(query.limit || '20', 10)));
        const skip = (page - 1) * limit;

        const [cards, total] = await Promise.all([
            CardModel.find(filter)
                .populate('centerStudentId', 'studentName studentCode gradeLevel studentPhone parentName barcode')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CardModel.countDocuments(filter),
        ]);

        return {
            data: cards,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    static async resolveCard(centerId: string, rawInput: string) {
        const centerObjId = new Types.ObjectId(centerId);

        let clean = String(rawInput || '').trim();
        if (clean.includes('/card/')) {
            clean = clean.split('/card/').pop()?.split(/[?#]/)[0]?.trim() || clean;
        }

        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const uuidMatch = clean.match(uuidRegex);
        const looksLikeToken = uuidMatch !== null;
        const resolvedInput = looksLikeToken ? uuidMatch![0]! : clean;

        let card: any = null;

        if (looksLikeToken) {
            card = await CardModel.findOne({ cardToken: resolvedInput, centerId: centerObjId }).lean();
        }
        if (!card) {
            card = await CardModel.findOne({
                centerId: centerObjId,
                $or: [
                    { cardNumber: resolvedInput },
                    { cardNumber: resolvedInput.toUpperCase() },
                    { cardToken: resolvedInput }
                ],
            }).lean();
        }

        if (card) {
            let studentData: any = null;
            let enrolledGroups: any[] = [];
            if (card.centerStudentId) {
                studentData = await CenterStudentModel.findOne({ _id: card.centerStudentId, centerId: centerObjId }).lean();
            } else if (card.status === 'NEW') {
                const matched = await CenterStudentModel.findOne({
                    centerId: centerObjId,
                    $or: [
                        { barcode: card.cardNumber },
                        { barcode: card.cardNumber.toUpperCase() },
                        { barcode: card.cardToken }
                    ],
                }).lean();
                if (matched) {
                    await CardModel.findByIdAndUpdate(card._id, {
                        centerStudentId: matched._id,
                        status: 'LINKED',
                        linkedAt: new Date(),
                    });
                    card.status = 'LINKED';
                    card.centerStudentId = matched._id;
                    studentData = matched;
                }
            }

            let activeEnrollment: any = null;
            if (studentData) {
                const [groups, enrollment] = await Promise.all([
                    CenterGroupModel.find({
                        centerId: centerObjId,
                        'students.studentId': studentData._id,
                        isActive: true,
                    }).select('name gradeLevel groupType').lean(),
                    CenterEnrollmentModel.findOne({
                        centerId: centerObjId,
                        studentId: studentData._id,
                        isActive: true,
                    }).populate('packageId', 'name gradeLevel monthlyPrice').lean(),
                ]);
                enrolledGroups = groups;
                activeEnrollment = enrollment;
                studentData = {
                    ...studentData,
                    studentType: activeEnrollment?.type || studentData.studentType || (activeEnrollment ? 'PACKAGE' : 'PRIVATE'),
                };
            }

            return {
                source: looksLikeToken ? 'cardToken' : 'cardNumber',
                isLinked: !!(studentData),
                card: {
                    _id: card._id,
                    cardNumber: card.cardNumber,
                    cardToken: card.cardToken,
                    status: card.status,
                    centerId: card.centerId,
                },
                student: studentData,
                enrollment: activeEnrollment,
                enrolledGroups,
            };
        }

        const directStudent = await CenterStudentModel.findOne({
            centerId: centerObjId,
            $or: [
                { barcode: resolvedInput },
                { barcode: resolvedInput.toUpperCase() },
                { studentCode: resolvedInput },
                { studentCode: resolvedInput.toUpperCase() }
            ],
        }).lean();

        if (directStudent) {
            const [existingCard, groups, enrollment] = await Promise.all([
                CardModel.findOne({ centerStudentId: directStudent._id, centerId: centerObjId }).lean(),
                CenterGroupModel.find({
                    centerId: centerObjId,
                    'students.studentId': directStudent._id,
                    isActive: true,
                }).select('name gradeLevel groupType').lean(),
                CenterEnrollmentModel.findOne({
                    centerId: centerObjId,
                    studentId: directStudent._id,
                    isActive: true,
                }).populate('packageId', 'name gradeLevel monthlyPrice').lean(),
            ]);

            const enrichedDirectStudent = {
                ...directStudent,
                studentType: enrollment?.type || directStudent.studentType || (enrollment ? 'PACKAGE' : 'PRIVATE'),
            };

            return {
                source: directStudent.barcode === resolvedInput ? 'barcode' : 'studentCode',
                isLinked: !!(existingCard && existingCard.status === 'LINKED'),
                card: existingCard ? {
                    _id: existingCard._id,
                    cardNumber: existingCard.cardNumber,
                    cardToken: existingCard.cardToken,
                    status: existingCard.status,
                    centerId: existingCard.centerId,
                } : null,
                student: enrichedDirectStudent,
                enrollment,
                enrolledGroups: groups,
            };
        }

        throw NotFoundException({ message: 'لم يتم العثور على أي كارت أو طالب يطابق هذه البيانات في السنتر' });
    }

    static async linkCard(centerId: string, cardNumber: string, centerStudentId: string, linkedBy: string) {
        const centerObjId = new Types.ObjectId(centerId);
        const [card, student] = await Promise.all([
            CardModel.findOne({
                centerId: centerObjId,
                $or: [{ cardNumber }, { cardNumber: cardNumber.toUpperCase() }],
            }),
            CenterStudentModel.findOne({ _id: centerStudentId, centerId: centerObjId }),
        ]);

        if (!card) throw NotFoundException({ message: 'الكارت غير موجود بالسنتر' });
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود بالسنتر' });
        if (card.status === 'DISABLED') throw BadRequestException({ message: 'لا يمكن ربط كارت معطل' });

        // Unlink any old card previously bound to this student
        await CardModel.updateMany(
            { centerStudentId: student._id, _id: { $ne: card._id } },
            { $set: { status: 'NEW', centerStudentId: null, linkedAt: null, linkedBy: null } }
        );

        card.centerStudentId = student._id;
        card.status = 'LINKED';
        card.linkedAt = new Date();
        card.linkedBy = new Types.ObjectId(linkedBy);
        await card.save();

        student.barcode = card.cardNumber;
        await student.save();

        return { card, student };
    }

    static async createStudentAndLinkCard(centerId: string, studentData: any, linkedBy: string) {
        const centerObjId = new Types.ObjectId(centerId);
        const { cardNumber, ...rest } = studentData;

        const card = await CardModel.findOne({
            centerId: centerObjId,
            $or: [{ cardNumber }, { cardNumber: cardNumber?.toUpperCase() }],
        });
        if (!card) throw NotFoundException({ message: 'الكارت غير موجود بالسنتر' });
        if (card.status === 'DISABLED') throw BadRequestException({ message: 'الكارت معطل' });

        const letter = (GRADE_LETTER as any)[rest.gradeLevel] || 'A';
        const count = await nextSequence(`${centerId}_${rest.gradeLevel}`);
        const studentCode = `${count}${letter}`;

        const studentName = (rest.studentName || rest.name || '').trim();
        if (!studentName) throw BadRequestException({ message: 'اسم الطالب مطلوب' });

        const studentPhone = (rest.studentPhone || rest.phone || '').trim();
        const parentPhone = (rest.parentPhone || '').trim();

        let parentName = rest.parentName?.trim();
        if (!parentName && studentName) {
            const parts = studentName.split(/\s+/);
            parentName = parts.length > 1 ? parts.slice(1).join(' ') : `ولي أمر ${studentName}`;
        }

        const finalStudentType = rest.studentType || (rest.packageId ? 'PACKAGE' : 'PRIVATE');
        let matchedPkg: any = null;
        if (rest.packageId && finalStudentType === 'PACKAGE') {
            matchedPkg = await CenterPackageModel.findOne({ _id: rest.packageId, centerId: centerObjId, isActive: true }).lean();
            if (!matchedPkg) throw NotFoundException({ message: 'الباكيدج المحدد غير موجود' });
            if (matchedPkg.gradeLevel !== rest.gradeLevel) {
                throw BadRequestException({ message: `الباكيدج المحدد (${matchedPkg.gradeLevel}) لا يطابق المرحلة الدراسية للطالب (${rest.gradeLevel})` });
            }
        }

        const student = await CenterStudentModel.create({
            ...rest,
            studentType: finalStudentType,
            studentName,
            parentName,
            studentPhone: studentPhone || undefined,
            parentPhone: parentPhone || undefined,
            centerId: centerObjId,
            studentCode,
            barcode: card.cardNumber,
            isActive: true,
        });

        // Unlink any old card previously bound to this student (if any)
        await CardModel.updateMany(
            { centerStudentId: student._id, _id: { $ne: card._id } },
            { $set: { status: 'NEW', centerStudentId: null, linkedAt: null, linkedBy: null } }
        );

        card.centerStudentId = student._id;
        card.status = 'LINKED';
        card.linkedAt = new Date();
        card.linkedBy = new Types.ObjectId(linkedBy);
        await card.save();

        // If packageId provided and studentType is PACKAGE, create enrollment
        if (rest.packageId && finalStudentType === 'PACKAGE') {
            const pkgTeacherIds = (matchedPkg?.teachers || []).map((t: any) =>
                typeof t.teacherId === 'object' ? t.teacherId?._id : t.teacherId
            ).filter(Boolean);

            const autoGroups = await CenterGroupModel.find({
                centerId: centerObjId,
                centerTeacherId: { $in: pkgTeacherIds },
                gradeLevel: rest.gradeLevel,
                groupType: { $in: ['PACKAGE', 'MIXED'] },
                isActive: true,
            }).select('_id').lean();

            await CenterEnrollmentModel.create({
                centerId: centerObjId,
                studentId: student._id,
                type: CenterEnrollmentType.PACKAGE,
                packageId: new Types.ObjectId(rest.packageId),
                packageMonthlyPrice: matchedPkg?.monthlyPrice ?? null,
                packageGroups: autoGroups.map((g) => g._id),
                startDate: new Date(),
                isActive: true,
            });
        } else if (finalStudentType === 'PRIVATE') {
            let pts = rest.privateTeachers || [];
            if ((!pts || pts.length === 0) && rest.groupIds && rest.groupIds.length > 0) {
                pts = rest.groupIds.map((gid: string) => ({ groupId: gid }));
            } else if ((!pts || pts.length === 0) && rest.groupId) {
                pts = [{ groupId: rest.groupId }];
            }

            if (pts.length > 0) {
                const resolvedPrivate = await Promise.all(
                    pts.map(async (pt: any) => {
                        const group = await CenterGroupModel.findOne({ _id: pt.groupId, centerId: centerObjId }).lean();
                        if (!group) throw NotFoundException({ message: 'المجموعة المحددة غير موجودة' });
                        return {
                            centerTeacherId: pt.centerTeacherId || group.centerTeacherId,
                            groupId: group._id,
                            subject: pt.subject || null,
                            monthlyPrice: pt.monthlyPrice ?? group.privateMonthlyPrice ?? 0,
                            sessionsPerWeek: pt.sessionsPerWeek || 1,
                        };
                    })
                );

                await CenterEnrollmentModel.create({
                    centerId: centerObjId,
                    studentId: student._id,
                    type: CenterEnrollmentType.PRIVATE,
                    privateTeachers: resolvedPrivate,
                    startDate: new Date(),
                    isActive: true,
                });
            }
        }

        return { card, student };
    }

    static async unlinkCard(centerId: string, cardNumber: string) {
        const centerObjId = new Types.ObjectId(centerId);
        const card = await CardModel.findOne({ cardNumber, centerId: centerObjId });
        if (!card) throw NotFoundException({ message: 'الكارت غير موجود' });

        if (card.centerStudentId) {
            await CenterStudentModel.updateOne(
                { _id: card.centerStudentId, centerId: centerObjId, barcode: cardNumber },
                { $set: { barcode: null } }
            );
        }

        card.centerStudentId = null;
        card.status = 'NEW';
        card.linkedAt = null;
        card.linkedBy = null;
        await card.save();

        return card;
    }

    static async disableCard(centerId: string, cardNumber: string, reason: string, disabledBy: string) {
        const centerObjId = new Types.ObjectId(centerId);
        const card = await CardModel.findOne({ cardNumber, centerId: centerObjId });
        if (!card) throw NotFoundException({ message: 'الكارت غير موجود' });

        card.status = 'DISABLED';
        card.disabledAt = new Date();
        card.disabledReason = reason || 'MANUAL';
        card.disabledBy = new Types.ObjectId(disabledBy);
        await card.save();

        return card;
    }

    static async getCardTemplate(centerId: string) {
        const center = await CenterModel.findById(centerId).select('cardTemplate name logoUrl').lean();
        if (!center) throw NotFoundException({ message: 'السنتر غير موجود' });

        return {
            centerName: center.name,
            logoUrl: center.logoUrl,
            template: (center as any).cardTemplate || {
                frontDesignUrl: null,
                backDesignUrl: null,
                themePreset: 'modern_dark',
                showCenterName: true,
                showStudentPhoto: true,
                showBarcode: true,
                showQrCode: true,
                primaryColor: '#6366f1',
            },
        };
    }

    static async updateCardTemplate(centerId: string, templateData: any) {
        const center = await CenterModel.findById(centerId);
        if (!center) throw NotFoundException({ message: 'السنتر غير موجود' });

        (center as any).cardTemplate = {
            ...((center as any).cardTemplate || {}),
            ...templateData,
        };
        await center.save();

        return (center as any).cardTemplate;
    }

    static async getBatchPrintCards(centerId: string, batchId: string) {
        const centerObjId = new Types.ObjectId(centerId);
        const [center, cards] = await Promise.all([
            CenterModel.findById(centerId).lean(),
            CardModel.find({ centerId: centerObjId, batchId })
                .populate('centerStudentId', 'studentName studentCode gradeLevel')
                .lean(),
        ]);

        if (!center) throw NotFoundException({ message: 'السنتر غير موجود' });

        return {
            center: {
                _id: center._id,
                name: center.name,
                logoUrl: center.logoUrl,
                template: (center as any).cardTemplate,
            },
            batchId,
            cards,
        };
    }
}
