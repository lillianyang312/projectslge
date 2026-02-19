'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-lg">
      <div className="w-full max-w-md">
        <div className="mb-3xl text-center">
          <h1 className="font-heading text-h1 text-text-primary">Sellryte</h1>
          <p className="mt-xs text-md text-text-secondary">
            Harvard Student Marketplace
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
