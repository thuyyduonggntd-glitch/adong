import { Suspense } from 'react';
import LoginContent from './LoginContent';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center" />}>
      <LoginContent />
    </Suspense>
  );
}
