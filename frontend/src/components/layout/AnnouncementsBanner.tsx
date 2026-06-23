'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchActiveAnnouncements } from '@/lib/api/admin';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { useState } from 'react';

export function AnnouncementsBanner() {
    const { data: announcements } = useQuery({
        queryKey: ['active-announcements'],
        queryFn: fetchActiveAnnouncements,
        refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    });

    const [dismissed, setDismissed] = useState<string[]>([]);

    if (!announcements || announcements.length === 0) return null;

    // Filter out dismissed announcements
    const visibleAnnouncements = announcements.filter(a => !dismissed.includes(a._id));

    if (visibleAnnouncements.length === 0) return null;

    const handleDismiss = (id: string) => {
        setDismissed([...dismissed, id]);
    };

    const getTypeStyles = (type: string) => {
        if (type === 'warning') return 'bg-orange-50 border-orange-200 text-orange-800';
        if (type === 'success') return 'bg-green-50 border-green-200 text-green-800';
        return 'bg-blue-50 border-blue-200 text-blue-800';
    };

    const getTypeIcon = (type: string) => {
        if (type === 'warning') return <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />;
        if (type === 'success') return <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />;
        return <Info className="h-5 w-5 text-blue-500 shrink-0" />;
    };

    return (
        <div className="w-full flex flex-col gap-2 px-4 py-2 bg-[#f9f9fb] sm:pr-64 z-40 relative" dir="rtl">
            {visibleAnnouncements.map(ann => (
                <div 
                    key={ann._id} 
                    className={`flex items-start justify-between gap-4 p-3 rounded-xl border shadow-sm ${getTypeStyles(ann.type)}`}
                >
                    <div className="flex items-start gap-3">
                        {getTypeIcon(ann.type)}
                        <div>
                            <h4 className="font-bold text-sm">{ann.title}</h4>
                            <p className="text-xs mt-0.5 whitespace-pre-wrap opacity-90">{ann.content}</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => handleDismiss(ann._id)}
                        className="p-1 rounded-md hover:bg-black/5 transition-colors shrink-0"
                    >
                        <X className="h-4 w-4 opacity-70" />
                    </button>
                </div>
            ))}
        </div>
    );
}
