'use client';

import { useState } from 'react';
import { PasswordRequirements, isPasswordValid } from '@/components/password-requirements';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

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
    setLoading(true);

    try {
      await api<{ message: string; email: string }>('/api/auth/signup', {
        method: 'POST',
        body: { name, email, password },
      });
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      if (err instanceof ApiError && err.status === 503) {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18"/><path d="M15 3v18"/></svg>
            </div>
            <span className="text-2xl font-bold text-gray-900">Task Tracker</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
          <p className="text-gray-600">Start tracking your tasks today</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                />
                <PasswordRequirements password={password} />
              </div>

              <Button type="submit" disabled={loading || !isPasswordValid(password)} className="w-full">
                {loading ? 'Creating account...' : 'Create Account'}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>

              <p className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
