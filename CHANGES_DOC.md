# توثيق التعديلات الأخيرة (Platform Major Updates)

يحتوي هذا الملف على قائمة مفصّلة **لكل التعديلات والملفات** التي تم إجراؤها على المشروع، مقسمة حسب القسم والميزة لضمان الشفافية وتسهيل المراجعة.

---

## 1. أتمتة الواتساب والمراقبة اللحظية (WhatsApp Automation)
تم تطوير نظام الواتساب ليعمل في الخلفية مع إضافة إمكانية المراقبة الحية لحالة الإرسال.
- `backend/src/infrastructure/queues/whatsapp.processor.ts`: إضافة معالج طوابير (Processor) للتعامل مع رسائل الواتساب المرسلة في الخلفية لتجنب توقف النظام.
- `backend/src/infrastructure/socket/whatsapp.gateway.ts`: إعداد Socket.io لإرسال تحديثات لحظية للإدارة بحالة الرسائل (تم الإرسال، فشل، قيد الانتظار).
- `backend/src/common/utils/whatsapp.service.ts`: تحديث خدمة الواتساب لربطها بالطوابير (Queues) وتسجيل حالة الاتصال.
- `frontend/src/app/(dashboard)/admin/automation/page.tsx`: إنشاء وتحديث واجهة المراقبة الحية للواتساب في لوحة تحكم السوبر آدمن (Super Admin) لعرض الإحصائيات وحالة الطابور بشكل فوري.

---

## 2. خدمة تصدير الامتحانات إلى PDF
إضافة قدرة تحويل الامتحانات إلى ملفات قابلة للطباعة بتصميم احترافي.
- `backend/src/modules/exams/exam-pdf.service.ts`: بناء الكود الخاص بتوليد HTML للامتحان بشكل احترافي، متضمناً تنسيق الأسئلة (اختياري، صح/خطأ، مقالي).
- `backend/src/modules/exams/exams.controller.ts`: إضافة Endpoint مخصصة لاستخراج ملف الامتحان كـ PDF.
- `frontend/src/app/(dashboard)/exams/[examId]/page.tsx`: إضافة واجهة المدرس لمعاينة الامتحان وطباعته.
- `frontend/src/app/(dashboard)/exams/page.tsx`: تعديلات بسيطة على صفحة الامتحانات للتوافق مع التصميم الجديد.
- `frontend/src/components/exams/AIGenerateExamModal.tsx`: تحديث النافذة المنبثقة لإنشاء الامتحان بالذكاء الاصطناعي لتدعم التصدير.
- `frontend/src/components/exams/CreateExamModal.tsx`: تحسين النافذة المنبثقة لإنشاء الامتحان يدوياً.
- `frontend/src/lib/api/exams.ts`: إضافة الدوال الخاصة بالاستدعاءات لملفات الـ PDF.

---

## 3. إعدادات المراحل التعليمية (المرحلة الابتدائية)
- `backend/src/common/enums/enum.service.ts`: إضافة "الابتدائية" إلى قائمة الـ Enums العامة.
- `frontend/src/lib/constants/grade.constants.ts`: تحديث ثوابت النظام في الواجهة الأمامية لتشمل صفوف المرحلة الابتدائية (من الأول للسادس).
- `frontend/src/lib/utils/grades.ts`: ضبط أدوات التعامل مع المراحل التعليمية.

---

## 4. نظام المدفوعات، الإيصالات، وخصومات السنتر
تطوير جذري في طرق الدفع والاشتراكات.
- `backend/src/database/models/price-settings.model.ts`: إضافة حقول الإعدادات الخاصة بخصومات السنتر.
- `backend/src/database/models/transaction.model.ts`: تعديل النموذج لحفظ بيانات الخصم.
- `backend/src/modules/payments/payments.controller.ts`: تحديث Endpoints التحكم بالمدفوعات.
- `backend/src/modules/payments/payments.service.ts`: تحديث منطق العمل (Business Logic) لحسابات الخصومات.
- `backend/src/types/price-settings.types.ts`: إضافة الأنواع (Types) المتعلقة بالخصومات.
- `backend/src/validation/payment.validation.ts`: تحديث قواعد التحقق (Validation) لعمليات الدفع.
- `frontend/src/components/payments/AddTransactionModal.tsx`: تحديث نافذة المعاملات.
- `frontend/src/components/payments/BatchSubscriptionModal.tsx`: تعديلات على الاشتراكات المجمعة.
- `frontend/src/components/payments/BulkSubscriptionModal.tsx`: تحديث الاشتراكات الشاملة.
- `frontend/src/components/payments/CenterDeductionModal.tsx`: إنشاء نافذة جديدة كلياً لإدارة تفاصيل خصم السنتر.
- `frontend/src/components/payments/PriceSettingsModal.tsx`: تحديث واجهة ضبط الأسعار لدعم الإعدادات الجديدة.
- `frontend/src/lib/api/payments.ts`: تحديث دوال الـ API الخاصة بالمدفوعات في الـ Frontend.
- `frontend/src/lib/utils/receiptHtml.ts`: إضافة قالب HTML جديد لتوليد إيصالات الدفع.

---

