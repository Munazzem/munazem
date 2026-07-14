export interface ReceiptData {
    teacherName: string;
    studentName?: string;
    amount: number;
    description: string;
    date: string;
    transactionId?: string;
}

const getReceiptStyles = () => `
    @page { margin: 0; size: 80mm auto; }
    body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 13px;
        line-height: 1.5;
        color: #000;
        margin: 0;
        padding: 12px;
        width: 80mm;
        box-sizing: border-box;
        direction: rtl;
        background: #fff;
    }
    .receipt {
        text-align: center;
        border-bottom: 2px dashed #333;
        padding-bottom: 15px;
        margin-bottom: 15px;
        page-break-after: always;
    }
    .receipt:last-child {
        page-break-after: auto;
        border-bottom: none;
    }
    .logo-placeholder {
        width: 40px;
        height: 40px;
        margin: 0 auto 8px auto;
        border: 1px solid #000;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: bold;
    }
    .header { font-size: 16px; font-weight: 900; margin-bottom: 4px; color: #000; }
    .subheader { font-size: 12px; margin-bottom: 15px; color: #555; border-bottom: 1px solid #000; padding-bottom: 5px; display: inline-block; }
    .divider { border-bottom: 1px dashed #666; margin: 12px 0; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; text-align: right; }
    .label { font-weight: bold; color: #333; width: 35%; }
    .value { font-family: monospace; font-size: 14px; width: 65%; text-align: left; font-weight: 600; color: #000; }
    .total { font-size: 16px; font-weight: 900; margin-top: 15px; background: #f0f0f0; padding: 6px; border-radius: 4px; }
    .footer { font-size: 11px; margin-top: 15px; text-align: center; font-weight: bold; }
    .footer-note { font-size: 10px; color: #555; margin-top: 4px; }
`;

const buildReceipt = (data: ReceiptData) => `
    <div class="receipt">
        <div class="header">الأستاذ / ${data.teacherName}</div>
        <div class="subheader">إيصال استلام نقدية</div>
        
        ${data.studentName ? `<div class="row"><span class="label">الطالب:</span> <span class="value">${data.studentName}</span></div>` : ''}
        <div class="row"><span class="label">البيان:</span> <span class="value">${data.description}</span></div>
        <div class="row"><span class="label">التاريخ:</span> <span class="value">${new Date(data.date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
        ${data.transactionId ? `<div class="row"><span class="label">رقم العملية:</span> <span class="value">#${data.transactionId.slice(-6).toUpperCase()}</span></div>` : ''}
        
        <div class="divider"></div>
        <div class="row total">
            <span class="label">المبلغ:</span> 
            <span class="value">${data.amount} ج.م</span>
        </div>
        
        <div class="footer">شكراً لثقتكم بنا</div>
        <div class="footer-note">نظام مُنظِّم للإدارة - Monazem</div>
    </div>
`;

export const generateReceiptHtml = (data: ReceiptData) => `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <title>طباعة الوصل</title>
        <style>${getReceiptStyles()}</style>
    </head>
    <body>
        ${buildReceipt(data)}
        <script>
            window.onload = () => { setTimeout(() => window.print(), 300); };
        </script>
    </body>
    </html>
`;

export const generateBatchReceiptsHtml = (receipts: ReceiptData[]) => `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <title>طباعة الوصلات المجمعة</title>
        <style>${getReceiptStyles()}</style>
    </head>
    <body>
        ${receipts.map(buildReceipt).join('')}
        <script>
            window.onload = () => { setTimeout(() => window.print(), 300); };
        </script>
    </body>
    </html>
`;
