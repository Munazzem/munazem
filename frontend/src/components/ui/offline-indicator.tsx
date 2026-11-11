'use client';

import { useEffect, useState } from 'react';
import { WifiOff, CloudUpload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOfflineSyncStore } from '@/lib/store/offline-sync.store';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [show, setShow] = useState(false);
  const pendingCount = useOfflineSyncStore((s) => s.pendingCount);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setTimeout(() => setShow(false), 4000);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setShow(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOffline(true);
        setShow(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!show && pendingCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border transition-all duration-500 animate-in slide-in-from-bottom-5",
        isOffline 
          ? "bg-slate-900/95 border-amber-500/40 text-white backdrop-blur-md" 
          : "bg-emerald-600 border-emerald-500 text-white"
      )}
      dir="rtl"
    >
      {isOffline ? (
        <>
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <WifiOff className="h-5 w-5 animate-pulse" />
            </div>
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold">وضع العمل بدون إنترنت (أوفلاين)</span>
                    {pendingCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-500/30 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/40">
                            {pendingCount} معلق
                        </span>
                    )}
                </div>
                <span className="text-[10px] text-gray-300">
                    البيانات محفوظة محلياً. <a href="/~offline" className="underline font-bold text-amber-300 hover:text-white transition-colors">عرض لوحة الأوفلاين</a>
                </span>
            </div>
        </>
      ) : (
        <>
            <div className="p-2 rounded-xl bg-white/20 text-white">
                <CloudUpload className="h-5 w-5 animate-bounce" />
            </div>
            <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-bold">عادت الخدمة!</span>
                <span className="text-[10px] opacity-90">جاري فحص ومزامنة البيانات المحفوظة محلياً...</span>
            </div>
        </>
      )}
    </div>
  );
}
