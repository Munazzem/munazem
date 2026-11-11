'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useState } from 'react';
import { createIndexedDBPersister } from '@/lib/offline/idb-persister';

/**
 * Global Providers Wrapper
 * Houses the React Query Client and any other context providers needed at the root.
 * Configured with IndexedDB persistence for robust, quota-free offline operation.
 */
export function Providers({ children }: { children: React.ReactNode }) {
    // We instantiate the client inside the component so that each user gets their own client if doing SSR in the future.
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days cache persistence for offline access
                        staleTime: 1000 * 15,            // 15 seconds: enables stale-while-revalidate for live server counts
                        refetchOnWindowFocus: false,
                        retry: 1,
                        networkMode: 'offlineFirst',      // Read cache or pause gracefully when offline
                    },
                    mutations: {
                        networkMode: 'offlineFirst',
                    },
                },
            })
    );

    const [persister] = useState<any>(() => {
        if (typeof window !== 'undefined') {
            return createIndexedDBPersister();
        }
        return null;
    });

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
            persistOptions={{
                persister,
                maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days max age
                buster: 'v3-live',
                dehydrateOptions: {
                    shouldDehydrateQuery: (query) => {
                        // Persist successful queries that aren't transient errors
                        return query.state.status === 'success';
                    },
                },
            }}
        >
            {children}
        </PersistQueryClientProvider>
    );
}
