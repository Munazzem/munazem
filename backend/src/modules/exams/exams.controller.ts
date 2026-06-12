import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ExamsService }  from './exams.service.js';
import { AIExamService } from './ai-exam.service.js';
import { UserRole, QuestionType } from '../../common/enums/enum.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { BadRequestException } from '../../common/utils/response/error.responce.js';
import { envVars } from '../../../config/env.service.js';
import { authenticate }    from '../../middlewares/auth.middleware.js';
import { authorizeRoles }  from '../../middlewares/roles.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createExamSchema, recordResultSchema, batchResultsSchema } from '../../validation/exam.validation.js';
import multer from 'multer';
import type { IJwtPayload } from '../../types/auth.types.js';

const examsRouter = Router();
examsRouter.use(authenticate);

// Multer — memory storage (no disk write)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

const resolveTeacherId = (user?: IJwtPayload): string => {
    if (!user) return '';
    return user.role === UserRole.assistant ? (user.teacherId || '') : user.userId;
};

// ════════ EXAM CRUD ════════════════════════════════════════════════

// POST /exams — Create exam manually (Teacher + Assistant)
examsRouter.post(
    '/',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(createExamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId(req.user);
            const exam = await ExamsService.createExam(teacherId, req.body);
            return SuccessResponse({ res, data: exam, message: 'تم إنشاء الامتحان بنجاح', status: 201 });
        } catch (error) { next(error); }
    }
);

// GET /exams?status=DRAFT&gradeLevel=... — List exams (Teacher + Assistant)
examsRouter.get(
    '/',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId(req.user);
            const result = await ExamsService.getExams(teacherId, req.query);
            return SuccessResponse({ res, data: result, message: 'تم جلب الامتحانات بنجاح' });
        } catch (error) { next(error); }
    }
);

// GET /exams/:id — Get single exam
examsRouter.get(
    '/:id',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId(req.user);
            const exam = await ExamsService.getExamById(req.params['id'] as string, teacherId);
            return SuccessResponse({ res, data: exam, message: 'تم جلب الامتحان بنجاح' });
        } catch (error) { next(error); }
    }
);

// PUT /exams/:id — Update exam (Teacher + Assistant, DRAFT only)
examsRouter.put(
    '/:id',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId(req.user);
            const exam = await ExamsService.updateExam(req.params['id'] as string, teacherId, req.body);
            return SuccessResponse({ res, data: exam, message: 'تم تعديل الامتحان بنجاح' });
        } catch (error) { next(error); }
    }
);

// PATCH /exams/:id/publish — Publish exam (Teacher + Assistant)
examsRouter.patch(
    '/:id/publish',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId(req.user);
            const exam = await ExamsService.publishExam(req.params['id'] as string, teacherId);
            return SuccessResponse({ res, data: exam, message: 'تم نشر الامتحان بنجاح — يمكن الآن إدخال الدرجات' });
        } catch (error) { next(error); }
    }
);

// DELETE /exams/:id — Delete DRAFT exam (Teacher + Assistant)
examsRouter.delete(
    '/:id',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId(req.user);
            await ExamsService.deleteExam(req.params['id'] as string, teacherId);
            return SuccessResponse({ res, data: null, message: 'تم حذف الامتحان بنجاح' });
        } catch (error) { next(error); }
    }
);

// ════════ RESULTS ══════════════════════════════════════════════════

// POST /exams/:id/results — Record single student result (Teacher + Assistant)
examsRouter.post(
    '/:id/results',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(recordResultSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) return next(BadRequestException({ message: 'المستخدم غير موجود' }));
            const teacherId = resolveTeacherId(user);
            const result = await ExamsService.recordResult(teacherId, user.userId, {
                examId:    req.params['id'] as string,
                studentId: req.body.studentId,
                score:     Number(req.body.score),
            });
            return SuccessResponse({ res, data: result, message: 'تم تسجيل درجة الطالب بنجاح', status: 201 });
        } catch (error) { next(error); }
    }
);

// POST /exams/:id/results/batch — Batch record results (Teacher + Assistant)
examsRouter.post(
    '/:id/results/batch',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(batchResultsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user;
            if (!user) return next(BadRequestException({ message: 'المستخدم غير موجود' }));
            const teacherId = resolveTeacherId(user);
            const result = await ExamsService.batchRecordResults(teacherId, user.userId, {
                examId:  req.params['id'] as string,
                results: req.body.results,
            });
            return SuccessResponse({ res, data: result, message: `تم تسجيل ${result.inserted} درجة من أصل ${result.total}` });
        } catch (error) { next(error); }
    }
);

