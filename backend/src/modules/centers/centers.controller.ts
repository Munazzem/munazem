import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { CenterService } from './centers.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { requireCenterPermission } from '../../middlewares/center-permissions.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { UserRole } from '../../common/enums/enum.service.js';
import {
    createCenterSchema,
    createBranchSchema,
    updateCenterSchema,
    createCenterTeacherSchema,
    updateCenterTeacherSchema,
    createCenterPackageSchema,
    updateCenterPackageSchema,
    createCenterGroupSchema,
    updateCenterGroupSchema,
    createCenterSupervisorSchema,
    updateCenterSupervisorSchema,
    createCenterEnrollmentSchema,
    updateCenterEnrollmentSchema,
    recordCenterAttendanceSchema,
    bulkCenterAttendanceSchema,
} from '../../validation/center.validation.js';

class CenterController {
    private static extractBranchId(req: Request): string | undefined {
        return (req.query.branchId as string) || (req.headers['x-branch-id'] as string) || req.body?.branchId || undefined;
    }

    // ── Centers & Branches ───────────────────────────────────────────────────

    static async getMyCenters(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centers = await CenterService.getMyCenters(user.userId, user.role, user.centerId);
            return SuccessResponse({ res, message: 'تم جلب بيانات السنتر والفروع', data: centers });
        } catch (error) {
            next(error);
        }
    }

    static async createCenter(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const center = await CenterService.createCenter(user.userId, req.body);
            return SuccessResponse({ res, message: 'تم إنشاء السنتر بنجاح', data: center, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    static async createBranch(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const branch = await CenterService.createBranch(user.userId, req.body);
            return SuccessResponse({ res, message: 'تم إنشاء الفرع بنجاح', data: branch, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    static async updateCenter(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = req.params.id || await CenterService.resolveCenter(user);
            const center = await CenterService.updateCenter(centerId, user.userId, req.body);
            return SuccessResponse({ res, message: 'تم تحديث بيانات السنتر بنجاح', data: center });
        } catch (error) {
            next(error);
        }
    }

    // ── Teachers ─────────────────────────────────────────────────────────────

    static async getTeachers(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const teachers = await CenterService.getTeachers(centerId, req.query);
            return SuccessResponse({ res, message: 'تم جلب المدرسين بنجاح', data: teachers });
        } catch (error) {
            next(error);
        }
    }

    static async createTeacher(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const teacher = await CenterService.createTeacher(centerId, req.body);
            return SuccessResponse({ res, message: 'تمت إضافة المدرس بنجاح', data: teacher, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    static async updateTeacher(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const teacher = await CenterService.updateTeacher(req.params.id as string, centerId, req.body);
            return SuccessResponse({ res, message: 'تم تعديل بيانات المدرس بنجاح', data: teacher });
        } catch (error) {
            next(error);
        }
    }

    static async deleteTeacher(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            await CenterService.deleteTeacher(req.params.id as string, centerId);
            return SuccessResponse({ res, message: 'تم حذف المدرس بنجاح' });
        } catch (error) {
            next(error);
        }
    }

    // ── Packages ─────────────────────────────────────────────────────────────

    static async getPackages(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const packages = await CenterService.getPackages(centerId, req.query);
            return SuccessResponse({ res, message: 'تم جلب الباكيدجات بنجاح', data: packages });
        } catch (error) {
            next(error);
        }
    }

    static async getPackageById(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const pkg = await CenterService.getPackageById(req.params.id as string, centerId);
            return SuccessResponse({ res, message: 'تم جلب بيانات الباكيدج', data: pkg });
        } catch (error) {
            next(error);
        }
    }

    static async createPackage(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const pkg = await CenterService.createPackage(centerId, req.body);
            return SuccessResponse({ res, message: 'تم إنشاء الباكيدج بنجاح', data: pkg, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    static async updatePackage(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const pkg = await CenterService.updatePackage(req.params.id as string, centerId, req.body);
            return SuccessResponse({ res, message: 'تم تعديل الباكيدج بنجاح', data: pkg });
        } catch (error) {
            next(error);
        }
    }

    static async deletePackage(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            await CenterService.deletePackage(req.params.id as string, centerId);
            return SuccessResponse({ res, message: 'تم تعطيل الباكيدج بنجاح' });
        } catch (error) {
            next(error);
        }
    }

    // ── Groups ───────────────────────────────────────────────────────────────

    static async getGroups(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const groups = await CenterService.getGroups(centerId, req.query);
            return SuccessResponse({ res, message: 'تم جلب المجموعات بنجاح', data: groups });
        } catch (error) {
            next(error);
        }
    }

    static async getGroupById(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const group = await CenterService.getGroupById(req.params.id as string, centerId);
            return SuccessResponse({ res, message: 'تم جلب بيانات المجموعة', data: group });
        } catch (error) {
            next(error);
        }
    }

    static async createGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const group = await CenterService.createGroup(centerId, req.body);
            return SuccessResponse({ res, message: 'تم إنشاء المجموعة بنجاح', data: group, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    static async updateGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const group = await CenterService.updateGroup(req.params.id as string, centerId, req.body);
            return SuccessResponse({ res, message: 'تم تعديل المجموعة بنجاح', data: group });
        } catch (error) {
            next(error);
        }
    }

    static async deleteGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            await CenterService.deleteGroup(req.params.id as string, centerId);
            return SuccessResponse({ res, message: 'تم تعطيل المجموعة بنجاح' });
        } catch (error) {
            next(error);
        }
    }

    // ── Supervisors ──────────────────────────────────────────────────────────

    static async getSupervisors(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const branchId = CenterController.extractBranchId(req);
            const supervisors = await CenterService.getSupervisors(user.userId, branchId);
            return SuccessResponse({ res, message: 'تم جلب المشرفين بنجاح', data: supervisors });
        } catch (error) {
            next(error);
        }
    }

    static async createSupervisor(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user);
            const supervisor = await CenterService.createSupervisor(user.userId, centerId, req.body);
            return SuccessResponse({ res, message: 'تم إنشاء حساب المشرف بنجاح', data: supervisor, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    static async updateSupervisor(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const supervisor = await CenterService.updateSupervisor(req.params.id as string, user.userId, req.body);
            return SuccessResponse({ res, message: 'تم تحديث بيانات المشرف بنجاح', data: supervisor });
        } catch (error) {
            next(error);
        }
    }

    static async deleteSupervisor(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            await CenterService.deleteSupervisor(req.params.id as string, user.userId);
            return SuccessResponse({ res, message: 'تم تعطيل حساب المشرف بنجاح' });
        } catch (error) {
            next(error);
        }
    }

    // ── Enrollments ──────────────────────────────────────────────────────────

    static async getEnrollments(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const enrollments = await CenterService.getEnrollments(centerId, req.query);
            return SuccessResponse({ res, message: 'تم جلب الاشتراكات بنجاح', data: enrollments });
        } catch (error) {
            next(error);
        }
    }

    static async getStudentEnrollment(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const enrollment = await CenterService.getStudentEnrollment(centerId, req.params.studentId as string);
            return SuccessResponse({ res, message: 'تم جلب اشتراك الطالب', data: enrollment });
        } catch (error) {
            next(error);
        }
    }

    static async enrollStudent(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const ownerId = (req as any).tenantId || user.userId;
            const enrollment = await CenterService.enrollStudent(centerId, ownerId, req.body);
            return SuccessResponse({ res, message: 'تم تسجيل اشتراك الطالب بنجاح', data: enrollment, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    static async updateEnrollment(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const enrollment = await CenterService.updateEnrollment(req.params.id as string, centerId, req.body);
            return SuccessResponse({ res, message: 'تم تعديل الاشتراك بنجاح', data: enrollment });
        } catch (error) {
            next(error);
        }
    }

    // ── Quick Attendance ─────────────────────────────────────────────────────

    static async recordAttendance(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const attendance = await CenterService.recordAttendance(centerId, user.userId, req.body);
            return SuccessResponse({ res, message: 'تم تسجيل الحضور بنجاح', data: attendance });
        } catch (error) {
            next(error);
        }
    }

    static async bulkRecordAttendance(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const result = await CenterService.bulkRecordAttendance(centerId, user.userId, req.body);
            return SuccessResponse({ res, message: `تم تسجيل حضور ${result.count} طالب بنجاح`, data: result });
        } catch (error) {
            next(error);
        }
    }

    static async getGroupAttendance(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const dateStr = (req.query.date as string) || new Date().toISOString();
            const attendance = await CenterService.getGroupAttendance(centerId, req.params.groupId as string, dateStr);
            return SuccessResponse({ res, message: 'تم جلب سجل الحضور للمجموعة', data: attendance });
        } catch (error) {
            next(error);
        }
    }

    static async getStudentAttendance(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const records = await CenterService.getStudentAttendance(centerId, req.params.studentId as string, req.query);
            return SuccessResponse({ res, message: 'تم جلب سجل حضور الطالب', data: records });
        } catch (error) {
            next(error);
        }
    }

    // ── Financials & Reports ─────────────────────────────────────────────────

    static async recordPayment(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const ownerId = (req as any).tenantId || user.userId;
            const payment = await CenterService.recordPayment(centerId, ownerId, user.userId, req.body);
            return SuccessResponse({ res, message: 'تم تسجيل المعاملة المالية بنجاح', data: payment, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    static async getFinancialSummary(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const summary = await CenterService.getFinancialSummary(
                centerId,
                req.query.startDate as string,
                req.query.endDate as string
            );
            return SuccessResponse({ res, message: 'تم جلب التقرير المالي للسنتر', data: summary });
        } catch (error) {
            next(error);
        }
    }

    static async getTeacherFinancialReport(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const report = await CenterService.getTeacherFinancialReport(
                centerId,
                req.params.teacherId as string,
                req.query.startDate as string,
                req.query.endDate as string
            );
            return SuccessResponse({ res, message: 'تم جلب كشف حساب المدرس', data: report });
        } catch (error) {
            next(error);
        }
    }
}

