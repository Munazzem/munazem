import * as Linking from 'expo-linking';

export interface ParsedDeepLink {
  target: 'attendance' | 'exams' | 'financial' | 'home' | 'notifications';
  studentId?: string;
  sessionId?: string;
  examId?: string;
  transactionId?: string;
  rawUrl: string;
}

let pendingDeepLink: ParsedDeepLink | null = null;

export const DeepLinkService = {
  /**
   * Parses custom URI scheme e.g. "monazem://child/123/exams?examId=456"
   */
  parse(url: string): ParsedDeepLink | null {
    if (!url) return null;
    const parsed = Linking.parse(url);
    const path = parsed.path || '';
    const queryParams = parsed.queryParams || {};

    // Example path: "child/123/attendance"
    const segments = path.split('/').filter(Boolean);

    if (segments[0] === 'child' && segments[1]) {
      const studentId = segments[1];
      const moduleName = segments[2] || 'home';

      if (moduleName === 'attendance') {
        return {
          target: 'attendance',
          studentId,
          sessionId: (queryParams.sessionId as string) || undefined,
          rawUrl: url,
        };
      }
      if (moduleName === 'exams') {
        return {
          target: 'exams',
          studentId,
          examId: (queryParams.examId as string) || undefined,
          rawUrl: url,
        };
      }
      if (moduleName === 'financial') {
        return {
          target: 'financial',
          studentId,
          transactionId: (queryParams.txId as string) || (queryParams.transactionId as string) || undefined,
          rawUrl: url,
        };
      }
    }

    if (segments[0] === 'notifications') {
      return { target: 'notifications', rawUrl: url };
    }

    return { target: 'home', rawUrl: url };
  },

  setPendingLink(link: ParsedDeepLink | null) {
    pendingDeepLink = link;
  },

  getAndClearPendingLink(): ParsedDeepLink | null {
    const link = pendingDeepLink;
    pendingDeepLink = null;
    return link;
  },
};
