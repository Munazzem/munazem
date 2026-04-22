export default function PortalLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#f9f9fb]" dir="rtl">
            {/* Simple header — no sidebar */}
            <header className="bg-white border-b border-gray-100 shadow-sm">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-extrabold text-[#1e3a6e]">مُنظِّم</h1>
                        <p className="text-xs text-gray-400">بوابة ولي الأمر</p>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    );
}
