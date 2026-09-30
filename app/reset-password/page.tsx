'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordRequirements, isPasswordValid } from '@/components/password-requirements';
import { PasswordField } from '@/components/password-field';
import { AuthShell, AuthFeedback, SubmitButton, authLinkClassName } from '@/components/auth-shell';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const mismatch = !!confirmPassword && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }
    if (!isPasswordValid(password)) {
      setError('Your password must meet all requirements.');
      return;
    }
    setLoading(true);
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: { token, password } });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={success ? 'Password updated' : !token ? 'Invalid reset link' : 'Set a new password'}
      footer={<Link href="/login" className={authLinkClassName}>Back to sign in</Link>}
    >
      <AuthFeedback
        kind="success"
        message={success ? 'Your password has been updated. You can now sign in with your new password.' : ''}
      />
      {success ? <Button asChild className="mt-5 h-11 w-full rounded-[6px] shadow-none"><Link href="/login">Sign in</Link></Button> : !token ? <div className="space-y-5">
        <AuthFeedback message="Invalid reset link. Please request a new one." />
        <Button asChild className="h-11 w-full rounded-[6px] shadow-none"><Link href="/forgot-password">Request a reset link</Link></Button>
      </div> : <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
        <AuthFeedback message={error} />
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
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
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <PasswordField
            id="confirm-password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            aria-invalid={mismatch}
            aria-describedby="password-match"
          />
          <AuthFeedback message={mismatch ? 'Passwords do not match' : ''} id="password-match" />
        </div>
        <SubmitButton
          type="submit"
          pending={loading}
          pendingLabel="Resetting password..."
          disabled={!isPasswordValid(password)}
          className="w-full"
        >Reset password</SubmitButton>
        {error && <Link href="/forgot-password" className={`block text-center text-sm ${authLinkClassName}`}>Request a new reset link</Link>}
      </form>}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return <Suspense
    fallback={<AuthShell title="Reset your password"><p role="status" className="text-sm text-[#68717f]">Loading...</p></AuthShell>}
  ><ResetPasswordContent /></Suspense>;
}
