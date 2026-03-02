import { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen bg-[#f9f9fb]">
            <Sidebar />

            {/* Main Content Area (offset by sidebar width on large screens) */}
            <main className="flex-1 flex flex-col transition-all duration-300 sm:pr-64">
                <Header />

                <div className="p-4 sm:p-8 flex-1 overflow-auto">
                    <ErrorBoundary>
                        {children}
                    </ErrorBoundary>
                </div>
            </main>
        </div>
    );
}
