'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8 text-center"
          dir="rtl"
        >
          <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-800">حدث خطأ غير متوقع</h2>
            <p className="text-gray-500 text-sm max-w-md">
              نعتذر عن هذا الخطأ. يمكنك إعادة تحميل الصفحة أو التواصل مع الدعم الفني إذا استمرت المشكلة.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="mt-4 p-3 bg-gray-100 rounded text-xs text-right text-red-600 max-w-lg overflow-auto">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <Button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            إعادة التحميل
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
