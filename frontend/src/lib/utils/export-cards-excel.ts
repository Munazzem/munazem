import * as XLSX from 'xlsx';

export interface ExportCardData {
    cardNumber: string;
    cardToken?: string;
    status?: string;
    studentId?: {
        studentName?: string;
        studentCode?: string;
        gradeLevel?: string;
    } | null;
    centerStudentId?: {
        studentName?: string;
        studentCode?: string;
        gradeLevel?: string;
    } | null;
    createdAt?: string;
    batchId?: string | null;
}

/**
 * Generates and downloads an Excel file containing card QR data formatted for print shops / archiving.
 */
export function exportCardsToExcel(
    cards: ExportCardData[],
    batchId?: string,
    batchCount?: number
) {
    if (!cards || cards.length === 0) {
        throw new Error('لا توجد كروت للتصدير');
    }

    const rows = cards.map((card, idx) => {
        let studentName = '—';
        let studentCode = '—';
        let gradeLevel = '—';

        const s = card.studentId || card.centerStudentId;
        if (s && typeof s === 'object') {
            studentName = s.studentName || '—';
            studentCode = s.studentCode || '—';
            gradeLevel = s.gradeLevel || '—';
        }

        let statusText = 'جديد (غير مربوط)';
        if (card.status === 'LINKED') {
            statusText = 'مربوط بطالب';
        } else if (card.status === 'DISABLED') {
            statusText = 'معطل';
        }

        return {
            'م': idx + 1,
            'كود الـ QR / رقم الكارت': card.cardNumber,
            'حالة الكارت': statusText,
            'اسم الطالب': studentName,
            'كود الطالب': studentCode,
            'الصف الدراسي': gradeLevel,
            'تاريخ الإنشاء': card.createdAt
                ? new Date(card.createdAt).toLocaleDateString('ar-EG', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                  })
                : new Date().toLocaleDateString('ar-EG', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                  }),
            'رقم الدفعة (Batch ID)': card.batchId || batchId || '—',
            'رمز الأمان (Token)': card.cardToken || '—',
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Set Sheet Direction to RTL (Right-to-Left)
    worksheet['!views'] = [{ RTL: true }];

    // Column widths
    worksheet['!cols'] = [
        { wch: 6 },   // م
        { wch: 28 },  // كود الـ QR / رقم الكارت
        { wch: 18 },  // حالة الكارت
        { wch: 24 },  // اسم الطالب
        { wch: 14 },  // كود الطالب
        { wch: 18 },  // الصف الدراسي
        { wch: 22 },  // تاريخ الإنشاء
        { wch: 38 },  // رقم الدفعة
        { wch: 38 },  // رمز الأمان
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'أكواد_الكروت');

    const shortBatch = batchId ? `_${batchId.slice(0, 8)}` : '';
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `كروت_QR_دفعة${shortBatch}_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);
}
