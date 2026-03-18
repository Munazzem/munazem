'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/lib/store/ui.store';

export function PWAEventListener() {
    const setDeferredPrompt = useUIStore((state) => state.setDeferredPrompt);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: any) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            console.log('👍 beforeinstallprompt event was fired.');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Optional: Listen for app installed event
        const handleAppInstalled = () => {
            setDeferredPrompt(null);
            console.log('👍 PWA was installed');
        };
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, [setDeferredPrompt]);

    return null;
}
