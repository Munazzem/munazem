import { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen bg-[#f9f9fb]">
            {/* Sidebar Placeholder */}
            <aside className="w-64 bg-white border-l border-gray-200 hidden md:block">
                <div className="p-6">
                    <h2 className="text-2xl font-bold text-primary">مُنظِّم</h2>
                </div>
                {/* Navigation links will go here */}
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col">
                {/* Header Placeholder */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 justify-between">
                    <div>لوحة التحكم</div>
                    {/* User Profile / Logout will go here */}
                </header>

                <div className="p-6 flex-1 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
