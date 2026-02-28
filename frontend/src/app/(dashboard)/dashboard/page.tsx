export default function DashboardPage() {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">مرحباً بك في لوحة التحكم</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-gray-500 font-medium">عدد الطلاب</h3>
                    <p className="text-3xl font-bold mt-2">--</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-gray-500 font-medium">مجموعات العمل</h3>
                    <p className="text-3xl font-bold mt-2">--</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-gray-500 font-medium">إجمالي الدخل</h3>
                    <p className="text-3xl font-bold mt-2 text-primary">-- ج.م</p>
                </div>
            </div>
        </div>
    );
}
