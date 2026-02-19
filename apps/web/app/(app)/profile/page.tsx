'use client';

import { useState } from 'react';
import Link from 'next/link';
import PageContainer from '@/components/layout/PageContainer';
import { Avatar, Badge, Button, Card } from '@/components/ui';
import Modal from '@/components/ui/Modal';
import { Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { createClient } from '@/lib/supabase/client';

export default function ProfilePage(): React.ReactElement {
  const { profile, signOut } = useAuthStore();

  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [resetLoading, setResetLoading] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string>('');
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);

  const handleResetPassword = async (): Promise<void> => {
    setResetError('');
    if (!newPassword.trim()) { setResetError('Please enter a new password.'); return; }
    if (newPassword.length < 6) { setResetError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setResetError('Passwords do not match.'); return; }
    if (!profile?.harvard_email) { setResetError('No email found on profile.'); return; }

    setResetLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.functions.invoke('resetUserPassword', {
        body: { email: profile.harvard_email, newPassword },
      });

      if (error) {
        setResetError(error.message || 'Failed to reset password.');
      } else {
        setResetSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setResetError(message);
    } finally {
      setResetLoading(false);
    }
  };

  const closeResetModal = (): void => {
    setShowResetModal(false);
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
    setResetSuccess(false);
  };

  if (!profile) {
    return (
      <PageContainer className="flex justify-center py-huge">
        <p className="text-text-muted">Loading profile...</p>
      </PageContainer>
    );
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const paymentMethods = profile.payment_preference?.split(',').filter(Boolean) || [];

  return (
    <PageContainer className="max-w-2xl">
      <div className="mb-2xl flex items-center justify-between">
        <h1 className="font-heading text-h1 text-text-primary">Profile</h1>
        <Link href="/profile/edit">
          <Button variant="secondary" size="sm">Edit</Button>
        </Link>
      </div>

      <Card className="mb-xl">
        <div className="flex items-center gap-xl">
          <Avatar name={profile.full_name} size="lg" />
          <div>
            <h2 className="font-heading text-h2 text-text-primary">{profile.full_name}</h2>
            <p className="text-sm text-text-secondary">{profile.harvard_email}</p>
            <p className="mt-xs text-sm text-text-muted">Member since {memberSince}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-lg sm:grid-cols-2">
        <Card>
          <h3 className="text-sm font-medium text-text-secondary">Harvard Info</h3>
          <div className="mt-md space-y-sm">
            {profile.graduation_year && (
              <div className="flex justify-between">
                <span className="text-sm text-text-muted">Class of</span>
                <span className="text-sm font-medium text-text-primary">{profile.graduation_year}</span>
              </div>
            )}
            {profile.house && (
              <div className="flex justify-between">
                <span className="text-sm text-text-muted">House</span>
                <span className="text-sm font-medium text-text-primary">{profile.house}</span>
              </div>
            )}
            {(profile.dorm_building || profile.dorm_room) && (
              <div className="flex justify-between">
                <span className="text-sm text-text-muted">Dorm</span>
                <span className="text-sm font-medium text-text-primary">
                  {[profile.dorm_building, profile.dorm_room].filter(Boolean).join(' ')}
                </span>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-text-secondary">Stats</h3>
          <div className="mt-md space-y-sm">
            <div className="flex justify-between">
              <span className="text-sm text-text-muted">Rating</span>
              <span className="text-sm font-medium text-text-primary">
                {profile.rating ? `${profile.rating.toFixed(1)} / 5` : 'No ratings yet'}
                {profile.rating_count > 0 && ` (${profile.rating_count})`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-text-muted">Sales</span>
              <span className="text-sm font-medium text-text-primary">{profile.sales_completed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-text-muted">Purchases</span>
              <span className="text-sm font-medium text-text-primary">{profile.purchases_completed}</span>
            </div>
          </div>
        </Card>
      </div>

      {paymentMethods.length > 0 && (
        <Card className="mt-lg">
          <h3 className="text-sm font-medium text-text-secondary">Payment</h3>
          <div className="mt-md flex flex-wrap gap-sm">
            {paymentMethods.map((m) => (
              <Badge key={m} variant="neutral">{m}</Badge>
            ))}
          </div>
          {profile.zelle_handle && (
            <p className="mt-sm text-sm text-text-muted">Zelle: {profile.zelle_handle}</p>
          )}
          {profile.venmo_handle && (
            <p className="mt-xs text-sm text-text-muted">Venmo: {profile.venmo_handle}</p>
          )}
        </Card>
      )}

      <div className="mt-3xl space-y-md">
        <Button variant="secondary" onClick={() => setShowResetModal(true)} className="w-full">
          Reset Password
        </Button>
        <Button variant="destructive" onClick={() => signOut()} className="w-full">
          Sign out
        </Button>
      </div>

      {/* Reset Password Modal */}
      <Modal open={showResetModal} onClose={closeResetModal} title="Reset Password">
        {resetSuccess ? (
          <div className="space-y-lg">
            <div className="rounded-md border border-success bg-success-soft/50 px-lg py-md text-sm text-success">
              Password updated successfully.
            </div>
            <Button onClick={closeResetModal} className="w-full">Done</Button>
          </div>
        ) : (
          <div className="space-y-lg">
            {resetError && (
              <div className="rounded-md bg-danger-soft px-lg py-md text-sm text-danger">{resetError}</div>
            )}
            <div>
              <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full rounded-md border border-border bg-card px-md py-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-sm block text-xs font-medium uppercase tracking-wide text-text-muted">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full rounded-md border border-border bg-card px-md py-md text-md text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <Button onClick={handleResetPassword} disabled={resetLoading} className="w-full">
              {resetLoading ? <Spinner size="sm" /> : 'Update Password'}
            </Button>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
