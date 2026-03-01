import Groq from 'groq-sdk';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);
const _pdfParseModule = _require('pdf-parse');
// pdf-parse v1 exports the function directly; v2 nests it under .default
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> =
    typeof _pdfParseModule === 'function'
        ? _pdfParseModule
        : (_pdfParseModule.default ?? _pdfParseModule);
import { ExamsService } from './exams.service.js';
import { ExamSource, QuestionType } from '../../common/enums/enum.service.js';
import { BadRequestException } from '../../common/utils/response/error.responce.js';
import { envVars } from '../../../config/env.service.js';

interface GenerateExamOptions {
    questionCount:    number;
    difficulty:       'easy' | 'medium' | 'hard' | 'mixed';
    questionTypes:    QuestionType[];
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

بناءً على المحتوى التعليمي التالي، أنشئ امتحاناً يحتوي على بالضبط ${options.questionCount} سؤال.

# المحتوى التعليمي:
${content.slice(0, 8000)}

# متطلبات الامتحان:
- عدد الأسئلة المطلوب بالضبط: ${options.questionCount} سؤال (لا أقل ولا أكثر)
- مستوى الصعوبة: ${options.difficulty}
- أنواع الأسئلة المطلوبة:
  - ${typesText}
- درجة كل سؤال: ${options.marksPerQuestion ?? 2}

# تعليمات مهمة:
1. أعد الإجابة كـ JSON صالح فقط — بدون أي نص إضافي قبله أو بعده.
2. يجب أن يحتوي مصفوفة "questions" على ${options.questionCount} عنصر بالضبط.
3. الصيغة المطلوبة (هذا مثال فقط، لا تعده كسؤال):
{
  "questions": [
    {
      "type": "MCQ",
      "text": "نص السؤال هنا",
      "marks": ${options.marksPerQuestion ?? 2},
      "options": ["أ. الخيار الأول", "ب. الخيار الثاني", "ج. الخيار الثالث", "د. الخيار الرابع"],
      "correctAnswer": "أ. الخيار الأول"
    }
  ]
}
4. اكتب الأسئلة باللغة العربية.
5. تأكد أن الأسئلة مرتبطة بالمحتوى التعليمي المُعطى.
6. تذكر: العدد المطلوب هو ${options.questionCount} سؤال بالضبط.
`.trim();
}

// ── AI Exam Service (Groq) ────────────────────────────────────────
export class AIExamService {

    static async generateFromPDF(
        teacherId: string,
        pdfBuffer: Buffer,
        examMeta: {
            title:        string;
            date:         string;
            passingMarks: number;
            gradeLevel?:  string;
            groupIds?:    string[];
        },
        options: GenerateExamOptions
    ) {
        // 1. Extract text from PDF
        const pdfData = await pdfParse(pdfBuffer);
        const content = pdfData.text?.trim();
        if (!content || content.length < 50) {
            throw BadRequestException({ message: 'لم يتم العثور على نص كافٍ في الـ PDF' });
        }

        // 2. Call Groq API
        const apiKey = envVars.groqApiKey;
        if (!apiKey) throw BadRequestException({ message: 'مفتاح Groq API غير مُهيأ' });

        const groq = new Groq({ apiKey });

        const completion = await groq.chat.completions.create({
            model:       'llama-3.3-70b-versatile',  // free, fast, great Arabic support
            messages: [
                {
                    role:    'system',
                    content: 'أنت مساعد تعليمي. أجب بـ JSON صالح فقط بدون أي نص إضافي.',
                },
                {
                    role:    'user',
                    content: buildPrompt(content, options),
                },
            ],
            temperature:  0.7,
            max_tokens:   4096,
            response_format: { type: 'json_object' },  // Groq enforces JSON output
        });

        const text = completion.choices[0]?.message?.content ?? '';

        // 3. Parse AI response
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

        // 3b. Normalize question types — AI sometimes returns short aliases
        const typeAliasMap: Record<string, string> = {
            'TF':          'TRUE_FALSE',
            'TRUE-FALSE':  'TRUE_FALSE',
            'TRUE/FALSE':  'TRUE_FALSE',
            'TRUEFALSE':   'TRUE_FALSE',
            'BOOL':        'TRUE_FALSE',
            'BOOLEAN':     'TRUE_FALSE',
            'essay':       'ESSAY',
            'OPEN':        'ESSAY',
            'OPEN_ENDED':  'ESSAY',
            'mcq':         'MCQ',
            'MULTIPLE_CHOICE': 'MCQ',
            'MULTIPLE-CHOICE': 'MCQ',
        };

        parsed.questions = parsed.questions.map((q: any) => ({
            ...q,
            type: typeAliasMap[q.type] ?? (q.type as string)?.toUpperCase() ?? q.type,
        }));

        // 4. Compute totalMarks
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
