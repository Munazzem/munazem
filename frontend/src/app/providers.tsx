'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { useState, useEffect } from 'react';

/**
 * Global Providers Wrapper
 * Houses the React Query Client and any other context providers needed at the root.
 */
export function Providers({ children }: { children: React.ReactNode }) {
    // We instantiate the client inside the component so that each user gets their own client if doing SSR in the future.
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        gcTime: 1000 * 60 * 60 * 24, // 24 hours
                        staleTime: 60 * 1000, // 1 minute stale time by default
                        refetchOnWindowFocus: false,
                        retry: 1,
                    },
                },
            })
    );

    const [persister, setPersister] = useState<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storagePersister = createSyncStoragePersister({
                storage: window.localStorage,
            });
            setPersister(storagePersister);
        }
    }, []);

    // Fallback to standard QueryClientProvider during SSR or before persister is ready
    if (!persister) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    }

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister }}
        >
            {children}
        </PersistQueryClientProvider>
    );
}
