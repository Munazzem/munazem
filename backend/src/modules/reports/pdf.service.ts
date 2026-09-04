import { ReportsService } from './reports.service.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import { SessionService } from '../sessions/sessions.service.js';
import { NotFoundException } from '../../common/utils/response/error.responce.js';
import { UserModel } from '../../database/models/user.model.js';
import { StudentModel } from '../../database/models/student.model.js';
import { GroupModel } from '../../database/models/group.model.js';
import { SessionModel } from '../../database/models/session.model.js';
import { AttendanceModel } from '../../database/models/attendance.model.js';
import { AttendanceSnapshotModel } from '../../database/models/attendance-snapshot.model.js';
import { TransactionModel } from '../../database/models/transaction.model.js';
import { CycleEnrollmentModel } from '../../database/models/cycle-enrollment.model.js';
import { SessionStatus, TransactionType, TransactionCategory, AttendanceStatus } from '../../common/enums/enum.service.js';
import { startOfDayEgypt } from '../../common/utils/date.util.js';

export class PdfService {

    // Common HTML wrapper helper to avoid repetitive CSS
    private static wrapHtmlContent(title: string, content: string, centerName?: string, logoUrl?: string): string {
        return `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
                * { box-sizing: border-box; }
                body {
                    font-family: 'Cairo', sans-serif;
                    background-color: #fff;
                    color: #1e293b;
                    padding: 24px;
                    margin: 0;
                    font-size: 13px;
                    line-height: 1.5;
                }
                @page {
                    size: A4 portrait;
                    margin: 10mm;
                }
                @media print {
                    body {
                        padding: 0;
                        margin: 0;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .no-print { display: none !important; }
                    .report-header-grid,
                    .summary-cards-grid,
                    .summary-card,
                    .header-box,
                    .header-box-title {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    .section-title {
                        page-break-after: avoid;
                        break-after: avoid;
                    }
                    table {
                        page-break-inside: auto;
                        break-inside: auto;
                    }
                    thead {
                        display: table-header-group;
                    }
                    tbody {
                        display: table-row-group;
                    }
                    tr {
                        page-break-inside: avoid;
                        break-inside: avoid;
                        page-break-after: auto;
                    }
                    td, th {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                }
                /* 3-Box Header */
                .report-header-grid {
                    display: flex;
                    justify-content: space-between;
                    align-items: stretch;
                    gap: 12px;
                    margin-bottom: 20px;
                }
                .header-box {
                    flex: 1;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 12px 14px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                .header-box-title {
                    flex: 1.2;
                    background: #eff6ff;
                    border: 1.5px solid #bfdbfe;
                    text-align: center;
                    border-radius: 10px;
                    padding: 12px 14px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                .header-box-title h1 {
                    margin: 0;
                    font-size: 19px;
                    font-weight: 800;
                    color: #1d4ed8;
                }
                .header-box-title .subtitle {
                    margin-top: 3px;
                    font-size: 11px;
                    color: #64748b;
                }
                .header-box p {
                    margin: 3px 0;
                    font-size: 12px;
                    color: #475569;
                }
                .header-box p strong {
                    color: #0f172a;
                }

                /* 4 Summary Cards Grid */
                .summary-cards-grid {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 22px;
                }
                .summary-card {
                    flex: 1;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 10px 12px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
                    text-align: right;
                }
                .summary-card-title {
                    font-size: 11px;
                    font-weight: 700;
                    color: #64748b;
                    border-bottom: 1px solid #f1f5f9;
                    padding-bottom: 4px;
                    margin-bottom: 6px;
                }
                .summary-card .stat-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 11.5px;
                    margin: 3px 0;
                }
                .summary-card .stat-row .val {
                    font-weight: 700;
                    font-size: 13px;
                }

                /* Section Titles & Tables */
                .section-title {
                    font-size: 14.5px;
                    font-weight: 700;
                    color: #1e293b;
                    border-right: 4px solid #2563eb;
                    padding-right: 8px;
                    margin: 18px 0 10px 0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    font-size: 11.5px;
                }
                th, td {
                    border: 1px solid #e2e8f0;
                    padding: 7px 8px;
                    text-align: center;
                }
                th {
                    background-color: #f1f5f9;
                    font-weight: 700;
                    color: #334155;
                }
                tr:nth-child(even) {
                    background-color: #f8fafc;
                }
                .badge-paid {
                    background: #dcfce7;
                    color: #15803d;
                    font-weight: 700;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 10.5px;
                }
                .badge-unpaid {
                    background: #fee2e2;
                    color: #b91c1c;
                    font-weight: 700;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 10.5px;
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    color: #94a3b8;
                    border-top: 1px solid #e2e8f0;
                    padding-top: 8px;
                    font-size: 10.5px;
                }
            </style>
        </head>
        <body>
            ${content}
            <div class="footer">
                <p>تم استخراج هذا التقرير آلياً من منصة "مُنظِّم" التعليمية - ${new Date().toLocaleString('ar-EG')}</p>
            </div>
            <script>
                // Auto-print when loaded
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 400);
                }
            </script>
        </body>
        </html>
        `;
    }
    
