'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
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
    isLoading?: boolean;
    disabled?: boolean;
    onConfirm: () => void;
}

/**
 * A reusable confirmation dialog that replaces window.confirm() calls.
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'تأكيد',
    cancelLabel = 'إلغاء',
    variant = 'default',
    isLoading = false,
    disabled = false,
    onConfirm,
}: ConfirmDialogProps) {
    const isActionDisabled = disabled || isLoading;

    return (
        <AlertDialog open={open} onOpenChange={(v) => { if (!isLoading) onOpenChange(v); }}>
            <AlertDialogContent dir="rtl" className="max-w-sm">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-right">{title}</AlertDialogTitle>
                    {description && (
                        <AlertDialogDescription className="text-right text-gray-500 whitespace-pre-line">
                            {description}
                        </AlertDialogDescription>
                    )}
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse sm:flex-row-reverse gap-2">
                    <AlertDialogAction
                        onClick={(e) => {
                            if (isActionDisabled) {
                                e.preventDefault();
                                return;
                            }
                            onConfirm();
                        }}
                        disabled={isActionDisabled}
                        className={
                            variant === 'danger'
                                ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50'
                                : 'bg-primary hover:bg-primary/90 text-white disabled:opacity-50'
                        }
                    >
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin ml-2 inline-block" />}
                        {confirmLabel}
                    </AlertDialogAction>
                    <AlertDialogCancel disabled={isLoading} className="mt-0">{cancelLabel}</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
