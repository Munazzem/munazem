'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchAdminErrors } from '@/lib/api/admin';
import type { AdminErrorLog } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';

function LevelBadge({ level }: { level: string }) {
    const map: Record<string, string> = {
        critical: 'bg-red-100 text-red-700 border border-red-200',
        error:    'bg-orange-100 text-orange-700 border border-orange-200',
        warn:     'bg-yellow-100 text-yellow-700 border border-yellow-200',
    };
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${map[level] ?? 'bg-gray-100 text-gray-600'}`}>
            {level}
        </span>
    );
}

function ErrorRow({ log }: { log: AdminErrorLog }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div
            className="p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 cursor-pointer transition-colors"
            onClick={() => setExpanded(e => !e)}
        >
            <div className="flex items-start gap-3">
                <LevelBadge level={log.level} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{log.message}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400 font-mono">{log.method} {log.path}</span>
                        <span className="text-xs text-gray-400">كود: {log.statusCode}</span>
                        {log.requestId && (
                            <span className="text-xs text-gray-300 font-mono hidden sm:inline">
                                #{log.requestId.slice(0, 8)}
                            </span>
                        )}
                    </div>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                    {new Date(log.createdAt).toLocaleString('ar-EG', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                    })}
                </span>
            </div>

            {expanded && log.stack && (
                <pre className="mt-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl p-3 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap break-all">
                    {log.stack}
                </pre>
            )}
        </div>
    );
}

export default function ErrorLogsPage() {
    const [level, setLevel] = useState('');
    const [page, setPage]   = useState(1);

    const { data, isLoading, refetch, isFetching } = useQuery({
        queryKey:        ['admin-errors', { level, page }],
        queryFn:         () => fetchAdminErrors({ level: level || undefined, page, limit: 50 }),
        refetchInterval: 30_000,
    });

    const logs       = data?.data ?? [];
    const pagination = data?.pagination;

    return (
        <div className="space-y-5 p-4 sm:p-6 max-w-5xl mx-auto" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-50 rounded-xl border border-red-100">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">سجل الأخطاء</h1>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {pagination ? `${pagination.total} خطأ مسجل` : ''}
                            {' — '}يتحدث كل 30 ثانية
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors bg-white border border-gray-200 rounded-xl px-4 py-2 disabled:opacity-50"
                >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    تحديث
                </button>
            </div>

            {/* Filter */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-2">
                {(['', 'critical', 'error', 'warn'] as const).map(l => (
                    <button
                        key={l}
                        onClick={() => { setLevel(l); setPage(1); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                            level === l
                                ? 'bg-primary text-white border-primary'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'
                        }`}
                    >
                        {l === '' ? 'الكل' : l}
                    </button>
                ))}
            </div>

            {/* Logs List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="divide-y divide-gray-50">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="h-16 animate-pulse mx-4 my-2 bg-gray-50 rounded-xl" />
                        ))}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="py-20 text-center text-gray-400 space-y-2">
                        <AlertTriangle className="h-10 w-10 mx-auto text-gray-200" />
                        <p>لا توجد أخطاء مسجلة 🎉</p>
                    </div>
                ) : (
                    <div>
                        {logs.map(log => <ErrorRow key={log._id} log={log} />)}
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                        <span className="text-xs text-gray-500">
                            صفحة {pagination.page} من {pagination.totalPages}
                        </span>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
