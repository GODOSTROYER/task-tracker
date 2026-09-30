'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, setToken, type AuthResponse } from '@/lib/api';
import { RefreshCw } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { AuthShell, AuthFeedback, SubmitButton, authLinkClassName } from '@/components/auth-shell';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    if (value.length > 1) {
      for (const [offset, digit] of [...value.slice(0, 6 - index)].entries()) {
        newOtp[index + offset] = digit;
      }
    } else {
      newOtp[index] = value;
    }
    setOtp(newOtp);
    if (value) inputRefs.current[Math.min(index + value.length, 5)]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i];
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await api<AuthResponse & { message: string }>('/api/auth/verify-email', { method: 'POST', body: { email, otp: code } });
      setToken(data.token, data.user);
      router.push('/workspaces');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setResendMessage('');
    try {
      const data = await api<{ message: string }>('/api/auth/resend-otp', { method: 'POST', body: { email } });
      setResendMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title="Verify your email"
      description={email ? <>Enter the 6-digit code sent to <span className="font-medium text-[#171b22]">{email}</span>.</> : undefined}
      footer={<Link href="/login" className={authLinkClassName}>Back to sign in</Link>}
    >
      {!email ? <div className="space-y-5">
        <AuthFeedback message="An email address is required to verify your account." />
        <Link href="/signup" className={`block text-sm ${authLinkClassName}`}>Back to create an account</Link>
      </div> : <form onSubmit={e => { e.preventDefault(); void handleVerify(); }} className="space-y-5" aria-busy={loading}>
        <AuthFeedback message={error} id="verification-error" />
        <AuthFeedback message={resendMessage} kind="success" />
        <fieldset className="min-w-0 space-y-2">
          <legend className="mb-2 text-[13px] font-medium">Verification code</legend>
          <div className="grid grid-cols-6 gap-2 sm:gap-3" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={el => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]"
                maxLength={index === 0 ? 6 : 1}
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                aria-label={`Code digit ${index + 1}`}
                aria-invalid={!!error}
                aria-describedby={error ? 'verification-error' : undefined}
                value={digit}
                onChange={e => handleChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                className="h-14 w-full min-w-0 rounded-[6px] border border-[#e4e7eb] bg-white text-center text-2xl font-semibold text-[#171b22] outline-none transition-colors focus:border-[#087f70] focus:ring-2 focus:ring-[#087f70]/20 aria-invalid:border-[#d56b59]"
              />
            ))}
          </div>
        </fieldset>
        <SubmitButton
          type="submit"
          pending={loading}
          pendingLabel="Verifying..."
          disabled={otp.join('').length !== 6}
          className="w-full"
        >Verify email</SubmitButton>
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px] text-[#68717f]">
          <span>Didn&apos;t receive a code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            aria-busy={resending}
            className={`inline-flex min-h-9 items-center gap-1.5 disabled:opacity-50 ${authLinkClassName}`}
          >
            <motion.span
              animate={resending && !reducedMotion ? { rotate: 360 } : { rotate: 0 }}
              transition={resending && !reducedMotion ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
              className="inline-flex"
            ><RefreshCw className="size-3.5" aria-hidden="true" /></motion.span>
            {resending ? 'Sending...' : 'Resend code'}
          </button>
        </div>
      </form>}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return <Suspense
    fallback={<AuthShell title="Verify your email"><p role="status" className="text-sm text-[#68717f]">Loading...</p></AuthShell>}
  ><VerifyEmailContent /></Suspense>;
}
