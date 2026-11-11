import axios from 'axios';
import Cookies from 'js-cookie';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store/auth.store';
import { OfflineStorageService } from '@/lib/offline/storage.service';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Resolve local IndexedDB data for essential entity GET requests when offline.
 */
async function resolveOfflineData(url: string, params?: any): Promise<any | null> {
    try {
        const rawUrl = url || '';
        const [cleanPath, queryString] = rawUrl.split('?');
        const cleanUrl = cleanPath.replace(/^https?:\/\/[^\/]+/, '');

        // NEVER resolve offline data for auth routes
        if (cleanUrl.startsWith('/auth') || cleanUrl.includes('/auth/')) {
            return null;
        }

        // Extract query parameters from URL string if present and merge with params object
        const urlParams: Record<string, any> = {};
        if (queryString) {
            const sp = new URLSearchParams(queryString);
            sp.forEach((value, key) => {
                urlParams[key] = value;
            });
        }
        const effectiveParams = { ...urlParams, ...(params || {}) };

        // 1. Groups
        if (cleanUrl === '/groups') {
            const groups = await OfflineStorageService.getOfflineGroups();
            return {
                status: 'success',
                message: 'تم استرجاع المجموعات من الكاش المحلي',
                data: {
                    data: groups,
                    pagination: { total: groups.length, page: 1, limit: 100, totalPages: 1 }
                }
            };
        }
        if (cleanUrl.startsWith('/groups/')) {
            const id = cleanUrl.replace('/groups/', '');
            const group = await OfflineStorageService.getOfflineGroupById(id);
            if (group) {
                return {
                    status: 'success',
                    message: 'تم استرجاع المجموعة من الكاش المحلي',
                    data: group
                };
            }
        }

        // 2. Students List
        if (cleanUrl === '/students') {
            const students = await OfflineStorageService.getOfflineStudents(effectiveParams);
            const page = parseInt(effectiveParams.page) || 1;
            const limit = parseInt(effectiveParams.limit) || 1000;
            const start = (page - 1) * limit;
            const pagedStudents = effectiveParams.page ? students.slice(start, start + limit) : students;
            return {
                status: 'success',
                message: 'تم استرجاع الطلاب من الكاش المحلي',
                data: {
                    data: pagedStudents,
                    pagination: {
                        total: students.length,
                        page,
                        limit,
                        totalPages: Math.ceil(students.length / limit) || 1
                    }
                }
            };
        }

        // 3. Single Student Details
        if (cleanUrl.startsWith('/students/')) {
            const id = cleanUrl.replace('/students/', '');
            const student = await OfflineStorageService.getOfflineStudentById(id);
            if (student) {
                return {
                    status: 'success',
                    message: 'تم استرجاع بيانات الطالب من الكاش المحلي',
                    data: student
                };
            }
        }

        // 4. Student Full Profile Report (Attendance, Subscriptions, Payments, Debts, Grades)
        if (cleanUrl.startsWith('/reports/student/') && !cleanUrl.endsWith('/pdf')) {
            const studentId = cleanUrl.replace('/reports/student/', '');
            const cachedReport = await OfflineStorageService.getOfflineStudentReport(studentId);
            if (cachedReport) {
                return {
                    status: 'success',
                    message: 'تم استرجاع تقرير الطالب من الكاش المحلي',
                    data: cachedReport
                };
            }

            // Fallback: build an offline report on the fly from local student data
            const student = await OfflineStorageService.getOfflineStudentById(studentId);
            if (student) {
                const targetGid = typeof student.groupId === 'object' ? student.groupId?._id : (student.groupId || student.groupDetails?._id);
                const [group, offlineGrades, groupSessions] = await Promise.all([
                    targetGid ? OfflineStorageService.getOfflineGroupById(targetGid) : null,
                    OfflineStorageService.getOfflineStudentGrades(studentId),
                    targetGid ? OfflineStorageService.getOfflineSessions(targetGid) : [],
                ]);

                const attendanceHistory = groupSessions.map(s => ({
                    sessionId: s._id,
                    date: s.date,
                    status: 'PRESENT',
                    homeworkDone: null,
                }));

                const fallbackReport = {
                    student: {
                        ...student,
                        groupName: group?.name || '—',
                        monthlySessionsQuota: (group as any)?.cycle?.capacity || 8,
                        remainingSessions: student.remainingSessions ?? 0,
                    },
                    attendance: {
                        totalSessions: attendanceHistory.length,
                        presentCount: attendanceHistory.length,
                        absentCount: 0,
                        attendanceRate: '100%',
                        history: attendanceHistory,
                        cycles: [],
                    },
                    payments: {
                        totalPaid: 0,
                        totalDiscount: 0,
                        subscriptionsCount: student.hasActiveSubscription ? 1 : 0,
                        notebookSalesCount: 0,
                        history: [],
                        subscriptions: [],
                        cycleEnrollments: [],
                        pastUnpaidCycles: [],
                        pastCyclesDebt: student.totalDebt || 0,
                        currentCycleNumber: 1,
                    },
                    grades: {
                        total: offlineGrades.length,
                        history: offlineGrades,
                    },
                };
                return {
                    status: 'success',
                    message: 'تم تجهيز تقرير الطالب محلياً في وضع عدم الاتصال',
                    data: fallbackReport,
                };
            }
        }

        // 5. Sessions
        if (cleanUrl === '/sessions') {
            const sessions = await OfflineStorageService.getOfflineSessions({
                groupId: effectiveParams?.groupId,
                date: effectiveParams?.date,
                status: effectiveParams?.status,
            });
            return {
                status: 'success',
                message: 'تم استرجاع الحصص من الكاش المحلي',
                data: {
                    data: sessions,
                    pagination: { total: sessions.length, page: 1, limit: 500, totalPages: 1 }
                }
            };
        }
        if (cleanUrl.startsWith('/sessions/')) {
            const id = cleanUrl.replace('/sessions/', '');
            const session = await OfflineStorageService.getOfflineSessionById(id);
            if (session) {
                return {
                    status: 'success',
                    message: 'تم استرجاع الحصة من الكاش المحلي',
                    data: session
                };
            }
        }

        // 6. Exams
        if (cleanUrl === '/exams') {
            const exams = await OfflineStorageService.getOfflineExams(effectiveParams);
            return {
                status: 'success',
                message: 'تم استرجاع الامتحانات من الكاش المحلي',
                data: {
                    data: exams,
                    pagination: { total: exams.length, page: 1, limit: 100, totalPages: 1 }
                }
            };
        }
        if (cleanUrl.startsWith('/exams/') && cleanUrl.endsWith('/results')) {
            const examId = cleanUrl.replace('/exams/', '').replace('/results', '');
            const cachedResults = await OfflineStorageService.getOfflineExamResults(examId);
            if (cachedResults) {
                return {
                    status: 'success',
                    message: 'تم استرجاع نتائج الامتحان من الكاش المحلي',
                    data: cachedResults,
                };
            }
            const exam = await OfflineStorageService.getOfflineExamById(examId);
            return {
                status: 'success',
                message: 'لا توجد نتائج مسجلة محلياً لهذا الامتحان',
                data: {
                    exam: exam || null,
                    results: [],
                    stats: { totalStudents: 0, appearedStudents: 0, averageScore: 0, passRate: 0 },
                },
            };
        }
        if (cleanUrl.startsWith('/exams/')) {
            const id = cleanUrl.replace('/exams/', '');
            const exam = await OfflineStorageService.getOfflineExamById(id);
            if (exam) {
                return {
                    status: 'success',
                    message: 'تم استرجاع الامتحان من الكاش المحلي',
                    data: exam
                };
            }
        }

        // 7. Attendance for session
        if (cleanUrl.startsWith('/attendance/session/')) {
            const sessionId = cleanUrl.replace('/attendance/session/', '');
            const records = await OfflineStorageService.getOfflineAttendanceRecords(sessionId);
            return {
                status: 'success',
                message: 'تم استرجاع سجلات الحضور من الكاش المحلي',
                data: records
            };
        }

        // 8. Daily Summary (الجرد اليومي)
        if (cleanUrl === '/reports/daily-summary') {
            const date = effectiveParams.date || new Date().toISOString().split('T')[0];
            const cachedSummary = await OfflineStorageService.getDailySummary(date);
            if (cachedSummary) {
                return {
                    status: 'success',
                    message: 'تم استرجاع ملخص اليوم من الكاش المحلي',
                    data: cachedSummary,
                };
            }
            return {
                status: 'success',
                message: 'ملخص اليوم في وضع الأوفلاين',
                data: {
                    date,
                    totalAttendance: 0,
                    totalIncome: 0,
                    totalExpenses: 0,
                    netBalance: 0,
                    sessions: [],
                    transactions: [],
                },
            };
        }

        // 9. Financial Ledgers & Prices (الماليات)
        if (cleanUrl === '/payments/ledger/daily') {
            const date = effectiveParams.date || new Date().toISOString().split('T')[0];
            const cachedLedger = await OfflineStorageService.getDailyLedger(date);
            if (cachedLedger) {
                return {
                    status: 'success',
                    message: 'تم استرجاع الجارد اليومي من الكاش المحلي',
                    data: cachedLedger,
                };
            }
            return {
                status: 'success',
                message: 'الجارد اليومي (محلي)',
                data: {
                    date,
                    totalIncome: 0,
                    totalExpense: 0,
                    netBalance: 0,
                    transactions: [],
                },
            };
        }

        if (cleanUrl === '/payments/ledger/monthly') {
            const now = new Date();
            const year = parseInt(effectiveParams.year) || now.getFullYear();
            const month = parseInt(effectiveParams.month) || (now.getMonth() + 1);
            const cachedMonthly = await OfflineStorageService.getMonthlyLedger(year, month);
            if (cachedMonthly) {
                return {
                    status: 'success',
                    message: 'تم استرجاع الجارد الشهري من الكاش المحلي',
                    data: cachedMonthly,
                };
            }
            return {
                status: 'success',
                message: 'الجارد الشهري (محلي)',
                data: {
                    year,
                    month,
                    totalIncome: 0,
                    totalExpense: 0,
                    netBalance: 0,
                    days: [],
                },
            };
        }

        if (cleanUrl === '/payments/prices') {
            const cachedPrices = await OfflineStorageService.getPriceSettings();
            if (cachedPrices) {
                return {
                    status: 'success',
                    message: 'تم استرجاع قائمة الأسعار من الكاش المحلي',
                    data: cachedPrices,
                };
            }
            return {
                status: 'success',
                data: { prices: [], centerDiscounts: [] },
            };
        }

        // 10. Notebooks & Store (المتجر والمذكرات)
        if (cleanUrl === '/notebooks') {
            const notebooks = await OfflineStorageService.getOfflineNotebooks(effectiveParams);
            return {
                status: 'success',
                message: 'تم استرجاع المذكرات من الكاش المحلي',
                data: {
                    data: notebooks,
                    pagination: { total: notebooks.length, page: 1, limit: 100, totalPages: 1 },
                },
            };
        }
        if (cleanUrl.startsWith('/notebooks/') && !cleanUrl.includes('/reservations') && !cleanUrl.includes('/restock')) {
            const id = cleanUrl.replace('/notebooks/', '');
            const notebook = await OfflineStorageService.getOfflineNotebookById(id);
            if (notebook) {
                return {
                    status: 'success',
                    message: 'تم استرجاع المذكرة من الكاش المحلي',
                    data: notebook,
                };
            }
        }
        if (cleanUrl === '/notebooks/reservations' || cleanUrl.startsWith('/notebooks/reservations')) {
            const reservations = await OfflineStorageService.getOfflineReservations(effectiveParams);
            return {
                status: 'success',
                message: 'تم استرجاع الحجوزات من الكاش المحلي',
                data: {
                    data: reservations,
                    pagination: { total: reservations.length, page: 1, limit: 100, totalPages: 1 },
                },
            };
        }

        // 11. Users & Assistants (المساعدين والمستخدمين)
        if (cleanUrl === '/users') {
            const users = await OfflineStorageService.getOfflineUsers(effectiveParams);
            return {
                status: 'success',
                message: 'تم استرجاع المستخدمين والمساعدين من الكاش المحلي',
                data: users,
            };
        }
        if (cleanUrl.startsWith('/users/') && !cleanUrl.includes('/pay-salary')) {
            const id = cleanUrl.replace('/users/', '');
            const user = await OfflineStorageService.getOfflineUserById(id);
            if (user) {
                return {
                    status: 'success',
                    data: user,
                };
            }
        }

        // 12. Centers (السناتر والفروع)
        if (cleanUrl === '/centers' || cleanUrl === '/centers/my') {
            const centers = await OfflineStorageService.getOfflineCenters();
            return {
                status: 'success',
                message: 'تم استرجاع السناتر من الكاش المحلي',
                data: centers,
            };
        }

        // 12.1 Center Teachers (/centers/teachers)
        if (cleanUrl === '/centers/teachers') {
            const teachers = await OfflineStorageService.getOfflineCenterTeachers(effectiveParams);
            return {
                status: 'success',
                message: 'تم استرجاع مدرسي السنتر من الكاش المحلي',
                data: teachers,
            };
        }
        if (cleanUrl.startsWith('/centers/teachers/')) {
            const id = cleanUrl.replace('/centers/teachers/', '');
            const teacher = await OfflineStorageService.getOfflineCenterTeacherById(id);
            if (teacher) {
                return {
                    status: 'success',
                    data: teacher,
                };
            }
        }

        // 12.2 Center Packages (/centers/packages)
        if (cleanUrl === '/centers/packages') {
            const packages = await OfflineStorageService.getOfflineCenterPackages(effectiveParams);
            return {
                status: 'success',
                message: 'تم استرجاع باقات السنتر من الكاش المحلي',
                data: packages,
            };
        }
        if (cleanUrl.startsWith('/centers/packages/')) {
            const id = cleanUrl.replace('/centers/packages/', '');
            const pkg = await OfflineStorageService.getOfflineCenterPackageById(id);
            if (pkg) {
                return {
                    status: 'success',
                    data: pkg,
                };
            }
        }

        // 12.3 Center Groups (/centers/groups)
        if (cleanUrl === '/centers/groups') {
            const groups = await OfflineStorageService.getOfflineCenterGroups(effectiveParams);
            return {
                status: 'success',
                message: 'تم استرجاع مجموعات السنتر من الكاش المحلي',
                data: groups,
            };
        }
        if (cleanUrl.startsWith('/centers/groups/')) {
            const id = cleanUrl.replace('/centers/groups/', '');
            const group = await OfflineStorageService.getOfflineCenterGroupById(id);
            if (group) {
                return {
                    status: 'success',
                    data: group,
                };
            }
        }

        // 12.4 Center Students (/centers/students)
        if (cleanUrl === '/centers/students') {
            const result = await OfflineStorageService.getOfflineCenterStudents(effectiveParams);
            return {
                status: 'success',
                message: 'تم استرجاع طلاب السنتر من الكاش المحلي',
                data: result,
            };
        }
        if (cleanUrl.startsWith('/centers/students/')) {
            const id = cleanUrl.replace('/centers/students/', '');
            const student = await OfflineStorageService.getOfflineCenterStudentById(id);
            if (student) {
                return {
                    status: 'success',
                    data: student,
                };
            }
        }

        // 12.5 Center Enrollments (/centers/enrollments)
        if (cleanUrl === '/centers/enrollments') {
            const enrollments = await OfflineStorageService.getOfflineCenterEnrollments(effectiveParams);
            return {
                status: 'success',
                message: 'تم استرجاع اشتراكات السنتر من الكاش المحلي',
                data: enrollments,
            };
        }
        if (cleanUrl.startsWith('/centers/enrollments/student/')) {
            const studentId = cleanUrl.replace('/centers/enrollments/student/', '');
            const enrollment = await OfflineStorageService.getOfflineStudentEnrollment(studentId);
            if (enrollment) {
                return {
                    status: 'success',
                    data: enrollment,
                };
            }
        }

        // 12.6 Center Gate Check-Ins (/centers/attendance/check-ins)
        if (cleanUrl === '/centers/attendance/check-ins') {
            const checkIns = await OfflineStorageService.getOfflineCenterCheckIns(effectiveParams);
            return {
                status: 'success',
                message: 'تم استرجاع تسجيلات الدخول من الكاش المحلي',
                data: checkIns,
            };
        }

        // 12.7 Center Group Attendance (/centers/attendance/group/:groupId)
        if (cleanUrl.startsWith('/centers/attendance/group/')) {
            const groupId = cleanUrl.replace('/centers/attendance/group/', '');
            const date = effectiveParams.date || new Date().toISOString().split('T')[0];
            const records = await OfflineStorageService.getOfflineGroupAttendance(groupId, date);
            return {
                status: 'success',
                data: records,
            };
        }

        // 12.8 Center Financials (/centers/financials/daily-tally, summary, monthly-tally)
        if (cleanUrl === '/centers/financials/daily-tally') {
            const date = effectiveParams.date || new Date().toISOString().split('T')[0];
            const tally = await OfflineStorageService.getOfflineCenterDailyTally(date);
            if (tally) {
                return {
                    status: 'success',
                    data: tally,
                };
            }
            return {
                status: 'success',
                data: {
                    date,
                    totalIncome: 0,
                    packageRevenue: 0,
                    privateRevenue: 0,
                    totalDebtCollected: 0,
                    totalExpenses: 0,
                    netBalance: 0,
                    transactions: [],
                },
            };
        }

        if (cleanUrl === '/centers/financials/monthly-tally') {
            const now = new Date();
            const year = Number(effectiveParams.year) || now.getFullYear();
            const month = Number(effectiveParams.month) || (now.getMonth() + 1);
            const tally = await OfflineStorageService.getOfflineCenterMonthlyTally(year, month);
            if (tally) {
                return {
                    status: 'success',
                    data: tally,
                };
            }
            return {
                status: 'success',
                data: { year, month, totalIncome: 0, totalExpenses: 0, netBalance: 0, dailyTallies: [] },
            };
        }

        if (cleanUrl === '/centers/financials/summary') {
            const summary = await OfflineStorageService.getOfflineCenterFinancialSummary();
            if (summary) {
                return {
                    status: 'success',
                    data: summary,
                };
            }
            return {
                status: 'success',
                data: {
                    totalRevenue: 0,
                    totalExpenses: 0,
                    netProfit: 0,
                    totalPendingDebt: 0,
                    totalStudents: 0,
                    totalActiveEnrollments: 0,
                },
            };
        }

        // 12.9 Center Supervisors (/centers/supervisors)
        if (cleanUrl === '/centers/supervisors') {
            const supervisors = await OfflineStorageService.getOfflineCenterSupervisors();
            return {
                status: 'success',
                data: supervisors,
            };
        }

        // 13. Dashboard Stats (/reports/dashboard)
        if (cleanUrl === '/reports/dashboard') {
            const cachedDashboard = await OfflineStorageService.getOfflineDashboardStats();
            if (cachedDashboard) {
                return {
                    status: 'success',
                    data: cachedDashboard,
                };
            }
            const stats = await OfflineStorageService.getOfflineStorageStats();
            return {
                status: 'success',
                data: {
                    studentsCount: stats.studentsCount,
                    groupsCount: stats.groupsCount,
                    sessionsCount: stats.sessionsCount,
                    examsCount: stats.examsCount,
                    notebooksCount: stats.notebooksCount,
                },
            };
        }

        // 14. Unpaid Students (/reports/unpaid-students)
        if (cleanUrl === '/reports/unpaid-students' || cleanUrl.startsWith('/reports/unpaid-students')) {
            const cachedUnpaid = await OfflineStorageService.getOfflineUnpaidStudents();
            if (cachedUnpaid) {
                return {
                    status: 'success',
                    data: cachedUnpaid,
                };
            }
            return {
                status: 'success',
                data: { totalUnpaidAmount: 0, unpaidStudentsCount: 0, students: [] },
            };
        }

        return null;
    } catch (err) {
        console.error('[Axios Offline Resolver] Error resolving from IndexedDB:', err);
        return null;
    }
}

