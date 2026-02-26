'use client';

import React from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  // Add global providers here (e.g. TooltipProvider, ToastProvider)
  return (
    <>
      {children}
    </>
  );
}
