// Removed Puppeteer imports and local chrome paths

import { ReportsService } from './reports.service.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import { SessionService } from '../sessions/sessions.service.js';
import { NotFoundException } from '../../common/utils/response/error.responce.js';

export class PdfService {

    // Common HTML wrapper helper to avoid repetitive CSS
    private static wrapHtmlContent(title: string, content: string): string {
        return `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&display=swap');
                body {
                    font-family: 'Cairo', sans-serif;
                    background-color: #fff;
                    color: #333;
                    padding: 40px;
                    margin: 0;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #5a5a5a;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .header h1 {
                    margin: 0;
                    color: #1a1a1a;
                    font-size: 28px;
                }
                .header h2 {
                    margin: 5px 0 0 0;
                    color: #666;
                    font-size: 18px;
                }
                .section-title {
                    font-size: 20px;
                    border-bottom: 1px solid #ccc;
                    padding-bottom: 5px;
                    margin-top: 30px;
                    margin-bottom: 15px;
                    color: #2c3e50;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: center;
                }
                th {
                    background-color: #f4f4f4;
                    font-weight: 600;
                }
                .summary-cards {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .card {
                    flex: 1;
                    background: #f1f8ff;
                    border: 1px solid #cce5ff;
                    padding: 15px;
                    border-radius: 6px;
                    text-align: center;
                }
                .card span {
                    display: block;
                    font-size: 24px;
                    font-weight: bold;
                    color: #004085;
                    margin-top: 5px;
                }
                .footer {
                    margin-top: 50px;
                    text-align: center;
                    color: #888;
                    border-top: 1px solid #eee;
                    padding-top: 10px;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>منصة مُنظِّم — Monazem</h1>
                <h2>${title}</h2>
            </div>
            ${content}
            <div class="footer">
                <p>تم استخراج هذا التقرير آلياً من منصة "مُنظِّم" التعليمية - ${new Date().toLocaleString('ar-EG')}</p>
            </div>
            <script>
                // Auto-print when loaded
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
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
        
        // 1. Fetch complete report data
        const reportData = await ReportsService.getStudentReport(studentId, teacherId);
        if (!reportData) {
            throw NotFoundException({ message: 'بيانات الطالب غير متوفرة لطباعة التقرير' });
        }

        const { student, attendance, payments } = reportData;

        // 2. Build HTML Template
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>تقرير الطالب - ${student.studentName}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&display=swap');
                body {
                    font-family: 'Cairo', sans-serif;
                    background-color: #fff;
                    color: #333;
                    padding: 40px;
                    margin: 0;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #5a5a5a;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .header h1 {
                    margin: 0;
                    color: #1a1a1a;
                    font-size: 28px;
                }
                .header h2 {
                    margin: 5px 0 0 0;
                    color: #666;
                    font-size: 18px;
                }
                .info-section {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 30px;
                    background-color: #f9f9f9;
                    padding: 20px;
                    border-radius: 8px;
                }
                .info-block {
                    flex: 1;
                }
                .info-block p {
                    margin: 5px 0;
                    font-size: 16px;
                }
                .info-block strong {
                    color: #000;
                }
                .barcode-block {
                    text-align: center;
                    flex-basis: 30%;
                }
                .barcode-block img {
                    max-width: 100%;
                    height: auto;
                    border: 1px solid #ddd;
                    padding: 5px;
                    border-radius: 4px;
                }
                .section-title {
                    font-size: 20px;
                    border-bottom: 1px solid #ccc;
                    padding-bottom: 5px;
                    margin-top: 30px;
                    margin-bottom: 15px;
                    color: #2c3e50;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 12px;
                    text-align: center;
                }
                th {
                    background-color: #f4f4f4;
                    font-weight: 600;
                }
                .summary-cards {
                    display: flex;
                    gap: 15px;
                }
                .card {
                    flex: 1;
                    background: #f1f8ff;
                    border: 1px solid #cce5ff;
                    padding: 15px;
                    border-radius: 6px;
                    text-align: center;
                }
                .card span {
                    display: block;
                    font-size: 24px;
                    font-weight: bold;
                    color: #004085;
                    margin-top: 5px;
                }
            </style>
        </head>
        <body>

            <div class="header">
                <h1>منصة مُنظِّم — Monazem</h1>
                <h2>تقرير شامل لبيانات الطالب الفنية والمالية</h2>
            </div>

            <div class="info-section">
                <div class="info-block">
                    <p><strong>اسم الطالب:</strong> ${student.studentName}</p>
                    <p><strong>رقم الهاتف:</strong> <span dir="ltr">${student.studentPhone ?? '—'}</span></p>
                    <p><strong>المرحلة/الصف:</strong> ${student.gradeLevel ?? '—'}</p>
                    <p><strong>المجموعة:</strong> ${student.groupName ?? '—'}</p>
                    <p><strong>كود الطالب:</strong> ${(student as any).studentCode ?? '—'}</p>
                </div>
                <div class="info-block">
                    <p><strong>اسم ولي الأمر:</strong> ${student.parentName ?? '—'}</p>
                    <p><strong>رقم ولي الأمر:</strong> <span dir="ltr">${(student as any).parentPhone ?? '—'}</span></p>
                    <p><strong>الحالة:</strong> ${student.isActive ? 'نشط' : 'غير نشط'}</p>
                </div>
                <!-- Dynamic Barcode Image Exported directly from getStudentReport -->
                ${student.barcodeImageBase64 ? `
                <div class="barcode-block">
                    <img src="${student.barcodeImageBase64}" alt="Barcode"/>
                    <p style="margin-top:5px; font-size:12px; color:#555">كود الطالب للماسح الضوئي</p>
                </div>
                ` : ''}
            </div>

            <h3 class="section-title">أولاً: مُلخص الغياب والحضور</h3>
            <div class="summary-cards">
                <div class="card">
                    إجمالي الحصص المٌسجلة
                    <span>${attendance.totalSessions}</span>
                </div>
                <div class="card">
                    حضـور
                    <span style="color: #155724; background: #d4edda; border-color: #c3e6cb;">${attendance.presentCount}</span>
                </div>
                <div class="card">
                    غيـاب
                    <span style="color: #721c24; background: #f8d7da; border-color: #f5c6cb;">${attendance.absentCount}</span>
                </div>
                <div class="card">
                    نسبة الحضور
                    <span>${attendance.attendanceRate}</span>
                </div>
            </div>

            <h3 class="section-title">ثانياً: المُعاملات المالية والاشتراكات</h3>
            <div class="summary-cards" style="margin-bottom: 20px;">
                <div class="card" style="background: #fff3cd; border-color: #ffeeba;">
                    إجمالي المدفوعات
                    <span style="color: #856404;">${payments.totalPaid} ج.م</span>
                </div>
                <div class="card" style="background: #e2e3e5; border-color: #d6d8db;">
                    إجمالي الخصومات الممنوحة
                    <span style="color: #383d41;">${payments.totalDiscount} ج.م</span>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>التاريخ</th>
                        <th>نوع الدفع</th>
                        <th>التفاصيل</th>
                        <th>المبلغ الأصلي</th>
                        <th>الخصم</th>
                        <th>المدفوع</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.history.length === 0 ? '<tr><td colspan="6">لا توجد معاملات مالية مسجلة</td></tr>' : 
                    payments.history.map((p: any) => `
                        <tr>
                            <td dir="ltr">${new Date(p.date).toLocaleDateString()}</td>
                            <td>${p.category === 'SUBSCRIPTION' ? 'اشتراك حصة/شهر' : (p.category === 'NOTEBOOK_SALE' ? 'شراء مذكرة' : 'أخرى')}</td>
                            <td>${p.description || '—'}</td>
                            <td>${p.originalAmount}</td>
                            <td>${p.discountAmount}</td>
                            <td><strong>${p.paidAmount}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div style="margin-top: 50px; text-align: center; color: #888; border-top: 1px solid #eee; padding-top: 10px; font-size: 12px;">
                <p>تم استخراج هذا التقرير آلياً من منصة "مُنظِّم" التعليمية - ${new Date().toLocaleString('ar-EG')}</p>
            </div>

        <script>
            // Auto-print when loaded
            window.onload = function() {
                setTimeout(function() {
                    window.print();
                }, 500);
            }
        </script>
        </body>
        </html>
        `;

        return htmlContent;
    }

    // ─────────────────────────────────────────────────────────────────
    // 2. Financial Monthly Report PDF
    // ─────────────────────────────────────────────────────────────────
    static async generateMonthlyFinancialPdf(teacherId: string, year: number, month: number): Promise<string> {
        const report = await ReportsService.getFinancialMonthlyReport(teacherId, year, month);

        const content = `
            <div class="summary-cards">
                <div class="card" style="background: #d4edda; border-color: #c3e6cb;">
                    إجمالي الدخل
                    <span style="color: #155724;">${report.totalIncome} ج.م</span>
                </div>
                <div class="card" style="background: #f8d7da; border-color: #f5c6cb;">
                    إجمالي المصروفات
                    <span style="color: #721c24;">${report.totalExpenses} ج.م</span>
                </div>
                <div class="card" style="background: #cce5ff; border-color: #b8daff;">
                    صافي الأرباح
                    <span style="color: #004085;">${report.netBalance} ج.م</span>
                </div>
            </div>

            <h3 class="section-title">تحليل المصروفات والإيرادات</h3>
            <table>
                <thead>
                    <tr>
                        <th>النوع</th>
                        <th>البند</th>
                        <th>عدد العمليات</th>
                        <th>المبلغ الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.breakdown.length === 0 ? '<tr><td colspan="4">لا توجد حركات مالية</td></tr>' : 
                    report.breakdown.map((row: any) => `
                        <tr>
                            <td>${row._id.type === 'INCOME' ? 'إيرادات' : 'مصروفات'}</td>
                            <td>${row._id.category}</td>
                            <td>${row.count}</td>
                            <td><strong>${row.total} ج.م</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <h3 class="section-title">التسجيل اليومي (Daily Summary)</h3>
            <table>
                <thead>
                    <tr>
                        <th>اليوم</th>
                        <th>الدخل</th>
                        <th>المصروفات</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.dailySummaries.length === 0 ? '<tr><td colspan="3">لا توجد بيانات يومية</td></tr>' :
                    report.dailySummaries.map((day: any) => `
                        <tr>
                            <td dir="ltr">${day.date ? new Date(day.date).toLocaleDateString('ar-EG') : '—'}</td>
                            <td style="color: green;">${(day.totalIncome ?? day.income ?? 0).toLocaleString()} ج.م</td>
                            <td style="color: red;">${(day.totalExpenses ?? day.expense ?? 0).toLocaleString()} ج.م</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        return this.wrapHtmlContent(`التقرير المالي - شهر ${month} لسنة ${year}`, content);
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. Group Report PDF (List of Students and Stats)
    // ─────────────────────────────────────────────────────────────────
    static async generateGroupReportPdf(groupId: string, teacherId: string): Promise<string> {
        const report = await ReportsService.getGroupReport(groupId, teacherId);

        const content = `
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p><strong>الصف والمرحلة:</strong> ${report.group.gradeLevel ?? '—'}</p>
                ${Array.isArray(report.group.schedule) && report.group.schedule.length > 0
                    ? `<p><strong>المواعيد:</strong> ${report.group.schedule.map((s: any) => `${s.day ?? ''} ${s.time ?? ''}`).join(' | ')}</p>`
                    : report.group.schedule ? `<p><strong>المواعيد:</strong> ${report.group.schedule}</p>` : ''}
                <p><strong>عدد الطلاب:</strong> ${report.group.totalStudents ?? 0}</p>
            </div>

            <h3 class="section-title">مُلخص الغياب للمجموعة</h3>
            <div class="summary-cards">
                <div class="card">
                    إجمالي الحصص المكتملة
                    <span>${report.attendance.totalSessions}</span>
                </div>
                <div class="card">
                    إجمالي حالات الحضور
                    <span style="color: green">${report.attendance.totalPresences}</span>
                </div>
                <div class="card">
                    إجمالي حالات الغياب
                    <span style="color: red">${report.attendance.totalAbsences}</span>
                </div>
                <div class="card">
                    متوسط الحضور
                    <span>${report.attendance.avgAttendanceRate}</span>
                </div>
            </div>

            <h3 class="section-title">أرباح المجموعة (تصنيف)</h3>
            <table>
                <thead>
                    <tr>
                        <th>البند</th>
                        <th>العدد</th>
                        <th>إجمالي الدخل</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.revenue.breakdown.length === 0 ? '<tr><td colspan="3">لا توجد إيرادات مسجلة</td></tr>' : 
                    report.revenue.breakdown.map((r: any) => `
                        <tr>
                            <td>${r._id}</td>
                            <td>${r.count}</td>
                            <td><strong>${r.total} ج.م</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        return this.wrapHtmlContent(`تقرير المجموعة: ${report.group.name}`, content);
    }

    // ─────────────────────────────────────────────────────────────────
    // 4. Session Attendance List PDF
    // ─────────────────────────────────────────────────────────────────
    static async generateSessionAttendancePdf(sessionId: string, teacherId: string): Promise<string> {
        const session = await SessionService.getSessionById(sessionId, teacherId);
        const attendanceList = await AttendanceService.getSessionAttendance(sessionId, teacherId);

        const content = `
            <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p><strong>تاريخ الحصة:</strong> <span dir="ltr">${new Date(session.date).toLocaleDateString()}</span></p>
                <p><strong>وقت البدء:</strong> ${session.startTime}</p>
                <p><strong>حالة الحصة:</strong> ${session.status === 'COMPLETED' ? 'مكتملة' : 'قيد الإجراء'}</p>
                <p><strong>عدد المسجلين في الكشف:</strong> ${attendanceList.length} طالب</p>
            </div>

            <h3 class="section-title">كشف أسماء الطلاب والغياب</h3>
            <table>
                <thead>
                    <tr>
                        <th>م</th>
                        <th>كود الطالب</th>
                        <th>اسم الطالب</th>
                        <th>رقم الهاتف</th>
                        <th>حالة الحضور</th>
                        <th>وقت التسجيل</th>
                    </tr>
                </thead>
                <tbody>
                    ${attendanceList.length === 0 ? '<tr><td colspan="6">لم يتم تسجيل أي طلاب في هذا الكشف</td></tr>' : 
                    attendanceList.map((record: any, index: number) => {
                        const isAttended = record.status === 'ATTENDED' || record.status === 'GUEST';
                        const statusColor = isAttended ? 'green' : 'red';
                        const statusText = record.status === 'ATTENDED' ? 'حاضر' : (record.status === 'ABSENT' ? 'غائب' : 'زائر (مجموعة أخرى)');
                        return `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${record.studentId?.studentCode || '—'}</td>
                            <td>${record.studentId?.studentName || '—'}</td>
                            <td dir="ltr">${record.studentId?.studentPhone || '—'}</td>
                            <td style="color: ${statusColor}; font-weight: bold;">${statusText}</td>
                            <td dir="ltr">${record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString() : '—'}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        return this.wrapHtmlContent(`كشف غياب الحصة`, content);
    }
}
