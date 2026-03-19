'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchGroups } from '@/lib/api/groups';
import { fetchStudents } from '@/lib/api/students';
import { useAuthStore } from '@/lib/store/auth.store';
import { UserRole } from '@/types/user.types';

/**
 * Background Cache Warmer
 * This component handles "warming up" the React Query cache by pre-fetching 
 * essential data when the user enters the application.
 */
export function CacheWarmer() {
    const queryClient = useQueryClient();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const user = useAuthStore((state) => state.user);

    useEffect(() => {
        if (!isAuthenticated || !user || user.role === UserRole.superAdmin) return;

        console.log('🔥 Warming up offline cache...');

        // 1. Pre-fetch all groups (for the groups list and sidebar)
        queryClient.prefetchQuery({
            queryKey: ['groups', { limit: 100 }],
            queryFn: () => fetchGroups({ limit: 100 }),
            staleTime: 10 * 60 * 1000, // 10 minutes
        });

        // 2. Pre-fetch the first page of students
        // This ensures the "Students" page is ready even if not visited yet
        queryClient.prefetchQuery({
            queryKey: ['students', { limit: 20, page: 1 }],
            queryFn: () => fetchStudents({ page: 1, limit: 20 }),
            staleTime: 5 * 60 * 1000, // 5 minutes
        });

    }, [isAuthenticated, queryClient, user]);

    return null;
}
