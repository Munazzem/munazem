/**
 * Centralized React Query key factory.
 *
 * Rules:
 *  - All queryKey arrays MUST be defined here — never inline string literals.
 *  - Keys are namespaced by domain (e.g. `students`, `payments`).
 *  - Dynamic keys are factory functions that accept the required identifiers.
 *
 * Usage:
 *   useQuery({ queryKey: QK.students.list({ search: 'ahmed' }), ... })
 *   queryClient.invalidateQueries({ queryKey: QK.students.all })
 */

export const QK = {

    // ── Auth / Me ───────────────────────────────────────────────────
    me: ['me'] as const,

    // ── Dashboard ───────────────────────────────────────────────────
    dashboard: {
        summary: ['dashboardSummary'] as const,
        dailySummary: (date?: string) => ['dailySummary', date] as const,
    },

    // ── Students ────────────────────────────────────────────────────
    students: {
        all:     ['students'] as const,
        list:    (params?: object) => ['students', params] as const,
        detail:  (id: string)      => ['student_detail', id] as const,
        details: ['student_detail'] as const,
        report:  (id: string)      => ['studentReport', id] as const,
        search:  (term: string)    => ['students-search', term] as const,
        picker:  (term: string)    => ['students-picker', term] as const,
    },

    // ── Groups ──────────────────────────────────────────────────────
    groups: {
        all:    ['groups'] as const,
        list:   (params?: object) => ['groups', params] as const,
        report: (id: string)      => ['group-report', id] as const,
        picker: (term: string)    => ['groups-picker', term] as const,
        // Scoped fetches inside modals
        forAddStudent:     ['teacherGroups_addStudent'] as const,
        forEditStudent:    ['teacherGroups_editStudent'] as const,
        forReassign:       (grade?: string) => ['teacherGroups_reassignStudent', grade] as const,
        forBulk:           ['teacherGroups_bulk'] as const,
        forBulkSub:        ['bulkSub_groups'] as const,
        forCreateSession:  ['groups'] as const,
    },

    // ── Sessions ────────────────────────────────────────────────────
    sessions: {
        all:    ['sessions'] as const,
        list:   (params?: object) => ['sessions', params] as const,
        detail: (id: string)      => ['session', id] as const,
    },

    // ── Attendance ──────────────────────────────────────────────────
    attendance: {
        bySession:   (sessionId: string) => ['attendance', sessionId] as const,
        snapshot:    (sessionId: string) => ['snapshot', sessionId] as const,
        whatsapp:    (sessionId: string) => ['whatsapp-links', sessionId] as const,
        searchInSession: (groupId: string, search: string) => ['students-search', groupId, search] as const,
    },

    // ── Notebooks ───────────────────────────────────────────────────
    notebooks: {
        all:          ['notebooks'] as const,
        list:         (params?: object) => ['notebooks', params] as const,
        listForModal: ['notebooks-list'] as const,
        reservations: (term?: string) => ['pendingReservations', term] as const,
        // Scoped fetches
        forQuickSale:      (grade?: string) => ['quickSale_notebooks', grade] as const,
    },

    // ── Payments / Ledger ────────────────────────────────────────────
    payments: {
        all:               ['payments'] as const,
        dailyLedgerBase:   ['daily-ledger'] as const,
        dailyLedger:       (date: string) => ['daily-ledger', date] as const,
        monthlyLedgerBase: ['monthly-ledger'] as const,
        monthlyLedger:     (year: number, month: number) => ['monthly-ledger', year, month] as const,
        priceSettings:     ['price-settings'] as const,
        // Scoped fetches
        searchForPayment:  (term: string) => ['students-search-payment', term] as const,
        batchStudents:     (term: string) => ['batchStudents', term] as const,
        bulkSubStudents:   (groupId: string) => ['bulkSub_students', groupId] as const,
        quickSaleStudents: (term: string) => ['quickSale_students', term] as const,
    },

    // ── Reports ─────────────────────────────────────────────────────
    reports: {
        daily:     (date: string)                 => ['daily-summary', date] as const,
        student:   (id: string)                   => ['student-report', id] as const,
        group:     (id: string)                   => ['group-report', id] as const,
        financial: (year: number, month: number)  => ['financial-report', year, month] as const,
    },

    // ── Exams ────────────────────────────────────────────────────────
    exams: {
        all:     ['exams'] as const,
        list:    (params?: object) => ['exams', params] as const,
        detail:  (id: string)      => ['exam', id] as const,
        results: (id: string)      => ['exam-results', id] as const,
    },

    // ── Users (Teachers / Assistants) ────────────────────────────────
    users: {
        all:  ['users'] as const,
        list: (params?: object) => ['users', params] as const,
    },

    // ── Subscriptions ────────────────────────────────────────────────
    subscriptions: {
        all:        ['subscriptions'] as const,
        forTeacher: (teacherId: string) => ['teacherSubscriptions', teacherId] as const,
    },

    // ── Admin ────────────────────────────────────────────────────────
    admin: {
        stats:    ['admin-stats'] as const,
        growth:   ['admin-growth'] as const,
        tenants:  (params?: object) => ['admin-tenants', params] as const,
        tenant:   (id: string)      => ['admin-tenant', id] as const,
        errors:   (params?: object) => ['admin-errors', params] as const,
        health:   ['admin-health'] as const,
        activity: (params?: object) => ['admin-activity', params] as const,
    },

} as const;
