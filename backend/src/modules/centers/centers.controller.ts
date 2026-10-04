import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { CenterService } from './centers.service.js';
import { CardBatchPdfService } from '../cards/card-batch-pdf.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { requireCenterPermission } from '../../middlewares/center-permissions.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { UserRole } from '../../common/enums/enum.service.js';
import {
    onboardCenterSchema,
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
    createCenterStudentSchema,
    bulkCreateCenterStudentSchema,
    updateCenterStudentSchema,
    createCenterEnrollmentSchema,
    updateCenterEnrollmentSchema,
    recordCenterAttendanceSchema,
    bulkCenterAttendanceSchema,
    centerCheckInSchema,
    updateCheckInGroupsSchema,
} from '../../validation/center.validation.js';

class CenterController {
    private static extractBranchId(req: Request): string | undefined {
        return (req.query.branchId as string) || (req.headers['x-branch-id'] as string) || req.body?.branchId || undefined;
    }

    // ── Centers & Branches ───────────────────────────────────────────────────

    static async onboardCenter(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await CenterService.onboardCenterByAdmin(req.body);
            return SuccessResponse({ res, message: 'تم إنشاء السنتر وصاحب السنتر بنجاح', data: result, status: 201 });
        } catch (error) {
            next(error);
        }
    }

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

    // ── Students ─────────────────────────────────────────────────────────────

    static async getStudents(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const result = await CenterService.getStudents(centerId, req.query);
            return SuccessResponse({ res, message: 'تم جلب الطلاب بنجاح', data: result });
        } catch (error) {
            next(error);
        }
    }

    static async getStudentById(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const student = await CenterService.getStudentById(centerId, req.params.id as string);
            return SuccessResponse({ res, message: 'تم جلب بيانات الطالب بنجاح', data: student });
        } catch (error) {
            next(error);
        }
    }

    static async createStudent(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const student = await CenterService.createStudent(centerId, req.body);
            return SuccessResponse({ res, message: 'تمت إضافة الطالب بنجاح', data: student, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    static async bulkCreateStudents(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const result = await CenterService.bulkCreateStudents(centerId, req.body);
            return SuccessResponse({ res, message: `تمت إضافة ${result.count} طالب بنجاح`, data: result, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    static async updateStudent(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const student = await CenterService.updateStudent(centerId, req.params.id as string, req.body);
            return SuccessResponse({ res, message: 'تم تعديل بيانات الطالب بنجاح', data: student });
        } catch (error) {
            next(error);
        }
    }

    static async deleteStudent(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            await CenterService.deleteStudent(centerId, req.params.id as string);
            return SuccessResponse({ res, message: 'تم حذف الطالب بنجاح' });
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

    // ── Gate Check-In ────────────────────────────────────────────────────────

    static async checkInStudent(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const result = await CenterService.checkInStudent(centerId, user.userId, req.body);
            return SuccessResponse({
                res,
                message: result.isNewCheckIn ? 'تم تسجيل دخول الطالب للسنتر بنجاح' : 'الطالب مسجل دخول بالفعل اليوم',
                data: result,
                status: result.isNewCheckIn ? 201 : 200,
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateCheckInGroups(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const result = await CenterService.updateCheckInGroups(centerId, user.userId, req.body);
            return SuccessResponse({ res, message: 'تم تحديث حصص الطالب بنجاح', data: result });
        } catch (error) {
            next(error);
        }
    }

    static async getDailyCheckIns(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const result = await CenterService.getDailyCheckIns(centerId, req.query);
            return SuccessResponse({ res, message: 'تم جلب سجل الدخول اليومي بنجاح', data: result });
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

    static async getDailyTally(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const tally = await CenterService.getDailyTally(centerId, req.query.date as string);
            return SuccessResponse({ res, message: 'تم جلب تقرير الجرد اليومي للسنتر بنجاح', data: tally });
        } catch (error) {
            next(error);
        }
    }

    static async getMonthlyTally(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const tally = await CenterService.getMonthlyTally(
                centerId,
                req.query.year ? Number(req.query.year) : undefined,
                req.query.month ? Number(req.query.month) : undefined
            );
            return SuccessResponse({ res, message: 'تم جلب تقرير الجرد الشهري للسنتر بنجاح', data: tally });
        } catch (error) {
            next(error);
        }
    }

    static async getTransactions(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const result = await CenterService.getCenterTransactions(centerId, req.query);
            return SuccessResponse({ res, message: 'تم جلب حركات ومعاملات السنتر المالية', data: result });
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

    static async getStudentFinancialReport(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const report = await CenterService.getStudentFinancialReport(centerId, req.params.studentId as string);
            return SuccessResponse({ res, message: 'تم جلب التقرير المالي للطالب بنجاح', data: report });
        } catch (error) {
            next(error);
        }
    }

    // ── Comprehensive Reports ──────────────────────────────────────────────────
    static async getReportsOverview(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const data = await CenterService.getReportsOverview(
                centerId,
                req.query.startDate as string,
                req.query.endDate as string
            );
            return SuccessResponse({ res, message: 'تم جلب التقرير الشامل للسنتر', data });
        } catch (error) {
            next(error);
        }
    }

    static async getTeachersReport(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const data = await CenterService.getTeachersReport(
                centerId,
                req.query.startDate as string,
                req.query.endDate as string
            );
            return SuccessResponse({ res, message: 'تم جلب تقارير المدرسين بنجاح', data });
        } catch (error) {
            next(error);
        }
    }

    static async getGroupsReport(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const data = await CenterService.getGroupsReport(centerId);
            return SuccessResponse({ res, message: 'تم جلب تقارير المجموعات الدراسية بنجاح', data });
        } catch (error) {
            next(error);
        }
    }

    // ── Smart Cards ────────────────────────────────────────────────────────────
    static async generateCards(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const result = await CenterService.generateCards(centerId, Number(req.body.count), user.userId);
            return SuccessResponse({ res, message: `تم إنشاء ${result.count} كارت بنجاح`, data: result, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    static async getCardsStats(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const stats = await CenterService.getCardsStats(centerId);
            return SuccessResponse({ res, message: 'تم جلب إحصائيات الكروت الذكية', data: stats });
        } catch (error) {
            next(error);
        }
    }

    static async getCards(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const result = await CenterService.getCards(centerId, req.query);
            return SuccessResponse({ res, message: 'تم جلب قائمة الكروت الذكية', data: result });
        } catch (error) {
            next(error);
        }
    }

    static async resolveCard(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const rawParam = (req.query.scanInput as string) || (req.params.scanInput as string) || '';
            const result = await CenterService.resolveCard(centerId, rawParam ? decodeURIComponent(rawParam) : '');
            return SuccessResponse({ res, message: 'تم فحص الكارت بنجاح', data: result });
        } catch (error) {
            next(error);
        }
    }

    static async linkCard(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const result = await CenterService.linkCard(centerId, req.body.cardNumber, req.body.centerStudentId, user.userId);
            return SuccessResponse({ res, message: 'تم ربط الكارت بالطالب بنجاح', data: result });
        } catch (error) {
            next(error);
        }
    }

    static async createStudentAndLinkCard(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const result = await CenterService.createStudentAndLinkCard(centerId, req.body, user.userId);
            return SuccessResponse({ res, message: 'تم إنشاء الطالب وربط الكارت به بنجاح', data: result, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    static async unlinkCard(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const result = await CenterService.unlinkCard(centerId, req.body.cardNumber);
            return SuccessResponse({ res, message: 'تم فك ربط الكارت بنجاح', data: result });
        } catch (error) {
            next(error);
        }
    }

    static async disableCard(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const result = await CenterService.disableCard(centerId, req.body.cardNumber, req.body.reason, user.userId);
            return SuccessResponse({ res, message: 'تم تعطيل الكارت بنجاح', data: result });
        } catch (error) {
            next(error);
        }
    }

    static async getCardTemplate(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const template = await CenterService.getCardTemplate(centerId);
            return SuccessResponse({ res, message: 'تم جلب قالب الكارت بنجاح', data: template });
        } catch (error) {
            next(error);
        }
    }

    static async updateCardTemplate(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const template = await CenterService.updateCardTemplate(centerId, req.body);
            return SuccessResponse({ res, message: 'تم حفظ إعدادات قالب الكارت بنجاح', data: template });
        } catch (error) {
            next(error);
        }
    }

    static async getBatchPrintCards(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const centerId = await CenterService.resolveCenter(user, CenterController.extractBranchId(req));
            const batchId = req.params.batchId as string;

            if (req.headers.accept?.includes('application/json') && !req.query.token) {
                const data = await CenterService.getBatchPrintCards(centerId, batchId);
                return SuccessResponse({ res, message: 'تم جلب كروت الطباعة بنجاح', data });
            }

            const mode = (req.query.mode as string) || 'dual_sided';
            const token = (req.query.token as string) || '';
            const html = await CardBatchPdfService.generateCenterBatchHtml(batchId, centerId, mode, token, req.query);
            res.setHeader('Content-Security-Policy',
                "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:;");
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(html);
        } catch (error) {
            next(error);
        }
    }
}

