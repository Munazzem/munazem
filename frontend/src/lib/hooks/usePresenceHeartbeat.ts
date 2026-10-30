'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { sendPresenceHeartbeat } from '@/lib/api/admin';

export function usePresenceHeartbeat() {
    const token = useAuthStore((s) => s.token);
    const user = useAuthStore((s) => s.user);
    const pathname = usePathname();
    const lastPingRef = useRef<number>(0);

    useEffect(() => {
        if (!token || !user) return;

        const sendPing = async () => {
            const now = Date.now();
            // Minimum 25 seconds between client-side pings
            if (now - lastPingRef.current < 25_000) return;
            lastPingRef.current = now;

            try {
                await sendPresenceHeartbeat({ currentRoute: pathname });
            } catch {
                // Heartbeat fails silently
            }
        };

        // Ping on initial mount or route change
        sendPing();

        // Heartbeat interval every 50 seconds
        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
                sendPing();
            }
        }, 50_000);

        // Ping when returning to the tab
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                sendPing();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [token, user, pathname]);
}
