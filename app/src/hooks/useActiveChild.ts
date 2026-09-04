import { useQuery } from '@tanstack/react-query';
import { HomeApi } from '../api/home.api';
import { useChildStore } from '../store/child.store';
import { ChildCardSummary } from '../types/child.types';

export const useActiveChild = () => {
  const {
    selectedChildId,
    selectedChild: storeChild,
    selectedSubjectId,
    setSelectedSubjectId,
    setSelectedChild,
  } = useChildStore();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['family-overview'],
    queryFn: HomeApi.getFamilyOverview,
    staleTime: 1000 * 30,        // 30s — refresh frequently so stats stay accurate
    refetchOnMount: 'always',    // always re-fetch when screen mounts
  });

  // 1. Resolve child from family overview data or fallback to store
  const child: ChildCardSummary | null =
    data?.children?.find((c) => c.id === selectedChildId) ??
    data?.children?.[0] ??
    storeChild ??
    null;

  const subjects = child?.subjects ?? [];

  // 2. Resolve active subject based on selectedSubjectId or default to subjects[0]
  const activeSubject =
    subjects.find((s) => s.studentId === selectedSubjectId) ??
    subjects[0] ??
    null;

  // 3. activeStudentId MUST come strictly from the resolved activeSubject —
  //    never fall back to raw selectedSubjectId (which may be stale)
  const activeStudentId =
    activeSubject?.studentId ||
    child?.id ||
    '';

  return {
    child,
    allChildren: data?.children ?? [],
    subjects,
    activeSubject,
    activeStudentId,
    selectedSubjectId: activeSubject?.studentId ?? null,
    setSelectedSubjectId,
    setSelectedChild,
    isLoading,
    refetch,
    isRefetching,
  };
};