const router = Router();
router.use(authenticate);

// ── Center & Branch Management ───────────────────────────────────────────────
router.post('/onboard', authorizeRoles(UserRole.superAdmin), validate(onboardCenterSchema), CenterController.onboardCenter);
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

// ── Center Students ──────────────────────────────────────────────────────────
router.get('/students', authorizeRoles(UserRole.centerOwner, UserRole.centerSupervisor), CenterController.getStudents);
router.get('/students/:id', authorizeRoles(UserRole.centerOwner, UserRole.centerSupervisor), CenterController.getStudentById);
router.post('/students', requireCenterPermission('canManageStudents'), validate(createCenterStudentSchema), CenterController.createStudent);
router.post('/students/bulk', requireCenterPermission('canManageStudents'), validate(bulkCreateCenterStudentSchema), CenterController.bulkCreateStudents);
router.put('/students/:id', requireCenterPermission('canManageStudents'), validate(updateCenterStudentSchema), CenterController.updateStudent);
router.delete('/students/:id', requireCenterPermission('canManageStudents'), CenterController.deleteStudent);

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

// ── Gate Check-In Routes ────────────────────────────────────────────────────
router.post('/attendance/check-in', requireCenterPermission('canTakeAttendance'), validate(centerCheckInSchema), CenterController.checkInStudent);
router.put('/attendance/check-in/groups', requireCenterPermission('canTakeAttendance'), validate(updateCheckInGroupsSchema), CenterController.updateCheckInGroups);
router.get('/attendance/check-ins', requireCenterPermission('canViewAttendance'), CenterController.getDailyCheckIns);