    /**
     * Generates a high-quality HTML report for a student, styled for printing.
     */
    static async generateStudentReportPdf(studentId: string, teacherId: string): Promise<string> {
        const teacher = await UserModel.findById(teacherId).lean();
        const reportData = await ReportsService.getStudentReport(studentId, teacherId);
        if (!reportData) {
            throw NotFoundException({ message: 'بيانات الطالب غير متوفرة لطباعة التقرير' });
        }

        const { student, attendance, payments, grades } = reportData;

        const content = `
            <!-- 3-Box Header -->
            <div class="report-header-grid">
                <!-- Right Box: Student Details -->
                <div class="header-box">
                    <p><strong>المرحلة/الصف:</strong> ${student.gradeLevel || '—'}</p>
                    <p><strong>المجموعة:</strong> ${student.groupName || '—'}</p>
                    <p><strong>حالة الطالب:</strong> ${student.isActive ? 'نشط' : 'غير نشط'}</p>
                </div>

                <!-- Center Box: Title -->
                <div class="header-box-title">
                    ${teacher?.logoUrl ? `<img src="${teacher.logoUrl}" alt="Logo" style="max-height: 45px; margin-bottom: 5px; border-radius: 4px;" />` : ''}
                    <h1>تقرير الطالب: ${student.studentName}</h1>
                    <div class="subtitle">كود الطالب: ${(student as any).studentCode || '—'} · ${teacher?.centerName || 'منظومة مُنظِّم'}</div>
                </div>

                <!-- Left Box: Meta Info -->
                <div class="header-box">
                    <p><strong>رقم الطالب:</strong> <span dir="ltr">${student.studentPhone || '—'}</span></p>
                    <p><strong>رقم ولي الأمر:</strong> <span dir="ltr">${(student as any).parentPhone || '—'}</span></p>
                    <p><strong>تاريخ التقرير:</strong> <span dir="ltr">${new Date().toLocaleDateString('ar-EG')}</span></p>
                </div>
            </div>

            <!-- 4 KPI Cards -->
            <div class="summary-cards-grid">
                <!-- Card 1: Attendance Sessions -->
                <div class="summary-card">
                    <div class="summary-card-title">الحصص والحضور</div>
                    <div class="stat-row"><span>إجمالي الحصص:</span><span class="val">${attendance.totalSessions}</span></div>
                    <div class="stat-row"><span style="color:#15803d;">حضور:</span><span class="val" style="color:#15803d;">${attendance.presentCount}</span></div>
                    <div class="stat-row"><span style="color:#b91c1c;">غياب:</span><span class="val" style="color:#b91c1c;">${attendance.absentCount}</span></div>
                </div>

                <!-- Card 2: Attendance Rate -->
                <div class="summary-card">
                    <div class="summary-card-title">نسبة الانضباط</div>
                    <div class="stat-row"><span>نسبة الحضور:</span><span class="val" style="color:#2563eb; font-size:15px;">${attendance.attendanceRate}</span></div>
                    <div class="stat-row"><span>حالة الاشتراك:</span><span class="val">${student.hasActiveSubscription ? '<span class="badge-paid">ساري</span>' : '<span class="badge-unpaid">غير مسدد</span>'}</span></div>
                </div>

                <!-- Card 3: Payments -->
                <div class="summary-card">
                    <div class="summary-card-title">المدفوعات والاشتراكات</div>
                    <div class="stat-row"><span>إجمالي المدفوع:</span><span class="val" style="color:#15803d;">${(payments.totalPaid || 0).toLocaleString()} ج</span></div>
                    <div class="stat-row"><span>الخصومات:</span><span class="val" style="color:#64748b;">${(payments.totalDiscount || 0).toLocaleString()} ج</span></div>
                </div>

                <!-- Card 4: Exams -->
                <div class="summary-card">
                    <div class="summary-card-title">الامتحانات والتقييمات</div>
                    <div class="stat-row"><span>عدد الامتحانات:</span><span class="val">${grades?.total || 0}</span></div>
                    <div class="stat-row"><span>متوسط الدرجات:</span><span class="val" style="color:#7c3aed;">${grades?.history?.length ? Math.round(grades.history.reduce((a: any, b: any) => a + (b.percentage || 0), 0) / grades.history.length) : 0}%</span></div>
                </div>
            </div>

            <!-- Table 1: Attendance History -->
            ${attendance.history?.length > 0 ? `
            <div class="section-title">أولاً: سجل الحضور والغياب (آخر ${attendance.history.length} حصة)</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 10%;">حصة #</th>
                        <th style="width: 40%;">تاريخ الحصة</th>
                        <th style="width: 25%;">حالة الحضور</th>
                        <th style="width: 25%;">تسليم الواجب</th>
                    </tr>
                </thead>
                <tbody>
                    ${attendance.history.map((h: any, idx: number) => `
                        <tr>
                            <td>${attendance.history.length - idx}</td>
                            <td dir="ltr">${h.date ? new Date(h.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' }) : '—'}</td>
                            <td>${h.status === 'PRESENT' ? '<span class="badge-paid">حاضر</span>' : h.status === 'ABSENT' ? '<span class="badge-unpaid">غائب</span>' : '<span style="color:#0284c7; font-weight:bold;">عذر / زائر</span>'}</td>
                            <td>${h.homeworkDone === true ? '<span style="color:#15803d; font-weight:bold;">تم التسليم ✓</span>' : h.homeworkDone === false ? '<span style="color:#b91c1c; font-weight:bold;">لم يسلم ✗</span>' : '—'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}

            <!-- Table 2: Payments History -->
            ${payments.history?.length > 0 ? `
            <div class="section-title">ثانياً: سجل المدفوعات والاشتراكات (${payments.history.length} عملية)</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 20%;">التاريخ</th>
                        <th style="width: 25%;">نوع المعاملة</th>
                        <th style="width: 25%;">التفاصيل / البيان</th>
                        <th style="width: 15%;">الخصم</th>
                        <th style="width: 15%;">المبلغ المدفوع</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.history.map((p: any) => `
                        <tr>
                            <td dir="ltr">${p.date ? new Date(p.date).toLocaleDateString('ar-EG') : '—'}</td>
                            <td>${p.category === 'SUBSCRIPTION' ? 'اشتراك دورة' : p.category === 'NOTEBOOK_SALE' ? 'شراء مذكرة' : 'معاملة مالية'}</td>
                            <td>${p.description || '—'}</td>
                            <td style="color:#64748b;">${(p.discountAmount || 0).toLocaleString()} ج</td>
                            <td style="color:#15803d; font-weight:bold;">${(p.paidAmount || 0).toLocaleString()} ج</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}

            <!-- Table 3: Exam Grades -->
            ${grades?.history?.length > 0 ? `
            <div class="section-title">ثالثاً: درجات الامتحانات والتقييمات (${grades.history.length} امتحان)</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 25%;">اسم الامتحان</th>
                        <th style="width: 25%;">التاريخ</th>
                        <th style="width: 15%;">الدرجة</th>
                        <th style="width: 15%;">النسبة المئوية</th>
                        <th style="width: 20%;">التقدير</th>
                    </tr>
                </thead>
                <tbody>
                    ${grades.history.map((g: any) => `
                        <tr>
                            <td style="font-weight:600;">${g.examTitle}</td>
                            <td dir="ltr">${g.date ? new Date(g.date).toLocaleDateString('ar-EG') : '—'}</td>
                            <td style="font-weight:bold;">${g.score} / ${g.totalMarks}</td>
                            <td style="font-weight:bold; color:${g.passed ? '#15803d' : '#b91c1c'}">${g.percentage}%</td>
                            <td>${g.passed ? '<span class="badge-paid">ناجح</span>' : '<span class="badge-unpaid">راسب</span>'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}
        `;

        return this.wrapHtmlContent(`تقرير الطالب: ${student.studentName}`, content, teacher?.centerName, teacher?.logoUrl);
    }

    // ─────────────────────────────────────────────────────────────────
    // 2. Financial Monthly Report PDF
    // ─────────────────────────────────────────────────────────────────
    static async generateMonthlyFinancialPdf(teacherId: string, year: number, month: number): Promise<string> {
        const teacher = await UserModel.findById(teacherId).lean();
        const report = await ReportsService.getFinancialMonthlyReport(teacherId, year, month);

        const monthNamesAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
        const monthName = monthNamesAr[month - 1] || `${month}`;

        const content = `
            <!-- 3-Box Header -->
            <div class="report-header-grid">
                <!-- Right Box -->
                <div class="header-box">
                    <p><strong>الشهر المالي:</strong> شهر ${monthName} (${month})</p>
                    <p><strong>السنة المالية:</strong> ${year}</p>
                    <p><strong>إجمالي الأيام المسجلة:</strong> ${report.dailySummaries?.length || 0} يوم</p>
                </div>

                <!-- Center Box: Title -->
                <div class="header-box-title">
                    ${teacher?.logoUrl ? `<img src="${teacher.logoUrl}" alt="Logo" style="max-height: 45px; margin-bottom: 5px; border-radius: 4px;" />` : ''}
                    <h1>التقرير المالي الشهري</h1>
                    <div class="subtitle">شهر ${monthName} ${year} · ${teacher?.centerName || 'منظومة مُنظِّم'}</div>
                </div>

                <!-- Left Box: Meta Info -->
                <div class="header-box">
                    <p><strong>تاريخ التقرير:</strong> <span dir="ltr">${new Date().toLocaleDateString('ar-EG')}</span></p>
                    <p><strong>صافي الأرباح:</strong> <span style="color:#15803d; font-weight:bold;">${(report.netBalance || 0).toLocaleString()} ج</span></p>
                    <p><strong>المعلم:</strong> ${teacher?.name || '—'}</p>
                </div>
            </div>

            <!-- 4 KPI Cards -->
            <div class="summary-cards-grid">
                <!-- Card 1: Total Income -->
                <div class="summary-card">
                    <div class="summary-card-title">إجمالي الإيرادات</div>
                    <div class="stat-row"><span>إجمالي الدخل:</span><span class="val" style="color:#15803d; font-size:14px;">${(report.totalIncome || 0).toLocaleString()} ج</span></div>
                    <div style="font-size:9.5px; color:#94a3b8; margin-top:2px;">(اشتراكات + مذكرات)</div>
                </div>

                <!-- Card 2: Subscriptions -->
                <div class="summary-card">
                    <div class="summary-card-title">اشتراكات الشهر</div>
                    <div class="stat-row"><span>عمليات الاشتراك:</span><span class="val">${report.stats?.subscriptionsCount || 0}</span></div>
                    <div class="stat-row"><span style="color:#15803d;">مبالغ الاشتراكات:</span><span class="val" style="color:#15803d;">${(report.stats?.subscriptionsRevenue || 0).toLocaleString()} ج</span></div>
                </div>

                <!-- Card 3: Notebooks -->
                <div class="summary-card">
                    <div class="summary-card-title">مبيعات المذكرات</div>
                    <div class="stat-row"><span>المذكرات المباعة:</span><span class="val">${report.stats?.notebooksSoldQuantity || 0} نسخة</span></div>
                    <div class="stat-row"><span style="color:#7c3aed;">فلوس المذكرات:</span><span class="val" style="color:#7c3aed;">${(report.stats?.notebooksRevenue || 0).toLocaleString()} ج</span></div>
                </div>

                <!-- Card 4: Expenses & Net -->
                <div class="summary-card">
                    <div class="summary-card-title">المصروفات والصافي</div>
                    <div class="stat-row"><span style="color:#b91c1c;">المصروفات:</span><span class="val" style="color:#b91c1c;">${(report.totalExpenses || 0).toLocaleString()} ج</span></div>
                    <div class="stat-row"><span style="color:#2563eb;">صافي الربح:</span><span class="val" style="color:#2563eb;">${(report.netBalance || 0).toLocaleString()} ج</span></div>
                </div>
            </div>

            <!-- Table 1: Category Breakdown -->
            <div class="section-title">أولاً: تحليل الإيرادات والمصروفات حسب البند</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 20%;">نوع المعاملة</th>
                        <th style="width: 35%;">البند / التصنيف</th>
                        <th style="width: 20%;">عدد العمليات</th>
                        <th style="width: 25%;">المبلغ الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.breakdown.length === 0 ? '<tr><td colspan="4">لا توجد حركات مالية مسجلة لهذا الشهر</td></tr>' : 
                    report.breakdown.map((row: any) => `
                        <tr>
                            <td>${row._id.type === 'INCOME' ? '<span class="badge-paid">إيراد</span>' : '<span class="badge-unpaid">مصروف</span>'}</td>
                            <td style="font-weight:600;">${row._id.category}</td>
                            <td>${row.count}</td>
                            <td style="font-weight:bold; color:${row._id.type === 'INCOME' ? '#15803d' : '#b91c1c'}">${(row.total || 0).toLocaleString()} ج</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <!-- Table 2: Daily Summaries -->
            ${report.dailySummaries?.length > 0 ? `
            <div class="section-title">ثانياً: سجل الحركة المالية اليومية في الشهر (${report.dailySummaries.length} يوم)</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 30%;">التاريخ</th>
                        <th style="width: 25%;">الدخل</th>
                        <th style="width: 25%;">المصروفات</th>
                        <th style="width: 20%;">صافي اليوم</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.dailySummaries.map((day: any) => {
                        const inc = day.totalIncome ?? day.income ?? 0;
                        const exp = day.totalExpenses ?? day.expense ?? 0;
                        const net = inc - exp;
                        return `
                        <tr>
                            <td dir="ltr" style="font-weight:600;">${day.date ? new Date(day.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' }) : '—'}</td>
                            <td style="color: #15803d; font-weight:bold;">${inc.toLocaleString()} ج</td>
                            <td style="color: #b91c1c; font-weight:bold;">${exp.toLocaleString()} ج</td>
                            <td style="font-weight:bold; color:${net >= 0 ? '#2563eb' : '#b91c1c'}">${net.toLocaleString()} ج</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            ` : ''}
        `;
        return this.wrapHtmlContent(`التقرير المالي - شهر ${monthName} لسنة ${year}`, content, teacher?.centerName, teacher?.logoUrl);
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. Daily Summary PDF
    // ─────────────────────────────────────────────────────────────────
    static async generateDailySummaryPdf(teacherId: string, dateStr?: string): Promise<string> {
        const teacher = await UserModel.findById(teacherId).lean();
        const report = await ReportsService.getDailySummary(teacherId, dateStr);

        const content = `
            <!-- 3-Box Header -->
            <div class="report-header-grid">
                <!-- Right Box -->
                <div class="header-box">
                    <p><strong>تاريخ اليوم:</strong> <span dir="ltr">${report.date}</span></p>
                    <p><strong>الحصص المكتملة اليوم:</strong> ${report.sessionsCount} حصة</p>
                    <p><strong>إجمالي حضور اليوم:</strong> ${report.totalPresent} طالب</p>
                </div>

                <!-- Center Box: Title -->
                <div class="header-box-title">
                    ${teacher?.logoUrl ? `<img src="${teacher.logoUrl}" alt="Logo" style="max-height: 45px; margin-bottom: 5px; border-radius: 4px;" />` : ''}
                    <h1>التقرير اليومي</h1>
                    <div class="subtitle">يوم: ${report.date} · ${teacher?.centerName || 'منظومة مُنظِّم'}</div>
                </div>

                <!-- Left Box: Meta Info -->
                <div class="header-box">
                    <p><strong>صافي اليوم:</strong> <span style="color:#15803d; font-weight:bold;">${(report.financial.netBalance || 0).toLocaleString()} ج</span></p>
                    <p><strong>المعلم:</strong> ${teacher?.name || '—'}</p>
                    <p><strong>وقت الطباعة:</strong> <span dir="ltr">${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span></p>
                </div>
            </div>

            <!-- 4 KPI Cards -->
            <div class="summary-cards-grid">
                <!-- Card 1: Daily Total Income -->
                <div class="summary-card">
                    <div class="summary-card-title">إجمالي إيراد اليوم</div>
                    <div class="stat-row"><span>المجموع الكلي:</span><span class="val" style="color:#15803d; font-size:14px;">${(report.financial.totalIncome || 0).toLocaleString()} ج</span></div>
                    <div style="font-size:9.5px; color:#94a3b8; margin-top:2px;">(اشتراكات + مذكرات)</div>
                </div>

                <!-- Card 2: Subscriptions Today -->
                <div class="summary-card">
                    <div class="summary-card-title">اشتراكات اليوم</div>
                    <div class="stat-row"><span>عمليات الاشتراك:</span><span class="val">${report.stats?.subscriptionsCount || 0}</span></div>
                    <div class="stat-row"><span style="color:#15803d;">فلوس الاشتراكات:</span><span class="val" style="color:#15803d;">${(report.stats?.subscriptionsRevenue || 0).toLocaleString()} ج</span></div>
                </div>

                <!-- Card 3: Notebooks Today -->
                <div class="summary-card">
                    <div class="summary-card-title">مبيعات مذكرات اليوم</div>
                    <div class="stat-row"><span>مذكرات مباعة:</span><span class="val">${report.stats?.notebooksSoldQuantity || 0} نسخة</span></div>
                    <div class="stat-row"><span style="color:#7c3aed;">فلوس المذكرات:</span><span class="val" style="color:#7c3aed;">${(report.stats?.notebooksRevenue || 0).toLocaleString()} ج</span></div>
                </div>

                <!-- Card 4: Daily Expenses & Net -->
                <div class="summary-card">
                    <div class="summary-card-title">مصروفات وصافي اليوم</div>
                    <div class="stat-row"><span style="color:#b91c1c;">مصروفات:</span><span class="val" style="color:#b91c1c;">${(report.financial.totalExpenses || 0).toLocaleString()} ج</span></div>
                    <div class="stat-row"><span style="color:#2563eb;">الصافي:</span><span class="val" style="color:#2563eb;">${(report.financial.netBalance || 0).toLocaleString()} ج</span></div>
                </div>
            </div>

            <!-- Table 1: Completed Sessions Today -->
            ${report.completedSessions?.length > 0 ? `
            <div class="section-title">أولاً: حصص اليوم المنعقدة (${report.completedSessions.length} حصة)</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 35%;">المجموعة</th>
                        <th style="width: 25%;">المرحلة / الصف</th>
                        <th style="width: 15%;">وقت البدء</th>
                        <th style="width: 12%;">حضور</th>
                        <th style="width: 13%;">غياب</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.completedSessions.map((s: any) => `
                        <tr>
                            <td style="font-weight:600;">${s.groupName}</td>
                            <td>${s.gradeLevel}</td>
                            <td dir="ltr">${s.startTime || '—'}</td>
                            <td style="color:#15803d; font-weight:bold;">${s.presentCount}</td>
                            <td style="color:#b91c1c; font-weight:bold;">${s.absentCount}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}

            <!-- Table 2: Daily Transactions -->
            ${report.transactions?.length > 0 ? `
            <div class="section-title">ثانياً: المعاملات المالية لليوم (${report.transactions.length} معاملة)</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 25%;">الطالب / الطرف</th>
                        <th style="width: 20%;">نوع المعاملة</th>
                        <th style="width: 30%;">البيان والتفاصيل</th>
                        <th style="width: 25%;">المبلغ</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.transactions.map((t: any) => `
                        <tr>
                            <td style="font-weight:600;">${t.studentName}</td>
                            <td>${t.type === 'INCOME' ? '<span class="badge-paid">إيراد</span>' : '<span class="badge-unpaid">مصروف</span>'}</td>
                            <td>${t.description}</td>
                            <td style="font-weight:bold; color:${t.type === 'INCOME' ? '#15803d' : '#b91c1c'}">${(t.paidAmount || 0).toLocaleString()} ج</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}
        `;
        return this.wrapHtmlContent(`تقرير يوم: ${report.date}`, content, teacher?.centerName, teacher?.logoUrl);
    }

    // ─────────────────────────────────────────────────────────────────
    // 4. Group Report PDF (List of Students and Stats)
    // ─────────────────────────────────────────────────────────────────
    static async generateGroupReportPdf(groupId: string, teacherId: string): Promise<string> {
        const teacher = await UserModel.findById(teacherId).lean();
        const report = await ReportsService.getGroupReport(groupId, teacherId);

        const scheduleText = Array.isArray(report.group.schedule) && report.group.schedule.length > 0
            ? report.group.schedule.map((s: any) => `${s.day ?? ''} ${s.time ?? ''}`).join(' | ')
            : report.group.schedule ? `${report.group.schedule}` : '—';

        const content = `
            <!-- 3-Box Header -->
            <div class="report-header-grid">
                <!-- Right Box: Group Info -->
                <div class="header-box">
                    <p><strong>المرحلة/الصف:</strong> ${report.group.gradeLevel || '—'}</p>
                    <p><strong>المواعيد:</strong> ${scheduleText}</p>
                    <p><strong>السعة المقررة:</strong> ${report.group.capacity || 50} طالب</p>
                </div>

                <!-- Center Box: Title -->
                <div class="header-box-title">
                    ${teacher?.logoUrl ? `<img src="${teacher.logoUrl}" alt="Logo" style="max-height: 45px; margin-bottom: 5px; border-radius: 4px;" />` : ''}
                    <h1>تقرير مجموعة: ${report.group.name}</h1>
                    <div class="subtitle">الدورة الحالية: ${report.group.currentCycleNumber || 1} · ${teacher?.centerName || 'منظومة مُنظِّم'}</div>
                </div>

                <!-- Left Box: Meta Info -->
                <div class="header-box">
                    <p><strong>تاريخ التقرير:</strong> <span dir="ltr">${new Date().toLocaleDateString('ar-EG')}</span></p>
                    <p><strong>نسبة الحضور العامة:</strong> <span style="color:#15803d; font-weight:bold;">${report.attendance.avgAttendanceRate || '0%'}</span></p>
                    <p><strong>إجمالي الحصص المنعقدة:</strong> ${report.attendance.totalSessions} حصة</p>
                </div>
            </div>

            <!-- 4 KPI Cards -->
            <div class="summary-cards-grid">
                <!-- Card 1: Students -->
                <div class="summary-card">
                    <div class="summary-card-title">حالة اشتراكات الطلاب</div>
                    <div class="stat-row"><span>عدد الطلاب:</span><span class="val">${report.stats.totalStudents}</span></div>
                    <div class="stat-row"><span style="color:#15803d;">الدافعين:</span><span class="val" style="color:#15803d;">${report.stats.paidStudentsCount}</span></div>
                    <div class="stat-row"><span style="color:#b91c1c;">المتأخرين في الدفع:</span><span class="val" style="color:#b91c1c;">${report.stats.unpaidStudentsCount}</span></div>
                </div>

                <!-- Card 2: Notebooks -->
                <div class="summary-card">
                    <div class="summary-card-title">مبيعات المذكرات</div>
                    <div class="stat-row"><span>المذكرات المباعة:</span><span class="val">${report.stats.notebooksSoldQuantity} نسخة</span></div>
                    <div class="stat-row"><span style="color:#7c3aed;">فلوس المذكرات:</span><span class="val" style="color:#7c3aed;">${(report.stats.notebooksRevenue || 0).toLocaleString()} ج</span></div>
                </div>

                <!-- Card 3: Subscriptions -->
                <div class="summary-card">
                    <div class="summary-card-title">اشتراكات الدورة</div>
                    <div class="stat-row"><span>عمليات الاشتراك:</span><span class="val">${report.stats.subscriptionsCount}</span></div>
                    <div class="stat-row"><span style="color:#15803d;">فلوس الاشتراكات:</span><span class="val" style="color:#15803d;">${(report.stats.subscriptionsRevenue || 0).toLocaleString()} ج</span></div>
                </div>

                <!-- Card 4: Total Finances -->
                <div class="summary-card">
                    <div class="summary-card-title">إجمالي ماليات المجموعة</div>
                    <div class="stat-row"><span>المجموع الكلي:</span><span class="val" style="color:#b45309; font-size:14px;">${(report.stats.totalRevenue || 0).toLocaleString()} ج</span></div>
                    <div style="font-size:9.5px; color:#94a3b8; margin-top:2px;">(اشتراكات + مذكرات)</div>
                </div>
            </div>

            <!-- Table 1: Students Roster with Subscription & Attendance -->
            <div class="section-title">أولاً: كشف طلاب المجموعة وحالة الاشتراك للدورة الحالية (${report.students?.length || 0} طالب)</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 5%;">م</th>
                        <th style="width: 25%; text-align: right;">اسم الطالب</th>
                        <th style="width: 12%;">الكود</th>
                        <th style="width: 15%;">الهاتف</th>
                        <th style="width: 15%;">هاتف ولي الأمر</th>
                        <th style="width: 13%;">حالة الاشتراك</th>
                        <th style="width: 15%;">نسبة الحضور</th>
                    </tr>
                </thead>
                <tbody>
                    ${!report.students || report.students.length === 0 ? '<tr><td colspan="7">لا يوجد طلاب مسجلين في هذه المجموعة</td></tr>' :
                    report.students.map((st: any, idx: number) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td style="text-align: right; font-weight: 600;">${st.studentName}</td>
                            <td>${st.studentCode || '—'}</td>
                            <td dir="ltr">${st.studentPhone || '—'}</td>
                            <td dir="ltr">${st.parentPhone || '—'}</td>
                            <td>${st.hasActiveSubscription ? '<span class="badge-paid">تم السداد</span>' : '<span class="badge-unpaid">لم يسدد بعد</span>'}</td>
                            <td style="font-weight: 600;">${st.attendanceRate} (${st.presentCount}ح / ${st.absentCount}غ)</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <!-- Table 2: Sessions History -->
            ${report.attendance?.sessionsHistory?.length > 0 ? `
            <div class="section-title">ثانياً: سجل الحصص المنعقدة (${report.attendance.sessionsHistory.length} حصة)</div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 8%;">حصة #</th>
                        <th style="width: 25%;">تاريخ الحصة</th>
                        <th style="width: 20%;">حضور</th>
                        <th style="width: 20%;">غياب</th>
                        <th style="width: 27%;">نسبة الحضور</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.attendance.sessionsHistory.map((s: any, idx: number) => {
                        const total = (s.presentCount || 0) + (s.absentCount || 0);
                        const rate = total > 0 ? Math.round((s.presentCount / total) * 100) : 0;
                        return `
                        <tr>
                            <td>${report.attendance.sessionsHistory.length - idx}</td>
                            <td dir="ltr">${s.date ? new Date(s.date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' }) : '—'}</td>
                            <td style="color:#15803d; font-weight:bold;">${s.presentCount || 0}</td>
                            <td style="color:#b91c1c; font-weight:bold;">${s.absentCount || 0}</td>
                            <td style="font-weight:bold;">${rate}%</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            ` : ''}
        `;
        return this.wrapHtmlContent(`تقرير مجموعة: ${report.group.name}`, content, teacher?.centerName, teacher?.logoUrl);
    }

    // ─────────────────────────────────────────────────────────────────
    // 4. Session Attendance List PDF
    // ─────────────────────────────────────────────────────────────────
    static async generateSessionAttendancePdf(sessionId: string, teacherId: string): Promise<string> {
        const teacher = await UserModel.findById(teacherId).lean();
        const session = await SessionService.getSessionById(sessionId, teacherId);
        const attendanceList = await AttendanceService.getSessionAttendance(sessionId, teacherId);

        const isHomeworkTrackingEnabled = Boolean(teacher?.features?.homeworkTracking);

        const content = `
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p><strong>تاريخ الحصة:</strong> <span dir="ltr">${new Date(session.date).toLocaleDateString('ar-EG')}</span></p>
                <p><strong>وقت البدء:</strong> ${session.startTime}</p>
                <p><strong>حالة الحصة:</strong> ${session.status === 'COMPLETED' ? 'مكتملة' : 'قيد الإجراء'}</p>
                <p><strong>عدد المسجلين في الكشف:</strong> ${attendanceList.length} طالب</p>
            </div>

            <h3 class="section-title">كشف أسماء الطلاب والحضور</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width: 5%;">م</th>
                        <th style="width: 15%;">كود الطالب</th>
                        <th style="width: ${isHomeworkTrackingEnabled ? '30%' : '35%'};">اسم الطالب</th>
                        <th style="width: ${isHomeworkTrackingEnabled ? '20%' : '25%'};">رقم الهاتف</th>
                        <th style="width: 10%; text-align: center;">الحالة</th>
                        ${isHomeworkTrackingEnabled ? '<th style="width: 10%; text-align: center;">الواجب</th>' : ''}
                        <th style="width: 10%; text-align: center;">الوقت</th>
                    </tr>
                </thead>
                <tbody>
                    ${attendanceList.length === 0 ? `<tr><td colspan="${isHomeworkTrackingEnabled ? '7' : '6'}" style="text-align: center; color: #9ca3af;">لم يتم تسجيل أي طلاب في هذا الكشف</td></tr>` : 
                    attendanceList.map((record: any, index: number) => {
                        const isAttended = record.status === 'PRESENT' || record.status === 'LATE';
                        const isGuest = record.isGuest === true;
                        const statusColor = isAttended ? '#15803d' : (record.status === 'EXCUSED' ? '#2563eb' : '#dc2626');
                        let statusText = 'غائب';
                        if (isAttended) {
                            statusText = isGuest ? 'زائر' : (record.status === 'LATE' ? 'متأخر' : 'حاضر');
                        } else if (record.status === 'EXCUSED') {
                            statusText = 'معوض';
                        }

                        let hwColumn = '';
                        if (isHomeworkTrackingEnabled) {
                            if (isAttended && typeof record.homeworkDone === 'boolean') {
                                hwColumn = record.homeworkDone
                                    ? '<td style="color: #15803d; font-weight: bold; text-align: center;">تم</td>'
                                    : '<td style="color: #dc2626; font-weight: bold; text-align: center;">لم يتم</td>';
                            } else {
                                hwColumn = '<td style="color: #9ca3af; text-align: center;">—</td>';
                            }
                        }

                        const time = record.scannedAt || record.checkInTime;

                        return `
                        <tr>
                            <td style="text-align: center;">${index + 1}</td>
                            <td>${record.studentId?.studentCode || '—'}</td>
                            <td style="font-weight: 600;">${record.studentId?.studentName || '—'}</td>
                            <td dir="ltr" style="text-align: right;">${record.studentId?.studentPhone || '—'}</td>
                            <td style="color: ${statusColor}; font-weight: bold; text-align: center;">${statusText}</td>
                            ${hwColumn}
                            <td dir="ltr" style="text-align: center;">${time ? new Date(time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        return this.wrapHtmlContent(`كشف حضور الحصة`, content, teacher?.centerName, teacher?.logoUrl);
    }

    // ─────────────────────────────────────────────────────────────────
    // 5. Group Attendance Sheet PDF (Printable)
    // ─────────────────────────────────────────────────────────────────
    static async generateGroupAttendanceSheetHtml(groupId: string, teacherId: string): Promise<string> {
        const group = await GroupModel.findOne({ _id: groupId, teacherId }).lean();
        if (!group) throw NotFoundException({ message: 'المجموعة غير موجودة' });

        const teacher = await UserModel.findById(teacherId).lean();
        const centerName = teacher?.centerName || 'منصة مُنظِّم — Monazem';
        const logoImg = teacher?.logoUrl ? `<img src="${teacher.logoUrl}" alt="Logo" style="max-height: 80px; margin-bottom: 10px; border-radius: 8px;" />` : '';

        // Active students — sorted alphabetically
        const students = await StudentModel.find({ groupId, teacherId, isActive: true })
            .select('studentName studentPhone parentPhone studentCode barcode').sort({ studentName: 1 }).lean();

        const studentIds = students.map(s => s._id);

        // Cycle parameters
        const cycleCapacity = (group as any)?.cycle?.capacity || (group?.schedule?.length ? group.schedule.length * 4 : 8);
        const currentCycleNumber = (group as any)?.cycle?.currentCycleNumber || 1;
        const rawCycleStartedAt = (group as any)?.cycle?.startedAt;
        const cycleStartedAt = startOfDayEgypt(rawCycleStartedAt);

        // Current Cycle Sessions for the group (all non-cancelled sessions in this cycle, up to cycleCapacity)
        const sessions = await SessionModel.find({
            groupId,
            teacherId,
            date: { $gte: cycleStartedAt },
            status: { $ne: SessionStatus.CANCELLED }
        }).sort({ date: 1, startTime: 1 }).limit(cycleCapacity).lean();

        const sessionIds = sessions.map(s => s._id);

        // 1. Fetch current cycle enrollments for subscriptions
        const enrollments = await CycleEnrollmentModel.find({
            studentId: { $in: studentIds },
            cycleNumber: currentCycleNumber
        }).lean();

        const paidSubSet = new Set<string>();
        enrollments.forEach(e => {
            if (e.status === 'PAID' || e.status === 'PARTIALLY_PAID' || e.totalPaid > 0) {
                paidSubSet.add(e.studentId.toString());
            }
        });

        // 2. Fetch live attendance records, snapshots, and guest attendances in the cycle
        const [attendedRecords, sessionSnapshots, guestRecords] = await Promise.all([
            AttendanceModel.find({
                studentId: { $in: studentIds },
                sessionId: { $in: sessionIds as any },
            }).lean(),
            AttendanceSnapshotModel.find({
                sessionId: { $in: sessionIds as any },
            }).lean(),
            AttendanceModel.find({
                studentId: { $in: studentIds },
                isGuest: true,
                status: { $in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE] },
                scannedAt: { $gte: cycleStartedAt },
            }).lean(),
        ]);

        // Build student -> sessionId -> status map
        const studentAttendanceMap = new Map<string, Map<string, AttendanceStatus>>();
        attendedRecords.forEach(a => {
            const sid = a.studentId.toString();
            const sessId = a.sessionId ? a.sessionId.toString() : '';
            if (sessId) {
                if (!studentAttendanceMap.has(sid)) studentAttendanceMap.set(sid, new Map());
                studentAttendanceMap.get(sid)!.set(sessId, a.status as AttendanceStatus);
            }
        });

        // Complement with snapshots if direct attendance record not found
        sessionSnapshots.forEach(snap => {
            const sessId = snap.sessionId.toString();
            snap.presentStudents?.forEach((p: any) => {
                const sid = p.studentId?.toString();
                if (sid) {
                    if (!studentAttendanceMap.has(sid)) studentAttendanceMap.set(sid, new Map());
                    if (!studentAttendanceMap.get(sid)!.has(sessId)) {
                        studentAttendanceMap.get(sid)!.set(sessId, p.status === AttendanceStatus.EXCUSED ? AttendanceStatus.EXCUSED : AttendanceStatus.PRESENT);
                    }
                }
            });
            snap.guestStudents?.forEach((g: any) => {
                const sid = g.studentId?.toString();
                if (sid) {
                    if (!studentAttendanceMap.has(sid)) studentAttendanceMap.set(sid, new Map());
                    if (!studentAttendanceMap.get(sid)!.has(sessId)) {
                        studentAttendanceMap.get(sid)!.set(sessId, AttendanceStatus.PRESENT);
                    }
                }
            });
            snap.absentStudents?.forEach((a: any) => {
                const sid = a.studentId?.toString();
                if (sid) {
                    if (!studentAttendanceMap.has(sid)) studentAttendanceMap.set(sid, new Map());
                    if (!studentAttendanceMap.get(sid)!.has(sessId)) {
                        studentAttendanceMap.get(sid)!.set(sessId, AttendanceStatus.ABSENT);
                    }
                }
            });
        });

        // Group guest records by student
        const studentGuestsMap = new Map<string, any[]>();
        guestRecords.forEach(g => {
            const sid = g.studentId.toString();
            if (!studentGuestsMap.has(sid)) studentGuestsMap.set(sid, []);
            studentGuestsMap.get(sid)!.push(g);
        });

        const now = new Date();
        const monthNamesAr = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
        const currentMonthName = monthNamesAr[now.getMonth()];

        const content = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&display=swap');
                    @page { size: A4 landscape; margin: 12mm; }
                    body {
                        font-family: 'Cairo', sans-serif;
                        background-color: #fff;
                        color: #000;
                        margin: 0;
                        font-size: 12px;
                    }
                    .header-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 2px solid #000;
                        padding-bottom: 12px;
                        margin-bottom: 16px;
                    }
                    .header-info { text-align: right; }
                    .header-info h1 { margin: 0 0 4px 0; font-size: 18px; }
                    .header-info h2 { margin: 0 0 3px 0; font-size: 14px; font-weight: normal; }
                    .logo-box { text-align: left; }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 15px;
                        page-break-inside: auto;
                    }
                    thead {
                        display: table-header-group;
                    }
                    tr {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 6px 3px;
                        text-align: center;
                        vertical-align: middle;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    th {
                        background-color: #f7f7f7;
                        font-weight: bold;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        font-size: 11px;
                    }
                    .student-name { text-align: right; padding-right: 6px; width: 18%; font-weight: 600; }
                    .checkbox-col { font-size: 16px; font-weight: bold; }
                    .session-col { min-width: 38px; }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div class="header-info">
                        <h1>${centerName}</h1>
                        <h2>كشف حضور مجموعة: <strong>${group.name}</strong> — ${group.gradeLevel || ''}</h2>
                        <h2>الدورة: <strong>${currentCycleNumber}</strong> (سعة: ${cycleCapacity} حصص) — شهر: <strong>${currentMonthName} ${now.getFullYear()}</strong></h2>
                    </div>
                    <div class="logo-box">
                        ${logoImg}
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 3%">م</th>
                            <th class="student-name">اسم الطالب</th>
                            <th style="width: 10%">رقم الطالب</th>
                            <th style="width: 10%">رقم ولي الأمر</th>
                            <th style="width: 5%">اشتراك</th>
                            ${Array.from({ length: cycleCapacity }).map((_, i) => {
                                const s = sessions[i];
                                const dateStr = s ? new Date(s.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' }) : '-';
                                return `<th class="session-col">ح${i + 1}<br><span style="font-size:9px; font-weight:normal;">${dateStr}</span></th>`;
                            }).join('')}
                            <th style="width: 8%">ملاحظات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.length === 0 ? `<tr><td colspan="${5 + cycleCapacity + 1}" style="padding: 20px;">لا يوجد طلاب في هذه المجموعة</td></tr>` : 
                        students.map((student: any, idx: number) => {
                            const sid = student._id.toString();
                            const isSub = paidSubSet.has(sid);
                            const studentAttMap = studentAttendanceMap.get(sid) || new Map();
                            const guestList = studentGuestsMap.get(sid) || [];
                            const matchedGuestIds = new Set<string>();

                            return `
                            <tr>
                                <td>${idx + 1}</td>
                                <td class="student-name">${student.studentName}</td>
                                <td dir="ltr">${student.studentPhone || '—'}</td>
                                <td dir="ltr">${student.parentPhone || '—'}</td>
                                <td class="checkbox-col">${isSub ? '☑' : '☐'}</td>
                                ${Array.from({ length: cycleCapacity }).map((_, i) => {
                                    const s = sessions[i];
                                    if (!s) return '<td></td>'; // Future / unheld session
                                    
                                    const sessId = s._id.toString();
                                    let status = studentAttMap.get(sessId);
                                    const sessionDateKey = s.date ? new Date(s.date).toISOString().split('T')[0] : '';

                                    // Check cross-date or same-date guest compensation if absent
                                    let isCompensated = false;
                                    if (status !== AttendanceStatus.PRESENT && status !== AttendanceStatus.LATE && status !== AttendanceStatus.EXCUSED) {
                                        const exactGuest = guestList.find(g => {
                                            const gd = g.scannedAt ? new Date(g.scannedAt).toISOString().split('T')[0] : '';
                                            return gd === sessionDateKey && !matchedGuestIds.has(g._id.toString());
                                        });

                                        if (exactGuest) {
                                            matchedGuestIds.add(exactGuest._id.toString());
                                            isCompensated = true;
                                            status = AttendanceStatus.EXCUSED;
                                        }
                                    }

                                    if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE || isCompensated) {
                                        return `<td style="font-weight:bold; font-size: 15px; color: green;">✓</td>`;
                                    } else if (status === AttendanceStatus.EXCUSED) {
                                        return `<td style="font-weight:bold; font-size: 11px; color: #0284c7;">معوض</td>`;
                                    } else {
                                        return `<td style="font-weight:bold; font-size: 15px; color: red;">✗</td>`;
                                    }
                                }).join('')}
                                <td></td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                <div style="text-align:center; font-size:10px; color:#555; margin-top:20px;">
                    تم الاستخراج آلياً من منصة "مُنظِّم" التعليمية - ${new Date().toLocaleString('ar-EG')}
                </div>
            </body>
            </html>
        `;

        return content;
    }
}