/**
 * Handle offline CRUD mutations (POST, PUT, PATCH, DELETE) gracefully without throwing Network Error.
 * Persists changes into local IndexedDB and queues them in generic mutations outbox for auto-sync.
 */
async function resolveOfflineMutation(config: any): Promise<any | null> {
    try {
        const method = (config.method || 'post').toUpperCase();
        const rawUrl = config.url || '';
        const [cleanPath] = rawUrl.split('?');
        const cleanUrl = cleanPath.replace(/^https?:\/\/[^\/]+/, '');
        const data = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});

        // NEVER intercept or handle auth mutations offline
        if (cleanUrl.startsWith('/auth') || cleanUrl.includes('/auth/')) {
            return null;
        }

        // 1. Create Student (POST /students)
        if (cleanUrl === '/students' && method === 'POST') {
            const tempId = `loc_stu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const localStudent = {
                _id: tempId,
                ...data,
                isActive: true,
                totalDebt: 0,
                hasActiveSubscription: false,
                createdAt: new Date().toISOString(),
                isOfflineCreated: true,
            };
            await OfflineStorageService.saveOneOfflineStudent(localStudent);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `إضافة طالب: ${data.studentName || 'طالب جديد'}`,
            });
            return {
                status: 'success',
                message: 'تم حفظ الطالب محلياً وسيتم رفعه تلقائياً فور الاتصال بالإنترنت',
                data: localStudent,
            };
        }

        // 2. Update Student (PUT /students/:id or PATCH /students/:id)
        if (cleanUrl.startsWith('/students/') && (method === 'PUT' || method === 'PATCH')) {
            const studentId = cleanUrl.replace('/students/', '');
            const existing = await OfflineStorageService.getOfflineStudentById(studentId);
            const updated = { ...(existing || {}), ...data, _id: studentId, updatedAt: new Date().toISOString() };
            await OfflineStorageService.saveOneOfflineStudent(updated);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method,
                data,
                description: `تعديل بيانات الطالب: ${updated.studentName || studentId}`,
            });
            return {
                status: 'success',
                message: 'تم تعديل بيانات الطالب محلياً وسيتم المزامنة تلقائياً',
                data: updated,
            };
        }

        // 3. Delete Student (DELETE /students/:id)
        if (cleanUrl.startsWith('/students/') && method === 'DELETE') {
            const studentId = cleanUrl.replace('/students/', '');
            await OfflineStorageService.deleteOfflineStudent(studentId);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'DELETE',
                description: `حذف الطالب: ${studentId}`,
            });
            return {
                status: 'success',
                message: 'تم حذف الطالب محلياً وسيتم تطبيق الحذف على السيرفر فور الاتصال',
            };
        }

        // 4. Create Session (POST /sessions)
        if (cleanUrl === '/sessions' && method === 'POST') {
            const tempId = `loc_sess_${Date.now()}`;
            const localSession = {
                _id: tempId,
                ...data,
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                isOfflineCreated: true,
            };
            await OfflineStorageService.saveOneOfflineSession(localSession);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `إنشاء حصة للمجموعة: ${data.groupId || ''}`,
            });
            return {
                status: 'success',
                message: 'تم إنشاء الحصة محلياً بنجاح',
                data: localSession,
            };
        }

        // 5. Financials & Payments Mutations (Subscriptions, Notebooks, Expenses, Debts)
        // 5.1 Single Subscription (POST /payments/subscription)
        if (cleanUrl === '/payments/subscription' && method === 'POST') {
            const tx = await OfflineStorageService.recordOfflineTransaction({
                type: 'INCOME',
                category: 'SUBSCRIPTION',
                paidAmount: Number(data.paidAmount) || 0,
                studentId: data.studentId,
                description: data.description,
                date: data.date,
            });
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `تسجيل اشتراك بمبلغ ${data.paidAmount || 0} ج للـطالب: ${tx.studentName || ''}`,
            });
            return {
                status: 'success',
                message: 'تم تسجيل الاشتراك محلياً وسيتم إرساله للسيرفر فور الاتصال',
                data: tx,
            };
        }

        // 5.2 Batch Subscription (POST /payments/subscription/batch)
        if (cleanUrl === '/payments/subscription/batch' && method === 'POST') {
            const studentIds: string[] = Array.isArray(data.studentIds) ? data.studentIds : [];
            const customAmount = Number(data.customAmount) || 0;
            const results: any[] = [];
            for (const sId of studentIds) {
                const tx = await OfflineStorageService.recordOfflineTransaction({
                    type: 'INCOME',
                    category: 'SUBSCRIPTION',
                    paidAmount: customAmount,
                    studentId: sId,
                    description: data.description,
                    date: data.date,
                });
                results.push({
                    studentId: sId,
                    studentName: tx.studentName,
                    paidAmount: customAmount,
                    status: 'success',
                });
            }
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `تسجيل ${studentIds.length} اشتراك مجمع أوفلاين`,
            });
            return {
                status: 'success',
                message: `تم تسجيل ${studentIds.length} اشتراك محلياً بنجاح`,
                data: {
                    results,
                    successCount: studentIds.length,
                    failCount: 0,
                    totalPaid: customAmount * studentIds.length,
                },
            };
        }

        // 5.3 Notebook Sale & Reservation (POST /payments/notebook, /payments/notebook/reserve)
        if ((cleanUrl === '/payments/notebook' || cleanUrl === '/payments/notebook/reserve') && method === 'POST') {
            const isReservation = cleanUrl.includes('reserve');
            const tx = await OfflineStorageService.recordOfflineTransaction({
                type: 'INCOME',
                category: isReservation ? 'NOTEBOOK_RESERVATION' : 'NOTEBOOK_SALE',
                paidAmount: Number(data.paidAmount) || 0,
                studentId: data.studentId,
                description: data.description || (isReservation ? 'حجز مذكرة' : 'بيع مذكرة'),
                date: data.date,
            });
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `${isReservation ? 'حجز' : 'بيع'} مذكرة بمبلغ ${data.paidAmount || 0} ج للـطالب: ${tx.studentName || ''}`,
            });
            return {
                status: 'success',
                message: `تم تسجيل ${isReservation ? 'حجز' : 'بيع'} المذكرة محلياً`,
                data: tx,
            };
        }

        // 5.4 Batch Notebook Sales & Reservations
        if ((cleanUrl === '/payments/notebook/batch' || cleanUrl === '/payments/notebook/reserve/batch') && method === 'POST') {
            const studentIds: string[] = Array.isArray(data.studentIds) ? data.studentIds : [];
            const amount = Number(data.paidAmount) || 0;
            const isReservation = cleanUrl.includes('reserve');
            const results: any[] = [];
            for (const sId of studentIds) {
                const tx = await OfflineStorageService.recordOfflineTransaction({
                    type: 'INCOME',
                    category: isReservation ? 'NOTEBOOK_RESERVATION' : 'NOTEBOOK_SALE',
                    paidAmount: amount,
                    studentId: sId,
                    description: data.description || (isReservation ? 'حجز مذكرة' : 'بيع مذكرة'),
                    date: data.date,
                });
                results.push({
                    studentId: sId,
                    studentName: tx.studentName,
                    paidAmount: amount,
                    status: 'success',
                });
            }
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `تسجيل ${studentIds.length} ${isReservation ? 'حجز' : 'بيع'} مذكرة مجمع`,
            });
            return {
                status: 'success',
                message: `تم تسجيل ${studentIds.length} عملية محلياً بنجاح`,
                data: {
                    results,
                    successCount: studentIds.length,
                    failCount: 0,
                    totalPaid: amount * studentIds.length,
                },
            };
        }

        // 5.5 Debt Payments (POST /payments/pay-debt, /payments/debt/pay, /payments/pay-cycle-debt, /payments/pay-all-past-cycles)
        if ((cleanUrl === '/payments/pay-debt' || cleanUrl === '/payments/debt/pay' || cleanUrl === '/payments/pay-cycle-debt' || cleanUrl === '/payments/pay-all-past-cycles') && method === 'POST') {
            const paidAmount = Number(data.paidAmount || data.amount) || 0;
            const tx = await OfflineStorageService.recordOfflineTransaction({
                type: 'INCOME',
                category: 'DEBT_PAYMENT',
                paidAmount,
                studentId: data.studentId,
                description: data.description || 'سداد باقي مصاريف/مديونية',
                date: data.date,
            });
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `سداد مديونية بمبلغ ${paidAmount} ج للـطالب: ${tx.studentName || ''}`,
            });
            return {
                status: 'success',
                message: 'تم تسجيل سداد المديونية محلياً',
                data: tx,
            };
        }

        // 5.6 Expenses (POST /payments/expense)
        if (cleanUrl === '/payments/expense' && method === 'POST') {
            const amount = Number(data.amount) || 0;
            const tx = await OfflineStorageService.recordOfflineTransaction({
                type: 'EXPENSE',
                category: data.category || 'OTHER_EXPENSE',
                paidAmount: amount,
                description: data.description || 'مصروف',
                date: data.date,
            });
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `تسجيل مصروف: ${data.description || data.category || 'مصروف'} (${amount} ج)`,
            });
            return {
                status: 'success',
                message: 'تم تسجيل المصروف محلياً بنجاح',
                data: tx,
            };
        }

        // 5.7 Center Deductions (POST /payments/center-deduction)
        if (cleanUrl === '/payments/center-deduction' && method === 'POST') {
            const amount = Number(data.amount) || 0;
            const tx = await OfflineStorageService.recordOfflineTransaction({
                type: 'EXPENSE',
                category: 'OTHER_EXPENSE',
                paidAmount: amount,
                description: `خصم سنتر: ${data.centerName || ''} ${data.description ? `- ${data.description}` : ''}`,
                date: data.date,
            });
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `خصم سنتر: ${data.centerName || ''} (${amount} ج)`,
            });
            return {
                status: 'success',
                message: 'تم تسجيل خصم السنتر محلياً بنجاح',
                data: tx,
            };
        }

        // 5.8 Delete Transaction (DELETE /payments/:id)
        if (cleanUrl.startsWith('/payments/') && method === 'DELETE') {
            const txId = cleanUrl.replace('/payments/', '');
            const { isLocal } = await OfflineStorageService.markTransactionPendingDelete(txId);
            return {
                status: 'success',
                message: isLocal
                    ? 'تم مسح المعاملة المحلية نهائياً بنجاح'
                    : 'تم جدولة مسح المعاملة: سيتم الحذف نهائياً من السيرفر فور استعادة الاتصال بالإنترنت',
                data: { deleted: true, transactionId: txId, isPendingDelete: !isLocal },
            };
        }

        // 5.9 Batch Delete Transactions (POST /payments/batch-delete)
        if (cleanUrl === '/payments/batch-delete' && method === 'POST') {
            const txIds: string[] = Array.isArray(data.transactionIds) ? data.transactionIds : [];
            for (const id of txIds) {
                await OfflineStorageService.markTransactionPendingDelete(id);
            }
            return {
                status: 'success',
                message: `تم جدولة مسح المعاملات المحددة`,
                data: { deletedCount: txIds.length, failedCount: 0, total: txIds.length, results: [] },
            };
        }

        // 5.10 Deliver Reserved Notebook (POST /payments/notebook/deliver/:id)
        if (cleanUrl.startsWith('/payments/notebook/deliver/') && method === 'POST') {
            const reservationId = cleanUrl.replace('/payments/notebook/deliver/', '');
            const paidAmount = Number(data.paidAmount) || 0;
            if (paidAmount > 0) {
                await OfflineStorageService.recordOfflineTransaction({
                    type: 'INCOME',
                    category: 'NOTEBOOK_DELIVERY',
                    paidAmount,
                    description: data.description || 'استلام مذكرة وسداد باقي المبلغ',
                });
            }
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `تسليم مذكرة محجوزة (${reservationId}) بمبلغ ${paidAmount} ج`,
            });
            return {
                status: 'success',
                message: 'تم تسجيل تسليم المذكرة محلياً بنجاح',
                data: { delivered: true, reservationId },
            };
        }

        // 6. Record Exam Results (POST /exams/:id/results or /batch)
        if (cleanUrl.includes('/exams/') && cleanUrl.includes('/results') && method === 'POST') {
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: 'تسجيل درجات الامتحان',
            });
            return {
                status: 'success',
                message: 'تم حفظ درجات الامتحان محلياً بنجاح وسيتم رفعها تلقائياً',
                data: {
                    inserted: data.results?.length || 1,
                    total: data.results?.length || 1,
                },
            };
        }

        // 6.1 Delete Single Exam Result (DELETE /exams/:examId/results/:resultId)
        if (cleanUrl.includes('/exams/') && cleanUrl.includes('/results/') && method === 'DELETE') {
            const parts = cleanUrl.split('/');
            const examId = parts[2];
            const resultId = parts[4];
            const { isLocal, studentName } = await OfflineStorageService.markExamResultPendingDelete(examId, resultId);
            return {
                status: 'success',
                message: isLocal
                    ? 'تم مسح درجة الطالب محلياً نهائياً (لم تكن مرفوعة للسيرفر)'
                    : `تم جدولة حذف درجة الطالب ${studentName || ''}: سيتم الحذف نهائياً من السيرفر فور استعادة الاتصال`,
                data: { deleted: true, isPendingDelete: !isLocal, studentName, resultId },
            };
        }

        // 6.2 Update Single Exam Result (PUT /exams/:examId/results/:resultId)
        if (cleanUrl.includes('/exams/') && cleanUrl.includes('/results/') && method === 'PUT') {
            const parts = cleanUrl.split('/');
            const examId = parts[2];
            const resultId = parts[4];
            const cached = await OfflineStorageService.getOfflineExamResults(examId);
            if (cached && Array.isArray(cached.results)) {
                const target = cached.results.find((r: any) => r._id === resultId || r.resultId === resultId);
                if (target) {
                    target.score = Number(data.score) || 0;
                    target.isPendingSync = true;
                    await OfflineStorageService.saveOfflineExamResults(examId, cached);
                }
            }
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'PUT',
                data,
                description: `تعديل درجة الامتحان إلى ${data.score}`,
            });
            return {
                status: 'success',
                message: 'تم حفظ تعديل الدرجة محلياً وسيتم المزامنة فور الاتصال',
                data: { ...data, _id: resultId, isPendingSync: true },
            };
        }

        // 6.3 Delete Exam (DELETE /exams/:id)
        if (cleanUrl.startsWith('/exams/') && !cleanUrl.includes('/results') && method === 'DELETE') {
            const examId = cleanUrl.replace('/exams/', '');
            const isLocal = examId.startsWith('loc_exam_');
            if (isLocal) {
                const all = await OfflineStorageService.getOfflineExams();
                await OfflineStorageService.saveOfflineExams(all.filter(e => e._id !== examId));
            } else {
                await OfflineStorageService.queueGenericMutation({
                    url: cleanUrl,
                    method: 'DELETE',
                    description: `حذف الامتحان من السيرفر: ${examId}`,
                });
            }
            return {
                status: 'success',
                message: isLocal
                    ? 'تم حذف الامتحان المحلي نهائياً'
                    : 'تم جدولة حذف الامتحان: سيتم الحذف نهائياً من السيرفر فور استعادة الاتصال',
                data: { deleted: true, isPendingDelete: !isLocal },
            };
        }

        // 7. Notebooks & Store Mutations (المتجر والمذكرات)
        if (cleanUrl === '/notebooks' && method === 'POST') {
            const tempId = `loc_nb_${Date.now()}`;
            const localNotebook = {
                _id: tempId,
                ...data,
                stock: Number(data.stock) || 0,
                createdAt: new Date().toISOString(),
                isOfflineCreated: true,
            };
            await OfflineStorageService.saveOneOfflineNotebook(localNotebook);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `إضافة مذكرة: ${data.name || ''}`,
            });
            return {
                status: 'success',
                message: 'تم حفظ المذكرة محلياً وسيتم رفعها للسيرفر فور الاتصال',
                data: localNotebook,
            };
        }

        if (cleanUrl.startsWith('/notebooks/') && cleanUrl.endsWith('/restock') && method === 'PATCH') {
            const id = cleanUrl.replace('/notebooks/', '').replace('/restock', '');
            const existing = await OfflineStorageService.getOfflineNotebookById(id);
            if (existing) {
                existing.stock = (existing.stock || 0) + (Number(data.quantity) || 0);
                await OfflineStorageService.saveOneOfflineNotebook(existing);
            }
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'PATCH',
                data,
                description: `إعادة تزويد مخزون المذكرة: +${data.quantity || 0}`,
            });
            return {
                status: 'success',
                message: 'تم تحديث المخزون محلياً بنجاح',
                data: existing || { _id: id, ...data },
            };
        }

        if (cleanUrl.startsWith('/notebooks/') && method === 'PUT') {
            const id = cleanUrl.replace('/notebooks/', '');
            const existing = await OfflineStorageService.getOfflineNotebookById(id);
            const updated = { ...(existing || {}), ...data, _id: id };
            await OfflineStorageService.saveOneOfflineNotebook(updated);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'PUT',
                data,
                description: `تعديل بيانات المذكرة: ${updated.name || id}`,
            });
            return {
                status: 'success',
                message: 'تم حفظ تعديلات المذكرة محلياً',
                data: updated,
            };
        }

        if (cleanUrl.startsWith('/notebooks/') && method === 'DELETE') {
            const id = cleanUrl.replace('/notebooks/', '');
            const { isLocal, name } = await OfflineStorageService.markNotebookPendingDelete(id);
            return {
                status: 'success',
                message: isLocal
                    ? 'تم مسح المذكرة المحلية نهائياً'
                    : `تم جدولة حذف المذكرة "${name || ''}": سيتم الحذف نهائياً من السيرفر فور استعادة الاتصال`,
                data: { deleted: true, isPendingDelete: !isLocal, name },
            };
        }

        // 8. Users & Assistants Mutations (المساعدين والمستخدمين)
        if (cleanUrl === '/users' && method === 'POST') {
            const tempId = `loc_usr_${Date.now()}`;
            const localUser = {
                _id: tempId,
                ...data,
                role: data.role || 'assistant',
                createdAt: new Date().toISOString(),
                isOfflineCreated: true,
            };
            await OfflineStorageService.saveOneOfflineUser(localUser);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `إضافة مساعد: ${data.name || ''}`,
            });
            return {
                status: 'success',
                message: 'تم إضافة المساعد محلياً وسيتم المزامنة فور الاتصال',
                data: localUser,
            };
        }

        if (cleanUrl.startsWith('/users/') && cleanUrl.endsWith('/pay-salary') && method === 'POST') {
            const id = cleanUrl.replace('/users/', '').replace('/pay-salary', '');
            const amount = Number(data.amount) || 0;
            const user = await OfflineStorageService.getOfflineUserById(id);
            await OfflineStorageService.recordOfflineTransaction({
                type: 'EXPENSE',
                category: 'SALARY',
                paidAmount: amount,
                description: `صرف راتب للمساعد: ${user?.name || id} ${data.notes ? `(${data.notes})` : ''}`,
            });
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `صرف راتب للمساعد ${user?.name || id}: ${amount} ج`,
            });
            return {
                status: 'success',
                message: 'تم تسجيل صرف الراتب في الخزينة محلياً بنجاح',
                data: { success: true },
            };
        }

        if (cleanUrl.startsWith('/users/') && (method === 'PUT' || method === 'PATCH')) {
            const id = cleanUrl.replace('/users/', '');
            const existing = await OfflineStorageService.getOfflineUserById(id);
            const updated = { ...(existing || {}), ...data, _id: id };
            await OfflineStorageService.saveOneOfflineUser(updated);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method,
                data,
                description: `تعديل بيانات المستخدم: ${updated.name || id}`,
            });
            return {
                status: 'success',
                message: 'تم تعديل بيانات المستخدم محلياً',
                data: updated,
            };
        }

        if (cleanUrl.startsWith('/users/') && method === 'DELETE') {
            const id = cleanUrl.replace('/users/', '');
            const { isLocal, name } = await OfflineStorageService.markUserPendingDelete(id);
            return {
                status: 'success',
                message: isLocal
                    ? 'تم مسح المساعد المحلي نهائياً'
                    : `تم جدولة حذف المساعد "${name || ''}": سيتم الحذف نهائياً من السيرفر فور استعادة الاتصال`,
                data: { deleted: true, isPendingDelete: !isLocal, name },
            };
        }

        if (cleanUrl === '/auth/assistants-access' && method === 'POST') {
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `${data.enabled ? 'فتح' : 'قفل'} وصول المساعدين`,
            });
            return {
                status: 'success',
                message: 'تم تعديل صلاحية وصول المساعدين محلياً',
                data: { assistantsAccessEnabled: data.enabled },
            };
        }

        // ── Center Offline Mutations ─────────────────────────────────────────

        // C1. Gate Check-In (POST /centers/attendance/check-in)
        if (cleanUrl === '/centers/attendance/check-in' && method === 'POST') {
            const checkInRes = await OfflineStorageService.recordOfflineGateCheckIn(data);
            return {
                status: 'success',
                message: checkInRes.isNewCheckIn ? 'تم تسجيل حضور الطالب بنجاح محلياً' : 'الطالب مسجل حضور بالفعل اليوم',
                data: checkInRes,
            };
        }

        // C2. Update Check-In Groups (PUT /centers/attendance/check-in/groups)
        if (cleanUrl === '/centers/attendance/check-in/groups' && method === 'PUT') {
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'PUT',
                data,
                description: `تحديث حصص الحضور للطالب: ${data.studentId || ''}`,
            });
            return {
                status: 'success',
                message: 'تم تحديث الحصص محلياً',
                data: { success: true },
            };
        }

        // C2.1 Group Attendance Single (POST /centers/attendance/group)
        if (cleanUrl === '/centers/attendance/group' && method === 'POST') {
            const tempId = `loc_ca_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const record = {
                _id: tempId,
                ...data,
                date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
                createdAt: new Date().toISOString(),
                isOfflineCreated: true,
            };
            await OfflineStorageService.saveOneOfflineCenterAttendance(record);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `تسجيل حضور سنتر لطالب: ${data.studentId || ''}`,
            });
            return {
                status: 'success',
                message: 'تم تسجيل الحضور محلياً بنجاح',
                data: record,
            };
        }

        // C2.2 Group Attendance Bulk (POST /centers/attendance/group/bulk)
        if (cleanUrl === '/centers/attendance/group/bulk' && method === 'POST') {
            const recordsList = Array.isArray(data.records) ? data.records : [];
            for (const item of recordsList) {
                const tempId = `loc_ca_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const record = {
                    _id: tempId,
                    centerGroupId: data.centerGroupId,
                    studentId: item.studentId,
                    status: item.status,
                    notes: item.notes,
                    date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    isOfflineCreated: true,
                };
                await OfflineStorageService.saveOneOfflineCenterAttendance(record);
            }
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `حفظ كشف حضور سنتر للمجموعة: ${data.centerGroupId || ''} (${recordsList.length} طالب)`,
            });
            return {
                status: 'success',
                message: 'تم حفظ كشف الحضور محلياً بنجاح',
                data: { modifiedCount: recordsList.length },
            };
        }

        // C3. Center Payment (POST /centers/financials/payment)
        if (cleanUrl === '/centers/financials/payment' && method === 'POST') {
            const tx = await OfflineStorageService.recordOfflineCenterPayment(data);
            return {
                status: 'success',
                message: 'تم تسجيل الدفعة محلياً وسيتم ترحيلها للسيرفر فور الاتصال',
                data: tx,
            };
        }

        // C4. Center Student CRUD (POST, PUT, DELETE /centers/students)
        if (cleanUrl === '/centers/students' && method === 'POST') {
            const tempId = `loc_cs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const localStudent = {
                _id: tempId,
                ...data,
                isActive: true,
                totalDebt: 0,
                hasActiveSubscription: false,
                createdAt: new Date().toISOString(),
                isOfflineCreated: true,
            };
            await OfflineStorageService.saveOneOfflineCenterStudent(localStudent);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `تسجيل طالب سنتر: ${data.studentName || ''}`,
            });
            return {
                status: 'success',
                message: 'تم إضافة طالب السنتر محلياً بنجاح',
                data: localStudent,
            };
        }

        if (cleanUrl === '/centers/students/bulk' && method === 'POST') {
            const studentsList = Array.isArray(data.students) ? data.students : [];
            const savedList: any[] = [];
            for (const s of studentsList) {
                const tempId = `loc_cs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                const stObj = {
                    _id: tempId,
                    ...s,
                    gradeLevel: data.gradeLevel || s.gradeLevel,
                    isActive: true,
                    totalDebt: 0,
                    createdAt: new Date().toISOString(),
                    isOfflineCreated: true,
                };
                await OfflineStorageService.saveOneOfflineCenterStudent(stObj);
                savedList.push(stObj);
            }
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `إضافة مجمعة لـ ${studentsList.length} طالب سنتر`,
            });
            return {
                status: 'success',
                message: `تم إضافة ${studentsList.length} طالب سنتر محلياً بنجاح`,
                data: { count: studentsList.length, students: savedList },
            };
        }

        if (cleanUrl.startsWith('/centers/students/') && (method === 'PUT' || method === 'PATCH')) {
            const id = cleanUrl.replace('/centers/students/', '');
            const existing = (await OfflineStorageService.getOfflineCenterStudentById(id)) || {};
            const updated = { ...existing, ...data, _id: id, updatedAt: new Date().toISOString() };
            await OfflineStorageService.saveOneOfflineCenterStudent(updated);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method,
                data,
                description: `تعديل بيانات طالب السنتر: ${updated.studentName || id}`,
            });
            return {
                status: 'success',
                message: 'تم تعديل بيانات طالب السنتر محلياً',
                data: updated,
            };
        }

        if (cleanUrl.startsWith('/centers/students/') && method === 'DELETE') {
            const id = cleanUrl.replace('/centers/students/', '');
            const stu = await OfflineStorageService.getOfflineCenterStudentById(id);
            const { isLocal } = await OfflineStorageService.markCenterStudentPendingDelete(id);
            return {
                status: 'success',
                message: isLocal
                    ? 'تم حذف الطالب المحلي نهائياً'
                    : `تم جدولة حذف الطالب "${stu?.studentName || ''}": سيتم الحذف من السيرفر فور استعادة الاتصال`,
                data: { deleted: true, isPendingDelete: !isLocal, studentName: stu?.studentName },
            };
        }

        // C5. Center Teachers CRUD (POST, PUT, DELETE /centers/teachers)
        if (cleanUrl === '/centers/teachers' && method === 'POST') {
            const tempId = `loc_ct_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const localTeacher = {
                _id: tempId,
                ...data,
                isActive: true,
                createdAt: new Date().toISOString(),
                isOfflineCreated: true,
            };
            await OfflineStorageService.saveOneOfflineCenterTeacher(localTeacher);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `إضافة مدرس سنتر: ${data.name || ''}`,
            });
            return {
                status: 'success',
                message: 'تم إضافة المدرس محلياً بنجاح',
                data: localTeacher,
            };
        }

        if (cleanUrl.startsWith('/centers/teachers/') && (method === 'PUT' || method === 'PATCH')) {
            const id = cleanUrl.replace('/centers/teachers/', '');
            const existing = (await OfflineStorageService.getOfflineCenterTeacherById(id)) || {};
            const updated = { ...existing, ...data, _id: id };
            await OfflineStorageService.saveOneOfflineCenterTeacher(updated);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method,
                data,
                description: `تعديل بيانات مدرس السنتر: ${updated.name || id}`,
            });
            return {
                status: 'success',
                message: 'تم تعديل بيانات المدرس محلياً',
                data: updated,
            };
        }

        if (cleanUrl.startsWith('/centers/teachers/') && method === 'DELETE') {
            const id = cleanUrl.replace('/centers/teachers/', '');
            const teacher = await OfflineStorageService.getOfflineCenterTeacherById(id);
            const { isLocal } = await OfflineStorageService.markCenterTeacherPendingDelete(id);
            return {
                status: 'success',
                message: isLocal
                    ? 'تم حذف المدرس المحلي نهائياً'
                    : `تم جدولة حذف المدرس "${teacher?.name || ''}": سيتم الحذف من السيرفر فور الاتصال`,
                data: { deleted: true, isPendingDelete: !isLocal, name: teacher?.name },
            };
        }

        // C6. Center Packages CRUD (POST, PUT, DELETE /centers/packages)
        if (cleanUrl === '/centers/packages' && method === 'POST') {
            const tempId = `loc_cp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const localPkg = {
                _id: tempId,
                ...data,
                isActive: true,
                createdAt: new Date().toISOString(),
                isOfflineCreated: true,
            };
            await OfflineStorageService.saveOneOfflineCenterPackage(localPkg);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `إنشاء باقة سنتر: ${data.name || ''}`,
            });
            return {
                status: 'success',
                message: 'تم إنشاء الباقة محلياً بنجاح',
                data: localPkg,
            };
        }

        if (cleanUrl.startsWith('/centers/packages/') && (method === 'PUT' || method === 'PATCH')) {
            const id = cleanUrl.replace('/centers/packages/', '');
            const existing = (await OfflineStorageService.getOfflineCenterPackageById(id)) || {};
            const updated = { ...existing, ...data, _id: id };
            await OfflineStorageService.saveOneOfflineCenterPackage(updated);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method,
                data,
                description: `تعديل باقة السنتر: ${updated.name || id}`,
            });
            return {
                status: 'success',
                message: 'تم تعديل الباقة محلياً',
                data: updated,
            };
        }

        if (cleanUrl.startsWith('/centers/packages/') && method === 'DELETE') {
            const id = cleanUrl.replace('/centers/packages/', '');
            const pkg = await OfflineStorageService.getOfflineCenterPackageById(id);
            const { isLocal } = await OfflineStorageService.markCenterPackagePendingDelete(id);
            return {
                status: 'success',
                message: isLocal
                    ? 'تم حذف الباقة المحلية نهائياً'
                    : `تم جدولة حذف الباقة "${pkg?.name || ''}": سيتم الحذف من السيرفر فور الاتصال`,
                data: { deleted: true, isPendingDelete: !isLocal, name: pkg?.name },
            };
        }

        // C7. Center Groups CRUD (POST, PUT, DELETE /centers/groups)
        if (cleanUrl === '/centers/groups' && method === 'POST') {
            const tempId = `loc_cg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const localGroup = {
                _id: tempId,
                ...data,
                isActive: true,
                createdAt: new Date().toISOString(),
                isOfflineCreated: true,
            };
            await OfflineStorageService.saveOneOfflineCenterGroup(localGroup);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `إنشاء مجموعة سنتر: ${data.name || ''}`,
            });
            return {
                status: 'success',
                message: 'تم إنشاء مجموعة السنتر محلياً بنجاح',
                data: localGroup,
            };
        }

        if (cleanUrl.startsWith('/centers/groups/') && (method === 'PUT' || method === 'PATCH')) {
            const id = cleanUrl.replace('/centers/groups/', '');
            const existing = (await OfflineStorageService.getOfflineCenterGroupById(id)) || {};
            const updated = { ...existing, ...data, _id: id };
            await OfflineStorageService.saveOneOfflineCenterGroup(updated);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method,
                data,
                description: `تعديل مجموعة السنتر: ${updated.name || id}`,
            });
            return {
                status: 'success',
                message: 'تم تعديل مجموعة السنتر محلياً',
                data: updated,
            };
        }

        if (cleanUrl.startsWith('/centers/groups/') && method === 'DELETE') {
            const id = cleanUrl.replace('/centers/groups/', '');
            const grp = await OfflineStorageService.getOfflineCenterGroupById(id);
            const { isLocal } = await OfflineStorageService.markCenterGroupPendingDelete(id);
            return {
                status: 'success',
                message: isLocal
                    ? 'تم حذف المجموعة المحلية نهائياً'
                    : `تم جدولة حذف المجموعة "${grp?.name || ''}": سيتم الحذف من السيرفر فور الاتصال`,
                data: { deleted: true, isPendingDelete: !isLocal, name: grp?.name },
            };
        }

        // C8. Center Enrollments (POST /centers/enrollments)
        if (cleanUrl === '/centers/enrollments' && method === 'POST') {
            const tempId = `loc_ce_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const localEnrollment = {
                _id: tempId,
                ...data,
                isActive: true,
                createdAt: new Date().toISOString(),
                isOfflineCreated: true,
            };
            await OfflineStorageService.saveOneOfflineCenterEnrollment(localEnrollment);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `تسجيل اشتراك سنتر للطالب: ${data.studentId || ''}`,
            });
            return {
                status: 'success',
                message: 'تم تسجيل اشتراك السنتر محلياً بنجاح',
                data: localEnrollment,
            };
        }

        // C9. Center Supervisors CRUD
        if (cleanUrl === '/centers/supervisors' && method === 'POST') {
            const tempId = `loc_csu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const localSup = {
                _id: tempId,
                ...data,
                isActive: true,
                createdAt: new Date().toISOString(),
                isOfflineCreated: true,
            };
            await OfflineStorageService.saveOneOfflineCenterSupervisor(localSup);
            await OfflineStorageService.queueGenericMutation({
                url: cleanUrl,
                method: 'POST',
                data,
                description: `إضافة مشرف سنتر: ${data.name || ''}`,
            });
            return {
                status: 'success',
                message: 'تم إضافة المشرف محلياً بنجاح',
                data: localSup,
            };
        }

        if (cleanUrl.startsWith('/centers/supervisors/') && method === 'DELETE') {
            const id = cleanUrl.replace('/centers/supervisors/', '');
            const { isLocal } = await OfflineStorageService.markCenterSupervisorPendingDelete(id);
            return {
                status: 'success',
                message: isLocal
                    ? 'تم حذف المشرف المحلي نهائياً'
                    : 'تم جدولة حذف المشرف: سيتم الحذف من السيرفر فور استعادة الاتصال',
                data: { deleted: true, isPendingDelete: !isLocal },
            };
        }

        // Generic fallback for any other offline mutation
        await OfflineStorageService.queueGenericMutation({
            url: cleanUrl,
            method,
            data,
            description: `عملية ${method} على ${cleanUrl}`,
        });

        return {
            status: 'success',
            message: 'تم حفظ العملية محلياً وستتم مزامنتها تلقائياً عند استعادة الاتصال',
            data: { _id: `loc_mut_${Date.now()}`, ...data },
        };
    } catch (err) {
        console.error('[Axios Offline Mutation Handler] Error handling offline mutation:', err);
        return null;
    }
}