// ── Financials & Payments ───────────────────────────────────────────────────
router.post('/financials/payment', requireCenterPermission('canRecordPayments'), CenterController.recordPayment);
router.get('/financials/summary', requireCenterPermission('canViewFinancials'), CenterController.getFinancialSummary);
router.get('/financials/daily-tally', requireCenterPermission('canViewFinancials'), CenterController.getDailyTally);
router.get('/financials/monthly-tally', requireCenterPermission('canViewFinancials'), CenterController.getMonthlyTally);
router.get('/financials/transactions', requireCenterPermission('canViewFinancials'), CenterController.getTransactions);
router.get('/financials/teacher/:teacherId', requireCenterPermission('canViewFinancials'), CenterController.getTeacherFinancialReport);
router.get('/financials/student/:studentId', requireCenterPermission('canViewFinancials'), CenterController.getStudentFinancialReport);

// ── Comprehensive Reports ───────────────────────────────────────────────────
router.get('/reports/overview', requireCenterPermission('canViewFinancials'), CenterController.getReportsOverview);
router.get('/reports/teachers', requireCenterPermission('canViewFinancials'), CenterController.getTeachersReport);
router.get('/reports/groups', requireCenterPermission('canViewAttendance'), CenterController.getGroupsReport);

// ── Smart Cards ─────────────────────────────────────────────────────────────
router.post('/cards/generate', requireCenterPermission('canManageStudents'), CenterController.generateCards);
router.get('/cards/stats', requireCenterPermission('canManageStudents'), CenterController.getCardsStats);
router.get('/cards', requireCenterPermission('canManageStudents'), CenterController.getCards);
router.get('/cards/resolve', requireCenterPermission('canManageStudents'), CenterController.resolveCard);
router.get('/cards/resolve/:scanInput', requireCenterPermission('canManageStudents'), CenterController.resolveCard);
router.post('/cards/link', requireCenterPermission('canManageStudents'), CenterController.linkCard);
router.post('/cards/create-and-link', requireCenterPermission('canManageStudents'), CenterController.createStudentAndLinkCard);
router.post('/cards/unlink', requireCenterPermission('canManageStudents'), CenterController.unlinkCard);
router.post('/cards/disable', requireCenterPermission('canManageStudents'), CenterController.disableCard);
router.get('/cards/template', requireCenterPermission('canManageStudents'), CenterController.getCardTemplate);
router.put('/cards/template', requireCenterPermission('canManageStudents'), CenterController.updateCardTemplate);
router.get('/cards/batch/:batchId/print', requireCenterPermission('canManageStudents'), CenterController.getBatchPrintCards);

export default router;
