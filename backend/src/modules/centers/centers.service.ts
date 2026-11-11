import crypto from 'crypto';
import { Types } from 'mongoose';
import { CenterModel } from '../../database/models/center.model.js';
import { CardModel } from '../../database/models/card.model.js';
import { CenterTeacherModel } from '../../database/models/center-teacher.model.js';
import { CenterPackageModel } from '../../database/models/center-package.model.js';
import { CenterGroupModel } from '../../database/models/center-group.model.js';
import { CenterSessionModel } from '../../database/models/center-session.model.js';
import { CenterAttendanceModel } from '../../database/models/center-attendance.model.js';
import { CenterCheckInModel } from '../../database/models/center-checkin.model.js';
import { CenterEnrollmentModel } from '../../database/models/center-enrollment.model.js';
import { CenterStudentModel } from '../../database/models/center-student.model.js';
import { TeacherMessageModel } from '../../database/models/teacher-message.model.js';
import { ParentStudentModel } from '../../database/models/parent-student.model.js';
import { nextSequence, nextSequenceBulk } from '../../database/models/counter.model.js';
import { UserModel } from '../../database/models/user.model.js';
import { StudentModel } from '../../database/models/student.model.js';
import { TransactionModel } from '../../database/models/transaction.model.js';
import { SubscriptionModel } from '../../database/models/subscription.model.js';
import { UserRole, CenterSupervisorType, TransactionType, TransactionCategory, SubscriptionStatus, SubscriptionPlan, GradeLevel, GRADE_LETTER, CenterEnrollmentType, CenterGroupType, AttendanceStatus } from '../../common/enums/enum.service.js';
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
    // 3. Center Packages (with Auto-Synced Subject Classes / حصص الباكيدج)
    // ══════════════════════════════════════════════════════════════════════════

    static async syncPackageClasses(
        centerId: string,
        gradeLevel: GradeLevel,
        _packageName?: string,
        teachersInput: any[] = [],
        _extra?: any
    ) {
        const centerObjId = new Types.ObjectId(centerId);
        const resolvedTeachers: any[] = [];

        for (const item of teachersInput || []) {
            const rawTeacherId = typeof item.teacherId === 'object' ? item.teacherId?._id : item.teacherId;
            if (!rawTeacherId) continue;

            const teacher = await CenterTeacherModel.findOne({
                _id: rawTeacherId,
                centerId: centerObjId,
            }).lean();

            const subject = (item.subject || teacher?.subject || 'مادة').trim();
            const explicitSchedule = Array.isArray(item.schedule)
                ? item.schedule.filter((s: any) => s?.day && s?.time)
                : [];

            let groupDoc: any = null;
            if (item.groupId && Types.ObjectId.isValid(String(item.groupId))) {
                groupDoc = await CenterGroupModel.findOne({
                    _id: item.groupId,
                    centerId: centerObjId,
                    isActive: true,
                }).lean();
            }

            if (!groupDoc) {
                groupDoc = await CenterGroupModel.findOne({
                    centerId: centerObjId,
                    centerTeacherId: new Types.ObjectId(String(rawTeacherId)),
                    gradeLevel,
                    groupType: { $in: [CenterGroupType.PACKAGE, CenterGroupType.MIXED] },
                    isActive: true,
                }).lean();
            }

            if (groupDoc && explicitSchedule.length > 0) {
                groupDoc = await CenterGroupModel.findByIdAndUpdate(
                    groupDoc._id,
                    { $set: { schedule: explicitSchedule } },
                    { new: true }
                ).lean();
            }

            resolvedTeachers.push({
                teacherId: new Types.ObjectId(String(rawTeacherId)),
                subject,
                ...(explicitSchedule.length > 0
                    ? { schedule: explicitSchedule }
                    : groupDoc?.schedule?.length
                        ? { schedule: groupDoc.schedule }
                        : {}),
                ...(groupDoc?._id ? { groupId: groupDoc._id } : {}),
            });
        }

        return resolvedTeachers;
    }

    static async resolvePackageClassGroupIds(centerId: string, pkg: any): Promise<Types.ObjectId[]> {
        if (!pkg) return [];
        const centerObjId = new Types.ObjectId(centerId);
        const explicitGroupIds: Types.ObjectId[] = [];
        const teacherIds: Types.ObjectId[] = [];

        for (const t of pkg.teachers || []) {
            const gid = typeof t.groupId === 'object' ? t.groupId?._id : t.groupId;
            if (gid && Types.ObjectId.isValid(String(gid))) {
                explicitGroupIds.push(new Types.ObjectId(String(gid)));
            }
            const tid = typeof t.teacherId === 'object' ? t.teacherId?._id : t.teacherId;
            if (tid && Types.ObjectId.isValid(String(tid))) {
                teacherIds.push(new Types.ObjectId(String(tid)));
            }
        }

        if (explicitGroupIds.length > 0) {
            return Array.from(new Map(explicitGroupIds.map((id) => [id.toString(), id])).values());
        }

        if (teacherIds.length > 0) {
            const groups = await CenterGroupModel.find({
                centerId: centerObjId,
                centerTeacherId: { $in: teacherIds },
                gradeLevel: pkg.gradeLevel,
                groupType: { $in: [CenterGroupType.PACKAGE, CenterGroupType.MIXED] },
                isActive: true,
            }).select('_id').lean();
            return groups.map((g) => g._id as Types.ObjectId);
        }

        return [];
    }

    static async createPackage(centerId: string, data: any) {
        const existing = await CenterPackageModel.findOne({
            centerId,
            gradeLevel: data.gradeLevel,
            isActive: true,
        }).lean();

        if (existing) {
            throw ConflictException({ message: 'يوجد باكيدج مسجل بالفعل لهذا الصف الدراسي في هذا السنتر' });
        }

        // Verify all teacher IDs exist in this center
        const uniqueTeacherIds: string[] = Array.from(new Set(data.teachers.map((t: any) => String(t.teacherId))));
        const count = await CenterTeacherModel.countDocuments({
            _id: { $in: uniqueTeacherIds },
            centerId,
            isActive: true,
        });

        if (count !== uniqueTeacherIds.length) {
            throw BadRequestException({ message: 'بعض المدرسين المحددين غير موجودين أو غير نشطين في هذا السنتر' });
        }

        const syncedTeachers = await CenterService.syncPackageClasses(
            centerId,
            data.gradeLevel,
            data.name,
            data.teachers
        );

        const created = await CenterPackageModel.create({
            centerId,
            name: data.name,
            gradeLevel: data.gradeLevel,
            teachers: syncedTeachers,
            monthlyPrice: data.monthlyPrice,
            isActive: true,
        });

        return await CenterPackageModel.findById(created._id)
            .populate('teachers.teacherId', 'name subject')
            .populate('teachers.groupId', 'name schedule gradeLevel groupType')
            .lean();
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
            .populate('teachers.groupId', 'name schedule gradeLevel groupType')
            .sort({ gradeLevel: 1 })
            .lean();
    }

    static async getPackageById(packageId: string, centerId: string) {
        const pkg = await CenterPackageModel.findOne({ _id: packageId, centerId })
            .populate('teachers.teacherId', 'name subject')
            .populate('teachers.groupId', 'name schedule gradeLevel groupType')
            .lean();
        if (!pkg) throw NotFoundException({ message: 'الباكيدج غير موجود' });
        return pkg;
    }

    static async updatePackage(packageId: string, centerId: string, data: any) {
        const existingPkg = await CenterPackageModel.findOne({ _id: packageId, centerId }).lean();
        if (!existingPkg) throw NotFoundException({ message: 'الباكيدج غير موجود' });

        const targetGrade = (data.gradeLevel || existingPkg.gradeLevel) as GradeLevel;
        const targetName = data.name || existingPkg.name;

        const updatePayload: any = { ...data };
        if (Array.isArray(data.teachers)) {
            updatePayload.teachers = await CenterService.syncPackageClasses(
                centerId,
                targetGrade,
                targetName,
                data.teachers
            );
        }

        const pkg = await CenterPackageModel.findOneAndUpdate(
            { _id: packageId, centerId },
            { $set: updatePayload },
            { new: true }
        )
            .populate('teachers.teacherId', 'name subject')
            .populate('teachers.groupId', 'name schedule gradeLevel groupType')
            .lean();

        if (!pkg) throw NotFoundException({ message: 'الباكيدج غير موجود' });

        // Sync active PACKAGE / BOTH enrollments so package students automatically get all package classes
        if (Array.isArray(updatePayload.teachers)) {
            const classGroupIds = updatePayload.teachers
                .map((t: any) => t.groupId)
                .filter(Boolean);
            if (classGroupIds.length > 0) {
                await CenterEnrollmentModel.updateMany(
                    {
                        centerId: new Types.ObjectId(centerId),
                        packageId: new Types.ObjectId(packageId),
                        type: { $in: [CenterEnrollmentType.PACKAGE, CenterEnrollmentType.BOTH] },
                        isActive: true,
                    },
                    { $set: { packageGroups: classGroupIds } }
                );
            }
        }

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
        const centerObjId = new Types.ObjectId(centerId);
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

        const finalStudentType = data.studentType || (data.packageId ? 'PACKAGE' : 'PRIVATE');
        let matchedPkg: any = null;
        if (data.packageId && (finalStudentType === 'PACKAGE' || finalStudentType === 'BOTH')) {
            matchedPkg = await CenterPackageModel.findOne({ _id: data.packageId, centerId: centerObjId, isActive: true }).lean();
            if (!matchedPkg) throw NotFoundException({ message: 'الباكيدج المحدد غير موجود' });
            if (matchedPkg.gradeLevel !== data.gradeLevel) {
                throw BadRequestException({ message: `الباكيدج المحدد (${matchedPkg.gradeLevel}) لا يطابق الصف الدراسي للطالب (${data.gradeLevel})` });
            }
        }

        const student = await CenterStudentModel.create({
            centerId: centerObjId,
            studentName,
            parentName,
            studentPhone: data.studentPhone?.trim() || null,
            parentPhone: data.parentPhone?.trim() || null,
            gradeLevel: data.gradeLevel,
            studentType: finalStudentType,
            studentCode,
            barcode,
            notes: data.notes?.trim() || null,
            isActive: true,
        });

        // Auto-enroll if packageId or private classes provided
        if (matchedPkg && (finalStudentType === 'PACKAGE' || finalStudentType === 'BOTH')) {
            const pkgGroupIds = await CenterService.resolvePackageClassGroupIds(centerId, matchedPkg);
            await CenterEnrollmentModel.create({
                centerId: centerObjId,
                studentId: student._id,
                type: CenterEnrollmentType.PACKAGE,
                packageId: matchedPkg._id,
                packageMonthlyPrice: matchedPkg.monthlyPrice ?? null,
                packageGroups: pkgGroupIds,
                privateTeachers: [],
                startDate: new Date(),
                isActive: true,
            });
        } else if (finalStudentType === 'PRIVATE') {
            let pts = data.privateTeachers || [];
            if ((!pts || pts.length === 0) && Array.isArray(data.groupIds) && data.groupIds.length > 0) {
                pts = data.groupIds.map((gid: string) => ({ groupId: gid }));
            } else if ((!pts || pts.length === 0) && data.groupId) {
                pts = [{ groupId: data.groupId }];
            }

            if (pts.length > 0) {
                const resolvedPrivate = await Promise.all(
                    pts.map(async (pt: any) => {
                        const group = await CenterGroupModel.findOne({ _id: pt.groupId, centerId: centerObjId }).lean();
                        if (!group) throw NotFoundException({ message: 'الحصة المحددة غير موجودة' });
                        return {
                            centerTeacherId: pt.centerTeacherId || group.centerTeacherId,
                            groupId: group._id,
                            subject: pt.subject || null,
                            monthlyPrice: pt.monthlyPrice ?? group.privateMonthlyPrice ?? 0,
                            sessionsPerWeek: pt.sessionsPerWeek || (group.schedule?.length || 1),
                        };
                    })
                );

                await CenterEnrollmentModel.create({
                    centerId: centerObjId,
                    studentId: student._id,
                    type: CenterEnrollmentType.PRIVATE,
                    packageId: null,
                    packageGroups: [],
                    privateTeachers: resolvedPrivate,
                    startDate: new Date(),
                    isActive: true,
                });
            }
        }

        return student;
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

        if (query.groupId) {
            try {
                const groupObjId = new Types.ObjectId(query.groupId);
                const enrollments = await CenterEnrollmentModel.find({
                    centerId: centerObjId,
                    $or: [
                        { packageGroups: groupObjId },
                        { 'privateTeachers.groupId': groupObjId },
                    ],
                }).select('studentId').lean();
                const studentIds = enrollments.map(e => e.studentId);
                filter._id = { $in: studentIds };
            } catch (e) {
                // Ignore invalid ObjectId
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
                CenterStudentModel.countDocuments({ centerId: centerObjId, gradeLevel: { $in: primaryGrades } }),
                CenterStudentModel.aggregate([
                    { $match: { centerId: centerObjId } },
                    { $group: { _id: '$gradeLevel', count: { $sum: 1 } } },
                ])
            );
        }

        const [students, total, totalCenter, secCount, prepCount, primCount, gradeAgg] = await Promise.all(promises);

        const gradeCounts: Record<string, number> = {};
        if (Array.isArray(gradeAgg)) {
            for (const g of gradeAgg) {
                if (g._id) gradeCounts[String(g._id)] = g.count || 0;
            }
        }

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
            gradeCounts: needStageCounts ? gradeCounts : undefined,
        };
    }

    static async getStudentById(centerId: string, studentId: string) {
        const student = await CenterStudentModel.findOne({ _id: studentId, centerId }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });
        return student;
    }

    static calculateEnrollmentNetPrice(enrollment: any): number {
        if (!enrollment || !enrollment.isActive) return 0;

        const applyDisc = (base: number, disc?: { type?: string | null; value?: number } | null) => {
            if (!disc || !disc.type || !disc.value || disc.value <= 0) return base;
            if (disc.type === 'PERCENTAGE') {
                return Math.max(0, Math.round(base * (1 - Math.min(100, disc.value) / 100)));
            }
            return Math.max(0, base - disc.value);
        };

        let pkgNet = 0;
        if (enrollment.type === 'PACKAGE' || enrollment.type === 'BOTH') {
            const rawPkg = enrollment.packageMonthlyPrice ?? (enrollment.packageId as any)?.monthlyPrice ?? 0;
            pkgNet = applyDisc(Number(rawPkg) || 0, enrollment.packageDiscount);
        }

        let privNet = 0;
        if (enrollment.type === 'PRIVATE' || enrollment.type === 'BOTH') {
            const rawPriv = (enrollment.privateTeachers || []).reduce(
                (acc: number, pt: any) => acc + (Number(pt.monthlyPrice ?? (pt.groupId as any)?.privateMonthlyPrice ?? 0) || 0),
                0
            );
            privNet = applyDisc(rawPriv, enrollment.privateDiscount);
        }

        const combined = pkgNet + privNet;
        if (enrollment.type === 'BOTH' && enrollment.combinedDiscount) {
            return applyDisc(combined, enrollment.combinedDiscount);
        }
        return combined;
    }

    static computeStudentDebtSummary(enrollment: any, transactions: any[]) {
        const expectedAmount = CenterService.calculateEnrollmentNetPrice(enrollment);
        const totalPaid = (transactions || []).reduce((acc, t) => acc + (Number(t.paidAmount) || 0), 0);
        const txRemaining = (transactions || []).reduce((acc, t) => acc + (Number(t.remainingAmount) || 0), 0);
        const totalOriginal = (transactions || []).reduce((acc, t) => acc + (Number(t.originalAmount) || 0), 0);

        const unpaidFromEnrollment = expectedAmount > 0 ? Math.max(0, expectedAmount - totalPaid) : 0;
        const totalRemainingDebt = (transactions && transactions.length > 0)
            ? Math.max(txRemaining, unpaidFromEnrollment)
            : expectedAmount;

        return {
            expectedAmount,
            totalOriginal: totalOriginal || expectedAmount,
            totalPaid,
            txRemaining,
            totalRemaining: totalRemainingDebt,
            totalRemainingDebt,
            hasDebt: totalRemainingDebt > 0,
            hasActiveEnrollment: !!enrollment,
            enrollmentType: enrollment?.type || null,
        };
    }

    static async getStudentFullProfile(centerId: string, studentId: string) {
        const centerObjId = new Types.ObjectId(centerId);
        const student = await CenterStudentModel.findOne({ _id: studentId, centerId: centerObjId }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });

        const [enrollment, classAttendance, checkIns, transactions] = await Promise.all([
            CenterEnrollmentModel.findOne({ centerId: centerObjId, studentId: student._id })
                .populate({
                    path: 'packageId',
                    select: 'name gradeLevel monthlyPrice teachers',
                    populate: [
                        { path: 'teachers.teacherId', select: 'name subject' },
                        { path: 'teachers.groupId', select: 'name schedule gradeLevel groupType' },
                    ],
                })
                .populate({
                    path: 'packageGroups',
                    select: 'name schedule gradeLevel centerTeacherId groupType privateMonthlyPrice',
                    populate: { path: 'centerTeacherId', select: 'name subject' },
                })
                .populate('privateTeachers.centerTeacherId', 'name subject')
                .populate({
                    path: 'privateTeachers.groupId',
                    select: 'name schedule gradeLevel centerTeacherId groupType privateMonthlyPrice',
                    populate: { path: 'centerTeacherId', select: 'name subject' },
                })
                .lean(),
            CenterAttendanceModel.find({ centerId: centerObjId, studentId: student._id })
                .populate({
                    path: 'groupId',
                    select: 'name gradeLevel groupType schedule centerTeacherId',
                    populate: { path: 'centerTeacherId', select: 'name subject' },
                })
                .populate('recordedBy', 'name role')
                .sort({ date: -1, scannedAt: -1 })
                .limit(200)
                .lean(),
            CenterCheckInModel.find({ centerId: centerObjId, studentId: student._id })
                .populate({
                    path: 'attendedGroups',
                    select: 'name gradeLevel groupType schedule centerTeacherId',
                    populate: { path: 'centerTeacherId', select: 'name subject' },
                })
                .populate('recordedBy', 'name')
                .sort({ date: -1, checkInTime: -1 })
                .limit(100)
                .lean(),
            TransactionModel.find({ centerId: centerObjId, studentId: student._id })
                .populate('centerTeacherId', 'name subject')
                .populate('createdBy', 'name role')
                .sort({ date: -1, createdAt: -1 })
                .lean(),
        ]);

        // Build unified enrolled classes list
        const enrolledClassesMap = new Map<string, any>();
        if (enrollment && (enrollment.type === 'PACKAGE' || enrollment.type === 'BOTH')) {
            for (const g of (enrollment.packageGroups || []) as any[]) {
                if (g && g._id) {
                    const tch = g.centerTeacherId;
                    enrolledClassesMap.set(String(g._id), {
                        _id: g._id,
                        name: g.name,
                        gradeLevel: g.gradeLevel,
                        groupType: g.groupType || 'PACKAGE',
                        enrollmentSource: 'PACKAGE',
                        teacherName: tch?.name || 'غير محدد',
                        subject: tch?.subject || 'عام',
                        schedule: g.schedule || [],
                    });
                }
            }
        }
        if (enrollment && (enrollment.type === 'PRIVATE' || enrollment.type === 'BOTH')) {
            for (const pt of (enrollment.privateTeachers || []) as any[]) {
                const g = pt.groupId;
                const tch = pt.centerTeacherId || g?.centerTeacherId;
                if (g && g._id) {
                    enrolledClassesMap.set(String(g._id), {
                        _id: g._id,
                        name: g.name,
                        gradeLevel: g.gradeLevel || student.gradeLevel,
                        groupType: g.groupType || 'PRIVATE',
                        enrollmentSource: 'PRIVATE',
                        teacherName: tch?.name || 'غير محدد',
                        subject: pt.subject || tch?.subject || 'عام',
                        schedule: g.schedule || [],
                        monthlyPrice: pt.monthlyPrice ?? g.privateMonthlyPrice ?? 0,
                    });
                }
            }
        }

        const enrolledClasses = Array.from(enrolledClassesMap.values());

        // Attendance stats
        let presentCount = 0;
        let absentCount = 0;
        let lateCount = 0;
        let excusedCount = 0;
        for (const a of classAttendance) {
            if (a.status === 'PRESENT') presentCount++;
            else if (a.status === 'ABSENT') absentCount++;
            else if (a.status === 'LATE') lateCount++;
            else if (a.status === 'EXCUSED') excusedCount++;
        }
        const totalClassSessions = classAttendance.length;
        const attendedCount = presentCount + lateCount;
        const attendanceRate = totalClassSessions > 0 ? Math.round((attendedCount / totalClassSessions) * 100) : 100;

        const debtSummary = CenterService.computeStudentDebtSummary(enrollment, transactions);

        const financialsObj = {
            ...debtSummary,
            totalExpected: debtSummary.expectedAmount,
            transactions,
            transactionCount: transactions.length,
        };

        return {
            student,
            enrollment,
            enrolledClasses,
            classAttendance,
            checkIns,
            quickCheckIns: checkIns,
            attendanceStats: {
                totalClassSessions,
                presentCount,
                absentCount,
                lateCount,
                excusedCount,
                attendanceRate,
                totalCheckIns: checkIns.length,
            },
            financials: financialsObj,
            financialSummary: financialsObj,
        };
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
        let autoPackageGroups: Types.ObjectId[] = [];
        const isPackageIncluded = data.type === CenterEnrollmentType.PACKAGE || data.type === CenterEnrollmentType.BOTH;
        const isPrivateIncluded = data.type === CenterEnrollmentType.PRIVATE || data.type === CenterEnrollmentType.BOTH;

        if (isPackageIncluded && data.packageId) {
            const pkg = await CenterPackageModel.findOne({ _id: data.packageId, centerId, isActive: true }).lean();
            if (!pkg) throw NotFoundException({ message: 'الباكيدج المحدد غير موجود' });
            const studentDoc = await CenterStudentModel.findById(data.studentId).lean();
            if (studentDoc && pkg.gradeLevel !== studentDoc.gradeLevel) {
                throw BadRequestException({ message: `الباكيدج المحدد (${pkg.gradeLevel}) لا يطابق الصف الدراسي للطالب (${studentDoc.gradeLevel})` });
            }
            packageMonthlyPrice = pkg.monthlyPrice;
            autoPackageGroups = await CenterService.resolvePackageClassGroupIds(centerId, pkg);
        }

        const resolvedPackageGroups = isPackageIncluded
            ? (Array.isArray(data.packageGroups) && data.packageGroups.length > 0
                ? data.packageGroups.map((id: string) => new Types.ObjectId(id))
                : autoPackageGroups)
            : [];

        // ── Private: snapshot price from each class/group (only for PRIVATE or BOTH) ──
        let resolvedPrivateTeachers: any[] = [];
        if (isPrivateIncluded && Array.isArray(data.privateTeachers) && data.privateTeachers.length > 0) {
            resolvedPrivateTeachers = await Promise.all(
                data.privateTeachers.map(async (pt: any) => {
                    if (!pt.groupId) throw NotFoundException({ message: 'يجب تحديد الحصة لكل مادة برايفت' });
                    const group = await CenterGroupModel.findOne({ _id: pt.groupId, centerId }).lean();
                    if (!group) throw NotFoundException({ message: `الحصة ${pt.groupId} غير موجودة` });
                    return {
                        centerTeacherId: pt.centerTeacherId || group.centerTeacherId,
                        groupId: group._id,
                        subject: pt.subject || null,
                        monthlyPrice: group.privateMonthlyPrice ?? 0,
                        sessionsPerWeek: pt.sessionsPerWeek || (group.schedule?.length || 1),
                    };
                })
            );
        }

        const derivedType = data.type === CenterEnrollmentType.PACKAGE ? 'PACKAGE' : (data.type === CenterEnrollmentType.BOTH ? 'BOTH' : 'PRIVATE');

        if (existingEnrollment) {
            existingEnrollment.type = data.type;
            existingEnrollment.packageId = isPackageIncluded && data.packageId ? new Types.ObjectId(data.packageId) : null;
            existingEnrollment.packageMonthlyPrice = isPackageIncluded ? packageMonthlyPrice : null;
            if (data.packageDiscount) existingEnrollment.packageDiscount = data.packageDiscount;
            existingEnrollment.packageGroups = resolvedPackageGroups;
            existingEnrollment.privateTeachers = isPrivateIncluded ? resolvedPrivateTeachers : [];
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
            packageId: isPackageIncluded && data.packageId ? data.packageId : null,
            packageMonthlyPrice: isPackageIncluded ? packageMonthlyPrice : null,
            packageDiscount: data.packageDiscount || { type: null, value: 0 },
            packageGroups: resolvedPackageGroups,
            privateTeachers: isPrivateIncluded ? resolvedPrivateTeachers : [],
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
        const existing = await CenterEnrollmentModel.findOne({ _id: enrollmentId, centerId }).lean();
        if (!existing) throw NotFoundException({ message: 'الاشتراك غير موجود' });

        const targetType = data.type || existing.type;
        const isPackageIncluded = targetType === CenterEnrollmentType.PACKAGE || targetType === CenterEnrollmentType.BOTH;
        const isPrivateIncluded = targetType === CenterEnrollmentType.PRIVATE || targetType === CenterEnrollmentType.BOTH;

        const updatePayload: any = { ...data };

        if (!isPackageIncluded) {
            updatePayload.packageId = null;
            updatePayload.packageMonthlyPrice = null;
            updatePayload.packageGroups = [];
        } else if (data.packageId) {
            const pkg = await CenterPackageModel.findOne({ _id: data.packageId, centerId, isActive: true }).lean();
            if (pkg) {
                updatePayload.packageMonthlyPrice = pkg.monthlyPrice;
                if (!Array.isArray(data.packageGroups) || data.packageGroups.length === 0) {
                    updatePayload.packageGroups = await CenterService.resolvePackageClassGroupIds(centerId, pkg);
                }
            }
        }

        if (!isPrivateIncluded) {
            updatePayload.privateTeachers = [];
        } else if (Array.isArray(data.privateTeachers)) {
            updatePayload.privateTeachers = await Promise.all(
                data.privateTeachers.map(async (pt: any) => {
                    const group = await CenterGroupModel.findOne({ _id: pt.groupId, centerId }).lean();
                    if (!group) throw NotFoundException({ message: `الحصة ${pt.groupId} غير موجودة` });
                    return {
                        centerTeacherId: pt.centerTeacherId || group.centerTeacherId,
                        groupId: group._id,
                        subject: pt.subject || null,
                        monthlyPrice: group.privateMonthlyPrice ?? 0,
                        sessionsPerWeek: pt.sessionsPerWeek || (group.schedule?.length || 1),
                    };
                })
            );
        }

        const enrollment = await CenterEnrollmentModel.findOneAndUpdate(
            { _id: enrollmentId, centerId },
            { $set: updatePayload },
            { new: true }
        )
            .populate('studentId packageId packageGroups privateTeachers.centerTeacherId privateTeachers.groupId')
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

    // ── Helper: Resolve Student by ID, Card, Barcode, Code, or Phone ─────────
    static async resolveCenterStudentByCode(centerId: string, rawInput: string) {
        let rawCode = String(rawInput || '').trim();
        if (!rawCode) throw BadRequestException({ message: 'كود أو باركود أو هاتف الطالب مطلوب' });

        if (rawCode.includes('/card/')) {
            rawCode = rawCode.split('/card/').pop()?.split(/[?#]/)[0]?.trim() || rawCode;
        }

        let student: any = null;
        if (Types.ObjectId.isValid(rawCode)) {
            student = await CenterStudentModel.findOne({ _id: rawCode, centerId }).lean();
        }

        if (!student) {
            const matchedCard = await CardModel.findOne({
                centerId,
                $or: [{ cardNumber: rawCode }, { cardNumber: rawCode.toUpperCase() }, { cardToken: rawCode }],
            }).lean();
            if (matchedCard?.centerStudentId) {
                student = await CenterStudentModel.findOne({ _id: matchedCard.centerStudentId, centerId }).lean();
            }
        }

        if (!student) {
            const escaped = rawCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            student = await CenterStudentModel.findOne({
                centerId,
                $or: [
                    { barcode: rawCode },
                    { barcode: rawCode.toUpperCase() },
                    { studentCode: { $regex: new RegExp(`^${escaped}$`, 'i') } },
                    { studentPhone: rawCode },
                    { parentPhone: rawCode },
                ],
            }).lean();
        }

        if (!student) {
            const escaped = rawCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            student = await StudentModel.findOne({
                centerId,
                $or: [
                    { barcode: rawCode },
                    { studentCode: { $regex: new RegExp(`^${escaped}$`, 'i') } },
                    { phone: rawCode },
                ],
            }).lean();
        }

        if (!student) {
            throw NotFoundException({ message: `لم يتم العثور على طالب بالكود أو الباركود: "${rawCode}"` });
        }

        return student;
    }

    // ── Helper: Normalize Arabic Day Name ────────────────────────────────────
    static normalizeArabicDay(day?: string | null): string {
        if (!day) return '';
        return day
            .trim()
            .replace(/[إأآ]/g, 'ا')
            .replace(/ة/g, 'ه');
    }

    static getCairoArabicDay(dateInput?: string | Date): string {
        const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const d = dateInput ? new Date(dateInput) : new Date();
        const dayIndex = new Date(d.toLocaleString('en-US', { timeZone: 'Africa/Cairo' })).getDay();
        return ARABIC_DAYS[dayIndex] || 'السبت';
    }

    // ── Helper: Get Enrolled Students for a Specific Class (Group) ───────────
    static async getEnrolledStudentsForClass(centerId: string, group: any) {
        const centerObjId = new Types.ObjectId(centerId);
        const groupObjId = new Types.ObjectId(String(group._id));

        // 1. Find enrollments explicitly referencing this groupId:
        //    - PACKAGE / BOTH students with groupObjId in packageGroups
        //    - PRIVATE / BOTH students with groupObjId in privateTeachers.groupId
        //    - Plus legacy PACKAGE / BOTH students of the same gradeLevel if group is PACKAGE/MIXED and packageGroups was empty
        const orConditions: any[] = [
            {
                type: { $in: [CenterEnrollmentType.PACKAGE, CenterEnrollmentType.BOTH] },
                packageGroups: groupObjId,
            },
            {
                type: { $in: [CenterEnrollmentType.PRIVATE, CenterEnrollmentType.BOTH] },
                'privateTeachers.groupId': groupObjId,
            },
        ];

        if (group.groupType === CenterGroupType.PACKAGE || group.groupType === CenterGroupType.MIXED) {
            orConditions.push({
                type: { $in: [CenterEnrollmentType.PACKAGE, CenterEnrollmentType.BOTH] },
                $or: [{ packageGroups: { $exists: false } }, { packageGroups: { $size: 0 } }],
            });
        }

        const enrollments = await CenterEnrollmentModel.find({
            centerId: centerObjId,
            isActive: true,
            $or: orConditions,
        })
            .populate('packageId', 'name gradeLevel monthlyPrice')
            .populate('privateTeachers.groupId', 'name privateMonthlyPrice')
            .lean();

        const enrollmentMap = new Map<string, any>();
        const explicitStudentIds: Types.ObjectId[] = [];
        const fallbackStudentIds: Types.ObjectId[] = [];

        for (const e of enrollments) {
            const sid = String(e.studentId);
            enrollmentMap.set(sid, e);
            const hasExplicitPkgGroup = (e.packageGroups || []).some((gid: any) => String(gid) === String(groupObjId));
            const hasExplicitPrivGroup = (e.privateTeachers || []).some((pt: any) => String(pt.groupId?._id || pt.groupId) === String(groupObjId));

            if (hasExplicitPkgGroup || hasExplicitPrivGroup) {
                explicitStudentIds.push(new Types.ObjectId(sid));
            } else {
                fallbackStudentIds.push(new Types.ObjectId(sid));
            }
        }

        const studentOr: any[] = [];
        if (explicitStudentIds.length > 0) {
            studentOr.push({ _id: { $in: explicitStudentIds } });
        }
        if (fallbackStudentIds.length > 0) {
            studentOr.push({ _id: { $in: fallbackStudentIds }, gradeLevel: group.gradeLevel });
        }
        // Also include students with studentType === 'PACKAGE' in same gradeLevel if group is PACKAGE and they don't have an enrollment doc yet
        if (group.groupType === CenterGroupType.PACKAGE || group.groupType === CenterGroupType.MIXED) {
            studentOr.push({
                gradeLevel: group.gradeLevel,
                studentType: 'PACKAGE',
            });
        }

        if (studentOr.length === 0) {
            return { students: [], enrollmentMap };
        }

        const students = await CenterStudentModel.find({
            centerId: centerObjId,
            isActive: true,
            $or: studentOr,
        })
            .sort({ studentName: 1 })
            .lean();

        // Filter out any student whose explicit enrollment is PRIVATE and does NOT include this group
        const validStudents = students.filter((st) => {
            const enr = enrollmentMap.get(String(st._id));
            if (enr) {
                if (enr.type === CenterEnrollmentType.PRIVATE) {
                    return (enr.privateTeachers || []).some(
                        (pt: any) => String(pt.groupId?._id || pt.groupId) === String(groupObjId)
                    );
                }
                return true;
            }
            // If no enrollment doc, only include if studentType === 'PACKAGE' and group is PACKAGE/MIXED
            return st.studentType === 'PACKAGE' && (group.groupType === CenterGroupType.PACKAGE || group.groupType === CenterGroupType.MIXED);
        });

        return { students: validStudents, enrollmentMap };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 7A. Center Scheduled Classes / Sessions (حصص اليوم والتحضير بالسناب شوت)
    // ══════════════════════════════════════════════════════════════════════════

    static async getTodayCenterSessions(centerId: string, query: any = {}) {
        const centerObjId = new Types.ObjectId(centerId);
        const dateStr = query.date || new Date().toISOString().split('T')[0];
        const sessionDate = new Date(dateStr);
        sessionDate.setUTCHours(0, 0, 0, 0);

        const arabicDay = CenterService.getCairoArabicDay(dateStr);
        const normalizedTargetDay = CenterService.normalizeArabicDay(arabicDay);

        // Fetch active groups (classes) in this center
        const groupFilter: any = { centerId: centerObjId, isActive: true };
        if (query.gradeLevel && query.gradeLevel !== 'ALL') {
            groupFilter.gradeLevel = query.gradeLevel;
        } else if (query.stage && query.stage !== 'ALL') {
            if (query.stage === 'SECONDARY') {
                groupFilter.gradeLevel = { $in: [GradeLevel.SEC_1, GradeLevel.SEC_2, GradeLevel.SEC_3] };
            } else if (query.stage === 'PREPARATORY') {
                groupFilter.gradeLevel = { $in: [GradeLevel.PREP_1, GradeLevel.PREP_2, GradeLevel.PREP_3] };
            } else if (query.stage === 'PRIMARY') {
                groupFilter.gradeLevel = {
                    $in: [
                        GradeLevel.PRIM_1,
                        GradeLevel.PRIM_2,
                        GradeLevel.PRIM_3,
                        GradeLevel.PRIM_4,
                        GradeLevel.PRIM_5,
                        GradeLevel.PRIM_6,
                    ],
                };
            }
        }

        const [groups, existingSessions] = await Promise.all([
            CenterGroupModel.find(groupFilter)
                .populate('centerTeacherId', 'name subject')
                .sort({ gradeLevel: 1, name: 1 })
                .lean(),
            CenterSessionModel.find({
                centerId: centerObjId,
                sessionDate,
            }).lean(),
        ]);

        const existingByGroupId = new Map<string, any>();
        for (const s of existingSessions) {
            existingByGroupId.set(String(s.groupId), s);
        }

        // Auto-create SCHEDULED sessions for groups scheduled on arabicDay (or if query.includeAllClasses === 'true')
        const includeAll = query.includeAllClasses === 'true' || query.includeAllClasses === true;
        for (const group of groups) {
            const gidStr = String(group._id);
            if (existingByGroupId.has(gidStr)) continue;

            const matchingSlot = (group.schedule || []).find(
                (slot: any) => CenterService.normalizeArabicDay(slot.day) === normalizedTargetDay
            );

            if (matchingSlot || includeAll) {
                const slot = matchingSlot || (group.schedule && group.schedule[0]) || { day: arabicDay, time: '04:00 م' };
                const tch = group.centerTeacherId as any;
                const teacherObjId = tch?._id || group.centerTeacherId;

                const upserted = await CenterSessionModel.findOneAndUpdate(
                    {
                        centerId: centerObjId,
                        groupId: group._id,
                        sessionDate,
                    },
                    {
                        $setOnInsert: {
                            centerId: centerObjId,
                            groupId: group._id,
                            centerTeacherId: teacherObjId,
                            gradeLevel: group.gradeLevel,
                            subject: tch?.subject || group.name,
                            sessionDate,
                            scheduledDay: slot.day || arabicDay,
                            scheduledTime: slot.time || '04:00 م',
                            status: 'SCHEDULED',
                            presentStudents: [],
                            absentStudents: [],
                            totalEnrolled: 0,
                            presentCount: 0,
                            absentCount: 0,
                        },
                    },
                    { upsert: true, new: true }
                ).lean();

                existingByGroupId.set(gidStr, upserted);
            }
        }

        // Now enrich all sessions for groups in groupFilter
        const targetGroupIds = groups.map((g) => g._id);
        const sessions = await CenterSessionModel.find({
            centerId: centerObjId,
            sessionDate,
            groupId: { $in: targetGroupIds },
        })
            .populate({
                path: 'groupId',
                select: 'name gradeLevel groupType schedule capacity privateMonthlyPrice centerTeacherId',
                populate: { path: 'centerTeacherId', select: 'name subject' },
            })
            .populate('centerTeacherId', 'name subject')
            .sort({ gradeLevel: 1, scheduledTime: 1 })
            .lean();

        // Live attendance counts for non-completed sessions
        const attendanceAgg = await CenterAttendanceModel.aggregate([
            {
                $match: {
                    centerId: centerObjId,
                    date: sessionDate,
                    groupId: { $in: targetGroupIds },
                },
            },
            {
                $group: {
                    _id: { groupId: '$groupId', status: '$status' },
                    count: { $sum: 1 },
                },
            },
        ]);

        const liveCountsMap = new Map<string, { present: number; absent: number }>();
        for (const item of attendanceAgg) {
            const gid = String(item._id.groupId);
            const current = liveCountsMap.get(gid) || { present: 0, absent: 0 };
            if (item._id.status === 'PRESENT' || item._id.status === 'LATE') {
                current.present += item.count;
            } else if (item._id.status === 'ABSENT') {
                current.absent += item.count;
            }
            liveCountsMap.set(gid, current);
        }

        const enrichedSessions = await Promise.all(
            sessions.map(async (session: any) => {
                const group = session.groupId;
                const gid = String(group?._id || session.groupId);
                const live = liveCountsMap.get(gid) || { present: 0, absent: 0 };

                let totalEnrolled = session.totalEnrolled || 0;
                if (session.status !== 'COMPLETED' && group) {
                    const { students } = await CenterService.getEnrolledStudentsForClass(centerId, group);
                    totalEnrolled = students.length;
                }

                const presentVal = session.status === 'COMPLETED' ? session.presentCount : live.present;
                const absentVal = session.status === 'COMPLETED' ? session.absentCount : live.absent;
                const matchingSlot = (group?.schedule || []).find(
                    (slot: any) => CenterService.normalizeArabicDay(slot.day) === normalizedTargetDay
                );

                return {
                    ...session,
                    sessionStatus: session.status,
                    subject: session.subject || (session.centerTeacherId as any)?.subject || (group?.centerTeacherId as any)?.subject || group?.name || '',
                    scheduledTime: session.scheduledTime || matchingSlot?.time || group?.schedule?.[0]?.time || '',
                    group: group || null,
                    teacher: session.centerTeacherId || group?.centerTeacherId || null,
                    session,
                    scheduledSlots: matchingSlot ? [matchingSlot] : group?.schedule || [],
                    isScheduledToday: Boolean(matchingSlot),
                    enrolledCount: totalEnrolled,
                    totalEnrolled,
                    presentCount: presentVal,
                    absentCount: absentVal,
                    lateCount: 0,
                    excusedCount: 0,
                };
            })
        );

        return {
            date: dateStr,
            arabicDay,
            sessions: enrichedSessions,
            classes: enrichedSessions,
            totalSessions: enrichedSessions.length,
        };
    }

    static async resolveCenterSessionDoc(centerId: string, sessionIdOrGroupId: string, dateStr?: string) {
        const centerObjId = new Types.ObjectId(centerId);
        let session = await CenterSessionModel.findOne({
            _id: sessionIdOrGroupId,
            centerId: centerObjId,
        })
            .populate({
                path: 'groupId',
                select: 'name gradeLevel groupType schedule capacity privateMonthlyPrice centerTeacherId',
                populate: { path: 'centerTeacherId', select: 'name subject' },
            })
            .populate('centerTeacherId', 'name subject')
            .populate('completedBy', 'name');

        if (!session) {
            // Treat sessionIdOrGroupId as a groupId and find or create session for dateStr
            const group = await CenterGroupModel.findOne({
                _id: sessionIdOrGroupId,
                centerId: centerObjId,
            })
                .populate('centerTeacherId', 'name subject')
                .lean();

            if (!group) throw NotFoundException({ message: 'الحصة غير موجودة' });

            const targetDateStr: string = dateStr || new Date().toISOString().split('T')[0] || '';
            const sessionDate = new Date(targetDateStr);
            sessionDate.setUTCHours(0, 0, 0, 0);
            const arabicDay = CenterService.getCairoArabicDay(targetDateStr);
            const normalizedTargetDay = CenterService.normalizeArabicDay(arabicDay);
            const matchingSlot =
                (group.schedule || []).find(
                    (slot: any) => CenterService.normalizeArabicDay(slot.day) === normalizedTargetDay
                ) || (group.schedule && group.schedule[0]) || { day: arabicDay, time: '04:00 م' };
            const tch = group.centerTeacherId as any;

            session = await CenterSessionModel.findOneAndUpdate(
                {
                    centerId: centerObjId,
                    groupId: group._id,
                    sessionDate,
                },
                {
                    $setOnInsert: {
                        centerId: centerObjId,
                        groupId: group._id,
                        centerTeacherId: tch?._id || group.centerTeacherId,
                        gradeLevel: group.gradeLevel,
                        subject: tch?.subject || group.name,
                        sessionDate,
                        scheduledDay: matchingSlot.day || arabicDay,
                        scheduledTime: matchingSlot.time || '04:00 م',
                        status: 'SCHEDULED',
                        presentStudents: [],
                        absentStudents: [],
                        totalEnrolled: 0,
                        presentCount: 0,
                        absentCount: 0,
                    },
                },
                { upsert: true, new: true }
            )
                .populate({
                    path: 'groupId',
                    select: 'name gradeLevel groupType schedule capacity privateMonthlyPrice centerTeacherId',
                    populate: { path: 'centerTeacherId', select: 'name subject' },
                })
                .populate('centerTeacherId', 'name subject')
                .populate('completedBy', 'name');
        }

        return session;
    }

    static async getCenterSessionById(centerId: string, sessionId: string, dateStr?: string) {
        const centerObjId = new Types.ObjectId(centerId);
        const sessionDoc = await CenterService.resolveCenterSessionDoc(centerId, sessionId, dateStr);
        if (!sessionDoc) throw NotFoundException({ message: 'الحصة غير موجودة' });
        const session = sessionDoc.toObject();

        const group = session.groupId as any;
        if (!group) throw NotFoundException({ message: 'بيانات الحصة غير مكتملة' });

        const { students: enrolledStudents, enrollmentMap } = await CenterService.getEnrolledStudentsForClass(centerId, group);

        // Also include any student who already has an attendance record in this session (e.g. make-up student)
        const attendanceRecords = await CenterAttendanceModel.find({
            centerId: centerObjId,
            groupId: group._id,
            date: session.sessionDate,
        }).lean();

        const attendanceByStudentId = new Map<string, any>();
        const extraStudentIds: Types.ObjectId[] = [];
        const enrolledSet = new Set(enrolledStudents.map((s: any) => String(s._id)));

        for (const rec of attendanceRecords) {
            const sid = String(rec.studentId);
            attendanceByStudentId.set(sid, rec);
            if (!enrolledSet.has(sid)) {
                extraStudentIds.push(new Types.ObjectId(sid));
            }
        }

        let allStudents = [...enrolledStudents];
        if (extraStudentIds.length > 0) {
            const extraDocs = await CenterStudentModel.find({ _id: { $in: extraStudentIds }, centerId: centerObjId }).lean();
            allStudents.push(...extraDocs);
        }

        const allStudentIds = allStudents.map((s: any) => s._id);
        const allTransactions = await TransactionModel.find({
            centerId: centerObjId,
            studentId: { $in: allStudentIds },
        }).lean();

        const txByStudentId = new Map<string, any[]>();
        for (const tx of allTransactions) {
            if (!tx.studentId) continue;
            const sid = String(tx.studentId);
            const arr = txByStudentId.get(sid) || [];
            arr.push(tx);
            txByStudentId.set(sid, arr);
        }

        // Ensure enrollmentMap has enrollments for extra students too
        if (extraStudentIds.length > 0) {
            const extraEnrollments = await CenterEnrollmentModel.find({
                centerId: centerObjId,
                studentId: { $in: extraStudentIds },
                isActive: true,
            })
                .populate('packageId', 'name gradeLevel monthlyPrice')
                .populate('privateTeachers.groupId', 'name privateMonthlyPrice')
                .lean();
            for (const e of extraEnrollments) {
                enrollmentMap.set(String(e.studentId), e);
            }
        }

        let presentCount = 0;
        let absentCount = 0;
        let lateCount = 0;
        let pendingCount = 0;
        let debtCount = 0;

        const studentsWithStatus = allStudents.map((st: any) => {
            const sid = String(st._id);
            const att = attendanceByStudentId.get(sid);
            const enr = enrollmentMap.get(sid);
            const txs = txByStudentId.get(sid) || [];
            const financialStatus = CenterService.computeStudentDebtSummary(enr, txs);

            if (financialStatus.hasDebt) debtCount++;

            const status = att?.status || (session.status === 'COMPLETED' ? 'ABSENT' : 'PENDING');
            if (status === 'PRESENT') presentCount++;
            else if (status === 'LATE') {
                presentCount++;
                lateCount++;
            } else if (status === 'ABSENT') absentCount++;
            else pendingCount++;

            const enrollmentType = enr?.type || st.studentType || 'PACKAGE';
            const packageName = (enr?.packageId as any)?.name || null;

            return {
                _id: st._id,
                studentName: st.studentName,
                studentCode: st.studentCode,
                studentPhone: st.studentPhone,
                parentPhone: st.parentPhone,
                gradeLevel: st.gradeLevel,
                barcode: st.barcode,
                studentType: enrollmentType,
                enrollmentType,
                packageName,
                attendanceStatus: status,
                status: status === 'PENDING' ? null : status,
                scannedAt: att?.scannedAt || null,
                source: att?.source || null,
                notes: att?.notes || '',
                financialStatus,
            };
        });

        return {
            session: {
                ...session,
                totalEnrolled: allStudents.length,
                presentCount,
                absentCount,
            },
            group,
            teacher: (session.centerTeacherId as any) || (group.centerTeacherId as any) || null,
            students: studentsWithStatus,
            stats: {
                totalEnrolled: allStudents.length,
                presentCount,
                absentCount,
                lateCount,
                pendingCount,
                debtCount,
            },
        };
    }

    static async recordCenterSessionAttendance(
        centerId: string,
        sessionId: string,
        recordedBy: string,
        data: { studentIdOrCode: string; status?: string; source?: string; notes?: string | null; date?: string }
    ) {
        const centerObjId = new Types.ObjectId(centerId);
        const session = await CenterService.resolveCenterSessionDoc(centerId, sessionId, data.date);

        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });

        const group = session.groupId as any;
        if (!group) throw NotFoundException({ message: 'بيانات الحصة غير مكتملة' });

        // Resolve student by ID, Card, Barcode, Code, or Phone
        const student = await CenterService.resolveCenterStudentByCode(centerId, data.studentIdOrCode);

        // Check enrollment to verify if Private student is enrolled in this class
        const enrollment = await CenterEnrollmentModel.findOne({
            centerId: centerObjId,
            studentId: student._id,
            isActive: true,
        })
            .populate('packageId', 'name gradeLevel monthlyPrice')
            .populate('privateTeachers.groupId', 'name privateMonthlyPrice')
            .lean();

        if (enrollment && enrollment.type === CenterEnrollmentType.PRIVATE) {
            const isEnrolledInThisClass = (enrollment.privateTeachers || []).some(
                (pt: any) => String(pt.groupId?._id || pt.groupId) === String(group._id)
            );
            if (!isEnrolledInThisClass) {
                throw BadRequestException({
                    message: `الطالب "${student.studentName}" (برايفت) غير مسجل في هذه الحصة (${group.name})`,
                });
            }
        } else if (enrollment && (enrollment.type === CenterEnrollmentType.PACKAGE || enrollment.type === CenterEnrollmentType.BOTH)) {
            const hasPkgGroup = (enrollment.packageGroups || []).some((gid: any) => String(gid) === String(group._id));
            const hasPrivGroup = (enrollment.privateTeachers || []).some(
                (pt: any) => String(pt.groupId?._id || pt.groupId) === String(group._id)
            );
            if (!hasPkgGroup && !hasPrivGroup && student.gradeLevel !== group.gradeLevel) {
                throw BadRequestException({
                    message: `الطالب "${student.studentName}" (${student.gradeLevel}) غير مسجل في صف هذه الحصة (${group.gradeLevel})`,
                });
            }
        }

        const newStatus = (data.status || AttendanceStatus.PRESENT) as AttendanceStatus;

        // Check previous status before update
        const previousAttendance = await CenterAttendanceModel.findOne({
            centerId: centerObjId,
            groupId: group._id,
            studentId: student._id,
            date: session.sessionDate,
        }).lean();

        const updatedAttendance = await CenterAttendanceModel.findOneAndUpdate(
            {
                centerId: centerObjId,
                groupId: group._id,
                studentId: student._id,
                date: session.sessionDate,
            },
            {
                $set: {
                    centerId: centerObjId,
                    groupId: group._id,
                    studentId: student._id,
                    date: session.sessionDate,
                    status: newStatus,
                    source: data.source || 'MANUAL',
                    notes: data.notes || '',
                    scannedAt: new Date(),
                    recordedBy: new Types.ObjectId(recordedBy),
                },
            },
            { upsert: true, new: true }
        ).lean();

        // Also sync with CenterCheckInModel if marked PRESENT or LATE
        if (newStatus === AttendanceStatus.PRESENT || newStatus === AttendanceStatus.LATE) {
            await CenterCheckInModel.findOneAndUpdate(
                {
                    centerId: centerObjId,
                    studentId: student._id,
                    date: session.sessionDate,
                },
                {
                    $setOnInsert: {
                        checkInTime: new Date(),
                        source: data.source === 'QR_SCAN' ? 'QR_SCAN' : 'MANUAL',
                        recordedBy: new Types.ObjectId(recordedBy),
                    },
                    $addToSet: {
                        attendedGroups: group._id,
                    },
                },
                { upsert: true }
            );
        }

        const wasCompleted = session.status === 'COMPLETED';
        if (session.status === 'SCHEDULED') {
            session.status = 'IN_PROGRESS';
            await session.save();
        } else if (wasCompleted) {
            // Rebuild session snapshot and send correction notification if status changed
            const allAtt = await CenterAttendanceModel.find({
                centerId: centerObjId,
                groupId: group._id,
                date: session.sessionDate,
            })
                .populate('studentId', 'studentName studentCode studentPhone parentPhone')
                .lean();

            const presentSnap: any[] = [];
            const absentSnap: any[] = [];
            for (const rec of allAtt) {
                const st = rec.studentId as any;
                if (!st) continue;
                const snapItem = {
                    studentId: st._id,
                    studentName: st.studentName,
                    studentCode: st.studentCode,
                    studentPhone: st.studentPhone || null,
                    parentPhone: st.parentPhone || null,
                    status: rec.status,
                    scannedAt: rec.scannedAt || null,
                };
                if (rec.status === 'PRESENT' || rec.status === 'LATE' || rec.status === 'EXCUSED') {
                    presentSnap.push(snapItem);
                } else {
                    absentSnap.push(snapItem);
                }
            }

            session.presentStudents = presentSnap;
            session.absentStudents = absentSnap;
            session.presentCount = presentSnap.length;
            session.absentCount = absentSnap.length;
            session.totalEnrolled = presentSnap.length + absentSnap.length;
            await session.save();

            // Send [تصحيح] notification to parent app if status changed after session completion
            if (!previousAttendance || previousAttendance.status !== newStatus) {
                const centerDoc = await CenterModel.findById(centerId).select('name').lean();
                const tch = (session.centerTeacherId as any) || (group.centerTeacherId as any);
                ParentPushService.notifyCenterAttendanceCorrection({
                    sessionId: String(session._id),
                    centerId,
                    centerName: centerDoc?.name || 'السنتر',
                    studentId: String(student._id),
                    studentName: student.studentName,
                    groupName: group.name,
                    subject: session.subject || tch?.subject || group.name,
                    teacherName: tch?.name || '',
                    sessionDate: session.sessionDate,
                    oldStatus: previousAttendance?.status || 'ABSENT',
                    newStatus: newStatus === AttendanceStatus.ABSENT ? 'ABSENT' : 'PRESENT',
                });
            }
        }

        // Compute student's financial debt status for immediate UI feedback on scan
        const transactions = await TransactionModel.find({
            centerId: centerObjId,
            studentId: student._id,
        }).lean();

        const financialStatus = CenterService.computeStudentDebtSummary(enrollment, transactions);

        return {
            attendance: updatedAttendance,
            student: {
                _id: student._id,
                studentName: student.studentName,
                studentCode: student.studentCode,
                studentPhone: student.studentPhone,
                parentPhone: student.parentPhone,
                gradeLevel: student.gradeLevel,
                barcode: student.barcode,
                studentType: enrollment?.type || student.studentType || 'PACKAGE',
            },
            financialStatus,
            sessionStatus: session.status,
            isCorrection: wasCompleted,
            isPostCompletionEdit: wasCompleted,
        };
    }

    static async completeCenterSession(centerId: string, sessionId: string, completedBy: string, dateStr?: string) {
        const centerObjId = new Types.ObjectId(centerId);
        const session = await CenterService.resolveCenterSessionDoc(centerId, sessionId, dateStr);

        if (!session) throw NotFoundException({ message: 'الحصة غير موجودة' });

        const group = session.groupId as any;
        if (!group) throw NotFoundException({ message: 'بيانات الحصة غير مكتملة' });

        const { students: enrolledStudents } = await CenterService.getEnrolledStudentsForClass(centerId, group);

        const existingAttendance = await CenterAttendanceModel.find({
            centerId: centerObjId,
            groupId: group._id,
            date: session.sessionDate,
        }).lean();

        const attMap = new Map<string, any>();
        for (const rec of existingAttendance) {
            attMap.set(String(rec.studentId), rec);
        }

        // Mark all enrolled students without an attendance record as ABSENT
        const bulkAbsentOps: any[] = [];
        for (const st of enrolledStudents) {
            const sid = String(st._id);
            if (!attMap.has(sid)) {
                bulkAbsentOps.push({
                    updateOne: {
                        filter: {
                            centerId: centerObjId,
                            groupId: group._id,
                            studentId: st._id,
                            date: session.sessionDate,
                        },
                        update: {
                            $set: {
                                centerId: centerObjId,
                                groupId: group._id,
                                studentId: st._id,
                                date: session.sessionDate,
                                status: AttendanceStatus.ABSENT,
                                source: 'MANUAL',
                                notes: 'غياب تلقائي عند إنهاء الحصة',
                                scannedAt: new Date(),
                                recordedBy: new Types.ObjectId(completedBy),
                            },
                        },
                        upsert: true,
                    },
                });
            }
        }

        if (bulkAbsentOps.length > 0) {
            await CenterAttendanceModel.bulkWrite(bulkAbsentOps);
        }

        // Fetch final attendance records to build snapshot
        const finalAttendance = await CenterAttendanceModel.find({
            centerId: centerObjId,
            groupId: group._id,
            date: session.sessionDate,
        })
            .populate('studentId', 'studentName studentCode studentPhone parentPhone')
            .lean();

        const presentStudents: any[] = [];
        const absentStudents: any[] = [];

        for (const rec of finalAttendance) {
            const st = rec.studentId as any;
            if (!st) continue;
            const snap = {
                studentId: st._id,
                studentName: st.studentName,
                studentCode: st.studentCode,
                studentPhone: st.studentPhone || null,
                parentPhone: st.parentPhone || null,
                status: rec.status,
                scannedAt: rec.scannedAt || null,
            };
            if (rec.status === 'PRESENT' || rec.status === 'LATE' || rec.status === 'EXCUSED') {
                presentStudents.push(snap);
            } else {
                absentStudents.push(snap);
            }
        }

        session.status = 'COMPLETED';
        session.completedAt = new Date();
        session.completedBy = new Types.ObjectId(completedBy);
        session.presentStudents = presentStudents;
        session.absentStudents = absentStudents;
        session.presentCount = presentStudents.length;
        session.absentCount = absentStudents.length;
        session.totalEnrolled = presentStudents.length + absentStudents.length;
        session.notificationsSentAt = new Date();
        await session.save();

        // Dispatch batch parent app notifications for both present and absent students
        const centerDoc = await CenterModel.findById(centerId).select('name').lean();
        const tch = (session.centerTeacherId as any) || (group.centerTeacherId as any);

        ParentPushService.notifyCenterSessionAttendanceBatch({
            sessionId: String(session._id),
            centerId,
            centerName: centerDoc?.name || 'السنتر',
            groupName: group.name,
            subject: session.subject || tch?.subject || group.name,
            teacherName: tch?.name || '',
            sessionDate: session.sessionDate,
            startTime: session.scheduledTime || '',
            items: [...presentStudents, ...absentStudents].map((s) => ({
                studentId: String(s.studentId),
                studentName: s.studentName,
                status: s.status,
                scannedAt: s.scannedAt,
            })),
        });

        return {
            session: session.toObject(),
            stats: {
                totalEnrolled: session.totalEnrolled,
                presentCount: session.presentCount,
                absentCount: session.absentCount,
            },
            notifications: {
                sentCount: presentStudents.length + absentStudents.length,
            },
        };
    }

    // ── Gate / Reception Daily Check-In ──────────────────────────────────────

    static async checkInStudent(centerId: string, recordedBy: string, data: any) {
        const student = await CenterService.resolveCenterStudentByCode(centerId, data.studentIdOrCode);

        // 2. Normalize date to start of day UTC
        const checkDate = data.date ? new Date(data.date) : new Date();
        checkDate.setUTCHours(0, 0, 0, 0);

        // 3. Determine today's day name in Arabic (Cairo timezone)
        const todayArabicDay = CenterService.getCairoArabicDay(data.date);
        const normalizedToday = CenterService.normalizeArabicDay(todayArabicDay);

        // 4. Find active enrollment in this center
        const enrollment = await CenterEnrollmentModel.findOne({
            centerId,
            studentId: student._id,
            isActive: true,
        })
            .populate('packageId', 'name gradeLevel monthlyPrice')
            .populate('privateTeachers.groupId', 'name privateMonthlyPrice')
            .lean();

        // 5. Gather enrolled group IDs (strictly respecting PACKAGE vs PRIVATE)
        const candidateGroupIds: Types.ObjectId[] = [];
        if (enrollment) {
            if ((enrollment.type === 'PACKAGE' || enrollment.type === 'BOTH') && enrollment.packageGroups && enrollment.packageGroups.length > 0) {
                candidateGroupIds.push(...enrollment.packageGroups);
            }
            if ((enrollment.type === 'PRIVATE' || enrollment.type === 'BOTH') && enrollment.privateTeachers && enrollment.privateTeachers.length > 0) {
                for (const pt of enrollment.privateTeachers) {
                    const gid = (pt.groupId as any)?._id || pt.groupId;
                    if (gid) candidateGroupIds.push(new Types.ObjectId(String(gid)));
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
            const scheduleEntry = group.schedule?.find(
                (s: any) => CenterService.normalizeArabicDay(s.day) === normalizedToday
            );
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

        // 12. True Financial calculation (considering enrollment net price & transactions)
        const transactions = await TransactionModel.find({
            centerId: new Types.ObjectId(centerId),
            studentId: student._id,
        }).lean();

        const financialStatus = CenterService.computeStudentDebtSummary(enrollment, transactions);

        let packageName: string | null = null;
        if (enrollment?.packageId) {
            packageName = (enrollment.packageId as any)?.name || null;
        }

        const privateTeachersSummary: string[] = [];
        if (enrollment?.privateTeachers && enrollment.privateTeachers.length > 0) {
            for (const pt of enrollment.privateTeachers) {
                const gidStr = String((pt.groupId as any)?._id || pt.groupId);
                const tch = allEnrolledGroups.find((g) => g._id.toString() === gidStr)?.centerTeacherId
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
            financialStatus,
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
        const centerObjId = new Types.ObjectId(centerId);
        const checkDate = query.date ? new Date(query.date) : new Date();
        checkDate.setUTCHours(0, 0, 0, 0);

        const filter: any = {
            centerId: centerObjId,
            date: checkDate,
        };

        const checkIns = await CenterCheckInModel.find(filter)
            .populate('studentId', 'studentName studentCode studentPhone parentPhone gradeLevel barcode studentType')
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

        // Enrich with active enrollment details and true debt status for each student
        const studentIds = filtered.map((ci: any) => ci.studentId?._id).filter(Boolean);
        const [enrollments, transactions] = await Promise.all([
            CenterEnrollmentModel.find({
                centerId: centerObjId,
                studentId: { $in: studentIds },
                isActive: true,
            })
                .populate('packageId', 'name monthlyPrice')
                .populate('privateTeachers.centerTeacherId', 'name subject')
                .populate('privateTeachers.groupId', 'name privateMonthlyPrice')
                .populate('packageGroups', 'name')
                .lean(),
            TransactionModel.find({
                centerId: centerObjId,
                studentId: { $in: studentIds },
            }).lean(),
        ]);

        const enrollmentMap = new Map<string, any>();
        for (const e of enrollments) {
            enrollmentMap.set(e.studentId.toString(), e);
        }

        const txMap = new Map<string, any[]>();
        for (const t of transactions) {
            if (!t.studentId) continue;
            const sid = t.studentId.toString();
            const list = txMap.get(sid) || [];
            list.push(t);
            txMap.set(sid, list);
        }

        const enrichedCheckIns = filtered.map((ci: any) => {
            const sid = ci.studentId?._id?.toString();
            const enr = sid ? enrollmentMap.get(sid) || null : null;
            const txs = sid ? txMap.get(sid) || [] : [];
            const debtSummary = CenterService.computeStudentDebtSummary(enr, txs);
            return {
                ...ci,
                enrollment: enr,
                totalRemainingDebt: debtSummary.totalRemainingDebt,
                financialStatus: debtSummary,
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

    static async notifyQuickCheckInAbsentees(
        centerId: string,
        data: { date?: string; stage?: string; gradeLevel?: string; studentIds?: string[] }
    ) {
        const centerObjId = new Types.ObjectId(centerId);
        const checkDate = data.date ? new Date(data.date) : new Date();
        checkDate.setUTCHours(0, 0, 0, 0);

        const studentFilter: any = {
            centerId: centerObjId,
            isActive: true,
        };

        if (Array.isArray(data.studentIds) && data.studentIds.length > 0) {
            studentFilter._id = { $in: data.studentIds.map((id) => new Types.ObjectId(id)) };
        } else if (data.gradeLevel && data.gradeLevel !== 'ALL') {
            studentFilter.gradeLevel = data.gradeLevel;
        } else if (data.stage && data.stage !== 'ALL') {
            if (data.stage === 'SECONDARY') {
                studentFilter.gradeLevel = { $in: [GradeLevel.SEC_1, GradeLevel.SEC_2, GradeLevel.SEC_3] };
            } else if (data.stage === 'PREPARATORY') {
                studentFilter.gradeLevel = { $in: [GradeLevel.PREP_1, GradeLevel.PREP_2, GradeLevel.PREP_3] };
            } else if (data.stage === 'PRIMARY') {
                studentFilter.gradeLevel = {
                    $in: [
                        GradeLevel.PRIM_1,
                        GradeLevel.PRIM_2,
                        GradeLevel.PRIM_3,
                        GradeLevel.PRIM_4,
                        GradeLevel.PRIM_5,
                        GradeLevel.PRIM_6,
                    ],
                };
            }
        }

        const [allTargetStudents, checkInsToday, centerDoc] = await Promise.all([
            CenterStudentModel.find(studentFilter).select('_id studentName gradeLevel').lean(),
            CenterCheckInModel.find({
                centerId: centerObjId,
                date: checkDate,
            })
                .select('studentId')
                .lean(),
            CenterModel.findById(centerId).select('name').lean(),
        ]);

        const checkedInIds = new Set(checkInsToday.map((c) => String(c.studentId)));
        const absentStudents = allTargetStudents
            .filter((s) => !checkedInIds.has(String(s._id)))
            .map((s) => ({
                studentId: String(s._id),
                studentName: s.studentName,
            }));

        if (absentStudents.length === 0) {
            return {
                absentCount: 0,
                notifiedStudentsCount: 0,
                pushSentCount: 0,
            };
        }

        const pushResult = await ParentPushService.sendCenterCheckInAbsentees({
            centerId,
            centerName: centerDoc?.name || 'السنتر',
            date: checkDate,
            students: absentStudents,
        });

        return {
            absentCount: absentStudents.length,
            notifiedStudentsCount: pushResult.notifiedStudentsCount,
            pushSentCount: pushResult.pushCount,
            sent: pushResult.notifiedStudentsCount,
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

    static async updateTransaction(centerId: string, transactionId: string, data: any) {
        const centerObjId = new Types.ObjectId(centerId);
        const existing = await TransactionModel.findOne({ _id: transactionId, centerId: centerObjId });
        if (!existing) throw NotFoundException({ message: 'المعاملة المالية غير موجودة بالسنتر' });

        if (data.category !== undefined) existing.category = data.category;
        if (data.centerTeacherId !== undefined) {
            existing.centerTeacherId = data.centerTeacherId ? new Types.ObjectId(data.centerTeacherId) : null;
        }
        if (data.originalAmount !== undefined) existing.originalAmount = Number(data.originalAmount);
        if (data.discountAmount !== undefined) existing.discountAmount = Number(data.discountAmount);
        if (data.paidAmount !== undefined) existing.paidAmount = Number(data.paidAmount);

        if (data.remainingAmount !== undefined) {
            existing.remainingAmount = Number(data.remainingAmount);
        } else if (data.originalAmount !== undefined || data.discountAmount !== undefined || data.paidAmount !== undefined) {
            const net = Math.max(0, (existing.originalAmount || 0) - (existing.discountAmount || 0));
            existing.remainingAmount = Math.max(0, net - (existing.paidAmount || 0));
        }

        if (data.description !== undefined) existing.description = data.description || '';
        if (data.date) existing.date = new Date(data.date);

        await existing.save();

        return await TransactionModel.findById(existing._id)
            .populate('centerTeacherId', 'name subject')
            .populate('createdBy', 'name role')
            .lean();
    }

    static async deleteTransaction(centerId: string, transactionId: string) {
        const centerObjId = new Types.ObjectId(centerId);
        const deleted = await TransactionModel.findOneAndDelete({
            _id: transactionId,
            centerId: centerObjId,
        }).lean();

        if (!deleted) throw NotFoundException({ message: 'المعاملة المالية غير موجودة بالسنتر' });
        return deleted;
    }

    static async batchDeleteTransactions(centerId: string, transactionIds: string[]) {
        const centerObjId = new Types.ObjectId(centerId);
        const validIds = (transactionIds || [])
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));

        if (validIds.length === 0) {
            throw BadRequestException({ message: 'لم يتم تحديد معاملات صالحة للحذف' });
        }

        const result = await TransactionModel.deleteMany({
            _id: { $in: validIds },
            centerId: centerObjId,
        });

        return {
            deletedCount: result.deletedCount || 0,
        };
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
        const centerObjId = new Types.ObjectId(centerId);
        const filter: any = {
            centerId: centerObjId,
            studentId: new Types.ObjectId(studentId),
        };

        const [transactions, enrollment] = await Promise.all([
            TransactionModel.find(filter)
                .populate('centerTeacherId', 'name subject')
                .populate('createdBy', 'name')
                .sort({ date: -1 })
                .lean(),
            CenterEnrollmentModel.findOne({ centerId: centerObjId, studentId: new Types.ObjectId(studentId), isActive: true })
                .populate('packageId', 'name monthlyPrice')
                .populate('privateTeachers.groupId', 'name privateMonthlyPrice')
                .lean(),
        ]);

        const debtSummary = CenterService.computeStudentDebtSummary(enrollment, transactions);

        return {
            studentId,
            transactions,
            expectedAmount: debtSummary.expectedAmount,
            totalPaid: debtSummary.totalPaid,
            totalRemaining: debtSummary.totalRemainingDebt,
            totalRemainingDebt: debtSummary.totalRemainingDebt,
            totalOriginal: debtSummary.totalOriginal,
            hasDebt: debtSummary.hasDebt,
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

    static async getBatches(centerId: string) {
        const centerObjId = new Types.ObjectId(centerId);
        const batches = await CardModel.aggregate([
            { $match: { centerId: centerObjId, batchId: { $ne: null } } },
            {
                $group: {
                    _id: '$batchId',
                    count: { $sum: 1 },
                    createdAt: { $first: '$createdAt' },
                },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 30 },
        ]);

        return batches.map((b) => ({
            batchId: b._id,
            count: b.count,
            createdAt: b.createdAt,
        }));
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

    // ══════════════════════════════════════════════════════════════════════════
    // 11. Center Custom Broadcast Messages (رسائل مخصصة لأولياء الأمور)
    // ══════════════════════════════════════════════════════════════════════════

    static async resolveCenterMessageStudentIds(
        centerId: string,
        input: { targetType: 'GROUP' | 'GRADE'; groupId?: string | null; gradeLevel?: GradeLevel | null }
    ): Promise<{ studentIds: Types.ObjectId[]; groupName?: string; gradeLevel: GradeLevel }> {
        const centerObjId = new Types.ObjectId(centerId);

        if (input.targetType === 'GROUP') {
            if (!input.groupId || !Types.ObjectId.isValid(input.groupId)) {
                throw BadRequestException({ message: 'معرف الحصة مطلوب' });
            }
            const group = await CenterGroupModel.findOne({
                _id: input.groupId,
                centerId: centerObjId,
                isActive: true,
            }).lean();

            if (!group) {
                throw NotFoundException({ message: 'الحصة غير موجودة بالسنتر' });
            }

            const { students } = await CenterService.getEnrolledStudentsForClass(centerId, group);
            return {
                studentIds: students.map((s: any) => new Types.ObjectId(String(s._id))),
                groupName: group.name,
                gradeLevel: group.gradeLevel as GradeLevel,
            };
        }

        if (!input.gradeLevel) {
            throw BadRequestException({ message: 'الصف الدراسي مطلوب' });
        }

        const students = await CenterStudentModel.find({
            centerId: centerObjId,
            gradeLevel: input.gradeLevel,
            isActive: true,
        })
            .select('_id')
            .lean();

        return {
            studentIds: students.map((s) => s._id as Types.ObjectId),
            gradeLevel: input.gradeLevel,
        };
    }

    static async getCenterMessageAudience(
        centerId: string,
        query: { targetType: 'GROUP' | 'GRADE'; groupId?: string; gradeLevel?: GradeLevel }
    ) {
        const { studentIds } = await CenterService.resolveCenterMessageStudentIds(centerId, query);
        const targetStudentCount = studentIds.length;

        if (targetStudentCount === 0) {
            return {
                targetStudentCount: 0,
                reachedParentCount: 0,
                studentsWithoutParentCount: 0,
            };
        }

        const activeLinks = await ParentStudentModel.find({
            studentId: { $in: studentIds },
            status: 'ACTIVE',
        })
            .select('studentId parentId')
            .lean();

        const reachedParentCount = new Set(activeLinks.map((l) => l.parentId.toString())).size;
        const studentsWithParentCount = new Set(activeLinks.map((l) => l.studentId.toString())).size;
        const studentsWithoutParentCount = Math.max(0, targetStudentCount - studentsWithParentCount);

        return {
            targetStudentCount,
            reachedParentCount,
            studentsWithoutParentCount,
        };
    }

    static async createCenterMessage(
        centerId: string,
        sentBy: string,
        input: {
            targetType: 'GROUP' | 'GRADE';
            groupId?: string | null;
            gradeLevel?: GradeLevel | null;
            title?: string | null;
            body: string;
            clientRequestId: string;
        }
    ) {
        const centerObjId = new Types.ObjectId(centerId);
        const cleanRequestId = input.clientRequestId.trim();

        const existing = await TeacherMessageModel.findOne({
            centerId: centerObjId,
            clientRequestId: cleanRequestId,
        });

        if (existing) {
            const createdAtMs = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
            if (existing.status === 'SENDING' && createdAtMs > 0 && Date.now() - createdAtMs > 5 * 60 * 1000) {
                existing.status = 'FAILED';
                await existing.save();
            }
            return existing;
        }

        const { studentIds, groupName, gradeLevel } = await CenterService.resolveCenterMessageStudentIds(centerId, input);
        const targetStudentCount = studentIds.length;

        if (targetStudentCount === 0) {
            throw BadRequestException({ message: 'لا يوجد طلاب نشطين في نطاق الاستهداف المحدد' });
        }

        if (targetStudentCount > 2000) {
            throw BadRequestException({ message: 'الحد الأقصى للطلاب المستهدفين في الرسالة الواحدة هو 2000 طالب' });
        }

        const activeLinks = await ParentStudentModel.find({
            studentId: { $in: studentIds },
            status: 'ACTIVE',
        })
            .select('parentId')
            .lean();

        const reachedParentCount = new Set(activeLinks.map((l) => l.parentId.toString())).size;
        if (reachedParentCount === 0) {
            throw BadRequestException({
                message: 'لا يمكن إرسال الرسالة: لا يوجد أولياء أمور مربوطين بالطلاب المستهدفين على التطبيق',
            });
        }

        const docData: any = {
            teacherId: null,
            centerId: centerObjId,
            sentBy: new Types.ObjectId(sentBy),
            targetType: input.targetType,
            gradeLevel,
            body: input.body.trim(),
            clientRequestId: cleanRequestId,
            status: 'SENDING',
            targetStudentCount,
            reachedParentCount,
            pushSentCount: 0,
        };

        if (input.groupId && Types.ObjectId.isValid(input.groupId)) {
            docData.groupId = new Types.ObjectId(input.groupId);
        }
        if (groupName) {
            docData.groupName = groupName;
        }
        if (input.title?.trim()) {
            docData.title = input.title.trim();
        }

        const [message, centerDoc] = await Promise.all([
            TeacherMessageModel.create(docData),
            CenterModel.findById(centerId).select('name').lean(),
        ]);
        ParentPushService.notifyCenterMessage(
            String((message as any)._id),
            centerDoc?.name || 'السنتر',
            studentIds.map((id) => String(id))
        );
        return message;
    }

    static async getCenterMessages(centerId: string, query: { page?: number; limit?: number } = {}) {
        const centerObjId = new Types.ObjectId(centerId);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        await TeacherMessageModel.updateMany(
            {
                centerId: centerObjId,
                status: 'SENDING',
                createdAt: { $lt: fiveMinutesAgo },
            },
            { $set: { status: 'FAILED' } }
        );

        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
        const skip = (page - 1) * limit;

        const [messages, total] = await Promise.all([
            TeacherMessageModel.find({ centerId: centerObjId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            TeacherMessageModel.countDocuments({ centerId: centerObjId }),
        ]);

        return {
            messages,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 12. Weekly Attendance Sheet Report & Printable HTML (كشف الحضور الأسبوعي)
    // ══════════════════════════════════════════════════════════════════════════

    static async getWeeklyAttendanceReport(
        centerId: string,
        query: {
            mode?: 'CLASSES' | 'QUICK_CHECKIN';
            stage?: string;
            gradeLevel?: string;
            groupId?: string;
            weekStart?: string;
        } = {}
    ) {
        const centerObjId = new Types.ObjectId(centerId);
        const mode = query.mode === 'QUICK_CHECKIN' ? 'QUICK_CHECKIN' : 'CLASSES';

        // Determine week start (default to most recent Saturday)
        let startDate: Date;
        if (query.weekStart) {
            startDate = new Date(query.weekStart);
            startDate.setUTCHours(0, 0, 0, 0);
        } else {
            const now = new Date();
            const day = now.getUTCDay(); // 0=Sun .. 6=Sat
            const diffToSat = day === 6 ? 0 : day + 1;
            startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToSat, 0, 0, 0, 0));
        }

        const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const weekDays: { dateStr: string; dateObj: Date; dayName: string }[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
            const dateStr = d.toISOString().split('T')[0] || '';
            const dayName = ARABIC_DAYS[d.getUTCDay()] || '';
            weekDays.push({ dateStr, dateObj: d, dayName });
        }

        const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

        // Filter students / groups by gradeLevel or stage
        const gradeFilter: any = {};
        if (query.gradeLevel && query.gradeLevel !== 'ALL') {
            gradeFilter.gradeLevel = query.gradeLevel;
        } else if (query.stage && query.stage !== 'ALL') {
            if (query.stage === 'SECONDARY') {
                gradeFilter.gradeLevel = { $in: [GradeLevel.SEC_1, GradeLevel.SEC_2, GradeLevel.SEC_3] };
            } else if (query.stage === 'PREPARATORY') {
                gradeFilter.gradeLevel = { $in: [GradeLevel.PREP_1, GradeLevel.PREP_2, GradeLevel.PREP_3] };
            } else if (query.stage === 'PRIMARY') {
                gradeFilter.gradeLevel = {
                    $in: [
                        GradeLevel.PRIM_1,
                        GradeLevel.PRIM_2,
                        GradeLevel.PRIM_3,
                        GradeLevel.PRIM_4,
                        GradeLevel.PRIM_5,
                        GradeLevel.PRIM_6,
                    ],
                };
            }
        }

        const [center, groups, allStudents, enrollments, transactions] = await Promise.all([
            CenterModel.findById(centerId).select('name phone address').lean(),
            CenterGroupModel.find({
                centerId: centerObjId,
                isActive: true,
                ...(query.groupId && query.groupId !== 'ALL' ? { _id: new Types.ObjectId(query.groupId) } : {}),
                ...gradeFilter,
            })
                .populate('centerTeacherId', 'name subject')
                .sort({ gradeLevel: 1, name: 1 })
                .lean(),
            CenterStudentModel.find({
                centerId: centerObjId,
                isActive: true,
                ...gradeFilter,
            })
                .sort({ gradeLevel: 1, studentName: 1 })
                .lean(),
            CenterEnrollmentModel.find({
                centerId: centerObjId,
                isActive: true,
            })
                .populate('packageId', 'name monthlyPrice')
                .populate('privateTeachers.groupId', 'name privateMonthlyPrice')
                .lean(),
            TransactionModel.find({ centerId: centerObjId }).lean(),
        ]);

        const enrollmentMap = new Map<string, any>();
        for (const e of enrollments) {
            enrollmentMap.set(String(e.studentId), e);
        }

        const txMap = new Map<string, any[]>();
        for (const t of transactions) {
            if (!t.studentId) continue;
            const sid = String(t.studentId);
            const arr = txMap.get(sid) || [];
            arr.push(t);
            txMap.set(sid, arr);
        }

        // If groupId is specified, restrict students to those enrolled in that class
        let targetStudents = allStudents;
        if (query.groupId && query.groupId !== 'ALL' && groups.length > 0) {
            const { students: classStudents } = await CenterService.getEnrolledStudentsForClass(centerId, groups[0]);
            targetStudents = classStudents;
        }

        if (mode === 'QUICK_CHECKIN') {
            const checkIns = await CenterCheckInModel.find({
                centerId: centerObjId,
                date: { $gte: startDate, $lte: endDate },
            }).lean();

            const checkInMap = new Map<string, any>();
            for (const ci of checkIns) {
                const dStr = new Date(ci.date).toISOString().split('T')[0];
                checkInMap.set(`${String(ci.studentId)}_${dStr}`, ci);
            }

            const rows = targetStudents.map((st: any) => {
                const sid = String(st._id);
                const enr = enrollmentMap.get(sid);
                const txs = txMap.get(sid) || [];
                const fin = CenterService.computeStudentDebtSummary(enr, txs);

                let presentDays = 0;
                let absentDays = 0;

                const days = weekDays.map((wd) => {
                    const ci = checkInMap.get(`${sid}_${wd.dateStr}`);
                    if (ci) {
                        presentDays++;
                        return {
                            date: wd.dateStr,
                            dayName: wd.dayName,
                            status: 'PRESENT',
                            time: ci.checkInTime
                                ? new Date(ci.checkInTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                                : null,
                        };
                    }
                    absentDays++;
                    return {
                        date: wd.dateStr,
                        dayName: wd.dayName,
                        status: 'ABSENT',
                        time: null,
                    };
                });

                return {
                    student: {
                        _id: st._id,
                        studentName: st.studentName,
                        studentCode: st.studentCode,
                        studentPhone: st.studentPhone,
                        parentPhone: st.parentPhone,
                        gradeLevel: st.gradeLevel,
                        studentType: enr?.type || st.studentType || 'PACKAGE',
                    },
                    days,
                    presentCount: presentDays,
                    absentCount: absentDays,
                    totalRemainingDebt: fin.totalRemainingDebt,
                    hasDebt: fin.hasDebt,
                };
            });

            return {
                centerName: center?.name || 'السنتر',
                mode,
                weekStart: weekDays[0]?.dateStr,
                weekEnd: weekDays[6]?.dateStr,
                weekDays: weekDays.map((w) => ({ date: w.dateStr, dayName: w.dayName })),
                groups,
                rows,
            };
        }

        // CLASSES Mode
        const attendanceRecords = await CenterAttendanceModel.find({
            centerId: centerObjId,
            date: { $gte: startDate, $lte: endDate },
            ...(query.groupId && query.groupId !== 'ALL' ? { groupId: new Types.ObjectId(query.groupId) } : {}),
        })
            .populate('groupId', 'name')
            .lean();

        const attByStudentDate = new Map<string, any[]>();
        for (const rec of attendanceRecords) {
            const dStr = new Date(rec.date).toISOString().split('T')[0];
            const key = `${String(rec.studentId)}_${dStr}`;
            const list = attByStudentDate.get(key) || [];
            list.push(rec);
            attByStudentDate.set(key, list);
        }

        const rows = targetStudents.map((st: any) => {
            const sid = String(st._id);
            const enr = enrollmentMap.get(sid);
            const txs = txMap.get(sid) || [];
            const fin = CenterService.computeStudentDebtSummary(enr, txs);

            let presentCount = 0;
            let absentCount = 0;

            const days = weekDays.map((wd) => {
                const recs = attByStudentDate.get(`${sid}_${wd.dateStr}`) || [];
                if (recs.length === 0) {
                    return {
                        date: wd.dateStr,
                        dayName: wd.dayName,
                        status: 'NONE',
                        classes: [],
                    };
                }

                const classes = recs.map((r: any) => {
                    if (r.status === 'PRESENT' || r.status === 'LATE') presentCount++;
                    else if (r.status === 'ABSENT') absentCount++;
                    return {
                        groupId: r.groupId?._id || r.groupId,
                        groupName: r.groupId?.name || 'حصة',
                        status: r.status,
                    };
                });

                const hasPresent = classes.some((c) => c.status === 'PRESENT' || c.status === 'LATE');
                const allAbsent = classes.every((c) => c.status === 'ABSENT');

                return {
                    date: wd.dateStr,
                    dayName: wd.dayName,
                    status: hasPresent ? 'PRESENT' : allAbsent ? 'ABSENT' : 'MIXED',
                    classes,
                };
            });

            return {
                student: {
                    _id: st._id,
                    studentName: st.studentName,
                    studentCode: st.studentCode,
                    studentPhone: st.studentPhone,
                    parentPhone: st.parentPhone,
                    gradeLevel: st.gradeLevel,
                    studentType: enr?.type || st.studentType || 'PACKAGE',
                },
                days,
                presentCount,
                absentCount,
                totalRemainingDebt: fin.totalRemainingDebt,
                hasDebt: fin.hasDebt,
            };
        });

        return {
            centerName: center?.name || 'السنتر',
            mode,
            weekStart: weekDays[0]?.dateStr,
            weekEnd: weekDays[6]?.dateStr,
            weekDays: weekDays.map((w) => ({ date: w.dateStr, dayName: w.dayName })),
            groups,
            rows,
        };
    }

    static async generateWeeklyAttendancePrintHtml(centerId: string, query: any = {}) {
        const report = await CenterService.getWeeklyAttendanceReport(centerId, query);
        const modeTitle = report.mode === 'QUICK_CHECKIN' ? 'التحضير السريع (بوابة السنتر)' : 'تحضير الحصص الدراسية';
        const selectedGroup = query.groupId && query.groupId !== 'ALL'
            ? report.groups.find((g: any) => String(g._id) === String(query.groupId))
            : null;
        const subtitle = selectedGroup
            ? `${selectedGroup.name} - ${selectedGroup.gradeLevel}`
            : query.gradeLevel && query.gradeLevel !== 'ALL'
                ? `الصف الدراسي: ${query.gradeLevel}`
                : 'جميع الصفوف الدراسية';

        // Group rows by gradeLevel so each Grade prints cleanly under its header
        const rowsByGrade = new Map<string, any[]>();
        for (const r of report.rows) {
            const g = r.student.gradeLevel || 'غير محدد';
            const list = rowsByGrade.get(g) || [];
            list.push(r);
            rowsByGrade.set(g, list);
        }

        const dayHeadersHtml = report.weekDays
            .map(
                (wd) => `<th style="text-align:center;min-width:85px;">
                    <div>${wd.dayName}</div>
                    <div style="font-size:10px;font-weight:normal;color:#475569;">${wd.date}</div>
                </th>`
            )
            .join('');

        let sectionsHtml = '';
        if (rowsByGrade.size === 0) {
            sectionsHtml = `<div style="padding:30px;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:8px;">لا توجد بيانات طلاب في هذا النطاق</div>`;
        } else {
            for (const [grade, gradeRows] of rowsByGrade.entries()) {
                const bodyRowsHtml = gradeRows
                    .map((row, idx) => {
                        const cellsHtml = row.days
                            .map((d: any) => {
                                if (report.mode === 'QUICK_CHECKIN') {
                                    if (d.status === 'PRESENT') {
                                        return `<td style="text-align:center;color:#15803d;font-weight:bold;background:#f0fdf4;">✓ حاضر${d.time ? `<div style="font-size:9px;color:#166534;">${d.time}</div>` : ''}</td>`;
                                    }
                                    return `<td style="text-align:center;color:#b91c1c;background:#fef2f2;">✗ غائب</td>`;
                                }
                                // CLASSES mode
                                if (!d.classes || d.classes.length === 0) {
                                    return `<td style="text-align:center;color:#94a3b8;">—</td>`;
                                }
                                const badges = d.classes
                                    .map((c: any) => {
                                        const isP = c.status === 'PRESENT' || c.status === 'LATE';
                                        const color = isP ? '#15803d' : '#b91c1c';
                                        const bg = isP ? '#dcfce7' : '#fee2e2';
                                        const mark = isP ? '✓' : '✗';
                                        const shortName = String(c.groupName || '').replace(/^حصة\s+/, '').split('(')[0]?.trim();
                                        return `<div style="font-size:10px;margin:2px 0;padding:1px 4px;border-radius:4px;background:${bg};color:${color};font-weight:600;">${mark} ${shortName}</div>`;
                                    })
                                    .join('');
                                return `<td style="text-align:center;vertical-align:middle;">${badges}</td>`;
                            })
                            .join('');

                        const typeLabel = row.student.studentType === 'PACKAGE' ? 'باكيدج' : row.student.studentType === 'BOTH' ? 'باكيدج + برايفت' : 'برايفت';
                        const debtHtml = row.hasDebt
                            ? `<span style="color:#b91c1c;font-weight:bold;">${row.totalRemainingDebt} ج.م</span>`
                            : `<span style="color:#15803d;">خالص</span>`;

                        return `<tr>
                            <td style="text-align:center;font-weight:bold;">${idx + 1}</td>
                            <td style="font-weight:bold;">${row.student.studentName}</td>
                            <td style="text-align:center;font-family:monospace;">${row.student.studentCode}</td>
                            <td style="text-align:center;font-size:11px;">${typeLabel}</td>
                            <td style="text-align:center;font-size:11px;direction:ltr;">${row.student.parentPhone || row.student.studentPhone || '—'}</td>
                            ${cellsHtml}
                            <td style="text-align:center;color:#15803d;font-weight:bold;">${row.presentCount}</td>
                            <td style="text-align:center;color:#b91c1c;font-weight:bold;">${row.absentCount}</td>
                            <td style="text-align:center;">${debtHtml}</td>
                        </tr>`;
                    })
                    .join('');

                sectionsHtml += `
                <div class="grade-section">
                    <div class="grade-title">الصف الدراسي: ${grade} (${gradeRows.length} طالب)</div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width:36px;">#</th>
                                <th style="min-width:150px;">اسم الطالب</th>
                                <th style="width:70px;">الكود</th>
                                <th style="width:70px;">الاشتراك</th>
                                <th style="width:95px;">هاتف ولي الأمر</th>
                                ${dayHeadersHtml}
                                <th style="width:55px;">حضور</th>
                                <th style="width:55px;">غياب</th>
                                <th style="width:80px;">المتبقي</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bodyRowsHtml}
                        </tbody>
                    </table>
                </div>`;
            }
        }

        return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8" />
    <title>كشف الحضور والغياب الأسبوعي - ${report.centerName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; font-family: 'Cairo', sans-serif; }
        body { margin: 0; padding: 16px; color: #0f172a; background: #fff; font-size: 12px; }
        .no-print { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; }
        .btn-print { background: #2563eb; color: #fff; border: none; padding: 8px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 16px; }
        .header h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 800; }
        .header p { margin: 0; color: #475569; font-size: 12px; }
        .grade-section { margin-bottom: 24px; page-break-inside: avoid; }
        .grade-title { background: #1e293b; color: #fff; padding: 6px 12px; border-radius: 6px 6px 0 0; font-weight: 700; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
        th { background: #f1f5f9; font-weight: 700; font-size: 11px; }
        @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
        }
    </style>
</head>
<body>
    <div class="no-print">
        <div><strong>معاينة طباعة كشف الحضور والغياب الأسبوعي</strong> — ${subtitle}</div>
        <button class="btn-print" onclick="window.print()">طباعة الكشف الآن</button>
    </div>
    <div class="header">
        <div>
            <h1>${report.centerName} — كشف الحضور والغياب الأسبوعي</h1>
            <p>النظام: ${modeTitle} | ${subtitle}</p>
        </div>
        <div style="text-align:left;">
            <div><strong>الفترة:</strong> من ${report.weekStart} إلى ${report.weekEnd}</div>
            <div style="font-size:11px;color:#64748b;">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
        </div>
    </div>
    ${sectionsHtml}
</body>
</html>`;
    }
}
