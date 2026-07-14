import { ExamModel } from '../../database/models/exam.model.js';
import { UserModel } from '../../database/models/user.model.js';
import { BadRequestException } from '../../common/utils/response/error.responce.js';
import { QuestionType } from '../../common/enums/enum.service.js';

export class ExamPdfService {
    static async generateExamHtml(examId: string, teacherId: string): Promise<string> {
        const exam = await ExamModel.findOne({ _id: examId, teacherId }).lean();
        if (!exam) {
            throw BadRequestException({ message: 'الامتحان غير موجود' });
        }

        const teacher = await UserModel.findById(teacherId).select('name subject centerName logoUrl').lean();
        if (!teacher) {
            throw BadRequestException({ message: 'المعلم غير موجود' });
        }

        const mcqQuestions = exam.questions.filter(q => q.type === QuestionType.MCQ);
        const tfQuestions = exam.questions.filter(q => q.type === QuestionType.TRUE_FALSE);
        const essayQuestions = exam.questions.filter(q => q.type === QuestionType.ESSAY);

        let globalQuestionIndex = 1;

        const renderQuestions = (questions: any[], sectionTitle: string) => {
            if (questions.length === 0) return '';
            
            const sectionHtml = `
                <div class="section-title">
                    <span>${sectionTitle}</span>
                </div>
                <div class="questions-group">
                    ${questions.map((q) => {
                        const i = globalQuestionIndex++;
                        let answersHtml = '';
                        
                        // Check if the question text or first option is mainly English
                        const textToCheck = (q.options && q.options[0]) ? q.options[0] : q.text;
                        const isEnglish = /[a-zA-Z]/.test(textToCheck) && !/[\u0600-\u06FF]/.test(textToCheck);
                        
                        const arabicLabels = ['أ', 'ب', 'ج', 'د', 'هـ'];
                        const englishLabels = ['A', 'B', 'C', 'D', 'E'];
                        const labels = isEnglish ? englishLabels : arabicLabels;
                        const dirClass = isEnglish ? 'ltr' : '';

                        if (q.type === QuestionType.MCQ && q.options) {
                            answersHtml = `
                                <div class="options-container">
                                    ${q.options.map((opt: string, optIndex: number) => `
                                        <div class="option-item ${dirClass}">
                                            <span class="option-label">(${labels[optIndex] || optIndex + 1})</span> 
                                            <span class="option-text">${opt}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            `;
                        } else if (q.type === QuestionType.TRUE_FALSE) {
                            answersHtml = `
                                <div class="options-container tf-options">
                                    <div class="option-item"><span class="option-label">(أ)</span> صح</div>
                                    <div class="option-item"><span class="option-label">(ب)</span> خطأ</div>
                                </div>
                            `;
                        } else if (q.type === QuestionType.ESSAY) {
                            answersHtml = `<div class="essay-space"></div>`;
                        }

                        return `
                            <div class="question-container">
                                <div class="question-header" dir="${isEnglish ? 'ltr' : 'rtl'}">
                                    <div class="question-text">
                                        <span class="q-number">${isEnglish ? '' : 'س'}${i}${isEnglish ? '.' : '-'}</span> 
                                        ${q.text}
                                    </div>
                                    <span class="q-marks">(${q.marks} درجات)</span>
                                </div>
                                ${answersHtml}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            return sectionHtml;
        };

        // Generate HTML
        const html = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${exam.title}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                
                @page {
                    size: A4;
                    margin: 1.5cm;
                }

                body {
                    font-family: 'Cairo', sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #f1f5f9;
                    color: #0f172a;
                    line-height: 1.6;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                .exam-wrapper {
                    max-width: 210mm;
                    margin: 0 auto;
                    padding: 30px;
                    background: white;
                    min-height: 297mm;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                }

                /* Header Styling */
                .exam-header {
                    border: 3px solid #1e293b;
                    padding: 20px 25px;
                    margin-bottom: 35px;
                    border-radius: 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 20px;
                    background-color: #ffffff;
                }
                .header-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                .header-row {
                    display: flex;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 15px;
                }
                .header-item {
                    font-size: 16px;
                    font-weight: 800;
                    color: #1e293b;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .header-item span {
                    font-weight: 600;
                    color: #334155;
                }
                .name-field {
                    flex-grow: 1;
                }
                .name-dots {
                    flex-grow: 1;
                    border-bottom: 2px dotted #94a3b8;
                    min-width: 250px;
                    display: inline-block;
                }
                .title-row {
                    font-size: 26px;
                    font-weight: 900;
                    color: #0f172a;
                    margin-top: 10px;
                    border-top: 2px dashed #cbd5e1;
                    padding-top: 15px;
                    text-align: center;
                }
                .header-logo img {
                    max-height: 100px;
                    max-width: 140px;
                    border-radius: 8px;
                    object-fit: contain;
                }

                /* Section Styling */
                .section-title {
                    font-size: 22px;
                    font-weight: 800;
                    color: #1e293b;
                    margin: 35px 0 25px 0;
                    padding-bottom: 10px;
                    border-bottom: 3px solid #3b82f6;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .section-title::before {
                    content: '';
                    display: inline-block;
                    width: 8px;
                    height: 24px;
                    background-color: #3b82f6;
                    border-radius: 4px;
                }

                /* Question Styling */
                .question-container {
                    margin-bottom: 30px;
                    page-break-inside: avoid;
                    background: #fff;
                    padding: 0 10px;
                }
                .question-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 15px;
                    gap: 15px;
                }
                .question-text {
                    font-size: 19px;
                    font-weight: 700;
                    color: #0f172a;
                    text-align: justify;
                    line-height: 1.8;
                }
                .q-number {
                    color: #3b82f6;
                    margin-left: 6px;
                    font-weight: 900;
                }
                .q-marks {
                    font-size: 14px;
                    color: #475569;
                    font-weight: 700;
                    white-space: nowrap;
                    background: #f1f5f9;
                    padding: 4px 12px;
                    border-radius: 20px;
                    border: 2px solid #e2e8f0;
                }

                /* Options Styling */
                .options-container {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px 30px;
                    margin-right: 40px;
                }
                .tf-options {
                    grid-template-columns: repeat(4, 1fr);
                }
                .option-item {
                    font-size: 18px;
                    font-weight: 600;
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    color: #1e293b;
                }
                .option-label {
                    color: #3b82f6;
                    font-weight: 800;
                    min-width: 30px;
                    padding-top: 2px;
                }
                .option-text {
                    text-align: justify;
                    line-height: 1.7;
                }
                .option-item.ltr {
                    direction: ltr;
                    justify-content: flex-end;
                }

                /* Essay Styling */
                .essay-space {
                    height: 150px;
                    margin-top: 20px;
                    background-image: repeating-linear-gradient(transparent, transparent 29px, #94a3b8 30px);
                    margin-right: 40px;
                }

                @media print {
                    body {
                        background-color: transparent;
                        padding: 0;
                    }
                    .exam-wrapper {
                        padding: 0;
                        margin: 0;
                        max-width: 100%;
                        box-shadow: none;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .q-marks {
                        border-color: #000;
                        background: transparent;
                        color: #000;
                    }
                }
            </style>
        </head>
        <body>
            <div class="exam-wrapper">
                <div class="no-print" style="text-align: center; margin-bottom: 25px;">
                    <button onclick="window.print()" style="padding: 12px 24px; font-size: 18px; font-weight: bold; font-family: 'Cairo'; cursor: pointer; background-color: #2563eb; color: white; border: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(59 130 246 / 0.5);">
                        طباعة الامتحان الآن
                    </button>
                </div>

                <div class="exam-header">
                    <div class="header-info">
                        <div class="header-row">
                            <div class="header-item">الأستاذ: <span>${teacher.name}</span></div>
                            <div class="header-item">التاريخ: <span>${new Date(exam.date).toLocaleDateString('ar-EG')}</span></div>
                        </div>
                        <div class="header-row">
                            <div class="header-item name-field">اسم الطالب: <span class="name-dots"></span></div>
                        </div>
                        <div class="title-row">
                            ${exam.title}
                        </div>
                    </div>
                    ${teacher.logoUrl ? `
                    <div class="header-logo">
                        <img src="${teacher.logoUrl}" alt="Logo" />
                    </div>
                    ` : ''}
                </div>

                <div class="exam-body">
                    ${renderQuestions(mcqQuestions, 'أولاً: أسئلة الاختيار من متعدد')}
                    ${renderQuestions(tfQuestions, 'ثانياً: أسئلة الصواب والخطأ')}
                    ${renderQuestions(essayQuestions, 'ثالثاً: الأسئلة المقالية')}
                </div>
            </div>
        </body>
        </html>
        `;

        return html;
    }
}
