import { z } from 'zod';
import { GradeLevel, CenterSupervisorType, CenterGroupType, CenterEnrollmentType, AttendanceStatus } from '../common/enums/enum.service.js';

// ── Discount Schema ───────────────────────────────────────────────────────────
const discountSchema = z.object({
    type: z.enum(['PERCENTAGE', 'FIXED']).nullable().optional(),
    value: z.number().min(0, 'قيمة الخصم يجب أن تكون صفر أو أكثر').default(0),
}).optional();

// ── Center Validation ─────────────────────────────────────────────────────────
export const onboardCenterSchema = z.object({
    body: z.object({
        centerName: z.string().min(2, 'اسم السنتر يجب أن يكون حرفين على الأقل'),
        ownerName: z.string().min(2, 'اسم المالك يجب أن يكون حرفين على الأقل'),
        phone: z.string().min(10, 'رقم الهاتف غير صحيح'),
        password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
        email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
        address: z.string().optional().nullable(),
        centerPhone: z.string().optional().nullable(),
        planTier: z.string().optional(),
    }),
});

export const createCenterSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'اسم السنتر يجب أن يكون حرفين على الأقل'),
        phone: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        logoUrl: z.string().optional().nullable(),
    }),
});

export const createBranchSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'اسم الفرع مطلوب'),
        phone: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
    }),
});

export const updateCenterSchema = z.object({
    params: z.object({
        id: z.string().optional(),
    }).optional(),
    body: z.object({
        name: z.string().min(2, 'اسم السنتر مطلوب').optional(),
        phone: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        logoUrl: z.string().optional().nullable(),
    }),
});

// ── Center Teacher Validation ─────────────────────────────────────────────────
export const createCenterTeacherSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'اسم المدرس يجب أن يكون حرفين على الأقل'),
        subject: z.string().min(1, 'المادة الدراسية مطلوبة'),
    }),
});

export const updateCenterTeacherSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'معرف المدرس مطلوب'),
    }),
    body: z.object({
        name: z.string().min(2, 'اسم المدرس مطلوب').optional(),
        subject: z.string().min(1, 'المادة مطلوبة').optional(),
        isActive: z.boolean().optional(),
    }),
});

// ── Center Package Validation ─────────────────────────────────────────────────
export const createCenterPackageSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'اسم الباكيدج مطلوب'),
        gradeLevel: z.nativeEnum(GradeLevel, { message: 'المرحلة الدراسية غير صحيحة' }),
        teachers: z.array(z.object({
            teacherId: z.string().min(1, 'معرف المدرس مطلوب'),
            subject: z.string().optional(),
        })).min(1, 'يجب إضافة مدرس واحد على الأقل في الباكيدج'),
        monthlyPrice: z.number().positive('سعر الباكيدج الشهري يجب أن يكون أكبر من صفر'),
    }),
});

export const updateCenterPackageSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'معرف الباكيدج مطلوب'),
    }),
    body: z.object({
        name: z.string().min(2).optional(),
        gradeLevel: z.nativeEnum(GradeLevel, { message: 'المرحلة الدراسية غير صحيحة' }).optional(),
        teachers: z.array(z.object({
            teacherId: z.string().min(1),
            subject: z.string().optional(),
        })).optional(),
        monthlyPrice: z.number().positive().optional(),
        isActive: z.boolean().optional(),
    }),
});

// ── Center Group Validation ───────────────────────────────────────────────────
export const createCenterGroupSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'اسم المجموعة مطلوب'),
        gradeLevel: z.nativeEnum(GradeLevel, { message: 'المرحلة الدراسية غير صحيحة' }),
        centerTeacherId: z.string().min(1, 'معرف المدرس مطلوب'),
        groupType: z.nativeEnum(CenterGroupType, { message: 'نوع المجموعة غير صحيح' }),
        schedule: z.array(z.object({
            day: z.string().min(1, 'اليوم مطلوب'),
            time: z.string().min(1, 'الوقت مطلوب'),
        })).min(1, 'يجب تحديد موعد واحد على الأقل في الجدول'),
        capacity: z.number().int().positive().default(50),
        privateMonthlyPrice: z.number().min(0).optional().nullable(),
    }).superRefine((data, ctx) => {
        if ((data.groupType === 'PRIVATE' || data.groupType === 'MIXED') && !data.privateMonthlyPrice) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'سعر البرايفت الشهري مطلوب لنوع المجموعة هذه',
                path: ['privateMonthlyPrice'],
            });
        }
    }),
});

