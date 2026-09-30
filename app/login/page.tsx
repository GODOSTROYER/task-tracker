'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setToken, type AuthResponse } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell, AuthFeedback, SubmitButton, authFieldClassName, authLinkClassName } from '@/components/auth-shell';
import { PasswordField } from '@/components/password-field';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } });
      setToken(data.token, data.user);
      router.push('/workspaces');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      if (message.includes('verify your email')) {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      footer={<>New to ProductSpace? <Link href="/signup" className={authLinkClassName}>Create an account</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
        <AuthFeedback message={error} />
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
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className={`text-[13px] ${authLinkClassName}`}>Forgot password?</Link>
          </div>
          <PasswordField
            id="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <SubmitButton type="submit" pending={loading} pendingLabel="Signing in..." className="w-full">Sign in</SubmitButton>
      </form>
    </AuthShell>
  );
}
