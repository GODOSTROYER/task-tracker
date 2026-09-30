'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useUser } from '@/lib/contexts/AuthContext';
import { updateProfile } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Save, User as UserIcon } from 'lucide-react';
import { PasswordField } from '@/components/password-field';
import { PasswordRequirements } from '@/components/password-requirements';
import { AuthFeedback, SubmitButton, authFieldClassName, authSurfaceClassName } from '@/components/auth-shell';

export default function SettingsPage() {
  const { user } = useUser();
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const reducedMotion = useReducedMotion();
  const mismatch = !!password && !!confirmPassword && password !== confirmPassword;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (password && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password && password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await updateProfile({
        name: name !== user?.name ? name : undefined,
        password: password || undefined,
        currentPassword: password ? currentPassword : undefined,
      });
      setSuccess(true);
      setPassword('');
      setCurrentPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.2 }}
      className={`mx-auto min-h-full w-full max-w-3xl bg-[#f5f6f8] px-5 py-8 sm:px-8 sm:py-10 ${authSurfaceClassName}`}
    >
      <header className="mb-7">
        <h1 className="text-[28px] font-semibold leading-tight tracking-normal">Account settings</h1>
      </header>
      <form onSubmit={handleSave} aria-busy={loading}>
        <section aria-labelledby="profile-heading" className="border-t border-[#e4e7eb] py-6">
          <h2 id="profile-heading" className="mb-5 flex items-center gap-2 text-base font-semibold"><UserIcon className="size-4 text-[#68717f]" aria-hidden="true" /> Profile</h2>
          <div className="max-w-[400px] space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={name}
                onChange={e => { setName(e.target.value); setSuccess(false); }}
                placeholder="Your name"
                autoComplete="name"
                className={authFieldClassName}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                autoComplete="email"
                className={`${authFieldClassName} disabled:bg-[#f5f6f8] disabled:opacity-100 disabled:text-[#68717f]`}
                aria-describedby="email-note"
              />
              <p id="email-note" className="text-xs text-[#68717f]">Email cannot be changed.</p>
            </div>
          </div>
        </section>
        <section aria-labelledby="security-heading" className="border-t border-[#e4e7eb] py-6">
          <h2 id="security-heading" className="mb-5 flex items-center gap-2 text-base font-semibold"><Lock className="size-4 text-[#68717f]" aria-hidden="true" /> Security</h2>
          <div className="max-w-[400px] space-y-5">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <PasswordField
                id="currentPassword"
                autoComplete="current-password"
                value={currentPassword}
                onChange={e => { setCurrentPassword(e.target.value); setSuccess(false); }}
                required={!!password}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <PasswordField
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setSuccess(false); }}
                placeholder="Leave blank to keep current"
                aria-describedby="password-requirements"
              />
              <PasswordRequirements password={password} id="password-requirements" />
            </div>
            {password && <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <PasswordField
                id="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setSuccess(false); }}
                required
                aria-invalid={mismatch}
                aria-describedby="password-match"
              />
              <AuthFeedback message={mismatch ? 'Passwords do not match' : ''} id="password-match" />
            </div>}
          </div>
        </section>
        <div className="space-y-4 border-t border-[#e4e7eb] pt-6">
          <div className="max-w-[400px] space-y-2">
            <AuthFeedback message={error} />
            <AuthFeedback message={success ? 'Changes saved successfully.' : ''} kind="success" />
          </div>
          <SubmitButton type="submit" pending={loading} pendingLabel="Saving changes..." icon={Save} className="min-w-[160px]">Save changes</SubmitButton>
        </div>
      </form>
    </motion.div>
  );
}
