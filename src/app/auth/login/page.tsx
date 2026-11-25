'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandaloneAuth } from '@/components/auth/StandaloneAuth';
import { PageShell } from '@/components/layout/PageShell';

function Login() {
  const params = useSearchParams();
  return <StandaloneAuth view={params.get('role') === 'child' ? 'child-login' : 'parent-login'} />;
}

export default function LoginPage() {
  return (
    <PageShell className="md:w-auto">
      <Suspense fallback={<p className="p-8 text-center text-content-secondary" role="status">Loading login…</p>}>
        <Login />
      </Suspense>
    </PageShell>
  );
}
