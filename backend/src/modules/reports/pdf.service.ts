import puppeteer from 'puppeteer';
import { ReportsService } from './reports.service.js';
import { NotFoundException } from '../../common/utils/response/error.responce.js';

export class PdfService {
    
    /**
     * Generates a high-quality PDF report for a student using Puppeteer headless chrome.
     */
    static async generateStudentReportPdf(studentId: string, teacherId: string): Promise<Buffer> {
        
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
                    <p><strong>رقم الهاتف:</strong> <span dir="ltr">${student.studentPhone}</span></p>
                    <p><strong>المرحلة/الصف:</strong> ${student.gradeLevel}</p>
                    <p><strong>المجموعة:</strong> ${student.groupName}</p>
                </div>
                <div class="info-block">
                    <p><strong>اسم ولي الأمر:</strong> ${student.parentName || '—'}</p>
                    <p><strong>رقم ولي الأمر:</strong> <span dir="ltr">${student.parentPhone || '—'}</span></p>
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

        </body>
        </html>
        `;

        // 3. Launch Puppeteer and generate PDF
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true, // v22 defaults to 'new' which is fine
                args: ['--no-sandbox', '--disable-setuid-sandbox'] // essential for running safely on most server envs
            });
            const page = await browser.newPage();
            
            // Set content and wait for network idle to ensure fonts are loaded
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            
            // Generate PDF Buffer
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    bottom: '20px',
                    left: '20px',
                    right: '20px'
                }
            });

            return Buffer.from(pdfBuffer);
        } catch (error) {
            console.error('Puppeteer PDF Generation Error:', error);
            throw error; // Let the controller catch it
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}
