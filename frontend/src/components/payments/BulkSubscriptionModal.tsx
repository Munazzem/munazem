'use client';

import { BatchSubscriptionModal } from './BatchSubscriptionModal';

interface Props {
    open: boolean;
    onOpenChange: (v: boolean) => void;
}

export function BulkSubscriptionModal({ open, onOpenChange }: Props) {
    return <BatchSubscriptionModal open={open} onOpenChange={onOpenChange} />;
}