export const updateCenterGroupSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'معرف المجموعة مطلوب'),
    }),
    body: z.object({
        name: z.string().min(2).optional(),
        gradeLevel: z.nativeEnum(GradeLevel).optional(),
        centerTeacherId: z.string().min(1).optional(),
        groupType: z.nativeEnum(CenterGroupType).optional(),
        schedule: z.array(z.object({
            day: z.string(),
            time: z.string(),
        })).optional(),
        capacity: z.number().int().positive().optional(),
        privateMonthlyPrice: z.number().min(0).optional().nullable(),
        isActive: z.boolean().optional(),
    }),
});

// ── Center Supervisor Validation ──────────────────────────────────────────────
export const createCenterSupervisorSchema = z.object({
    body: z.object({
        name: z.string().min(3, 'الاسم يجب أن يكون 3 أحرف على الأقل'),
        phone: z.string().min(10, 'رقم الهاتف غير صحيح'),
        password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
        supervisorType: z.nativeEnum(CenterSupervisorType, { message: 'نوع المشرف غير صحيح' }),
        branchId: z.string().optional().nullable(),
        supervisorPermissions: z.object({
            canViewFinancials: z.boolean().optional(),
            canRecordPayments: z.boolean().optional(),
            canManageExpenses: z.boolean().optional(),
            canViewReports: z.boolean().optional(),
            canTakeAttendance: z.boolean().optional(),
            canEditAttendance: z.boolean().optional(),
            canViewAttendance: z.boolean().optional(),
            canManageStudents: z.boolean().optional(),
            canManageTeachers: z.boolean().optional(),
            canManagePackages: z.boolean().optional(),
            canCreateExams: z.boolean().optional(),
            canSendNotifications: z.boolean().optional(),
        }).optional(),
    }),
});

export const updateCenterSupervisorSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'معرف المشرف مطلوب'),
    }),
    body: z.object({
        name: z.string().min(3).optional(),
        phone: z.string().min(10).optional(),
        password: z.string().min(6).optional(),
        supervisorType: z.nativeEnum(CenterSupervisorType).optional(),
        isActive: z.boolean().optional(),
        supervisorPermissions: z.object({
            canViewFinancials: z.boolean().optional(),
            canRecordPayments: z.boolean().optional(),
            canManageExpenses: z.boolean().optional(),
            canViewReports: z.boolean().optional(),
            canTakeAttendance: z.boolean().optional(),
            canEditAttendance: z.boolean().optional(),
            canViewAttendance: z.boolean().optional(),
            canManageStudents: z.boolean().optional(),
            canManageTeachers: z.boolean().optional(),
            canManagePackages: z.boolean().optional(),
            canCreateExams: z.boolean().optional(),
            canSendNotifications: z.boolean().optional(),
        }).optional(),
    }),
});

// ── Center Enrollment Validation ──────────────────────────────────────────────
export const createCenterEnrollmentSchema = z.object({
    body: z.object({
        studentId: z.string().min(1, 'معرف الطالب مطلوب'),
        type: z.nativeEnum(CenterEnrollmentType, { message: 'نوع الاشتراك غير صحيح' }),
        packageId: z.string().optional().nullable(),
        packageDiscount: discountSchema,
        packageGroups: z.array(z.string()).optional(),
        privateTeachers: z.array(z.object({
            centerTeacherId: z.string().min(1, 'معرف المدرس مطلوب'),
            // groupId is required — price is fetched from the group automatically
            groupId: z.string().min(1, 'يجب تحديد مجموعة البرايفت'),
            subject: z.string().optional(),
            sessionsPerWeek: z.number().min(1).default(1),
        })).optional(),
        privateDiscount: discountSchema,
        combinedDiscount: discountSchema,
    }),
});