const router = Router();
router.use(authenticate);

// ── Center & Branch Management ───────────────────────────────────────────────
router.get('/my', authorizeRoles(UserRole.centerOwner, UserRole.centerSupervisor), CenterController.getMyCenters);
router.post('/', authorizeRoles(UserRole.centerOwner, UserRole.superAdmin), validate(createCenterSchema), CenterController.createCenter);
router.post('/branches', authorizeRoles(UserRole.centerOwner), validate(createBranchSchema), CenterController.createBranch);
router.put('/', authorizeRoles(UserRole.centerOwner), validate(updateCenterSchema), CenterController.updateCenter);
router.put('/:id', authorizeRoles(UserRole.centerOwner), validate(updateCenterSchema), CenterController.updateCenter);

// ── Center Teachers ──────────────────────────────────────────────────────────
router.get('/teachers', authorizeRoles(UserRole.centerOwner, UserRole.centerSupervisor), CenterController.getTeachers);
router.post('/teachers', requireCenterPermission('canManageTeachers'), validate(createCenterTeacherSchema), CenterController.createTeacher);
router.put('/teachers/:id', requireCenterPermission('canManageTeachers'), validate(updateCenterTeacherSchema), CenterController.updateTeacher);
router.delete('/teachers/:id', requireCenterPermission('canManageTeachers'), CenterController.deleteTeacher);

