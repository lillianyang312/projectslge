'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import Modal from '@/components/ui/Modal';
import { Button, Spinner } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

function LoginForm(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/browse';

  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  /* ── Forgot Password state ─────────────────────────────────────── */
  const [showForgot, setShowForgot] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotNewPassword, setForgotNewPassword] = useState<string>('');
  const [forgotConfirm, setForgotConfirm] = useState<string>('');
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);
  const [forgotError, setForgotError] = useState<string>('');
  const [forgotSuccess, setForgotSuccess] = useState<boolean>(false);

  const closeForgotModal = (): void => {
    setShowForgot(false);
    setForgotEmail('');
    setForgotNewPassword('');
    setForgotConfirm('');
    setForgotError('');
    setForgotSuccess(false);
  };

  const handleForgotPassword = async (): Promise<void> => {
    setForgotError('');
    if (!forgotEmail.trim()) { setForgotError('Please enter your email.'); return; }
    if (!forgotNewPassword.trim()) { setForgotError('Please enter a new password.'); return; }
    if (forgotNewPassword.length < 6) { setForgotError('Password must be at least 6 characters.'); return; }
    if (forgotNewPassword !== forgotConfirm) { setForgotError('Passwords do not match.'); return; }

    setForgotLoading(true);
    try {
      const supabase = createClient();
      const { error: fnError } = await supabase.functions.invoke('resetUserPassword', {
        body: { email: forgotEmail.trim().toLowerCase(), newPassword: forgotNewPassword },
      });

      if (fnError) {
        setForgotError(fnError.message || 'Failed to reset password.');
      } else {
        setForgotSuccess(true);
        setForgotNewPassword('');
        setForgotConfirm('');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setForgotError(message);
    } finally {
      setForgotLoading(false);
    }
  };

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

      <div className="text-center">
        <button
          type="button"
          onClick={() => { setShowForgot(true); setForgotEmail(email); }}
          className="text-sm text-text-secondary hover:text-accent underline"
        >
          Forgot password?
        </button>
      </div>

      <p className="text-center text-sm text-text-secondary">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-accent underline">
          Sign up
        </Link>
      </p>

      {/* Forgot Password Modal */}
      <Modal open={showForgot} onClose={closeForgotModal} title="Reset Password">
        {forgotSuccess ? (
          <div className="space-y-lg">
            <div className="rounded-md border border-success bg-success-soft/50 px-lg py-md text-sm text-success">
              Password updated successfully. You can now sign in.
            </div>
            <Button onClick={closeForgotModal} className="w-full">Back to Sign In</Button>
          </div>
        ) : (
          <div className="space-y-lg">
            {forgotError && (
              <div className="rounded-md bg-danger-soft px-lg py-md text-sm text-danger">{forgotError}</div>
            )}
            <div>
              <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Email</label>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@college.harvard.edu"
                className="w-full rounded-md border border-border bg-card px-md py-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">New Password</label>
              <input
                type="password"
                value={forgotNewPassword}
                onChange={(e) => setForgotNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full rounded-md border border-border bg-card px-md py-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Confirm Password</label>
              <input
                type="password"
                value={forgotConfirm}
                onChange={(e) => setForgotConfirm(e.target.value)}
                placeholder="Confirm new password"
                className="w-full rounded-md border border-border bg-card px-md py-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <Button onClick={handleForgotPassword} disabled={forgotLoading} className="w-full">
              {forgotLoading ? <Spinner size="sm" /> : 'Reset Password'}
            </Button>
          </div>
        )}
      </Modal>
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
