import { StandaloneAuth } from '@/components/auth/StandaloneAuth';
import { PageShell } from '@/components/layout/PageShell';

export default function SignupPage() {
  return (
    <PageShell className="md:w-auto">
      <StandaloneAuth view="parent-signup" />
    </PageShell>
  );
}
