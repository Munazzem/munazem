'use client';

import { Check, X, Loader2, BookCheck, BookX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HomeworkToggleButtonProps {
    recordId: string;
    homeworkDone: boolean | null | undefined;
    disabled?: boolean;
    isPending?: boolean;
    onToggle: (newStatus: boolean) => void;
}

export function HomeworkToggleButton({
    recordId,
    homeworkDone,
    disabled = false,
    isPending = false,
    onToggle,
}: HomeworkToggleButtonProps) {
    // Default is true for present students if not explicitly set to false
    const isDone = homeworkDone ?? true;

    return (
        <button
            type="button"
            disabled={disabled || isPending}
            onClick={(e) => {
                e.stopPropagation();
                onToggle(!isDone);
            }}
            title={isDone ? 'تم تسليم الواجب (انقر لتغيير الحالة إلى لم يتم)' : 'لم يتم تسليم الواجب (انقر لتغيير الحالة إلى تم)'}
            aria-label={isDone ? 'تم تسليم الواجب' : 'لم يتم تسليم الواجب'}
            className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 sm:py-0.5 rounded-full text-xs font-bold transition-all select-none',
                'shrink-0 min-w-0 border shadow-2xs cursor-pointer',
                'min-h-[36px] sm:min-h-0 sm:h-7', // Mobile touch target safety >= 36px
                isDone
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 active:scale-95'
                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300 active:scale-95',
                (disabled || isPending) && 'opacity-60 cursor-not-allowed pointer-events-none'
            )}
        >
            {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-current" />
            ) : isDone ? (
                <BookCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
                <BookX className="h-3.5 w-3.5 shrink-0 text-rose-600" />
            )}

            <span className="truncate whitespace-nowrap text-[11px] sm:text-xs leading-none">
                {isDone ? 'الواجب ✓' : 'لم يتم ✗'}
            </span>
        </button>
    );
}
