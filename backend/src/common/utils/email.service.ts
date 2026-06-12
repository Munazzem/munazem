import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { envVars } from '../../../config/env.service.js';
import { logger }  from './logger.util.js';

// ─── Singleton transporter ───────────────────────────────────────────────────
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
    if (transporter) return transporter;

    if (!envVars.smtpUser || !envVars.smtpPass) {
        logger.warn('email_not_configured', {
            message: 'SMTP_USER / SMTP_PASS not set — email sending is disabled',
        });
        return null;
    }

    transporter = nodemailer.createTransport({
        host: envVars.smtpHost,
        port: envVars.smtpPort,
        secure: envVars.smtpPort === 465,  // true for 465, false for 587
        auth: {
            user: envVars.smtpUser,
            pass: envVars.smtpPass,
        },
    });

    return transporter;
}

// ─── Types ───────────────────────────────────────────────────────────────────
export interface WeeklyReportData {
    teacherName:          string;
    teacherEmail:         string;
    weekStart:            string;  // formatted date string
    weekEnd:              string;
    incomeSubscriptions:  number;
    incomeNotebooks:      number;
    incomeOther:          number;
    totalIncome:          number;
    expenseSalaries:      number;
    expenseRent:          number;
    expenseOther:         number;
    totalExpenses:        number;
    netBalance:           number;
    completedSessions:    number;
    cancelledSessions:    number;
    totalStudents:        number;
    unpaidStudents:       number;
}

