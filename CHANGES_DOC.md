# توثيق التعديلات الأخيرة (Uncommitted Changes)

يحتوي هذا الملف على تفاصيل التعديلات التي تم إجراؤها على المشروع والتي لم يتم رفعها (Commit) حتى الآن. تم تقسيم التعديلات إلى مجموعات حسب الميزة (Feature) لتسهيل المراجعة وتتبع التغييرات.

## 1. ميزة أتمتة الواتساب (WhatsApp Automation) والمراقبة الحية (Socket.io)
**الهدف:** تحسين نظام أتمتة الواتساب ليعمل في الخلفية (Queues) مع إضافة إمكانية المراقبة اللحظية (Real-time monitoring) من خلال لوحة تحكم الإدارة (Super Admin).

**الملفات المعدلة:**
- `backend/src/infrastructure/queues/whatsapp.processor.ts`: إضافة معالج طوابير (Processor) للتعامل مع رسائل الواتساب المرسلة في الخلفية لتجنب توقف النظام.
- `backend/src/infrastructure/socket/whatsapp.gateway.ts`: إعداد Socket.io لإرسال تحديثات لحظية للإدارة بحالة الرسائل (تم الإرسال، فشل، قيد الانتظار).
- `backend/src/common/utils/whatsapp.service.ts`: تحديث خدمة الواتساب لربطها بالطوابير (Queues) وتسجيل حالة الاتصال.
- `frontend/src/app/(dashboard)/admin/automation/page.tsx`: إنشاء وتحديث واجهة المراقبة الحية للواتساب في لوحة تحكم السوبر آدمن (Super Admin) لعرض الإحصائيات وحالة الطابور بشكل فوري.

## 2. خدمة تصدير الامتحانات إلى PDF (Exam to PDF Conversion)
**الهدف:** بناء خدمة تتيح للمدرسين تحويل الامتحانات إلى ملفات PDF قابلة للطباعة بتصميم احترافي (A4) يتضمن بيانات السنتر، اللوجو، وأقسام الأسئلة المنظمة.

**الملفات المعدلة والمضافة:**
- `backend/src/modules/exams/exam-pdf.service.ts` *(ملف جديد)*: بناء الكود الخاص بتوليد HTML للامتحان بشكل احترافي، متضمناً معالجة الأخطاء المطبعية وتنسيق الأسئلة (اختياري، صح/خطأ، مقالي).
- `frontend/src/app/(dashboard)/exams/[examId]/page.tsx`: إضافة واجهة أو زر للمدرس لمعاينة الامتحان وطباعته كـ PDF.
- `frontend/src/components/exams/AIGenerateExamModal.tsx` & `CreateExamModal.tsx`: تحسين النوافذ المنبثقة لإنشاء الامتحانات لتشمل خيارات الطباعة.

## 3. إضافة مرحلة الابتدائية (Primary School Stage)
**الهدف:** توسيع النظام ليشمل صفوف المرحلة الابتدائية استجابةً لمتطلبات المدرسين.

**الملفات المعدلة:**
- `backend/src/common/enums/enum.service.ts`: إضافة "الابتدائية" إلى قائمة الـ Enums العامة في الباك اند.
- `frontend/src/lib/constants/grade.constants.ts` & `frontend/src/lib/utils/grades.ts`: تحديث ثوابت النظام في الواجهة الأمامية (Frontend) لتشمل الصفوف الابتدائية (من الأول إلى السادس الابتدائي).

## 4. تحسينات قسم المدفوعات والاشتراكات (Payments & Subscriptions)
**الهدف:** إضافة نوافذ منبثقة جديدة لخصومات السنتر (Center Deduction) وتحسين فواتير الدفع والإيصالات.

**الملفات المعدلة والمضافة:**
- `frontend/src/components/payments/CenterDeductionModal.tsx` *(ملف جديد)*: نافذة لإدارة خصومات السنتر.
- `frontend/src/lib/utils/receiptHtml.ts` *(ملف جديد)*: قالب HTML مخصص لتوليد إيصالات الدفع.
- تعديلات في `payments.controller.ts`, `payments.service.ts`, `transactions.model.ts`: لتحديث منطق حسابات الخصومات ودفعات السنتر.

## 5. ميزة استخراج كروت المجموعات (Group Cards PDF)
**الهدف:** توليد كروت أو بطاقات للطلاب داخل المجموعات في صيغة PDF قابلة للطباعة.

**الملفات المضافة:**
- `backend/src/modules/students/group-cards-pdf.service.ts` *(ملف جديد)*: خدمة مسؤولة عن تجميع بيانات طلاب المجموعة وتنسيقها في كروت جاهزة للطباعة بصيغة PDF.

## 6. تعديلات عامة في الواجهات ولوحة التحكم (UI/UX & Dashboard Updates)
**الهدف:** تحسين العرض الرسومي وتحديث صفحات الإدارة المختلفة بناءً على الملاحظات.

**الملفات المعدلة:**
- مكونات الرسوم البيانية (Charts) مثل `AttendanceTrendChart`, `IncomeTrendChart`: تحسين طريقة عرض البيانات للإدارة.
- `frontend/src/components/dashboard/SuperAdminDashboard.tsx` & `AdminDashboard`: تحديث لوحة التحكم لتعرض إحصائيات دقيقة.
- `frontend/src/app/(dashboard)/dashboard/settings/page.tsx`: تحديث واجهة الإعدادات الخاصة بالنظام وتفعيل الخيارات الجديدة.

---

**خطة الرفع (Git Plan):**
سيتم رفع هذه التعديلات في فرع (Branch) جديد تحت اسم `feature/platform-updates`.
وسيتم تقسيمها إلى عدة Commits كالتالي للحفاظ على نظافة الـ Git History:
1. `feat(whatsapp): implement realtime automation and socket queues`
2. `feat(exams): add exam to PDF print-ready generation service`
3. `feat(core): add primary school stage to system enums`
4. `feat(payments): add center deduction modal and receipt templates`
5. `feat(students): add group cards PDF generation service`
6. `chore(ui): update dashboard charts and admin settings pages`
