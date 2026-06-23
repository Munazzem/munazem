'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Activity, AlertTriangle } from 'lucide-react';
import ErrorLogsPage from './ErrorLogs';
import ActivityFeedPage from './ActivityLogs';

export default function LogsPage() {
    return (
        <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto" dir="rtl">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">السجلات</h1>
                <p className="text-sm text-gray-500 mt-1">
                    مراقبة أحداث النظام وسجل الأخطاء التقنية
                </p>
            </div>

            <Tabs defaultValue="activity" className="space-y-6">
                <TabsList className="bg-white border border-gray-100 p-1 shadow-sm rounded-xl inline-flex w-full sm:w-auto">
                    <TabsTrigger value="activity" className="flex-1 sm:flex-none gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <Activity className="h-4 w-4" />
                        سجل النشاط
                    </TabsTrigger>
                    <TabsTrigger value="errors" className="flex-1 sm:flex-none gap-2 data-[state=active]:bg-red-500/10 data-[state=active]:text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        سجل الأخطاء
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="activity" className="mt-0 outline-none">
                    <div className="-mx-4 sm:-mx-6">
                        <ActivityFeedPage />
                    </div>
                </TabsContent>

                <TabsContent value="errors" className="mt-0 outline-none">
                    <div className="-mx-4 sm:-mx-6">
                        <ErrorLogsPage />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
