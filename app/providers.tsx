'use client';
import { SessionProvider } from 'next-auth/react';
import '@/lib/i18n';
import LanguageInitializer from '@/components/i18n/LanguageInitializer';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageInitializer />
      {children}
    </SessionProvider>
  );
}
