'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to detect whether the current environment is local development (localhost / dev environment)
 * or has developer override enabled.
 * Used to restrict sensitive developer-only controls (like card artwork design studio)
 * so they are only visible locally and hidden on production deployments.
 */
export function useIsLocalDev(): boolean {
    const [isLocal, setIsLocal] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const host = window.location.hostname;
        const isLocalHost =
            host === 'localhost' ||
            host === '127.0.0.1' ||
            host.endsWith('.local') ||
            host.startsWith('192.168.') ||
            host.startsWith('10.') ||
            host === '0.0.0.0';

        const isDevEnv = process.env.NODE_ENV === 'development';

        const hasDevOverride =
            window.location.search.includes('design=1') ||
            window.localStorage.getItem('dev_design_mode') === 'true' ||
            window.localStorage.getItem('allow_card_design') === 'true';

        if (isLocalHost || isDevEnv || hasDevOverride) {
            setIsLocal(true);
        }
    }, []);

    return isLocal;
}
