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
import { ExamSource, QuestionType, SubscriptionStatus, SubscriptionPlan } from '../../common/enums/enum.service.js';
import { BadRequestException } from '../../common/utils/response/error.responce.js';
import { envVars } from '../../../config/env.service.js';
import { SubscriptionModel } from '../../database/models/subscription.model.js';

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

    let difficultyInstruction = '';
    if (options.difficulty === 'hard') {
        difficultyInstruction = `
- مستوى الصعوبة: أسئلة صعبة ومستويات تفكير عليا (High-Order Thinking Skills).
- تجنب تماماً الأسئلة المباشرة أو أسئلة الحفظ والتسميع السطحي (مثل: "في أي عام..." أو "ما هو تعريف...").
- ركز على الأسئلة "اللافّة" وغير المباشرة التي تختبر الفهم العميق، الاستنتاج، التحليل، المقارنة بين المفاهيم، والربط بين أجزاء الدرس.
- اجعل خيارات الإجابة (المشتتات / Distractors) متقاربة جداً وذكية ومنطقية بحيث تحاكي الأخطاء المفاهيمية الشائعة للطلاب وتتطلب تركيزاً دقيقاً للتمييز بينها.
- استخدم صيغاً ذكية مثل: "أي العبارات الآتية تفسر بدقة..."، "النتيجة المترتبة على..."، "الرابط الأساسي بين... و..."، "كل ما يلي صحيح ما عدا...".
`.trim();
    } else if (options.difficulty === 'mixed') {
        difficultyInstruction = `
- مستوى الصعوبة: متدرج ومختلط (مستويات تفكير متعددة تحاكي نظام الامتحانات الحديثة):
  1. 30% من الأسئلة: أسئلة فهم وتطبيق مباشر للمفاهيم الأساسية.
  2. 40% من الأسئلة: أسئلة متوسطة تعتمد على التحليل والربط بين نقاط الدرس واستيعاب العلاقات والنتائج.
  3. 30% من الأسئلة: أسئلة ذكاء ومستويات تفكير عليا وأسئلة "لافّة" غير مباشرة (تعتمد على الاستنتاج، قراءة ما بين السطور، واستبعاد الخيارات المتقاربة جداً).
- اجعل خيارات الإجابة (المشتتات) ذكية ومنطقية ومتقاربة ومرتبطة بالمحتوى، وتجنب الخيارات الساذجة أو الواضحة البطلان فوراً.
`.trim();
    } else if (options.difficulty === 'medium') {
        difficultyInstruction = `
- مستوى الصعوبة: متوسط ومتوازن (فهم واستيعاب وتطبيق).
- تجنب الأسئلة التافهة أو المباشرة جداً، وركز على فهم العلاقات، أسباب الظواهر، وتطبيق القواعد أو المعلومات على أمثلة وحالات واقعية.
- اجعل الخيارات المتاحة في الاختياري مقنعة ومنطقية.
`.trim();
    } else if (options.difficulty === 'easy') {
        difficultyInstruction = `
- مستوى الصعوبة: سهل ومباشر.
- يركز على تذكر المفاهيم والتعريفات الأساسية والحقائق الواضحة المذكورة في النص بشكل مباشر وميسر.
`.trim();
    }

    return `
أنت خبير تربوي أول ومتخصص في وضع امتحانات دقيقة ومحكمة تقيس نواتج التعلم ومستويات التفكير العليا (مثل امتحانات الثانوية العامة والشهادات الدولية).

بناءً على المحتوى التعليمي التالي، أنشئ امتحاناً احترافياً يحتوي على بالضبط ${options.questionCount} سؤال.

# المحتوى التعليمي:
${content.slice(0, 8000)}

# متطلبات الامتحان:
- عدد الأسئلة المطلوب بالضبط: ${options.questionCount} سؤال (لا أقل ولا أكثر)
- تعليمات الصعوبة والعمق:
${difficultyInstruction}
- أنواع الأسئلة المطلوبة:
  - ${typesText}
- درجة كل سؤال: ${options.marksPerQuestion ?? 2}

# معايير جودة الأسئلة والخيارات:
1. الأسئلة الاختيارية (MCQ):
   - يجب أن يحتوي كل سؤال على بالضبط 4 خيارات حقيقية ومدروسة.
   - شرط أساسي صارم جداً: يجب أن تكون جميع الخيارات الأربعة فريدة ومختلفة تماماً عن بعضها البعض! يُمنع منعاً باتاً تكرار نفس الخيار أو نفس نص الإجابة مرتين في نفس السؤال تحت أي ظرف (All options MUST be strictly unique and distinct; NEVER repeat the same text in options).
   - يجب أن تكون هناك إجابة صحيحة واحدة فقط لا غير، وتحديد نصها بدقة متناهية في حقل "correctAnswer" بحيث يطابق نص ذلك الخيار بالحرف الواحد.
   - المشتتات (الخيارات الخاطئة) يجب أن تكون قوية ومقنعة ومبنية على التفكير الخاطئ الشائع للطلاب، بحيث يضطر الطالب للتفكير والتحليل قبل الاختيار، وتجنب الخيارات السطحية.
2. أسئلة صح أم خطأ (إن طُلبت):
   - تجنب العبارات البديهية جداً، واجعل العبارات تختبر الفروق الدقيقة والمفاهيم التي قد تلتبس على الطالب.
3. التنوع والعمق:
   - ابتعد عن الأسئلة النمطية التافهة، وركز على الربط والاستنتاج والتفكير النقدي.

# تعليمات الإخراج:
1. اكتب الأسئلة والإجابات باللغة العربية.
2. أعد الإجابة كـ JSON صالح فقط — بدون أي نص إضافي أو شروحات قبله أو بعده.
3. يجب أن يحتوي مصفوفة "questions" على ${options.questionCount} عنصر بالضبط.
4. الصيغة المطلوبة (هذا هيكل توضيحي فقط):
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
5. تأكد أن الأسئلة مرتبطة ارتباطاً وثيقاً بالمحتوى التعليمي المُعطى ولا تخرج عنه.
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
        if (!envVars.enableAIExams) {
            throw BadRequestException({
                message: 'ميزة توليد الامتحانات بالذكاء الاصطناعي متاحة في الخطة المدفوعة فقط حالياً',
            });
        }

        const activeSubscription = await SubscriptionModel.findOne({
            teacherId,
            status: SubscriptionStatus.ACTIVE,
            endDate: { $gt: new Date() },
        }).sort({ endDate: -1 }).lean();

        if (!activeSubscription || activeSubscription.planTier !== SubscriptionPlan.PREMIUM) {
            throw BadRequestException({
                message: 'ميزة توليد الامتحانات بالذكاء الاصطناعي متاحة فقط في الباقة المتميزة',
            });
        }

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

        const modelsToTry = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'allam-2-7b'];
        let completion: any = null;
        let lastErr: any = null;

        for (const model of modelsToTry) {
            try {
                completion = await groq.chat.completions.create({
                    model,
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
                    response_format: { type: 'json_object' },
                });
                if (completion?.choices?.[0]?.message?.content) {
                    break;
                }
            } catch (err: any) {
                lastErr = err;
                continue;
            }
        }

        if (!completion?.choices?.[0]?.message?.content) {
            throw lastErr || new Error('فشل توليد الامتحان من نماذج الذكاء الاصطناعي');
        }

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