## 5. خدمة كروت الطلاب والمجموعات
- `backend/src/modules/students/group-cards-pdf.service.ts`: إضافة خدمة جديدة مسؤولة عن تجميع بيانات طلاب المجموعة وتنسيقها في كروت جاهزة للطباعة بصيغة PDF.

---

## 6. تعديلات النماذج وقواعد البيانات (Database Models)
تعديلات عامة لدعم الخصائص الجديدة (مثل جلسات التعويض وخصومات السنتر).
- `backend/src/database/models/attendance-snapshot.model.ts`: تعديل نماذج لقطات الحضور.
- `backend/src/database/models/attendance.model.ts`: تعديلات نموذج الحضور.
- `backend/src/database/models/student.model.ts`: تحديث خصائص نموذج الطالب.
- `backend/src/database/models/user.model.ts`: تحديث نموذج المستخدمين.
- `backend/src/types/user.types.ts`: تحديث الأنواع.
- `backend/src/validation/user.validation.ts`: قواعد التحقق للمستخدمين.

---

## 7. تحديثات وحدات الباك اند (Backend Core Services)
- `backend/src/modules/admin/admin.controller.ts` & `admin.service.ts`: إضافة وتطوير الـ Endpoints الخاصة بمدير النظام (السوبر آدمن).
- `backend/src/modules/groups/groups.service.ts`: تحسينات المجموعات.
- `backend/src/modules/sessions/sessions.controller.ts` & `sessions.service.ts`: إضافة منطق حساب الجلسات الإضافية والمرونة في المواعيد وإدارتها.
- `backend/src/modules/students/students.controller.ts`: تحديث دوال التحكم للطلاب.
- `backend/src/modules/users/users.service.ts`: تحديث إدارة المستخدمين.
- `backend/package.json` & `backend/package-lock.json`: تحديث الاعتماديات والمكتبات.

---

## 8. تحديثات لوحة التحكم (Frontend Dashboard & UI)
تحسين العرض والتصميم.
- `frontend/src/components/dashboard/charts/*`: تحديث جميع المخططات البيانية لدعم البيانات الحديثة بدقة (`AttendanceTrendChart`, `ExpensesBreakdownChart`, `IncomeTrendChart`, `PlanDistributionChart`, `StudentsDistributionChart`, `TeacherGrowthChart`).
- `frontend/src/components/dashboard/SuperAdminDashboard.tsx`: تحديث عرض اللوحة الرئيسية.
- `frontend/src/app/(dashboard)/dashboard/settings/page.tsx`: تحديث واجهة الإعدادات العامة.
- `frontend/src/app/(dashboard)/admin/page.tsx` & `admin/tenants/[id]/page.tsx`: تحديث صفحات الإدارة للسناتر.
- `frontend/src/app/(dashboard)/dashboard/users/*`: واجهات إدارة المستخدمين والمدرسين وتفاصيلهم.
- `frontend/src/app/(dashboard)/dashboard/notebooks/page.tsx` & `payments/page.tsx` & `subscriptions/page.tsx`: تحديثات عرض الجداول.
- `frontend/src/app/(dashboard)/groups/page.tsx` & `sessions/page.tsx`: تحسين عرض المجموعات والجلسات.

---

## 9. المكونات المشتركة (Frontend Components)
تعديلات على النوافذ المنبثقة والقوائم الجانبية لتتلائم مع المتطلبات الجديدة.
- **إدارة المستخدمين:** `frontend/src/components/users/AddTeacherModal.tsx`, `EditTeacherModal.tsx`, و `frontend/src/app/(dashboard)/admin/tenants/[id]/EditTeacherModal.tsx`.
- **الطلاب والمجموعات:** `frontend/src/components/students/AddStudentModal.tsx`, `BulkAddStudentsModal.tsx`, `ImportExcelModal.tsx`, `AddGroupModal.tsx`.
- **المذكرات:** `frontend/src/components/notebooks/AddNotebookModal.tsx`.
- **الهيكل العام:** `frontend/src/components/layout/Header.tsx`, `Sidebar.tsx`, `SuperAdminHeader.tsx`, `FreeTrialBanner.tsx`.
- **المكونات الأساسية (UI Components):** تعديل مكونات الواجهة مثل النوافذ، الأزرار، التنبيهات، وغيرها (`alert-dialog.tsx`, `badge.tsx`, `button.tsx`, `checkbox.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `form.tsx`, `input.tsx`, `label.tsx`, `scroll-area.tsx`, `select.tsx`, `switch.tsx`, `table.tsx`, `tabs.tsx`, `InstallPrompt.tsx`).

---

## 10. إعدادات النظام و الـ API
- `frontend/src/lib/api/admin.ts`, `axios.ts`, `sessions.ts`, `students.ts`: إضافة وتحديث مسارات الطلبات إلى الخادم.
- `frontend/src/types/admin.types.ts`, `auth.types.ts`, `payment.types.ts`, `user.types.ts`: إعدادات الـ TypeScript.
- `frontend/src/app/layout.tsx`, `page.tsx`, `~offline/page.tsx`: الهيكل التنظيمي للصفحات وصفحة عدم الاتصال.
- `frontend/public/manifest.json`: التحديثات الخاصة بالتطبيق كتطبيق ويب (PWA).

---

> تم رفع جميع هذه التعديلات في فرع `feature/platform-updates` وتم عمل Pull Request مفصّل لها.
