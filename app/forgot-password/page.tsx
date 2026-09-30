'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell, AuthFeedback, SubmitButton, authFieldClassName, authLinkClassName } from '@/components/auth-shell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: { email } });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={success ? 'Check your inbox' : 'Reset your password'}
      description={success ? undefined : 'Enter the email address for your account.'}
      footer={<Link href="/login" className={authLinkClassName}>Back to sign in</Link>}
    >
      <AuthFeedback
        kind="success"
        message={success ? `If an account exists for ${email}, you'll receive a password reset link shortly.` : ''}
      />
      {!success && <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
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
        <SubmitButton type="submit" pending={loading} pendingLabel="Sending reset link..." className="w-full">Send reset link</SubmitButton>
      </form>}
    </AuthShell>
  );
}
