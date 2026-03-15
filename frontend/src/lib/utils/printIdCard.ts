import QRCode from 'qrcode';
import type { StudentWithGroup } from '@/types/student.types';

export const generateIdCardsHtml = async (students: StudentWithGroup[]): Promise<string> => {
    // Generate QR codes for all students
    const studentsWithQr = await Promise.all(
        students.map(async (stu) => {
            const qrValue = stu.barcode || stu.studentCode || stu._id;
            const qrDataUrl = await QRCode.toDataURL(qrValue, {
                width: 200,
                margin: 1,
                color: { dark: '#000000', light: '#ffffff' },
                errorCorrectionLevel: 'H',
            });
            return { ...stu, qrDataUrl };
        })
    );

    const cardsHtml = studentsWithQr.map((stu) => {
        const groupName = typeof stu.groupId === 'object' && stu.groupId !== null
            ? (stu.groupId as { name: string }).name
            : stu.groupDetails?.name || 'بدون مجموعة';

        return `
            <div class="page">
                <div class="header">
                    <h1>منصة مُنظِّم</h1>
                    <p>بطاقة تعريف طالب</p>
                </div>
                
                <div class="content">
                    <div class="qr-wrapper">
                        <img class="qr-code" src="${stu.qrDataUrl}" alt="QR Code" />
                        <div class="barcode" dir="ltr">${stu.barcode || stu.studentCode || stu._id}</div>
                    </div>

                    <div class="student-name">${stu.studentName}</div>
                    
                    <div class="details-grid">
                        <div class="detail-item">
                            <span class="label">المرحلة</span>
                            <span class="value">${stu.gradeLevel}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">المجموعة</span>
                            <span class="value">${groupName}</span>
                        </div>
                        <div class="detail-item">
                            <span class="label">رقم الطالب</span>
                            <span class="value" dir="ltr">${stu.studentPhone || '—'}</span>
                        </div>
                        ${stu.parentPhone ? `
                        <div class="detail-item">
                            <span class="label">ولي الأمر</span>
                            <span class="value" dir="ltr">${stu.parentPhone}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="footer">
                    تم إصدار هذه البطاقة من نظام مُنظِّم
                </div>
            </div>
        `;
    }).join('');

    return `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>طباعة بطاقات الطلاب</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
            <style>
                @page {
                    size: A4 portrait;
                    margin: 0;
                }
                body, html {
                    font-family: 'Cairo', sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #e2e8f0;
                    color: #0f172a;
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                .print-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 20mm 0;
                    gap: 20mm;
                }

                .page {
                    width: 210mm;
                    height: 296mm; /* slightly less than 297mm to prevent overflow blank page */
                    background: white;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    overflow: hidden;
                    page-break-after: always;
                    page-break-inside: avoid;
                }

                @media print {
                    body, html {
                        background-color: white;
                    }
                    .print-container {
                        padding: 0;
                        gap: 0;
                        display: block;
                    }
                    .page {
                        box-shadow: none !important;
                        margin: 0;
                        height: 100vh;
                        width: 100vw;
                        border: none;
                    }
                }

                /* Header */
                .header {
                    background-color: #0f4c81;
                    color: white;
                    text-align: center;
                    padding: 30px 20px;
                    border-bottom: 8px solid #0a365c;
                }
                .header h1 {
                    margin: 0;
                    font-size: 36px;
                    font-weight: 800;
                    letter-spacing: 1px;
                }
                .header p {
                    margin: 5px 0 0 0;
                    font-size: 20px;
                    color: #bae6fd;
                }

                /* Content */
                .content {
                    flex: 1;
                    padding: 30px 50px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                /* QR Section */
                .qr-wrapper {
                    text-align: center;
                    background: #f8fafc;
                    padding: 15px;
                    border-radius: 16px;
                    border: 3px dashed #cbd5e1;
                    margin-bottom: 25px;
                }
                .qr-code {
                    width: 250px;
                    height: 250px;
                    display: block;
                    margin: 0 auto;
                }
                .barcode {
                    margin-top: 10px;
                    font-size: 16px;
                    color: #475569;
                    font-family: monospace;
                    letter-spacing: 1px;
                }

                /* Student Info */
                .student-name {
                    font-size: 38px;
                    font-weight: 800;
                    color: #0f4c81;
                    text-align: center;
                    margin: 0 0 25px 0;
                    width: 100%;
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 15px;
                }

                .details-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    width: 100%;
                }

                .detail-item {
                    display: flex;
                    flex-direction: column;
                    background: #f1f5f9;
                    padding: 15px 20px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                }
                .detail-item .label {
                    font-size: 16px;
                    color: #64748b;
                    font-weight: 700;
                    margin-bottom: 4px;
                }
                .detail-item .value {
                    font-size: 22px;
                    font-weight: 800;
                    color: #0f172a;
                    word-break: break-word;
                }

                /* Footer */
                .footer {
                    background-color: #f8fafc;
                    color: #94a3b8;
                    text-align: center;
                    padding: 20px;
                    font-size: 16px;
                    font-weight: 600;
                    border-top: 1px solid #e2e8f0;
                }
            </style>
        </head>
        <body>
            <div class="print-container">
                ${cardsHtml}
            </div>
            <script>
                window.onload = function() {
                    // small timeout ensuring styles and images load fully before print dialog
                    setTimeout(() => window.print(), 300);
                };
            </script>
        </body>
        </html>
    `;
};
