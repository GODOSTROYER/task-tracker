'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordRequirements, isPasswordValid } from '@/components/password-requirements';
import { PasswordField } from '@/components/password-field';
import { AuthShell, AuthFeedback, SubmitButton, authFieldClassName, authLinkClassName } from '@/components/auth-shell';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isPasswordValid(password)) {
      setError('Your password must meet all requirements.');
      return;
    }
    setLoading(true);
    try {
      await api<{ message: string; email: string }>('/api/auth/signup', { method: 'POST', body: { name, email, password } });
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      if (err instanceof ApiError && err.status === 503) router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create an account"
      footer={<>Already have an account? <Link href="/login" className={authLinkClassName}>Sign in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
        <AuthFeedback message={error} />
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className={authFieldClassName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className={authFieldClassName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordField
            id="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            aria-describedby="password-requirements"
          />
          <PasswordRequirements password={password} id="password-requirements" />
        </div>
        <SubmitButton
          type="submit"
          pending={loading}
          pendingLabel="Creating account..."
          disabled={!isPasswordValid(password)}
          className="w-full"
        >Create account</SubmitButton>
      </form>
    </AuthShell>
  );
}
