/**
 * frontend/src/components/pwa/DataPreloader.tsx
 *
 * Proactive dataset preloader that caches vital entities:
 * - Groups
 * - Students (ALL pages — no 1000 cap)
 * - Student Comprehensive Reports (Profiles, Attendance, Payments, Debts, Exam Grades)
 * - Sessions
 * - Exams & Exam Results
 * - Daily Summary & Financial Ledgers
 * into IndexedDB & React Query cache so teachers and staff can access
 * their entire workspace completely offline.
 *
 * FIXES:
 * 1. Cross-tenant cache protection: detects user ID mismatch and purges stale data
 * 2. Paginated student fetching: loops pages instead of single limit:1000 call
 * 3. Mobile-safe operation: each store cleared separately, no large IDB transactions
 * 4. Reduced stale window: 10 min instead of 15 to catch fresher account switches
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
import { fetchStudentReport, fetchDailySummary, fetchOfflineReportsBundle } from '@/lib/api/reports';
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

/** Page size for paginated student preloading */
const STUDENT_PRELOAD_PAGE_SIZE = 200;
/** Maximum pages to fetch (safety cap: 200 * 30 = 6,000 students) */
const STUDENT_MAX_PAGES = 30;
/** Cache stale window: 10 minutes */
const CACHE_STALE_MS = 10 * 60 * 1000;

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

        // ── Cross-Tenant Guard ─────────────────────────────────────────────────
        /**
         * Checks if the current logged-in user matches the user who last populated
         * the IndexedDB cache. If different, wipes ALL cached data before loading.
         * This prevents Teacher A's 1,400 students showing in Teacher B's account.
         */
        const checkAndClearCrossUserCache = async (): Promise<boolean> => {
            try {
                const currentUserId = user?.id || (user as any)?._id;
                if (!currentUserId) return false;

                const cachedUserId = await OfflineStorageService.getCurrentUserId();

                if (cachedUserId && cachedUserId !== String(currentUserId)) {
                    console.warn(
                        `[DataPreloader] ⚠️ Cross-tenant cache detected! Cached: ${cachedUserId}, Current: ${currentUserId}. Purging...`
                    );
                    // Purge all cached data but preserve outbox mutations in case they belong to this session
                    await OfflineStorageService.clearAllOfflineData(true);
                    // Also invalidate all React Query cache
                    queryClient.removeQueries();
                    console.log('[DataPreloader] ✅ Cross-tenant cache purged.');
                    return true; // was dirty
                }
                return false;
            } catch (err) {
                console.warn('[DataPreloader] Cross-tenant check failed:', err);
                return false;
            }
        };

        // ── Teacher/Assistant: Warm local IndexedDB → React Query ──────────────
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

                if (localUsers.length > 0 && user?.role === 'teacher') {
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
                    // Seed general students list for fast offline lookups
                    const studentsPayload = {
                        data: localStudents,
                        pagination: { total: localStudents.length, page: 1, limit: localStudents.length, totalPages: 1 },
                    };
                    queryClient.setQueryData(QK.students.list({ limit: 1000 }), studentsPayload);

                    // Seed individual student details from local storage
                    for (const st of localStudents) {
                        queryClient.setQueryData(QK.students.detail(st._id), st);
                    }
                }

                if (localExams.length > 0) {
                    queryClient.setQueryData(['exams', { page: 1, limit: 20, status: '', gradeLevel: '' }], {
                        data: localExams.slice(0, 20),
                        pagination: { page: 1, limit: 20, total: localExams.length, totalPages: Math.ceil(localExams.length / 20) || 1 },
                    });

                    for (const ex of localExams) {
                        const results = await OfflineStorageService.getOfflineExamResults(ex._id).catch(() => null);
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

        /**
         * Fetch ALL students using pagination to overcome the backend's per-request cap.
         * Saves each page batch IMMEDIATELY to IndexedDB and generates baseline profile reports,
         * ensuring data is safe locally even if interrupted.
         */
        const fetchAllStudentsPaginated = async (): Promise<any[]> => {
            const allStudents: any[] = [];
            let currentPage = 1;
            let hasMore = true;

            while (hasMore && currentPage <= STUDENT_MAX_PAGES) {
                try {
                    const pageRes = await fetchStudents({
                        page: currentPage,
                        limit: STUDENT_PRELOAD_PAGE_SIZE,
                    });
                    const pageData = pageRes?.data ?? [];
                    if (pageData.length > 0) {
                        // Immediately persist this chunk into IndexedDB + generate baseline profile reports
                        await OfflineStorageService.saveOfflineStudents(pageData);
                        allStudents.push(...pageData);
                    }

                    const pagination = pageRes?.pagination;
                    if (pagination && currentPage < pagination.totalPages) {
                        currentPage++;
                    } else {
                        hasMore = false;
                    }

                    // Brief pause between pages to be kind to server
                    if (hasMore) {
                        await new Promise(r => setTimeout(r, 100));
                    }
                } catch (pageErr) {
                    console.warn(`[DataPreloader] Student page ${currentPage} fetch failed:`, pageErr);
                    hasMore = false;
                }
            }

            console.log(`[DataPreloader] Fetched & saved ${allStudents.length} students across ${currentPage - 1 || 1} page(s).`);
            return allStudents;
        };

        const performPreload = async (isManual = false) => {
            if (typeof window === 'undefined' || isPreloadingRef.current) return;

            // ── Step 0: Cross-Tenant Protection ───────────────────────────────
            const wasDirty = await checkAndClearCrossUserCache();

            // ── Step 1: Instantly warm React Query from local IndexedDB ONLY if offline ───
            if (!navigator.onLine && !wasDirty) {
                await warmLocalCache();
            }

            // Cannot fetch from server if completely offline
            if (!navigator.onLine) return;

            const stats = await OfflineStorageService.getOfflineStorageStats().catch(() => null);
            const isCacheEmpty = !stats ||
                stats.studentsCount === 0 ||
                stats.groupsCount === 0;
            const now = Date.now();
            const lastPreload = stats?.lastPreloadAt || 0;
            const isStale = (now - lastPreload) > CACHE_STALE_MS;

            // If not manual, not empty, and cache is fresh, skip background refetch
            if (!isManual && !isCacheEmpty && !isStale && !wasDirty) {
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
                        queryClient.invalidateQueries({ queryKey: QK.groups.all });
                    }
                } catch (e) {
                    console.warn('[DataPreloader] Groups fetch failed:', e);
                }

                // 2. Fetch & Store Students (ALL pages — paginated and saved page-by-page)
                let allStudents: any[] = [];
                try {
                    allStudents = await fetchAllStudentsPaginated();

                    if (allStudents.length > 0) {
                        // Invalidate students cache in React Query so any active screen revalidates live with server
                        queryClient.invalidateQueries({ queryKey: QK.students.all });
                    }
                } catch (e) {
                    console.warn('[DataPreloader] Students fetch failed:', e);
                }

                // 3. Preload all student profile reports (Attendance, Grades, Financials) in ONE ultra-fast batch request
                try {
                    const bundleRes = await fetchOfflineReportsBundle();
                    const bundleReports = bundleRes?.reports ?? [];
                    if (bundleReports.length > 0) {
                        await OfflineStorageService.saveOfflineStudentReportsBundle(bundleReports);
                    }
                } catch (e) {
                    console.warn('[DataPreloader] Offline reports bundle fetch warning:', e);
                }

                // 4. Fetch & Store Sessions
                try {
                    const sessionsRes = await fetchSessions({ limit: 200 });
                    const allSessions = sessionsRes?.data ?? [];
                    if (allSessions.length > 0) {
                        await OfflineStorageService.saveOfflineSessions(allSessions);
                        queryClient.invalidateQueries({ queryKey: QK.sessions.all });
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
                        queryClient.invalidateQueries({ queryKey: ['exams'] });

                        await Promise.allSettled(allExams.map(async (exam) => {
                            try {
                                const results = await getExamResults(exam._id);
                                if (results) {
                                    await OfflineStorageService.saveOfflineExamResults(exam._id, results);
                                }
                            } catch {}
                        }));
                    }
                } catch (e) {
                    console.warn('[DataPreloader] Exams fetch warning:', e);
                }

                // 6. Fetch & Store Daily Summary & Financials
                try {
                    const isTeacher = user?.role === 'teacher';
                    const financialPromises: Promise<any>[] = [
                        fetchDailySummary(today),
                        getDailyLedger(today),
                        getPriceSettings(),
                    ];
                    // Monthly ledger is strictly restricted to teachers
                    if (isTeacher) {
                        financialPromises.push(getMonthlyLedger(currentYear, currentMonth));
                    }

                    const settledResults = await Promise.allSettled(financialPromises);
                    const dailySummaryRes = settledResults[0];
                    const dailyLedgerRes = settledResults[1];
                    const pricesRes = settledResults[2];
                    const monthlyLedgerRes = isTeacher ? settledResults[3] : undefined;

                    if (dailySummaryRes?.status === 'fulfilled' && dailySummaryRes.value) {
                        await OfflineStorageService.saveDailySummary(today, dailySummaryRes.value);
                        queryClient.setQueryData(['daily-summary', today], dailySummaryRes.value);
                    }
                    if (dailyLedgerRes?.status === 'fulfilled' && dailyLedgerRes.value) {
                        await OfflineStorageService.saveDailyLedger(today, dailyLedgerRes.value);
                        queryClient.setQueryData(QK.payments.dailyLedger(today), dailyLedgerRes.value);
                    }
                    if (monthlyLedgerRes?.status === 'fulfilled' && monthlyLedgerRes.value) {
                        await OfflineStorageService.saveMonthlyLedger(currentYear, currentMonth, monthlyLedgerRes.value);
                        queryClient.setQueryData(QK.payments.monthlyLedger(currentYear, currentMonth), monthlyLedgerRes.value);
                    }
                    if (pricesRes?.status === 'fulfilled' && pricesRes.value) {
                        await OfflineStorageService.savePriceSettings(pricesRes.value);
                        queryClient.setQueryData(QK.payments.priceSettings, pricesRes.value);
                    }
                } catch (e) {
                    console.warn('[DataPreloader] Financials fetch warning:', e);
                }

                // 7. Fetch & Store Notebooks & Store Inventory
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

                // 8. Fetch & Store Users & Assistants (Teachers only; Assistants cannot manage or list other users)
                let allUsers: any[] = [];
                if (user?.role === 'teacher') {
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

                // 10. Mark cache as belonging to this user
                const currentUserId = user?.id || (user as any)?._id;
                if (currentUserId) {
                    await OfflineStorageService.setCurrentUserId(String(currentUserId));
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

        // ── Center Owner/Supervisor Preload Pipeline ───────────────────────────

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

            // Cross-tenant check for center users too
            const wasDirty = await checkAndClearCrossUserCache();

            if (!navigator.onLine && !wasDirty) {
                await warmLocalCenterCache();
            }

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

                // Mark cache owner
                const currentUserId = user?.id || (user as any)?._id;
                if (currentUserId) {
                    await OfflineStorageService.setCurrentUserId(String(currentUserId));
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
            // Revalidate all active queries immediately with the live server
            queryClient.invalidateQueries();
            if (isCenterRole) {
                performCenterPreload(false);
            } else {
                performPreload(false);
            }
        };

        const handleOffline = async () => {
            // Immediately warm React Query from local IndexedDB when network drops
            if (isCenterRole) {
                await warmLocalCenterCache();
            } else {
                await warmLocalCache();
            }
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
                    if (count > 0) {
                        toast.success('تم الانتقال لوضع عدم الاتصال (أوفلاين)!', {
                            id: 'munazem-offline-ready-toast',
                            description: `تم حفظ ${count} طالب، والمساعدين (${userCount})، والمتجر والمذكرات (${nbCount})، والامتحانات، والماليات محلياً.`,
                            duration: 5000,
                        });
                    } else {
                        toast.warning('أنت الآن في وضع عدم الاتصال (أوفلاين)', {
                            id: 'munazem-offline-ready-toast',
                            description: 'لم تكتمل المزامنة الكاملة مسبقاً، سيتم عرض البيانات المتوفرة محلياً.',
                            duration: 5000,
                        });
                    }
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