/**
 * Global Axios Instance for Client-Side Fetching (CSR)
 * It automatically attaches the JWT token to every request if available.
 */
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Attach Token & Transparent Offline Fallback Adapter
apiClient.interceptors.request.use(async (config) => {
    // Check if running on the client (browser) before accessing cookies
    if (typeof window !== 'undefined') {
        const token = Cookies.get('token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        const branchId = Cookies.get('selectedBranchId');
        if (branchId && config.headers && !config.headers['x-branch-id']) {
            config.headers['x-branch-id'] = branchId;
        }

        // Offline Adapter: Intercept GET reads and POST/PUT/DELETE mutations when disconnected
        // NEVER intercept auth routes (login, register, me, etc.)
        const rawUrl = config.url || '';
        const isAuthRoute = rawUrl.startsWith('/auth') || rawUrl.includes('/auth/');
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        const skipOffline = Boolean(config.headers?.['x-skip-offline-adapter']) || isAuthRoute;
        if (isOffline && !skipOffline) {
            if (config.method?.toLowerCase() === 'get') {
                const offlinePayload = await resolveOfflineData(config.url || '', config.params);
                if (offlinePayload !== null) {
                    config.adapter = async () => ({
                        data: offlinePayload,
                        status: 200,
                        statusText: 'OK',
                        headers: {},
                        config,
                    });
                }
            } else {
                // Intercept offline writes/mutations transparently
                const mutationPayload = await resolveOfflineMutation(config);
                if (mutationPayload !== null) {
                    config.adapter = async () => ({
                        data: mutationPayload,
                        status: 200,
                        statusText: 'OK',
                        headers: {},
                        config,
                    });
                }
            }
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response Interceptor: Auto-Cache & Handle Global Errors
apiClient.interceptors.response.use(
    (response) => {
        // Sliding Token renewal: If backend sent fresh token, update cookie and store state silently
        if (typeof window !== 'undefined') {
            const newToken = response.headers?.['x-new-token'] || (response.headers as any)?.get?.('x-new-token');
            if (newToken && typeof newToken === 'string') {
                try {
                    Cookies.set('token', newToken, {
                        expires: 1,
                        path: '/',
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                    });
                    const currentUser = useAuthStore.getState().user;
                    if (currentUser) {
                        useAuthStore.setState({ token: newToken });
                    }
                } catch {}
            }
        }

        // Silently update IndexedDB cache in background when online GET requests succeed
        if (typeof window !== 'undefined' && response.config?.method?.toLowerCase() === 'get') {
            const rawUrl = response.config.url || '';
            const url = rawUrl.split('?')[0].replace(/^https?:\/\/[^\/]+/, '');
            const resData = response.data;
            const items = resData?.data?.data || (Array.isArray(resData?.data) ? resData.data : null);

            if (items && Array.isArray(items)) {
                if (url === '/groups') OfflineStorageService.saveOfflineGroups(items);
                else if (url === '/students') OfflineStorageService.saveOfflineStudents(items);
                else if (url === '/sessions') OfflineStorageService.saveOfflineSessions(items);
                else if (url === '/exams') OfflineStorageService.saveOfflineExams(items);
                else if (url === '/notebooks') OfflineStorageService.saveOfflineNotebooks(items);
                else if (url === '/notebooks/reservations') OfflineStorageService.saveOfflineReservations(items);
                else if (url === '/users') OfflineStorageService.saveOfflineUsers(items);
                else if (url === '/centers' || url === '/centers/my') OfflineStorageService.saveOfflineCenters(items);
                else if (url === '/centers/teachers') OfflineStorageService.saveOfflineCenterTeachers(items);
                else if (url === '/centers/packages') OfflineStorageService.saveOfflineCenterPackages(items);
                else if (url === '/centers/groups') OfflineStorageService.saveOfflineCenterGroups(items);
                else if (url === '/centers/students') OfflineStorageService.saveOfflineCenterStudents(items);
                else if (url === '/centers/enrollments') OfflineStorageService.saveOfflineCenterEnrollments(items);
                else if (url === '/centers/supervisors') OfflineStorageService.saveOfflineCenterSupervisors(items);
            } else if (resData?.data && typeof resData.data === 'object' && resData.data._id) {
                if (url.startsWith('/students/')) OfflineStorageService.saveOfflineStudents([resData.data]);
                else if (url.startsWith('/groups/')) OfflineStorageService.saveOfflineGroups([resData.data]);
                else if (url.startsWith('/sessions/')) OfflineStorageService.saveOfflineSessions([resData.data]);
                else if (url.startsWith('/exams/')) OfflineStorageService.saveOfflineExams([resData.data]);
                else if (url.startsWith('/notebooks/')) OfflineStorageService.saveOneOfflineNotebook(resData.data);
                else if (url.startsWith('/users/')) OfflineStorageService.saveOneOfflineUser(resData.data);
                else if (url.startsWith('/centers/teachers/')) OfflineStorageService.saveOneOfflineCenterTeacher(resData.data);
                else if (url.startsWith('/centers/packages/')) OfflineStorageService.saveOneOfflineCenterPackage(resData.data);
                else if (url.startsWith('/centers/groups/')) OfflineStorageService.saveOneOfflineCenterGroup(resData.data);
                else if (url.startsWith('/centers/students/')) OfflineStorageService.saveOneOfflineCenterStudent(resData.data);
                else if (url.startsWith('/centers/enrollments/')) OfflineStorageService.saveOneOfflineCenterEnrollment(resData.data);
                else if (url.startsWith('/centers/supervisors/')) OfflineStorageService.saveOneOfflineCenterSupervisor(resData.data);
            }

            // Auto-cache student reports, exam results, financials, dashboard, and unpaid students
            if (url.startsWith('/reports/student/') && !url.endsWith('/pdf') && resData?.data) {
                const studentId = url.replace('/reports/student/', '');
                OfflineStorageService.saveOfflineStudentReport(studentId, resData.data);
            } else if (url.startsWith('/exams/') && url.endsWith('/results') && resData?.data) {
                const examId = url.replace('/exams/', '').replace('/results', '');
                OfflineStorageService.saveOfflineExamResults(examId, resData.data);
            } else if (url === '/reports/daily-summary' && resData?.data) {
                const date = response.config.params?.date || new Date().toISOString().split('T')[0];
                OfflineStorageService.saveDailySummary(date, resData.data);
            } else if (url === '/payments/ledger/daily' && resData?.data) {
                const date = response.config.params?.date || new Date().toISOString().split('T')[0];
                OfflineStorageService.saveDailyLedger(date, resData.data);
            } else if (url === '/payments/ledger/monthly' && resData?.data) {
                const now = new Date();
                const year = response.config.params?.year || now.getFullYear();
                const month = response.config.params?.month || (now.getMonth() + 1);
                OfflineStorageService.saveMonthlyLedger(year, month, resData.data);
            } else if (url === '/payments/prices' && resData?.data) {
                OfflineStorageService.savePriceSettings(resData.data);
            } else if (url === '/reports/dashboard' && resData?.data) {
                OfflineStorageService.saveOfflineDashboardStats(resData.data);
            } else if (url.startsWith('/reports/unpaid-students') && resData?.data) {
                OfflineStorageService.saveOfflineUnpaidStudents(resData.data);
            } else if (url === '/centers/attendance/check-ins' && resData?.data?.checkIns) {
                OfflineStorageService.saveOfflineCenterCheckIns(resData.data.checkIns);
            } else if (url.startsWith('/centers/attendance/group/') && items) {
                OfflineStorageService.saveOfflineCenterAttendance(items);
            } else if (url === '/centers/financials/daily-tally' && resData?.data) {
                const date = response.config.params?.date || new Date().toISOString().split('T')[0];
                OfflineStorageService.saveOfflineCenterDailyTally(date, resData.data);
            } else if (url === '/centers/financials/monthly-tally' && resData?.data) {
                const now = new Date();
                const year = response.config.params?.year || now.getFullYear();
                const month = response.config.params?.month || (now.getMonth() + 1);
                OfflineStorageService.saveOfflineCenterMonthlyTally(year, month, resData.data);
            } else if (url === '/centers/financials/summary' && resData?.data) {
                OfflineStorageService.saveOfflineCenterFinancialSummary(resData.data);
            }
        }
        return response.data;
    },
    async (error) => {
        // Prevent showing toast from server side requests if applicable
        if (typeof window !== 'undefined') {
            const url: string = error.config?.url || '';
            const isAuthRoute = url.startsWith('/auth') || url.includes('/auth/');
            const isLoginRequest = url.includes('/auth/login');
            const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
            const isNetworkError = isOffline || error.code === 'ERR_NETWORK' || error.message?.includes('Network');

            // If a network error occurred on a GET, attempt offline fallback before failing (never for auth)
            if (!isAuthRoute && isNetworkError && error.config?.method?.toLowerCase() === 'get') {
                const fallback = await resolveOfflineData(url, error.config?.params);
                if (fallback !== null) {
                    return fallback;
                }
            } else if (!isAuthRoute && isNetworkError && error.config?.method && error.config.method.toLowerCase() !== 'get') {
                // If a network error occurred on a write mutation, queue locally and return success (never for auth)
                const mutationFallback = await resolveOfflineMutation(error.config);
                if (mutationFallback !== null) {
                    return mutationFallback;
                }
            }

            // When offline, do NOT redirect to login or trigger global error toasts
            if (isOffline) {
                return Promise.reject(error);
            }

            if (error.response?.status === 401) {
                // If it is not the login request itself (which handles its own error UI)
                if (!isLoginRequest) {
                    useAuthStore.getState().logout();
                    
                    if (window.location.pathname !== '/login') {
                        window.location.href = '/login';
                    }
                }
            } else if (error.response?.status === 403) {
                // Silently suppress 403s from background queries that don't belong to the current user's role
                const currentUser = useAuthStore.getState().user;
                const isSuperAdminRoute = url.startsWith('/admin') || url === '/subscriptions';
                const isTeacherRoute = url.startsWith('/sessions') || url.startsWith('/groups') || url.startsWith('/reports') || url.startsWith('/students') || url.startsWith('/daily-summary') || url.startsWith('/unpaid-students') || url.startsWith('/ledger');
                const isCenterRoute = url.startsWith('/centers');

                const isRoleMismatch =
                    (currentUser?.role !== 'superAdmin' && isSuperAdminRoute) ||
                    ((currentUser?.role === 'centerOwner' || currentUser?.role === 'centerSupervisor') && isTeacherRoute) ||
                    ((currentUser?.role === 'teacher' || currentUser?.role === 'assistant') && isCenterRoute);

                if (!isRoleMismatch && !error.config?.headers?.['x-skip-error-toast']) {
                    const errorMsg = error.response?.data?.message || 'ليس لديك الصلاحيات الكافية للوصول إلى هذا المسار';
                    toast.error(errorMsg);
                }
            } else if (!isLoginRequest && !error.config?.headers?.['x-skip-error-toast']) {
                const errorMsg = error.response?.data?.message || 'تعذر الاتصال بالخادم، حاول مرة أخرى لاحقاً';
                toast.error(errorMsg);
            }
        }
        return Promise.reject(error);
    }
);
