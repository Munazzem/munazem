'use client';

import { useState, useEffect } from 'react';
import { useUIStore } from '@/lib/store/ui.store';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export function InstallPrompt() {
    const { deferredPrompt, setDeferredPrompt } = useUIStore();
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        // Don't show if already in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches) {
            return;
        }

        // Show the prompt if we have the event and it hasn't been dismissed in this session
        if (deferredPrompt && !isDismissed) {
            // Small delay to not annoy the user immediately
            const timer = setTimeout(() => setIsVisible(true), 2000);
            return () => clearTimeout(timer);
        }
    }, [deferredPrompt, isDismissed]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        setIsDismissed(true);
        // Maybe store in localStorage to not show again for a while
        localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
    };

    // Check if previously dismissed (optional: wait 7 days)
    useEffect(() => {
        const dismissedAt = localStorage.getItem('pwa-prompt-dismissed');
        if (dismissedAt) {
            const daysSinceDismissal = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissal < 7) {
                setIsDismissed(true);
            }
        }
    }, []);

    if (!isVisible || !deferredPrompt) return null;

    return (
        <div 
            className={cn(
                "fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 animate-in fade-in slide-in-from-bottom-5 duration-500",
                "bg-white/95 backdrop-blur-md border border-primary/20 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-4 rtl"
            )}
            dir="rtl"
        >
            <button 
                onClick={handleDismiss}
                className="absolute top-2 left-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
                <X size={16} />
            </button>

            <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 shadow-inner">
                    <Download size={24} />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-bold text-gray-900 leading-tight">تثبيت تطبيق "مُنظِّم"</h3>
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                        قم بتثبيت التطبيق على جهازك للوصول السريع واستخدام النظام بدون انترنت.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDismiss}
                    className="h-9 text-xs rounded-xl border-gray-200"
                >
                    ليس الآن
                </Button>
                <Button 
                    size="sm" 
                    onClick={handleInstall}
                    className="h-9 text-xs rounded-xl bg-primary hover:bg-primary/90 shadow-sm"
                >
                    تثبيت الآن
                </Button>
            </div>
            
            <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-gray-400 border-t border-gray-50 pt-2">
                <span className="flex items-center gap-1">
                    <Smartphone size={10} /> متاح للموبايل
                </span>
                <span className="flex items-center gap-1">
                    <Monitor size={10} /> متاح للكمبيوتر
                </span>
            </div>
        </div>
    );
}