export const updateCenterEnrollmentSchema = z.object({
    params: z.object({
        id: z.string().min(1, 'معرف الاشتراك مطلوب'),
    }),
    body: z.object({
        type: z.nativeEnum(CenterEnrollmentType).optional(),
        packageId: z.string().optional().nullable(),
        packageDiscount: discountSchema,
        packageGroups: z.array(z.string()).optional(),
        privateTeachers: z.array(z.object({
            centerTeacherId: z.string().min(1),
            groupId: z.string().min(1, 'يجب تحديد مجموعة البرايفت'),
            subject: z.string().optional(),
            sessionsPerWeek: z.number().min(1).optional(),
        })).optional(),
        privateDiscount: discountSchema,
        combinedDiscount: discountSchema,
        isActive: z.boolean().optional(),
    }),
});

// ── Center Attendance Validation ──────────────────────────────────────────────
export const recordCenterAttendanceSchema = z.object({
    body: z.object({
        groupId: z.string().min(1, 'معرف المجموعة مطلوب'),
        studentId: z.string().min(1, 'معرف الطالب مطلوب'),
        date: z.string().min(1, 'التاريخ مطلوب'),
        status: z.nativeEnum(AttendanceStatus, { message: 'حالة الحضور غير صحيحة' }),
        source: z.enum(['MANUAL', 'QR_SCAN']).default('MANUAL'),
        notes: z.string().optional(),
    }),
});

export const bulkCenterAttendanceSchema = z.object({
    body: z.object({
        groupId: z.string().min(1, 'معرف المجموعة مطلوب'),
        date: z.string().min(1, 'التاريخ مطلوب'),
        records: z.array(z.object({
            studentId: z.string().min(1, 'معرف الطالب مطلوب'),
            status: z.nativeEnum(AttendanceStatus),
            notes: z.string().optional(),
            source: z.enum(['MANUAL', 'QR_SCAN']).default('MANUAL'),
        })).min(1, 'يجب إرسال سجل حضور واحد على الأقل'),
    }),
});

// ── Center Students Validation ───────────────────────────────────────────────
export const createCenterStudentSchema = z.object({
    body: z.object({
        studentName: z.string().min(2, 'اسم الطالب يجب أن يكون حرفين على الأقل'),
        parentName: z.string().min(2, 'اسم ولي الأمر يجب أن يكون حرفين على الأقل'),
        studentPhone: z.string().optional().nullable(),
        parentPhone: z.string().optional().nullable(),
        gradeLevel: z.nativeEnum(GradeLevel, { message: 'المرحلة الدراسية غير صحيحة' }),
        barcode: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
    }),
});

export const bulkCreateCenterStudentSchema = z.object({
    body: z.object({
        students: z.array(z.object({
            studentName: z.string().min(2, 'اسم الطالب يجب أن يكون حرفين على الأقل'),
            parentName: z.string().min(2, 'اسم ولي الأمر يجب أن يكون حرفين على الأقل'),
            studentPhone: z.string().optional().nullable(),
            parentPhone: z.string().optional().nullable(),
            gradeLevel: z.nativeEnum(GradeLevel, { message: 'المرحلة الدراسية غير صحيحة' }),
            barcode: z.string().optional().nullable(),
            notes: z.string().optional().nullable(),
        })).min(1, 'يجب إضافة طالب واحد على الأقل'),
    }),
});

export const updateCenterStudentSchema = z.object({
    body: z.object({
        studentName: z.string().min(2, 'اسم الطالب يجب أن يكون حرفين على الأقل').optional(),
        parentName: z.string().min(2, 'اسم ولي الأمر يجب أن يكون حرفين على الأقل').optional(),
        studentPhone: z.string().optional().nullable(),
        parentPhone: z.string().optional().nullable(),
        gradeLevel: z.nativeEnum(GradeLevel, { message: 'المرحلة الدراسية غير صحيحة' }).optional(),
        barcode: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
    }),
});
