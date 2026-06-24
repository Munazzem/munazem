import { Router } from 'express';
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
    static extractTeacherId(user) {
        if (user.role === UserRole.teacher)
            return user.userId;
        if (user.role === UserRole.assistant && user.teacherId)
            return user.teacherId;
        throw UnauthorizedException({ message: 'طبيعة الحساب غير صالحة للقيام بهذه العملية' });
    }
    static async createStudent(req, res, next) {
        try {
            const user = req.user;
            const teacherId = StudentController.extractTeacherId(user);
            const student = await StudentService.createStudent(teacherId, req.body);
            return SuccessResponse({ res, message: 'تم إضافة الطالب بنجاح', data: student, status: 201 });
        }
        catch (error) {
            next(error);
        }
    }
    static async getStudents(req, res, next) {
        try {
            const user = req.user;
            const teacherId = StudentController.extractTeacherId(user);
            const students = await StudentService.getStudentsByTeacherId(teacherId, req.query);
            return SuccessResponse({ res, message: 'تم جلب الطلاب بنجاح', data: students });
        }
        catch (error) {
            next(error);
        }
    }
    static async getStudentById(req, res, next) {
        try {
            const user = req.user;
            const teacherId = StudentController.extractTeacherId(user);
            const student = await StudentService.getStudentById(req.params.id, teacherId);
            return SuccessResponse({ res, message: 'تم جلب بيانات الطالب', data: student });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateStudent(req, res, next) {
        try {
            const user = req.user;
            const teacherId = StudentController.extractTeacherId(user);
            const updatedStudent = await StudentService.updateStudent(req.params.id, teacherId, req.body);
            return SuccessResponse({ res, message: 'تم تعديل بيانات الطالب بنجاح', data: updatedStudent });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteStudent(req, res, next) {
        try {
            const user = req.user;
            const teacherId = StudentController.extractTeacherId(user);
            await StudentService.deleteStudent(req.params.id, teacherId);
            return SuccessResponse({ res, message: 'تم مسح الطالب بنجاح' });
        }
        catch (error) {
            next(error);
        }
    }
    static async bulkCreateStudents(req, res, next) {
        try {
            const user = req.user;
            const teacherId = StudentController.extractTeacherId(user);
            const result = await StudentService.bulkCreateStudents(teacherId, req.body.students);
            return SuccessResponse({ res, message: `تم إضافة ${result.successCount} من ${result.total} طالب`, data: result, status: 201 });
        }
        catch (error) {
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
router.post('/', authorizeRoles(UserRole.assistant, UserRole.teacher), validate(createStudentSchema), StudentController.createStudent);
router.post('/bulk', authorizeRoles(UserRole.assistant, UserRole.teacher), validate(bulkCreateStudentsSchema), StudentController.bulkCreateStudents);
router.put('/:id', authorizeRoles(UserRole.assistant, UserRole.teacher), validate(updateStudentSchema), StudentController.updateStudent);
router.delete('/:id', authorizeRoles(UserRole.assistant, UserRole.teacher), StudentController.deleteStudent);
router.get('/', authorizeRoles(UserRole.teacher, UserRole.assistant), StudentController.getStudents);
router.get('/:id', authorizeRoles(UserRole.teacher, UserRole.assistant), StudentController.getStudentById);
export default router;
//# sourceMappingURL=students.controller.js.map