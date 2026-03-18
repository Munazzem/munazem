'use client';

import React from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
}

/**
 * A reusable confirmation dialog that replaces window.confirm() calls.
 * Usage:
 *   <ConfirmDialog
 *     open={isOpen}
 *     onOpenChange={setIsOpen}
 *     title="هل أنت متأكد؟"
 *     description="سيتم حذف الطالب بشكل نهائي."
 *     onConfirm={handleDelete}
 *   />
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'تأكيد',
    cancelLabel = 'إلغاء',
    variant = 'default',
    onConfirm,
}: ConfirmDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent dir="rtl" className="max-w-sm">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-right">{title}</AlertDialogTitle>
                    {description && (
                        <AlertDialogDescription className="text-right text-gray-500">
                            {description}
                        </AlertDialogDescription>
                    )}
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse sm:flex-row-reverse gap-2">
                    <AlertDialogAction
                        onClick={onConfirm}
                        className={
                            variant === 'danger'
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-primary hover:bg-primary/90 text-white'
                        }
                    >
                        {confirmLabel}
                    </AlertDialogAction>
                    <AlertDialogCancel className="mt-0">{cancelLabel}</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
