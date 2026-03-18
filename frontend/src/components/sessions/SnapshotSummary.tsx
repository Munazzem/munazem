'use client';

import { CalendarCheck } from 'lucide-react';
import type { IAttendanceSnapshot } from '@/types/session.types';

interface SnapshotSummaryProps {
    snapshot: IAttendanceSnapshot;
}

export function SnapshotSummary({ snapshot }: SnapshotSummaryProps) {
    const rate = snapshot.totalCount > 0
        ? Math.round((snapshot.presentCount / snapshot.totalCount) * 100)
        : 0;

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                <CalendarCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                ملخص الحصة
            </h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                <div className="text-center bg-green-50 rounded-lg p-2 sm:p-3">
                    <p className="text-xl sm:text-2xl font-bold text-green-700">{snapshot.presentCount}</p>
                    <p className="text-[11px] sm:text-xs text-green-600 mt-1">حاضر</p>
                </div>
                <div className="text-center bg-red-50 rounded-lg p-2 sm:p-3">
                    <p className="text-xl sm:text-2xl font-bold text-red-600">{snapshot.absentCount}</p>
                    <p className="text-[11px] sm:text-xs text-red-500 mt-1">غائب</p>
                </div>
                <div className="text-center bg-blue-50 rounded-lg p-2 sm:p-3">
                    <p className="text-xl sm:text-2xl font-bold text-blue-700">{rate}%</p>
                    <p className="text-[11px] sm:text-xs text-blue-600 mt-1">نسبة الحضور</p>
                </div>
            </div>

            {snapshot.absentStudents.length > 0 && (
                <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">الغائبون:</p>
                    <div className="flex flex-wrap gap-1.5">
                        {snapshot.absentStudents.map((s) => (
                            <span
                                key={s.studentId}
                                className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100"
                            >
                                {s.studentName}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