// ─── HTML template builder ───────────────────────────────────────────────────
function buildWeeklyReportHTML(d: WeeklyReportData): string {
    const fmt = (n: number) => n.toLocaleString('ar-EG');
    const balanceColor = d.netBalance >= 0 ? '#22c55e' : '#ef4444';
    const baseUrl = envVars.frontendUrl.split(',')[0];

    const linkStyle = "color:inherit;text-decoration:none;border-bottom:1px dashed currentColor;";

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;color:#fff;">
    <h1 style="margin:0;font-size:22px;">📊 التقرير الأسبوعي</h1>
    <p style="margin:8px 0 0;opacity:.85;font-size:14px;">من ${d.weekStart} إلى ${d.weekEnd}</p>
  </div>

  <div style="padding:24px 32px;">

    <!-- Greeting & Warm Message -->
    <div style="margin-bottom:24px;line-height:1.6;color:#334155;font-size:15px;">
      <p style="margin:0 0 10px;font-size:18px;font-weight:600;color:#1e293b;">أهلاً بك أ. ${d.teacherName} 👋</p>
      <p style="margin:0;">لأننا في <strong>منظّم</strong> دايماً معاك خطوة بخطوة، بنتابع كل تفاصيل شغلك بدقة عشان تركز إنت في الشرح والإبداع مع طلابك، وتسيب الإدارة والحسابات علينا! ✨</p>
      <p style="margin:8px 0 0;color:#64748b;font-size:14px;">إليك ملخص سريع لإنجازاتك خلال الأسبوع الماضي:</p>
    </div>

    <!-- الإيرادات -->
    <h2 style="font-size:16px;color:#6366f1;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:12px;">
      <a href="${baseUrl}/dashboard/reports" style="${linkStyle}color:#6366f1;border-bottom:none;">💰 الإيرادات</a>
    </h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
      <tr><td style="padding:6px 0;color:#64748b;"><a href="${baseUrl}/dashboard/students" style="${linkStyle}">اشتراكات الطلاب</a></td><td style="padding:6px 0;text-align:left;font-weight:600;">${fmt(d.incomeSubscriptions)} ج.م</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">مبيعات المذكرات</td><td style="padding:6px 0;text-align:left;font-weight:600;">${fmt(d.incomeNotebooks)} ج.م</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">إيرادات أخرى</td><td style="padding:6px 0;text-align:left;font-weight:600;">${fmt(d.incomeOther)} ج.م</td></tr>
      <tr style="border-top:2px solid #e5e7eb;"><td style="padding:10px 0;font-weight:700;color:#22c55e;">إجمالي الإيرادات</td><td style="padding:10px 0;text-align:left;font-weight:700;color:#22c55e;font-size:16px;">${fmt(d.totalIncome)} ج.م</td></tr>
    </table>

    <!-- المصروفات -->
    <h2 style="font-size:16px;color:#ef4444;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:12px;">
      <a href="${baseUrl}/dashboard/reports" style="${linkStyle}color:#ef4444;border-bottom:none;">💸 المصروفات</a>
    </h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
      <tr><td style="padding:6px 0;color:#64748b;">مرتبات</td><td style="padding:6px 0;text-align:left;font-weight:600;">${fmt(d.expenseSalaries)} ج.م</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">إيجار</td><td style="padding:6px 0;text-align:left;font-weight:600;">${fmt(d.expenseRent)} ج.م</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">مصروفات أخرى</td><td style="padding:6px 0;text-align:left;font-weight:600;">${fmt(d.expenseOther)} ج.م</td></tr>
      <tr style="border-top:2px solid #e5e7eb;"><td style="padding:10px 0;font-weight:700;color:#ef4444;">إجمالي المصروفات</td><td style="padding:10px 0;text-align:left;font-weight:700;color:#ef4444;font-size:16px;">${fmt(d.totalExpenses)} ج.م</td></tr>
    </table>

    <!-- صافي الربح -->
    <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#64748b;">📈 صافي الربح</p>
      <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:${balanceColor};">${fmt(d.netBalance)} ج.م</p>
    </div>

    <!-- الحصص والطلاب -->
    <div style="display:flex;gap:12px;margin-bottom:20px;">
      <div style="flex:1;background:#f0fdf4;border-radius:10px;padding:14px;text-align:center;">
        <p style="margin:0;font-size:24px;font-weight:700;color:#22c55e;">${d.completedSessions}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#64748b;"><a href="${baseUrl}/dashboard/sessions" style="${linkStyle}">حصص مكتملة ✅</a></p>
      </div>
      <div style="flex:1;background:#fef2f2;border-radius:10px;padding:14px;text-align:center;">
        <p style="margin:0;font-size:24px;font-weight:700;color:#ef4444;">${d.cancelledSessions}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#64748b;"><a href="${baseUrl}/dashboard/sessions" style="${linkStyle}">حصص ملغية ❌</a></p>
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:20px;">
      <div style="flex:1;background:#eff6ff;border-radius:10px;padding:14px;text-align:center;">
        <p style="margin:0;font-size:24px;font-weight:700;color:#3b82f6;">${d.totalStudents}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#64748b;"><a href="${baseUrl}/dashboard/students" style="${linkStyle}">إجمالي الطلاب 👥</a></p>
      </div>
      <div style="flex:1;background:#fffbeb;border-radius:10px;padding:14px;text-align:center;">
        <p style="margin:0;font-size:24px;font-weight:700;color:#f59e0b;">${d.unpaidStudents}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#64748b;"><a href="${baseUrl}/dashboard/students" style="${linkStyle}">لم يدفعوا ⚠️</a></p>
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div style="background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8;">
    تقرير آلي من نظام <strong>منظم</strong> — لا تحتاج للرد على هذا الإيميل.
  </div>

</div>
</body>
</html>`;
}

// ─── Send weekly report email ────────────────────────────────────────────────
export async function sendWeeklyReportEmail(data: WeeklyReportData): Promise<boolean> {
    const t = getTransporter();
    if (!t) {
        logger.warn('email_skipped_no_transporter', { teacherEmail: data.teacherEmail });
        return false;
    }

    try {
        await t.sendMail({
            from:    envVars.smtpFrom,
            to:      data.teacherEmail,
            subject: `📊 التقرير الأسبوعي — ${data.weekStart} إلى ${data.weekEnd}`,
            html:    buildWeeklyReportHTML(data),
        });

        logger.info('email_weekly_report_sent', {
            teacherEmail: data.teacherEmail,
            weekStart:    data.weekStart,
        });
        return true;
    } catch (err) {
        logger.error('email_weekly_report_failed', {
            teacherEmail: data.teacherEmail,
            error:        (err as Error).message,
        });
        return false;
    }
}
