import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { StudentService } from './students.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { UnauthorizedException } from '../../common/utils/response/error.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createStudentSchema, updateStudentSchema, bulkCreateStudentsSchema } from '../../validation/student.validation.js';
import { UserRole } from '../../common/enums/enum.service.js';

class StudentController {
    
    // Helper to get the correct teacherId whether the user is a Teacher or an Assistant
    private static extractTeacherId(user: any): string {
        if (user.role === UserRole.teacher) return user.userId;
        if (user.role === UserRole.assistant && user.teacherId) return user.teacherId;
        throw UnauthorizedException({ message: 'طبيعة الحساب غير صالحة للقيام بهذه العملية' });
    }

    static async createStudent(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const teacherId = StudentController.extractTeacherId(user);
            const student = await StudentService.createStudent(teacherId, req.body);
            return SuccessResponse({ res, message: 'تم إضافة الطالب بنجاح', data: student, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    static async getStudents(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const teacherId = StudentController.extractTeacherId(user);
            const students = await StudentService.getStudentsByTeacherId(teacherId, req.query);
            return SuccessResponse({ res, message: 'تم جلب الطلاب بنجاح', data: students });
        } catch (error) {
            next(error);
        }
    }

    static async getStudentById(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const teacherId = StudentController.extractTeacherId(user);
            const student = await StudentService.getStudentById(req.params.id as string, teacherId);
            return SuccessResponse({ res, message: 'تم جلب بيانات الطالب', data: student });
        } catch (error) {
            next(error);
        }
    }

    static async updateStudent(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const teacherId = StudentController.extractTeacherId(user);
            const updatedStudent = await StudentService.updateStudent(req.params.id as string, teacherId, req.body);
            return SuccessResponse({ res, message: 'تم تعديل بيانات الطالب بنجاح', data: updatedStudent });
        } catch (error) {
            next(error);
        }
    }

    static async deleteStudent(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const teacherId = StudentController.extractTeacherId(user);
            await StudentService.deleteStudent(req.params.id as string, teacherId);
            return SuccessResponse({ res, message: 'تم مسح الطالب بنجاح' });
        } catch (error) {
            next(error);
        }
    }

    static async bulkCreateStudents(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const teacherId = StudentController.extractTeacherId(user);
            const result = await StudentService.bulkCreateStudents(teacherId, req.body.students);
            return SuccessResponse({ res, message: `تم إضافة ${result.successCount} من ${result.total} طالب`, data: result, status: 201 });
        } catch (error) {
            next(error);
        }
    }
}

const router = Router();
router.use(authenticate);

// ============================================
// CRITICAL ROLE SEGREGATION: 
// Assistants have Write permissions (POST, PUT, DELETE)
// Teachers and Assistants have Read permissions (GET)
// ============================================

router.post('/', authorizeRoles(UserRole.assistant), validate(createStudentSchema), StudentController.createStudent);
router.post('/bulk', authorizeRoles(UserRole.assistant), validate(bulkCreateStudentsSchema), StudentController.bulkCreateStudents);
router.put('/:id', authorizeRoles(UserRole.assistant), validate(updateStudentSchema), StudentController.updateStudent);
router.delete('/:id', authorizeRoles(UserRole.assistant), StudentController.deleteStudent);

router.get('/', authorizeRoles(UserRole.teacher, UserRole.assistant), StudentController.getStudents);
router.get('/:id', authorizeRoles(UserRole.teacher, UserRole.assistant), StudentController.getStudentById);

export default router;