// ── Center Packages ──────────────────────────────────────────────────────────
router.get('/packages', authorizeRoles(UserRole.centerOwner, UserRole.centerSupervisor), CenterController.getPackages);
router.get('/packages/:id', authorizeRoles(UserRole.centerOwner, UserRole.centerSupervisor), CenterController.getPackageById);
router.post('/packages', requireCenterPermission('canManagePackages'), validate(createCenterPackageSchema), CenterController.createPackage);
router.put('/packages/:id', requireCenterPermission('canManagePackages'), validate(updateCenterPackageSchema), CenterController.updatePackage);
router.delete('/packages/:id', requireCenterPermission('canManagePackages'), CenterController.deletePackage);

// ── Center Groups ────────────────────────────────────────────────────────────
router.get('/groups', authorizeRoles(UserRole.centerOwner, UserRole.centerSupervisor), CenterController.getGroups);
router.get('/groups/:id', authorizeRoles(UserRole.centerOwner, UserRole.centerSupervisor), CenterController.getGroupById);
router.post('/groups', authorizeRoles(UserRole.centerOwner, UserRole.centerSupervisor), validate(createCenterGroupSchema), CenterController.createGroup);
router.put('/groups/:id', authorizeRoles(UserRole.centerOwner, UserRole.centerSupervisor), validate(updateCenterGroupSchema), CenterController.updateGroup);
router.delete('/groups/:id', authorizeRoles(UserRole.centerOwner), CenterController.deleteGroup);

// ── Center Supervisors ───────────────────────────────────────────────────────
router.get('/supervisors', authorizeRoles(UserRole.centerOwner), CenterController.getSupervisors);
router.post('/supervisors', authorizeRoles(UserRole.centerOwner), validate(createCenterSupervisorSchema), CenterController.createSupervisor);
router.put('/supervisors/:id', authorizeRoles(UserRole.centerOwner), validate(updateCenterSupervisorSchema), CenterController.updateSupervisor);
router.delete('/supervisors/:id', authorizeRoles(UserRole.centerOwner), CenterController.deleteSupervisor);

// ── Center Enrollments ───────────────────────────────────────────────────────
router.get('/enrollments', authorizeRoles(UserRole.centerOwner, UserRole.centerSupervisor), CenterController.getEnrollments);
router.get('/enrollments/student/:studentId', authorizeRoles(UserRole.centerOwner, UserRole.centerSupervisor), CenterController.getStudentEnrollment);
router.post('/enrollments', requireCenterPermission('canManageStudents'), validate(createCenterEnrollmentSchema), CenterController.enrollStudent);
router.put('/enrollments/:id', requireCenterPermission('canManageStudents'), validate(updateCenterEnrollmentSchema), CenterController.updateEnrollment);

// ── Quick Attendance ─────────────────────────────────────────────────────────
router.post('/attendance', requireCenterPermission('canTakeAttendance'), validate(recordCenterAttendanceSchema), CenterController.recordAttendance);
router.post('/attendance/bulk', requireCenterPermission('canTakeAttendance'), validate(bulkCenterAttendanceSchema), CenterController.bulkRecordAttendance);
router.get('/attendance/group/:groupId', requireCenterPermission('canViewAttendance'), CenterController.getGroupAttendance);
router.get('/attendance/student/:studentId', requireCenterPermission('canViewAttendance'), CenterController.getStudentAttendance);

// ── Financials & Reports ─────────────────────────────────────────────────────
router.post('/financials/payment', requireCenterPermission('canRecordPayments'), CenterController.recordPayment);
router.get('/financials/summary', requireCenterPermission('canViewFinancials'), CenterController.getFinancialSummary);
router.get('/financials/teacher/:teacherId', requireCenterPermission('canViewFinancials'), CenterController.getTeacherFinancialReport);

export default router;
