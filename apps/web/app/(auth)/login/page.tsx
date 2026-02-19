'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

function LoginForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/browse';

  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required'); return; }
    if (!password) { setError('Password is required'); return; }

    setError('');
    setLoading(true);

    try {
      const { error: signInError } = await signIn(email.trim().toLowerCase(), password);

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push(redirect);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-lg">
      {error && (
        <div className="rounded-md bg-danger-soft px-lg py-md text-sm text-danger">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-sm block text-sm text-text-secondary">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@college.harvard.edu"
          autoComplete="email"
          autoFocus
          required
          className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-sm block text-sm text-text-secondary">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          autoComplete="current-password"
          required
          className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-accent px-2xl py-lg text-md font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>

      <p className="text-center text-sm text-text-secondary">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-accent underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage(): React.ReactElement {
  return (
    <Suspense fallback={<div className="text-center text-text-muted">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
