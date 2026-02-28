import { GoogleGenerativeAI } from '@google/generative-ai';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;
import { ExamsService } from './exams.service.js';
import { ExamSource, QuestionType } from '../../common/enums/enum.service.js';
import { BadRequestException } from '../../common/utils/response/error.responce.js';
import { envVars } from '../../../config/env.service.js';

interface GenerateExamOptions {
    questionCount:  number;
    difficulty:     'easy' | 'medium' | 'hard' | 'mixed';
    questionTypes:  QuestionType[];   // ['MCQ', 'TRUE_FALSE', 'ESSAY']
    marksPerQuestion?: number;
}

// ── Prompt builder ────────────────────────────────────────────────
function buildPrompt(content: string, options: GenerateExamOptions): string {
    const typeMap: Record<QuestionType, string> = {
        [QuestionType.MCQ]:        'اختيار من متعدد (4 خيارات أ/ب/ج/د مع تحديد الإجابة الصحيحة)',
        [QuestionType.TRUE_FALSE]: 'صح وخطأ (correctAnswer: "صح" أو "خطأ")',
        [QuestionType.ESSAY]:      'مقالي مفتوح (بدون correctAnswer)',
    };
    const typesText = options.questionTypes.map(t => typeMap[t]).join('\n  - ');

    return `
أنت مساعد تعليمي متخصص في إنشاء اختبارات أكاديمية.

بناءً على المحتوى التعليمي التالي، أنشئ امتحاناً يحتوي على ${options.questionCount} سؤال.

# المحتوى التعليمي:
${content.slice(0, 8000)}

# متطلبات الامتحان:
- عدد الأسئلة: ${options.questionCount}
- مستوى الصعوبة: ${options.difficulty}
- أنواع الأسئلة المطلوبة:
  - ${typesText}
- درجة كل سؤال: ${options.marksPerQuestion ?? 2}

# تعليمات مهمة:
1. أعد الإجابة كـ JSON صالح فقط — بدون أي نص إضافي قبله أو بعده.
2. الصيغة المطلوبة بالضبط:
{
  "questions": [
    {
      "type": "MCQ",
      "text": "نص السؤال",
      "marks": 2,
      "options": ["أ. الخيار الأول", "ب. الخيار الثاني", "ج. الخيار الثالث", "د. الخيار الرابع"],
      "correctAnswer": "أ. الخيار الأول"
    },
    {
      "type": "TRUE_FALSE",
      "text": "عبارة للحكم عليها",
      "marks": 2,
      "correctAnswer": "صح"
    },
    {
      "type": "ESSAY",
      "text": "سؤال مقالي",
      "marks": 5
    }
  ]
}
3. اكتب الأسئلة باللغة العربية.
4. تأكد أن الأسئلة مرتبطة بالمحتوى التعليمي المُعطى.
`.trim();
}

// ── AI Exam Service ───────────────────────────────────────────────
export class AIExamService {

    static async generateFromPDF(
        teacherId: string,
        pdfBuffer: Buffer,
        examMeta: {
            title: string;
            date: string;
            passingMarks: number;
            gradeLevel?: string;
            groupIds?: string[];
        },
        options: GenerateExamOptions
    ) {
        // 1. Extract text from PDF
        const pdfData = await pdfParse(pdfBuffer);
        const content = pdfData.text?.trim();
        if (!content || content.length < 50) {
            throw BadRequestException({ message: 'لم يتم العثور على نص كافٍ في الـ PDF' });
        }

        // 2. Call Gemini API
        const apiKey = envVars.geminiApiKey;
        if (!apiKey) throw BadRequestException({ message: 'مفتاح Gemini API غير مُهيأ' });

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = buildPrompt(content, options);
        const result = await model.generateContent(prompt);
        const text   = result.response.text();

        // 3. Parse AI response — strip markdown fences if present
        let parsed: { questions: any[] };
        try {
            const clean = text.replace(/```json|```/g, '').trim();
            parsed = JSON.parse(clean);
        } catch {
            throw BadRequestException({ message: 'فشل في تحليل استجابة الذكاء الاصطناعي — حاول مجدداً' });
        }

        if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
            throw BadRequestException({ message: 'لم يُولِّد الذكاء الاصطناعي أسئلة — حاول مجدداً' });
        }

        // 4. Compute totalMarks from questions
        const totalMarks = parsed.questions.reduce((sum: number, q: any) => sum + (q.marks ?? 2), 0);

        // 5. Save as DRAFT exam
        const exam = await ExamsService.createExam(teacherId, {
            title:        examMeta.title,
            date:         examMeta.date,
            totalMarks,
            passingMarks: examMeta.passingMarks,
            questions:    parsed.questions,
            source:       ExamSource.AI_GENERATED,
            ...(examMeta.gradeLevel ? { gradeLevel: examMeta.gradeLevel } : {}),
            ...(examMeta.groupIds?.length ? { groupIds: examMeta.groupIds } : {}),
        });

        return {
            exam,
            message: `تم توليد ${parsed.questions.length} سؤال بنجاح — راجع الامتحان واعتمده أو احذفه`,
        };
    }
}
