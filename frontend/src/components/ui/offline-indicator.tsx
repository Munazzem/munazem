'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setTimeout(() => setShow(false), 3000);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setShow(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial check
    if (!navigator.onLine) {
        setIsOffline(true);
        setShow(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-[9999] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl border transition-all duration-500 animate-in slide-in-from-bottom-5",
        isOffline 
          ? "bg-red-600 border-red-500 text-white" 
          : "bg-green-600 border-green-500 text-white"
      )}
      dir="rtl"
    >
      {isOffline ? (
        <>
            <WifiOff className="h-5 w-5 animate-pulse" />
            <div className="flex flex-col">
                <span className="text-sm font-bold">أنت غير متصل بالإنترنت</span>
                <span className="text-[10px] opacity-80">التغييرات ستحفظ محلياً حتى يعود الاتصال</span>
            </div>
        </>
      ) : (
        <>
            <div className="h-2 w-2 rounded-full bg-white animate-ping" />
            <span className="text-sm font-bold">عادت الخدمة! جاري المزامنة...</span>
        </>
      )}
    </div>
  );
}
