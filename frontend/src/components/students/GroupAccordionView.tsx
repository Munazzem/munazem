'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchGroups } from '@/lib/api/groups';
import type { Group } from '@/types/group.types';
import { Users, ChevronRight } from 'lucide-react';
import { CardSkeleton } from '@/components/layout/skeletons/CardSkeleton';
import { Badge } from '@/components/ui/badge';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

interface GroupAccordionViewProps {
    onSelectGroup: (group: Group) => void;
    canWrite: boolean;
}

export function GroupAccordionView({
    onSelectGroup,
    canWrite,
}: GroupAccordionViewProps) {
    const { data, isLoading } = useQuery({
        queryKey: ['groups', { limit: 100 }],
        queryFn: () => fetchGroups({ limit: 100 }),
    });

    const groups = data?.data ?? [];

    if (isLoading) {
        return <CardSkeleton count={6} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" />;
    }

    if (groups.length === 0) {
        return (
            <div className="py-16 text-center text-gray-400 bg-white rounded-xl border border-gray-100 shadow-sm">
                لا توجد مجموعات بعد.
            </div>
        );
    }

    // Group by Grade Level
    const groupsByGrade = groups.reduce((acc, group) => {
        const grade = group.gradeLevel || 'غير محدد';
        if (!acc[grade]) acc[grade] = [];
        acc[grade].push(group);
        return acc;
    }, {} as Record<string, Group[]>);

    const gradeKeys = Object.keys(groupsByGrade);

    return (
        <Accordion type="multiple" className="space-y-4">
            {gradeKeys.map((grade) => (
                <AccordionItem value={grade} key={grade} className="bg-white border border-gray-100 rounded-xl shadow-sm px-4">
                    <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-primary">{grade}</h2>
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                                {groupsByGrade[grade].length} مجموعات
                            </Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 pb-4">
                            {groupsByGrade[grade].map((group) => (
                                <button
                                    key={group._id}
                                    onClick={() => onSelectGroup(group)}
                                    className="bg-white border border-gray-50 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all text-right flex flex-col gap-3 group"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-xs text-gray-400 font-medium mb-1">{group.gradeLevel}</p>
                                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary transition-colors">
                                                {group.name}
                                            </h3>
                                        </div>
                                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <Users className="h-5 w-5 text-primary" />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                                        <span className="text-sm text-gray-500">
                                            {group.studentsCount ?? 0} / {group.capacity} طالب
                                        </span>
                                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}
