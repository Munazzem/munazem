'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, Sparkles, X, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { aiProxy, createExam } from '@/lib/api/exams';
import { fetchGroups } from '@/lib/api/groups';
import { useAuthStore } from '@/lib/store/auth.store';
import { getAllowedGrades } from '@/lib/utils/grades';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface Props {
    open:         boolean;
    onOpenChange: (v: boolean) => void;
}

const DIFFICULTIES = [
    { value: 'easy',   label: 'سهل' },
    { value: 'medium', label: 'متوسط' },
    { value: 'hard',   label: 'صعب' },
    { value: 'mixed',  label: 'مختلط' },
];

const QUESTION_TYPES = [
    { value: 'MCQ',        label: 'اختيار من متعدد' },
    { value: 'TRUE_FALSE', label: 'صح أم خطأ' },
    { value: 'ESSAY',      label: 'مقالي' },
];

// ── Prompt builder (moved from backend) ──────────────────────────────────────
function buildPrompt(content: string, options: {
    questionCount: number;
    difficulty: string;
    questionTypes: string[];
    marksPerQuestion: number;
    language: string;
}): string {
    const typeMap: Record<string, string> = {
        MCQ:        'اختيار من متعدد (4 خيارات أ/ب/ج/د مع تحديد الإجابة الصحيحة)',
        TRUE_FALSE: 'صح وخطأ (correctAnswer: "صح" أو "خطأ")',
        ESSAY:      'مقالي مفتوح (بدون correctAnswer)',
    };
    const typesText = options.questionTypes.map(t => typeMap[t] ?? t).join('\n  - ');

    const languageInstruction = options.language === 'English' 
        ? 'Write all questions, options, and answers entirely in English.'
        : options.language === 'French'
        ? 'Write all questions, options, and answers entirely in French.'
        : 'اكتب جميع الأسئلة والخيارات والإجابات باللغة العربية.';

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
- درجة كل سؤال: ${options.marksPerQuestion}

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
1. ${languageInstruction}
2. أعد الإجابة كـ JSON صالح فقط — بدون أي نص إضافي أو شروحات قبله أو بعده.
3. يجب أن يحتوي مصفوفة "questions" على ${options.questionCount} عنصر بالضبط.
4. الصيغة المطلوبة (هذا هيكل توضيحي فقط):
{
  "questions": [
    {
      "type": "MCQ",
      "text": "نص السؤال هنا",
      "marks": ${options.marksPerQuestion},
      "options": ["الخيار الأول", "الخيار الثاني", "الخيار الثالث", "الخيار الرابع"],
      "correctAnswer": "الخيار الأول"
    }
  ]
}
5. تأكد أن الأسئلة مرتبطة ارتباطاً وثيقاً بالمحتوى التعليمي المُعطى ولا تخرج عنه.
6. تذكر: العدد المطلوب هو ${options.questionCount} سؤال بالضبط.
`.trim();
}

// ── Type alias normalization ─────────────────────────────────────────────────
const typeAliasMap: Record<string, string> = {
    'TF':              'TRUE_FALSE',
    'TRUE-FALSE':      'TRUE_FALSE',
    'TRUE/FALSE':      'TRUE_FALSE',
    'TRUEFALSE':       'TRUE_FALSE',
    'BOOL':            'TRUE_FALSE',
    'BOOLEAN':         'TRUE_FALSE',
    'ESSAY':           'ESSAY',
    'OPEN':            'ESSAY',
    'OPEN_ENDED':      'ESSAY',
    'MCQ':             'MCQ',
    'MULTIPLE_CHOICE': 'MCQ',
    'MULTIPLE-CHOICE': 'MCQ',
    'MULTIPLE CHOICE': 'MCQ',
    'اختيار من متعدد': 'MCQ',
    'صح وخطأ':         'TRUE_FALSE',
    'صح أم خطأ':       'TRUE_FALSE',
    'مقالي':           'ESSAY',
    'مقالي مفتوح':     'ESSAY',
    'اختياري':         'MCQ',
};

function normalizeType(rawType: string): string {
    if (!rawType) return 'MCQ';
    const t = String(rawType).trim().toUpperCase();
    
    // Direct match
    if (t === 'MCQ' || t === 'TRUE_FALSE' || t === 'ESSAY') return t;
    
    // Alias match
    if (typeAliasMap[t]) return typeAliasMap[t];
    const originalTrimmed = String(rawType).trim();
    if (typeAliasMap[originalTrimmed]) return typeAliasMap[originalTrimmed];

    // Keyword matching fallback
    if (t.includes('MCQ') || t.includes('MULTIPLE') || t.includes('اختيار') || t.includes('متعدد') || t.includes('CHOICE')) return 'MCQ';
    if (t.includes('TRUE') || t.includes('FALSE') || t.includes('صح') || t.includes('خطأ') || t.includes('TF')) return 'TRUE_FALSE';
    if (t.includes('ESSAY') || t.includes('OPEN') || t.includes('مقال')) return 'ESSAY';

    // Ultimate default to prevent validation crash
    return 'MCQ';
}

export function AIGenerateExamModal({ open, onOpenChange }: Props) {
    const user = useAuthStore((s) => s.user);
    const allowedGrades = getAllowedGrades(user?.stages);
    const router = useRouter();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [file,             setFile]             = useState<File | null>(null);
    const [title,            setTitle]            = useState('');
    const [date,             setDate]             = useState('');
    const [passingMarksOverride, setPassingMarksOverride] = useState('');
    const [gradeLevel,       setGradeLevel]       = useState('');
    const [selectedGroups,   setSelectedGroups]   = useState<string[]>([]);
    const [questionCount,    setQuestionCount]    = useState<string>('');
    const [difficulty,       setDifficulty]       = useState('');
    const [language,         setLanguage]         = useState('Arabic');
    const [selectedTypes,    setSelectedTypes]    = useState<string[]>([]);
    const [marksPerQuestion, setMarksPerQuestion] = useState<string>('');
    const [totalMarksInput,  setTotalMarksInput]  = useState<string>('');
    const [statusText,       setStatusText]       = useState('');

    const resetForm = () => {
        setFile(null);
        setTitle('');
        setDate('');
        setPassingMarksOverride('');
        setGradeLevel('');
        setSelectedGroups([]);
        setQuestionCount('');
        setDifficulty('');
        setLanguage('Arabic');
        setSelectedTypes([]);
        setMarksPerQuestion('');
        setTotalMarksInput('');
        setStatusText('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleQuestionCountChange = (val: string) => {
        setQuestionCount(val);
        const qNum = Number(val);
        const mNum = Number(marksPerQuestion);
        const tNum = Number(totalMarksInput);
        if (qNum > 0 && mNum > 0) {
            setTotalMarksInput(String(qNum * mNum));
        } else if (qNum > 0 && tNum > 0) {
            setMarksPerQuestion(String(Math.max(1, Math.round(tNum / qNum))));
        }
    };

    const handleMarksPerQuestionChange = (val: string) => {
        setMarksPerQuestion(val);
        const mNum = Number(val);
        const qNum = Number(questionCount);
        if (mNum > 0 && qNum > 0) {
            setTotalMarksInput(String(qNum * mNum));
        }
    };

    const handleTotalMarksChange = (val: string) => {
        setTotalMarksInput(val);
        const tNum = Number(val);
        const qNum = Number(questionCount);
        if (tNum > 0 && qNum > 0) {
            const perQ = Math.max(1, Math.round(tNum / qNum));
            setMarksPerQuestion(String(perQ));
        }
    };

    const { data: groupsData } = useQuery({
        queryKey: ['groups'],
        queryFn: () => fetchGroups({ limit: 100 }),
    });
    const groups = (groupsData as any)?.data ?? (groupsData as any) ?? [];

    const mutation = useMutation({
        mutationFn: async () => {
            if (!file) throw new Error('اختر ملف PDF أولاً');
            if (!title.trim()) throw new Error('أدخل عنوان الامتحان');
            if (!date) throw new Error('أدخل التاريخ');
            if (!difficulty) throw new Error('اختر مستوى الصعوبة');
            if (selectedTypes.length === 0) throw new Error('اختر نوعاً واحداً على الأقل من أنواع الأسئلة');

            const qCount = Number(questionCount);
            if (!qCount || qCount < 1) throw new Error('أدخل عدد الأسئلة المطلوب');

            const totalMarksNum = Number(totalMarksInput);
            if (!totalMarksNum || totalMarksNum < 1) throw new Error('أدخل الدرجة الكلية للامتحان');

            const mPerQ = Number(marksPerQuestion) || Math.max(1, Math.round(totalMarksNum / qCount));

            // Step 1: Parse PDF on the client
            setStatusText('جاري قراءة ملف الـ PDF...');
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ');
                fullText += pageText + '\n';
            }

            if (fullText.trim().length < 50) {
                throw new Error('لم يتم العثور على نص كافٍ في الـ PDF');
            }

            // Step 2: Build prompt and send to proxy
            setStatusText('جاري توليد الأسئلة بالذكاء الاصطناعي...');
            const prompt = buildPrompt(fullText, {
                questionCount: qCount,
                difficulty,
                questionTypes: selectedTypes,
                marksPerQuestion: mPerQ,
                language,
            });

            const { text: aiResponse } = await aiProxy(prompt);

            // Step 3: Parse AI response
            setStatusText('جاري تحليل الاستجابة...');
            let parsed: { questions: any[] };
            try {
                const clean = aiResponse.replace(/```json|```/g, '').trim();
                parsed = JSON.parse(clean);
            } catch {
                throw new Error('فشل في تحليل استجابة الذكاء الاصطناعي — حاول مجدداً');
            }

            if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
                throw new Error('لم يُولِّد الذكاء الاصطناعي أسئلة — حاول مجدداً');
            }

            // Normalize types and ensure unique options without duplicate text
            parsed.questions = parsed.questions.map((q: any) => {
                const type = normalizeType(q.type);
                if (type === 'MCQ' && Array.isArray(q.options)) {
                    const seen = new Set<string>();
                    const uniqueOptions: string[] = [];
                    for (const raw of q.options) {
                        const opt = String(raw ?? '').trim();
                        if (!opt) continue;
                        const key = opt.toLowerCase();
                        if (!seen.has(key)) {
                            seen.add(key);
                            uniqueOptions.push(opt);
                        }
                    }

                    let correctAnswer = String(q.correctAnswer ?? '').trim();
                    const matched = uniqueOptions.find(o => o.toLowerCase() === correctAnswer.toLowerCase());
                    if (matched) {
                        correctAnswer = matched;
                    } else if (uniqueOptions.length > 0) {
                        correctAnswer = uniqueOptions[0];
                    }

                    return {
                        ...q,
                        type,
                        options: uniqueOptions,
                        correctAnswer,
                    };
                }
                return {
                    ...q,
                    type,
                };
            });

            // Step 4: Create exam via existing API
            setStatusText('جاري حفظ الامتحان...');
            const autoPassingMarks = passingMarksOverride.trim()
                ? Number(passingMarksOverride)
                : Math.round(totalMarksNum * 0.5);

            const exam = await createExam({
                title,
                date,
                totalMarks:   totalMarksNum,
                passingMarks: autoPassingMarks,
                questions:    parsed.questions,
                source:       'AI_GENERATED' as any,
                ...(gradeLevel ? { gradeLevel } : {}),
                ...(selectedGroups.length > 0 ? { groupIds: selectedGroups } : {}),
            });

            return {
                exam,
                message: `تم توليد ${parsed.questions.length} سؤال بنجاح — راجع الامتحان واعتمده أو احذفه`,
            };
        },
        onSuccess: (res) => {
            setStatusText('');
            toast.success(res.message);
            queryClient.invalidateQueries({ queryKey: ['exams'] });
            onOpenChange(false);
            router.push(`/exams/${res.exam._id}`);
        },
        onError: (err: any) => {
            setStatusText('');
            // Handled globally
        },
    });

    const toggleGroup = (id: string) =>
        setSelectedGroups((prev) => prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]);

    const toggleType = (t: string) =>
        setSelectedTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.type !== 'application/pdf') { toast.error('الملف يجب أن يكون PDF'); return; }
        if (f.size > 10 * 1024 * 1024)   { toast.error('حجم الملف يجب أن يكون أقل من 10 MB'); return; }
        setFile(f);
    };

    const handleDialogChange = (v: boolean) => {
        if (!v) resetForm();
        onOpenChange(v);
    };

    return (
        <Dialog open={open} onOpenChange={handleDialogChange}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold border-b pb-3 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        توليد امتحان بالذكاء الاصطناعي
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* PDF Upload */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">ملف PDF *</label>
                        {file ? (
                            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                                <FileText className="h-5 w-5 text-green-600 shrink-0" />
                                <span className="text-sm text-green-800 flex-1 truncate">{file.name}</span>
                                <button type="button" onClick={() => setFile(null)} className="text-green-600 hover:text-red-500">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center gap-2 text-gray-400 hover:border-primary hover:text-primary transition-colors"
                            >
                                <Upload className="h-8 w-8" />
                                <span className="text-sm font-medium">اضغط لرفع ملف PDF للمحتوى التعليمي</span>
                                <span className="text-xs text-gray-300">الحد الأقصى 10 ميجابايت</span>
                            </button>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={handleFile}
                        />
                    </div>

                    {/* Basic Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="text-sm font-medium text-gray-700 block mb-1">عنوان الامتحان *</label>
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: امتحان الفصل الأول" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">التاريخ *</label>
                            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">المرحلة الدراسية</label>
                            <Select onValueChange={(v) => setGradeLevel(v === 'ALL' ? '' : v)} dir="rtl">
                                <SelectTrigger className="bg-gray-50 border-gray-200">
                                    <SelectValue placeholder="اختر المرحلة" />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="ALL">كل المراحل</SelectItem>
                                    {allowedGrades.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">
                                الدرجة الكلية للامتحان *
                                {questionCount && marksPerQuestion ? (
                                    <span className="text-xs text-gray-400 mr-1 font-normal">({questionCount} أسئلة × {marksPerQuestion} درجات)</span>
                                ) : null}
                            </label>
                            <Input
                                type="number"
                                min={1}
                                dir="ltr"
                                value={totalMarksInput}
                                onChange={(e) => handleTotalMarksChange(e.target.value)}
                                placeholder="مثال: 20"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">
                                درجة النجاح
                                <span className="text-xs text-gray-400 mr-1 font-normal">(اختياري)</span>
                            </label>
                            <Input
                                type="number"
                                min={1}
                                dir="ltr"
                                value={passingMarksOverride}
                                onChange={(e) => setPassingMarksOverride(e.target.value)}
                                placeholder={totalMarksInput ? `${Math.round(Number(totalMarksInput) * 0.5)} (تلقائي)` : '50% تلقائياً'}
                            />
                        </div>
                    </div>

                    {/* Groups */}
                    {groups.length > 0 && (
                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-2">المجموعات المستهدفة</label>
                            <div className="flex flex-wrap gap-2">
                                {groups.map((g: any) => (
                                    <button
                                        key={g._id}
                                        type="button"
                                        onClick={() => toggleGroup(g._id)}
                                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                                            selectedGroups.includes(g._id)
                                                ? 'bg-primary text-white border-primary'
                                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-primary'
                                        }`}
                                    >
                                        {g.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* AI Options */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-100">
                        <p className="text-sm font-semibold text-gray-700">إعدادات الذكاء الاصطناعي</p>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">اللغة</label>
                                <Select value={language} onValueChange={setLanguage} dir="rtl">
                                    <SelectTrigger className="bg-white border-gray-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        <SelectItem value="Arabic">العربية</SelectItem>
                                        <SelectItem value="English">الإنجليزية</SelectItem>
                                        <SelectItem value="French">الفرنسية</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">عدد الأسئلة</label>
                                <Input
                                    type="number" min={1} max={50} dir="ltr"
                                    value={questionCount}
                                    placeholder="مثال: 10"
                                    onChange={(e) => handleQuestionCountChange(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">درجة كل سؤال</label>
                                <Input
                                    type="number" min={1} dir="ltr"
                                    value={marksPerQuestion}
                                    placeholder="مثال: 2"
                                    onChange={(e) => handleMarksPerQuestionChange(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">مستوى الصعوبة</label>
                                <Select value={difficulty} onValueChange={setDifficulty} dir="rtl">
                                    <SelectTrigger className="bg-white border-gray-200">
                                        <SelectValue placeholder="اختر مستوى الصعوبة" />
                                    </SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {DIFFICULTIES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 block mb-2">أنواع الأسئلة</label>
                            <div className="flex flex-wrap gap-2">
                                {QUESTION_TYPES.map((t) => (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => toggleType(t.value)}
                                        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                                            selectedTypes.includes(t.value)
                                                ? 'bg-primary text-white border-primary'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Loading state */}
                    {mutation.isPending && (
                        <div className="flex flex-col items-center gap-3 py-4 text-primary">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p className="text-sm font-medium">{statusText || 'جاري التحضير...'}</p>
                            <p className="text-xs text-gray-400">قد يستغرق ذلك دقيقة أو أكثر حسب حجم الملف</p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex gap-2 justify-end pt-2 border-t">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                            إلغاء
                        </Button>
                        <Button
                            type="button"
                            onClick={() => mutation.mutate()}
                            disabled={mutation.isPending || !file}
                            className="gap-2 min-w-[140px]"
                        >
                            {mutation.isPending
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Sparkles className="h-4 w-4" />
                            }
                            توليد الامتحان
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
