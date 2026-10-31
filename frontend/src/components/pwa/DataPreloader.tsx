/**
 * frontend/src/components/pwa/DataPreloader.tsx
 *
 * Proactive dataset preloader that caches vital entities:
 * - Groups
 * - Students
 * - Student Comprehensive Reports (Profiles, Attendance, Payments, Debts, Exam Grades)
 * - Sessions
 * - Exams & Exam Results
 * - Daily Summary & Financial Ledgers
 * into IndexedDB & React Query cache so teachers and staff can access
 * their entire workspace completely offline.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/lib/store/auth.store';
import { fetchGroups } from '@/lib/api/groups';
import { fetchStudents } from '@/lib/api/students';
import { fetchSessions } from '@/lib/api/sessions';
import { fetchExams, getExamResults } from '@/lib/api/exams';
import { fetchStudentReport, fetchDailySummary } from '@/lib/api/reports';
import { getDailyLedger, getMonthlyLedger, getPriceSettings } from '@/lib/api/payments';
import { fetchNotebooks, fetchReservations } from '@/lib/api/notebooks';
import { fetchUsers } from '@/lib/api/users';
import { apiClient } from '@/lib/api/axios';
import {
    fetchMyCenters,
    fetchCenterTeachers,
    fetchCenterPackages,
    fetchCenterGroups,
    fetchCenterStudents,
    fetchCenterEnrollments,
    fetchCenterSupervisors,
    fetchDailyCheckIns,
    fetchCenterDailyTally,
    fetchCenterFinancialSummary,
} from '@/lib/api/centers';
import { OfflineStorageService } from '@/lib/offline/storage.service';
import { QK } from '@/lib/query-keys';
import { toast } from 'sonner';

export function DataPreloader() {
    const queryClient = useQueryClient();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const user = useAuthStore((s) => s.user);
    const isPreloadingRef = useRef(false);

    useEffect(() => {
        const token = Cookies.get('token');
        if (!isAuthenticated && !token) return;

        // Determine user workspace type
        const isTeacherRole = user && ['teacher', 'assistant'].includes(user.role);
        const isCenterRole = user && ['centerOwner', 'centerSupervisor'].includes(user.role);

        if (!isTeacherRole && !isCenterRole) {
            return;
        }

        const today = [
            new Date().getFullYear(),
            String(new Date().getMonth() + 1).padStart(2, '0'),
            String(new Date().getDate()).padStart(2, '0'),
        ].join('-');

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        /**
         * Helper: Fast-warm React Query in-memory cache directly from local IndexedDB
         * Runs immediately to make the UI instant even before server replies.
         */
        const warmLocalCache = async () => {
            try {
                const [
                    localGroups,
                    localStudents,
                    localExams,
                    localDailySummary,
                    localDailyLedger,
                    localPrices,
                    localNotebooks,
                    localReservations,
                    localUsers,
                ] = await Promise.all([
                    OfflineStorageService.getOfflineGroups(),
                    OfflineStorageService.getOfflineStudents(),
                    OfflineStorageService.getOfflineExams(),
                    OfflineStorageService.getDailySummary(today),
                    OfflineStorageService.getDailyLedger(today),
                    OfflineStorageService.getPriceSettings(),
                    OfflineStorageService.getOfflineNotebooks(),
                    OfflineStorageService.getOfflineReservations(),
                    OfflineStorageService.getOfflineUsers(),
                    OfflineStorageService.getOfflineDashboardStats(),
                    OfflineStorageService.getOfflineUnpaidStudents(),
                ]);

                if (localNotebooks.length > 0) {
                    const nbPayload = {
                        data: localNotebooks,
                        pagination: { total: localNotebooks.length, page: 1, limit: 100, totalPages: 1 },
                    };
                    queryClient.setQueryData(['notebooks'], { data: nbPayload });
                    queryClient.setQueryData(['notebooks', { page: 1, limit: 20, search: '', gradeLevel: undefined }], { data: nbPayload });
                    queryClient.setQueryData(['notebooks', { page: 1, limit: 20, search: '', gradeLevel: '' }], { data: nbPayload });
                }

                if (localReservations.length > 0) {
                    queryClient.setQueryData(QK.notebooks.reservations(), { data: localReservations, pagination: { total: localReservations.length, page: 1, limit: 100, totalPages: 1 } });
                    queryClient.setQueryData(QK.notebooks.reservations(''), { data: localReservations, pagination: { total: localReservations.length, page: 1, limit: 100, totalPages: 1 } });
                }

                if (localUsers.length > 0) {
                    const assistantsList = localUsers.filter((u: any) => u.role === 'assistant');
                    queryClient.setQueryData(['assistants', ''], { data: assistantsList });
                    queryClient.setQueryData(['assistants', undefined], { data: assistantsList });
                    queryClient.setQueryData(['assistants'], { data: assistantsList });
                    queryClient.setQueryData(['users'], { data: localUsers });
                }

                if (localGroups.length > 0) {
                    const groupsPayload = {
                        data: localGroups,
                        pagination: { total: localGroups.length, page: 1, limit: 100, totalPages: 1 },
                    };
                    queryClient.setQueryData(QK.groups.list({ limit: 100 }), groupsPayload);
                    queryClient.setQueryData(['groups'], groupsPayload);
                }

                if (localStudents.length > 0) {
                    // Seed general students list
                    const studentsPayload = {
                        data: localStudents,
                        pagination: { total: localStudents.length, page: 1, limit: 1000, totalPages: 1 },
                    };
                    queryClient.setQueryData(QK.students.list({ limit: 1000 }), studentsPayload);

                    // Seed per-group student caches
                    for (const group of localGroups) {
                        const targetGid = group._id?.toString().trim();
                        const groupStudents = localStudents.filter((s) => {
                            let sGid = '';
                            if (s.groupId) {
                                if (typeof s.groupId === 'object' && s.groupId._id) {
                                    sGid = s.groupId._id.toString().trim();
                                } else {
                                    sGid = s.groupId.toString().trim();
                                }
                            }
                            return sGid === targetGid;
                        });

                        const infiniteData = {
                            pages: [{
                                data: groupStudents.slice(0, 20),
                                pagination: {
                                    page: 1,
                                    limit: 20,
                                    total: groupStudents.length,
                                    totalPages: Math.ceil(groupStudents.length / 20) || 1,
                                },
                            }],
                            pageParams: [1],
                        };

                        queryClient.setQueryData(QK.students.list({ limit: 20, search: '', groupId: group._id }), infiniteData);
                        queryClient.setQueryData(QK.students.list({ limit: 20, search: undefined, groupId: group._id }), infiniteData);
                        queryClient.setQueryData(QK.students.list({ groupId: group._id, limit: 200 }), {
                            data: groupStudents,
                            pagination: { page: 1, limit: 200, total: groupStudents.length, totalPages: 1 },
                        });

                        // Fast-warm student reports from IndexedDB
                        for (const st of groupStudents) {
                            const cachedReport = await OfflineStorageService.getOfflineStudentReport(st._id);
                            if (cachedReport) {
                                queryClient.setQueryData(QK.students.report(st._id), cachedReport);
                            }
                            queryClient.setQueryData(QK.students.detail(st._id), st);
                        }
                    }
                }

                if (localExams.length > 0) {
                    queryClient.setQueryData(['exams', { page: 1, limit: 20, status: '', gradeLevel: '' }], {
                        data: localExams.slice(0, 20),
                        pagination: { page: 1, limit: 20, total: localExams.length, totalPages: Math.ceil(localExams.length / 20) || 1 },
                    });

                    for (const ex of localExams) {
                        const results = await OfflineStorageService.getOfflineExamResults(ex._id);
                        if (results) {
                            queryClient.setQueryData(['exam-results', ex._id], results);
                        }
                    }
                }

                if (localDailySummary) {
                    queryClient.setQueryData(['daily-summary', today], localDailySummary);
                }
                if (localDailyLedger) {
                    queryClient.setQueryData(QK.payments.dailyLedger(today), localDailyLedger);
                }
                if (localPrices) {
                    queryClient.setQueryData(QK.payments.priceSettings, localPrices);
                }
            } catch (err) {
                console.warn('[DataPreloader] Local cache warmup warning:', err);
            }
        };

        const performPreload = async (isManual = false) => {
            if (typeof window === 'undefined' || isPreloadingRef.current) return;

            // Step 1: Instantly warm React Query from local IndexedDB
            await warmLocalCache();

            // Cannot fetch from server if completely offline
            if (!navigator.onLine) return;

            const stats = await OfflineStorageService.getOfflineStorageStats().catch(() => null);
            const isCacheEmpty = !stats ||
                stats.studentsCount === 0 ||
                stats.groupsCount === 0 ||
                (stats.notebooksCount ?? 0) === 0 ||
                (stats.usersCount ?? 0) === 0 ||
                (stats.examsCount ?? 0) === 0;
            const now = Date.now();
            const lastPreload = stats?.lastPreloadAt || 0;
            const isStale = (now - lastPreload) > (15 * 60 * 1000); // 15 minutes

            // If not manual, not empty, and cache is fresh, skip background refetch
            if (!isManual && !isCacheEmpty && !isStale) {
                return;
            }

            try {
                isPreloadingRef.current = true;
                const toastId = 'offline-dataset-preload';

                if (isManual) {
                    toast.loading('جاري تحميل وتجهيز كافة البيانات للعمل دون إنترنت...', { id: toastId });
                }

                console.log('📦 [DataPreloader] Downloading full workspace dataset for offline mode...');

                // 1. Fetch & Store Groups
                let allGroups: any[] = [];
                try {
                    const groupsRes = await fetchGroups({ limit: 100 });
                    allGroups = groupsRes?.data ?? [];
                    if (allGroups.length > 0) {
                        await OfflineStorageService.saveOfflineGroups(allGroups);

                        queryClient.setQueryData(QK.groups.list({ limit: 100 }), groupsRes);
                        queryClient.setQueryData(['groups'], groupsRes);
                    }
                } catch (e) {
                    console.warn('[DataPreloader] Groups fetch failed:', e);
                }

                // 2. Fetch & Store Students (up to 1000)
                let allStudents: any[] = [];
                try {
                    const studentsRes = await fetchStudents({ limit: 1000 });
                    allStudents = studentsRes?.data ?? [];
                    if (allStudents.length > 0) {
                        await OfflineStorageService.saveOfflineStudents(allStudents);

                        queryClient.setQueryData(QK.students.list({ limit: 1000 }), studentsRes);
                        queryClient.setQueryData(
                            QK.students.list({ limit: 20, search: '', groupId: undefined }),
                            {
                                pages: [{
                                    data: allStudents.slice(0, 20),
                                    pagination: { page: 1, limit: 20, total: allStudents.length, totalPages: Math.ceil(allStudents.length / 20) },
                                }],
                                pageParams: [1],
                            }
                        );

                        // Seed per-group student queries for both infinite query and standard query
                        for (const group of allGroups) {
                            const targetGid = group._id?.toString().trim();
                            const groupStudents = allStudents.filter((s) => {
                                let sGid = '';
                                if (s.groupId) {
                                    if (typeof s.groupId === 'object' && s.groupId._id) {
                                        sGid = s.groupId._id.toString().trim();
                                    } else {
                                        sGid = s.groupId.toString().trim();
                                    }
                                }
                                return sGid === targetGid;
                            });

                            const infiniteData = {
                                pages: [{
                                    data: groupStudents.slice(0, 20),
                                    pagination: {
                                        page: 1,
                                        limit: 20,
                                        total: groupStudents.length,
                                        totalPages: Math.ceil(groupStudents.length / 20) || 1,
                                    },
                                }],
                                pageParams: [1],
                            };

                            queryClient.setQueryData(QK.students.list({ limit: 20, search: '', groupId: group._id }), infiniteData);
                            queryClient.setQueryData(QK.students.list({ limit: 20, search: undefined, groupId: group._id }), infiniteData);
                            queryClient.setQueryData(QK.students.list({ groupId: group._id, limit: 200 }), {
                                data: groupStudents,
                                pagination: { page: 1, limit: 200, total: groupStudents.length, totalPages: 1 },
                            });
                        }

                        // 3. Preload Student Comprehensive Reports (Profiles, Attendance, Payments, Debts, Grades)
                        // Concurrently in chunks of 5
                        for (let i = 0; i < allStudents.length; i += 5) {
                            const chunk = allStudents.slice(i, i + 5);
                            await Promise.allSettled(chunk.map(async (st) => {
                                try {
                                    const report = await fetchStudentReport(st._id);
                                    if (report) {
                                        await OfflineStorageService.saveOfflineStudentReport(st._id, report);
                                        queryClient.setQueryData(QK.students.report(st._id), report);
                                        queryClient.setQueryData(QK.students.detail(st._id), st);
                                    }
                                } catch {}
                            }));
                        }
                    }
                } catch (e) {
                    console.warn('[DataPreloader] Students fetch failed:', e);
                }

                // 4. Fetch & Store Sessions
                try {
                    const sessionsRes = await fetchSessions({ limit: 200 });
                    const allSessions = sessionsRes?.data ?? [];
                    if (allSessions.length > 0) {
                        await OfflineStorageService.saveOfflineSessions(allSessions);

                        queryClient.setQueryData(QK.sessions.list({ limit: 50 }), sessionsRes);
                        queryClient.setQueryData(QK.sessions.list({ limit: 200 }), sessionsRes);
                        queryClient.setQueryData(
                            ['sessions', 1, '', '', today],
                            {
                                data: allSessions,
                                pagination: { total: allSessions.length, page: 1, limit: 500, totalPages: 1 },
                            }
                        );
                    }
                } catch (e) {
                    console.warn('[DataPreloader] Sessions fetch failed:', e);
                }

                // 5. Fetch & Store Exams & Exam Results
                try {
                    const examsRes = await fetchExams({ page: 1, limit: 100 });
                    const allExams = examsRes?.data ?? [];
                    if (allExams.length > 0) {
                        await OfflineStorageService.saveOfflineExams(allExams);

                        queryClient.setQueryData(
                            ['exams', { page: 1, limit: 20, status: '', gradeLevel: '' }],
                            {
                                data: allExams.slice(0, 20),
                                pagination: { page: 1, limit: 20, total: allExams.length, totalPages: Math.ceil(allExams.length / 20) },
                            }
                        );

                        // Preload results for each exam
                        await Promise.allSettled(allExams.map(async (exam) => {
                            try {
                                const results = await getExamResults(exam._id);
                                if (results) {
                                    await OfflineStorageService.saveOfflineExamResults(exam._id, results);
                                    queryClient.setQueryData(['exam-results', exam._id], results);
                                    queryClient.setQueryData(['exam', exam._id], exam);
                                }
                            } catch {}
                        }));
                    }
                } catch (e) {
                    console.warn('[DataPreloader] Exams fetch failed:', e);
                }

                // 6. Fetch & Store Daily Summary & Financials (الجرد اليومي والماليات)
                try {
                    const [dailySummaryRes, dailyLedgerRes, monthlyLedgerRes, pricesRes] = await Promise.allSettled([
                        fetchDailySummary(today),
                        getDailyLedger(today),
                        getMonthlyLedger(currentYear, currentMonth),
                        getPriceSettings(),
                    ]);

                    if (dailySummaryRes.status === 'fulfilled' && dailySummaryRes.value) {
                        await OfflineStorageService.saveDailySummary(today, dailySummaryRes.value);
                        queryClient.setQueryData(['daily-summary', today], dailySummaryRes.value);
                    }
                    if (dailyLedgerRes.status === 'fulfilled' && dailyLedgerRes.value) {
                        await OfflineStorageService.saveDailyLedger(today, dailyLedgerRes.value);
                        queryClient.setQueryData(QK.payments.dailyLedger(today), dailyLedgerRes.value);
                    }
                    if (monthlyLedgerRes.status === 'fulfilled' && monthlyLedgerRes.value) {
                        await OfflineStorageService.saveMonthlyLedger(currentYear, currentMonth, monthlyLedgerRes.value);
                        queryClient.setQueryData(QK.payments.monthlyLedger(currentYear, currentMonth), monthlyLedgerRes.value);
                    }
                    if (pricesRes.status === 'fulfilled' && pricesRes.value) {
                        await OfflineStorageService.savePriceSettings(pricesRes.value);
                        queryClient.setQueryData(QK.payments.priceSettings, pricesRes.value);
                    }
                } catch (e) {
                    console.warn('[DataPreloader] Financials fetch warning:', e);
                }

                // 7. Fetch & Store Notebooks & Store Inventory (المتجر والمذكرات)
                let allNotebooks: any[] = [];
                try {
                    const [notebooksRes, reservationsRes] = await Promise.allSettled([
                        fetchNotebooks({ limit: 500 }),
                        fetchReservations({ status: 'PENDING', limit: 200 }),
                    ]);

                    if (notebooksRes.status === 'fulfilled' && notebooksRes.value) {
                        allNotebooks = Array.isArray((notebooksRes.value as any)?.data)
                            ? (notebooksRes.value as any).data
                            : Array.isArray(notebooksRes.value)
                            ? notebooksRes.value
                            : [];
                        if (allNotebooks.length > 0) {
                            await OfflineStorageService.saveOfflineNotebooks(allNotebooks);
                            const nbPayload = { data: allNotebooks, pagination: { total: allNotebooks.length, page: 1, limit: 100, totalPages: 1 } };
                            queryClient.setQueryData(['notebooks'], { data: nbPayload });
                            queryClient.setQueryData(['notebooks', { page: 1, limit: 20, search: '', gradeLevel: undefined }], { data: nbPayload });
                            queryClient.setQueryData(['notebooks', { page: 1, limit: 20, search: '', gradeLevel: '' }], { data: nbPayload });
                        }
                    }

                    if (reservationsRes.status === 'fulfilled' && reservationsRes.value) {
                        const resvs = (reservationsRes.value as any)?.data || [];
                        if (resvs.length > 0) {
                            await OfflineStorageService.saveOfflineReservations(resvs);
                            queryClient.setQueryData(QK.notebooks.reservations(), { data: resvs, pagination: { total: resvs.length, page: 1, limit: 100, totalPages: 1 } });
                            queryClient.setQueryData(QK.notebooks.reservations(''), { data: resvs, pagination: { total: resvs.length, page: 1, limit: 100, totalPages: 1 } });
                        }
                    }
                } catch (e) {
                    console.warn('[DataPreloader] Notebooks fetch warning:', e);
                }

                // 8. Fetch & Store Users & Assistants (المساعدين والمستخدمين)
                let allUsers: any[] = [];
                try {
                    const usersRes = await fetchUsers();
                    allUsers = Array.isArray((usersRes as any)?.data)
                        ? (usersRes as any).data
                        : Array.isArray(usersRes)
                        ? usersRes
                        : [];
                    if (allUsers.length > 0) {
                        await OfflineStorageService.saveOfflineUsers(allUsers);
                        const assistantsList = allUsers.filter((u: any) => u.role === 'assistant');
                        queryClient.setQueryData(['assistants', ''], { data: assistantsList });
                        queryClient.setQueryData(['assistants', undefined], { data: assistantsList });
                        queryClient.setQueryData(['assistants'], { data: assistantsList });
                        queryClient.setQueryData(['users'], { data: allUsers });
                    }
                } catch (e) {
                    console.warn('[DataPreloader] Users/Assistants fetch warning:', e);
                }

                // 9. Fetch & Store Dashboard Summary & Unpaid Students
                try {
                    const [dashboardRes, unpaidRes] = await Promise.allSettled([
                        apiClient.get('/reports/dashboard'),
                        apiClient.get('/reports/unpaid-students?includeList=true'),
                    ]);
                    if (dashboardRes.status === 'fulfilled' && (dashboardRes.value as any)?.data) {
                        await OfflineStorageService.saveOfflineDashboardStats((dashboardRes.value as any).data);
                        queryClient.setQueryData(['dashboard-stats'], (dashboardRes.value as any).data);
                    }
                    if (unpaidRes.status === 'fulfilled' && (unpaidRes.value as any)?.data) {
                        await OfflineStorageService.saveOfflineUnpaidStudents((unpaidRes.value as any).data);
                        queryClient.setQueryData(['unpaid-students'], (unpaidRes.value as any).data);
                    }
                } catch (e) {
                    console.warn('[DataPreloader] Dashboard/Unpaid stats fetch warning:', e);
                }

                await OfflineStorageService.setLastPreloadTime(Date.now());

                if (isManual) {
                    toast.success('تم تجهيز كافة البيانات للعمل دون إنترنت بنجاح!', {
                        id: toastId,
                        description: `تم حفظ ${allStudents.length} طالب، ${allNotebooks.length} مذكرة، والمساعدين (${allUsers.length})، والماليات محلياً.`,
                        duration: 4000,
                    });
                }
                console.log(`✅ [DataPreloader] Offline storage primed with ${allStudents.length} students, ${allNotebooks.length} notebooks, ${allUsers.length} users/assistants, and financials.`);
            } catch (err) {
                console.warn('[DataPreloader] Background preload error:', err);
            } finally {
                isPreloadingRef.current = false;
            }
        };

        /**
         * ── Center Preload Pipeline ──────────────────────────────────────────
         */
        const warmLocalCenterCache = async () => {
            try {
                const [
                    localCenters,
                    localTeachers,
                    localPackages,
                    localGroups,
                    localStudentsRes,
                    localEnrollments,
                    localCheckIns,
                    localDailyTally,
                    localFinancials,
                    localSupervisors,
                ] = await Promise.all([
                    OfflineStorageService.getOfflineCenters(),
                    OfflineStorageService.getOfflineCenterTeachers(),
                    OfflineStorageService.getOfflineCenterPackages(),
                    OfflineStorageService.getOfflineCenterGroups(),
                    OfflineStorageService.getOfflineCenterStudents(),
                    OfflineStorageService.getOfflineCenterEnrollments(),
                    OfflineStorageService.getOfflineCenterCheckIns({ date: today }),
                    OfflineStorageService.getOfflineCenterDailyTally(today),
                    OfflineStorageService.getOfflineCenterFinancialSummary(),
                    OfflineStorageService.getOfflineCenterSupervisors(),
                ]);

                if (localCenters.length > 0) {
                    queryClient.setQueryData(['center', 'my-centers'], localCenters);
                }
                if (localTeachers.length > 0) {
                    queryClient.setQueryData(['center', 'teachers'], localTeachers);
                    queryClient.setQueryData(['center', 'teachers', ''], localTeachers);
                }
                if (localPackages.length > 0) {
                    queryClient.setQueryData(['center', 'packages'], localPackages);
                }
                if (localGroups.length > 0) {
                    queryClient.setQueryData(['center', 'groups'], localGroups);
                }
                if (localEnrollments.length > 0) {
                    queryClient.setQueryData(['center', 'enrollments'], localEnrollments);
                }
                if (localStudentsRes && localStudentsRes.stageCounts) {
                    queryClient.setQueryData(['center', 'students', 'stage-counts'], localStudentsRes);
                }
                if (localCheckIns && localCheckIns.checkIns.length > 0) {
                    queryClient.setQueryData(['center', 'daily-checkins', today, ''], localCheckIns);
                    queryClient.setQueryData(['center', 'daily-checkins', today], localCheckIns);
                }
                if (localDailyTally) {
                    queryClient.setQueryData(['center', 'daily-tally', today], localDailyTally);
                }
                if (localFinancials) {
                    queryClient.setQueryData(['center', 'financials-summary'], localFinancials);
                }
                if (localSupervisors.length > 0) {
                    queryClient.setQueryData(['center', 'supervisors'], localSupervisors);
                }
            } catch (err) {
                console.warn('[DataPreloader] Center cache warm error:', err);
            }
        };

        const performCenterPreload = async (isManual = false) => {
            if (isPreloadingRef.current) return;
            isPreloadingRef.current = true;

            await warmLocalCenterCache();

            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                isPreloadingRef.current = false;
                return;
            }

            try {
                const [
                    centersRes,
                    teachersRes,
                    packagesRes,
                    groupsRes,
                    studentsRes,
                    enrollmentsRes,
                    checkInsRes,
                    tallyRes,
                    summaryRes,
                    supervisorsRes,
                ] = await Promise.allSettled([
                    fetchMyCenters(),
                    fetchCenterTeachers({ isActive: true }),
                    fetchCenterPackages({ isActive: true }),
                    fetchCenterGroups({ isActive: true }),
                    fetchCenterStudents({ limit: 1000, includeCounts: 'true' as any }),
                    fetchCenterEnrollments({ isActive: true }),
                    fetchDailyCheckIns({ date: today }),
                    fetchCenterDailyTally(today),
                    fetchCenterFinancialSummary(),
                    fetchCenterSupervisors(),
                ]);

                if (centersRes.status === 'fulfilled' && Array.isArray(centersRes.value)) {
                    await OfflineStorageService.saveOfflineCenters(centersRes.value);
                    queryClient.setQueryData(['center', 'my-centers'], centersRes.value);
                }
                if (teachersRes.status === 'fulfilled' && Array.isArray(teachersRes.value)) {
                    await OfflineStorageService.saveOfflineCenterTeachers(teachersRes.value);
                    queryClient.setQueryData(['center', 'teachers'], teachersRes.value);
                    queryClient.setQueryData(['center', 'teachers', ''], teachersRes.value);
                }
                if (packagesRes.status === 'fulfilled' && Array.isArray(packagesRes.value)) {
                    await OfflineStorageService.saveOfflineCenterPackages(packagesRes.value);
                    queryClient.setQueryData(['center', 'packages'], packagesRes.value);
                }
                if (groupsRes.status === 'fulfilled' && Array.isArray(groupsRes.value)) {
                    await OfflineStorageService.saveOfflineCenterGroups(groupsRes.value);
                    queryClient.setQueryData(['center', 'groups'], groupsRes.value);
                }
                if (studentsRes.status === 'fulfilled' && studentsRes.value?.data) {
                    await OfflineStorageService.saveOfflineCenterStudents(studentsRes.value.data);
                    queryClient.setQueryData(['center', 'students', 'stage-counts'], studentsRes.value);
                }
                if (enrollmentsRes.status === 'fulfilled' && Array.isArray(enrollmentsRes.value)) {
                    await OfflineStorageService.saveOfflineCenterEnrollments(enrollmentsRes.value);
                    queryClient.setQueryData(['center', 'enrollments'], enrollmentsRes.value);
                }
                if (checkInsRes.status === 'fulfilled' && checkInsRes.value?.checkIns) {
                    await OfflineStorageService.saveOfflineCenterCheckIns(checkInsRes.value.checkIns);
                    queryClient.setQueryData(['center', 'daily-checkins', today, ''], checkInsRes.value);
                    queryClient.setQueryData(['center', 'daily-checkins', today], checkInsRes.value);
                }
                if (tallyRes.status === 'fulfilled' && tallyRes.value) {
                    await OfflineStorageService.saveOfflineCenterDailyTally(today, tallyRes.value);
                    queryClient.setQueryData(['center', 'daily-tally', today], tallyRes.value);
                }
                if (summaryRes.status === 'fulfilled' && summaryRes.value) {
                    await OfflineStorageService.saveOfflineCenterFinancialSummary(summaryRes.value);
                    queryClient.setQueryData(['center', 'financials-summary'], summaryRes.value);
                }
                if (supervisorsRes.status === 'fulfilled' && Array.isArray(supervisorsRes.value)) {
                    await OfflineStorageService.saveOfflineCenterSupervisors(supervisorsRes.value);
                    queryClient.setQueryData(['center', 'supervisors'], supervisorsRes.value);
                }

                await OfflineStorageService.setLastPreloadTime();

                if (isManual) {
                    const stuCount = studentsRes.status === 'fulfilled' ? studentsRes.value.data?.length : 0;
                    const grpCount = groupsRes.status === 'fulfilled' ? groupsRes.value.length : 0;
                    toast.success('تم تحديث وتجهيز كافة بيانات السنتر للعمل دون إنترنت بنجاح!', {
                        description: `تم حفظ ${stuCount} طالب، و${grpCount} مجموعة، والمدرسين، والتحضير، والماليات محلياً.`,
                    });
                }
                console.log('✅ [DataPreloader] Center offline storage primed successfully.');
            } catch (err) {
                console.warn('[DataPreloader] Center background preload error:', err);
            } finally {
                isPreloadingRef.current = false;
            }
        };

        // Run appropriate preload pipeline
        if (isCenterRole) {
            performCenterPreload();
        } else {
            performPreload();
        }

        const handleOnline = () => {
            if (isCenterRole) {
                performCenterPreload(false);
            } else {
                performPreload(false);
            }
        };

        const handleOffline = async () => {
            try {
                const stats = await OfflineStorageService.getOfflineStorageStats().catch(() => null);
                if (isCenterRole) {
                    const stuCount = stats?.centerStudentsCount || 0;
                    const grpCount = stats?.centerGroupsCount || 0;
                    const tchCount = stats?.centerTeachersCount || 0;
                    toast.success('تم الانتقال لوضع عدم الاتصال (أوفلاين) للسنتر!', {
                        id: 'munazem-center-offline-toast',
                        description: `جميع بيانات السنتر (${stuCount} طالب، ${grpCount} مجموعة، ${tchCount} مدرس، التحضير بالباركود) متاحة وتعمل محلياً.`,
                        duration: 5000,
                    });
                } else {
                    const count = stats?.studentsCount || 0;
                    const nbCount = stats?.notebooksCount || 0;
                    const userCount = stats?.usersCount || 0;
                    toast.success('تم تجهيز كافة البيانات للعمل دون إنترنت بنجاح!', {
                        id: 'munazem-offline-ready-toast',
                        description: count > 0
                            ? `تم حفظ ${count} طالب، والمساعدين (${userCount})، والمتجر والمذكرات (${nbCount})، والامتحانات، والماليات محلياً.`
                            : 'كافة البيانات المسجلة محفوظة ومتاحة للعمل دون اتصال.',
                        duration: 5000,
                    });
                }
            } catch {
                toast.info('أنت الآن في وضع عدم الاتصال (أوفلاين)');
            }
        };

        const handleManualPreloadEvent = () => {
            if (isCenterRole) {
                performCenterPreload(true);
            } else {
                performPreload(true);
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('munazem:preload-offline-data', handleManualPreloadEvent);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('munazem:preload-offline-data', handleManualPreloadEvent);
        };
    }, [isAuthenticated, user, queryClient]);

    return null;
}
