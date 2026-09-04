'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, ChevronDown, ChevronUp, UserCheck, UserX, Users } from 'lucide-react';
import type { IAttendanceSnapshot } from '@/types/session.types';

interface SnapshotSummaryProps {
    snapshot: IAttendanceSnapshot;
}

export function SnapshotSummary({ snapshot }: SnapshotSummaryProps) {
    const [showPresent, setShowPresent] = useState(false);
    const compCount = snapshot.compensatedStudents?.length ?? snapshot.compensatedCount ?? 0;
    const presentList = snapshot.presentStudents ?? [];
    const guestList = snapshot.guestStudents ?? [];
    const absentList = snapshot.absentStudents ?? [];
    const compList = snapshot.compensatedStudents ?? [];

    const rate = snapshot.totalCount > 0
        ? Math.round(((snapshot.presentCount + compCount) / snapshot.totalCount) * 100)
        : 0;

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                <CalendarCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                ملخص الحصة
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-4">
                <div className="text-center bg-green-50 rounded-lg p-2 sm:p-3 border border-green-100">
                    <p className="text-lg sm:text-2xl font-bold text-green-700">{snapshot.presentCount}</p>
                    <p className="text-[11px] sm:text-xs text-green-600 mt-1">حاضر</p>
                </div>
                <div className="text-center bg-indigo-50 rounded-lg p-2 sm:p-3 border border-indigo-100">
                    <p className="text-lg sm:text-2xl font-bold text-indigo-700">{guestList.length}</p>
                    <p className="text-[11px] sm:text-xs text-indigo-600 mt-1">زائر</p>
                </div>
                <div className="text-center bg-purple-50 rounded-lg p-2 sm:p-3 border border-purple-100">
                    <p className="text-lg sm:text-2xl font-bold text-purple-700">{compCount}</p>
                    <p className="text-[11px] sm:text-xs text-purple-600 mt-1">معوّض</p>
                </div>
                <div className="text-center bg-red-50 rounded-lg p-2 sm:p-3 border border-red-100">
                    <p className="text-lg sm:text-2xl font-bold text-red-600">{snapshot.absentCount}</p>
                    <p className="text-[11px] sm:text-xs text-red-500 mt-1">غائب</p>
                </div>
                <div className="col-span-2 sm:col-span-1 text-center bg-blue-50 rounded-lg p-2 sm:p-3 border border-blue-100">
                    <p className="text-lg sm:text-2xl font-bold text-blue-700">{rate}%</p>
                    <p className="text-[11px] sm:text-xs text-blue-600 mt-1">نسبة الحضور</p>
                </div>
            </div>

            {/* Compensated Students */}
            {compCount > 0 && compList.length > 0 && (
                <div className="mb-3">
                    <p className="text-xs font-semibold text-purple-700 mb-2">المعوضون مسبقاً ({compCount}):</p>
                    <div className="flex flex-wrap gap-2">
                        {compList.map((s) => (
                            <div
                                key={s.studentId}
                                className="inline-flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1 text-xs"
                            >
                                <Link
                                    href={`/students/${s.studentId}`}
                                    className="font-medium text-purple-800 hover:text-purple-950 hover:underline cursor-pointer"
                                    title="عرض ملف الطالب"
                                >
                                    {s.studentName}
                                </Link>
                                {s.relatedSessionId ? (
                                    <Link
                                        href={`/sessions/${s.relatedSessionId}`}
                                        className="text-[11px] font-medium text-purple-600 hover:text-purple-900 bg-purple-100/70 hover:bg-purple-200/70 px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-0.5"
                                        title="الانتقال للحصة التي حضر فيها كزائر"
                                    >
                                        <span>(حضر كزائر في {s.relatedGroupName || 'مجموعة أخرى'} ↗)</span>
                                    </Link>
                                ) : s.relatedGroupName ? (
                                    <span className="text-[11px] text-purple-500">
                                        (حضر كزائر في {s.relatedGroupName})
                                    </span>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Absent Students */}
            {absentList.length > 0 && (
                <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">الغائبون ({absentList.length}):</p>
                    <div className="flex flex-wrap gap-1.5">
                        {absentList.map((s) => (
                            <Link
                                key={s.studentId}
                                href={`/students/${s.studentId}`}
                                className="text-xs bg-red-50 hover:bg-red-100 hover:text-red-900 text-red-600 px-2.5 py-1 rounded-full border border-red-200 transition-all hover:shadow-sm inline-flex items-center gap-1 cursor-pointer"
                                title="عرض ملف الطالب"
                            >
                                {s.studentName}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Guest Students */}
            {guestList.length > 0 && (
                <div className="mb-3">
                    <p className="text-xs font-semibold text-indigo-700 mb-2">الطلاب الزوار ({guestList.length}):</p>
                    <div className="flex flex-wrap gap-2">
                        {guestList.map((s) => (
                            <div
                                key={s.studentId}
                                className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1 text-xs"
                            >
                                <Link
                                    href={`/students/${s.studentId}`}
                                    className="font-medium text-indigo-800 hover:text-indigo-950 hover:underline cursor-pointer"
                                    title="عرض ملف الطالب"
                                >
                                    {s.studentName}
                                </Link>
                                {s.relatedSessionId ? (
                                    <Link
                                        href={`/sessions/${s.relatedSessionId}`}
                                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-900 bg-indigo-100/70 hover:bg-indigo-200/70 px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-0.5"
                                        title="الانتقال لحصة الغياب الأصلية"
                                    >
                                        <span>(تعويض عن غياب في {s.relatedGroupName || 'مجموعته الأصلية'} ↗)</span>
                                    </Link>
                                ) : s.relatedGroupName ? (
                                    <span className="text-[11px] text-indigo-500">
                                        (تعويض عن غياب في {s.relatedGroupName})
                                    </span>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Present Students Toggle */}
            {presentList.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => setShowPresent(!showPresent)}
                        className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
                    >
                        <UserCheck className="h-3.5 w-3.5 text-green-600" />
                        <span>عرض قائمة الحاضرين ({presentList.length})</span>
                        {showPresent ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {showPresent && (
                        <div className="flex flex-wrap gap-1.5 mt-2 max-h-48 overflow-y-auto pt-1">
                            {presentList.map((s) => (
                                <Link
                                    key={s.studentId}
                                    href={`/students/${s.studentId}`}
                                    className="text-xs bg-green-50 hover:bg-green-100 hover:text-green-900 text-green-700 font-medium px-2.5 py-1 rounded-full border border-green-200 transition-all hover:shadow-sm inline-flex items-center gap-1 cursor-pointer"
                                    title="عرض ملف الطالب"
                                >
                                    {s.studentName}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