// GET /exams/:id/results — Get all results for an exam
examsRouter.get(
    '/:id/results',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId(req.user);
            const data = await ExamsService.getExamResults(req.params['id'] as string, teacherId);
            return SuccessResponse({ res, data, message: 'تم جلب نتائج الامتحان بنجاح' });
        } catch (error) { next(error); }
    }
);

// ════════ AI EXAM GENERATION ═══════════════════════════════════════

// POST /exams/ai/generate — Upload PDF + generate exam (Teacher + Assistant)
examsRouter.post(
    '/ai/generate',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    upload.single('pdf'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId(req.user);
            if (!req.file) {
                return next(new Error('الرجاء رفع ملف PDF'));
            }

            const {
                title, date, passingMarks, gradeLevel, groupIds,
                questionCount, difficulty, questionTypes, marksPerQuestion,
            } = req.body;

            const types: QuestionType[] = Array.isArray(questionTypes)
                ? questionTypes
                : [questionTypes ?? QuestionType.MCQ];

            const result = await AIExamService.generateFromPDF(
                teacherId,
                req.file.buffer,
                {
                    title,
                    date,
                    passingMarks: Number(passingMarks),
                    ...(gradeLevel ? { gradeLevel } : {}),
                    ...(groupIds   ? { groupIds: Array.isArray(groupIds) ? groupIds : [groupIds] } : {}),
                },
                {
                    questionCount:    Number(questionCount) || 10,
                    difficulty:       difficulty ?? 'mixed',
                    questionTypes:    types,
                    marksPerQuestion: Number(marksPerQuestion) || 2,
                }
            );
            return SuccessResponse({ res, data: result, message: result.message, status: 201 });
        } catch (error) { next(error); }
    }
);

export default examsRouter;

// ════════ AI PROXY (lightweight — no PDF, no DB) ═══════════════════
// The frontend parses the PDF and sends the extracted text.
// This endpoint just forwards the prompt to Groq and returns the AI
// response.  No file upload, no DB writes — minimal server load.
import Groq from 'groq-sdk';

const aiProxyRouter = Router();
aiProxyRouter.use(authenticate);

aiProxyRouter.post(
    '/',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const apiKey = envVars.groqApiKey;
            if (!apiKey) {
                return next(BadRequestException({ message: 'مفتاح Groq API غير مُهيأ في السيرفر' }));
            }

            const { prompt } = req.body;
            if (!prompt || typeof prompt !== 'string') {
                return next(BadRequestException({ message: 'الحقل prompt مطلوب وصالح' }));
            }

            const groq = new Groq({ apiKey });

            const completion = await groq.chat.completions.create({
                model:       'llama-3.3-70b-versatile',
                messages: [
                    {
                        role:    'system',
                        content: 'أنت مساعد تعليمي. أجب بـ JSON صالح فقط بدون أي نص إضافي.',
                    },
                    { role: 'user', content: prompt },
                ],
                temperature:     0.7,
                max_tokens:      4096,
                response_format: { type: 'json_object' },
            });

            const text = completion.choices[0]?.message?.content ?? '';
            return SuccessResponse({ res, data: { text }, message: 'تم توليد الأسئلة بنجاح' });
        } catch (error: any) {
            // Check for specific API HTTP errors
            if (error.status === 429) {
                return next(BadRequestException({ 
                    message: 'تجاوزت الحد الأقصى المسموح به لتوليد الامتحانات بالذكاء الاصطناعي (Rate Limit)، يرجى الانتظار دقيقة والمحاولة مجدداً.' 
                }));
            }
            if (error.status === 401 || error.status === 403) {
                return next(BadRequestException({ 
                    message: 'حدث خطأ في صلاحيات ومفتاح الـ API الخاص بـ Groq. يرجى التواصل مع إدارة النظام.' 
                }));
            }
            // Fallback for general errors
            const errMsg = error.message || 'حدث خطأ غير متوقع أثناء الاتصال بالذكاء الاصطناعي';
            return next(BadRequestException({ 
                message: `فشل توليد الامتحان: ${errMsg}` 
            }));
        }
    }
);

export { aiProxyRouter };
