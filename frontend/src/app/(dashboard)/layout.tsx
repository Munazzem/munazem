import { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DashboardWrapper } from '@/components/layout/DashboardWrapper';

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <DashboardWrapper>
            <ErrorBoundary>
                {children}
            </ErrorBoundary>
        </DashboardWrapper>
    );
}
