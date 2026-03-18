'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchStudents } from '@/lib/api/students';
import { cn } from '@/lib/utils';

interface StudentSearchResultsProps {
    sessionId: string;
    groupId: string;
    search: string;
    alreadyRecordedIds: Set<string>;
    onRecord: (studentId: string) => void;
    onClose: () => void;
}

export function StudentSearchResults({
    sessionId,
    groupId,
    search,
    alreadyRecordedIds,
    onRecord,
    onClose,
}: StudentSearchResultsProps) {
    const { data } = useQuery({
        queryKey: ['students-search', groupId, search],
        queryFn: () => fetchStudents({ groupId, search, limit: 10 }),
        enabled: search.length >= 1,
    });

    const students = data?.data ?? [];

    if (students.length === 0) return null;

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
                <span className="text-xs text-gray-500">نتائج البحث</span>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>
            <ul className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
                {students.map((student) => {
                    const already = alreadyRecordedIds.has(student._id);
                    return (
                        <li key={student._id}>
                            <button
                                className={cn(
                                    'w-full flex items-center justify-between px-3 py-2.5 text-sm text-right transition-colors',
                                    already
                                        ? 'bg-green-50 text-green-700 cursor-default'
                                        : 'hover:bg-primary/5 text-gray-700'
                                )}
                                onClick={() => !already && onRecord(student._id)}
                                disabled={already}
                            >
                                <span className="font-medium">{student.studentName}</span>
                                <span className="text-xs text-gray-400">{student.studentCode}</span>
                                {already && (
                                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full mr-2">
                                        مسجل
                                    </span>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
