'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Navbar from '@/components/layout/Navbar';

export default function AppLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      {children}
    </div>
  );
}
