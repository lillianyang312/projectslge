'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import { Button } from '@/components/ui';
import { updateProfile } from '@/services/profileService';
import { useAuthStore } from '@/stores/authStore';

const HOUSE_OPTIONS: readonly string[] = [
  'Adams', 'Cabot', 'Currier', 'Dunster', 'Eliot', 'Kirkland',
  'Leverett', 'Lowell', 'Mather', 'Pforzheimer', 'Quincy',
  'Winthrop', 'Dudley', 'Off-campus',
];

export default function EditProfilePage(): React.ReactElement {
  const router = useRouter();
  const { profile, fetchProfile } = useAuthStore();

  const [fullName, setFullName] = useState<string>(profile?.full_name || '');
  const [phone, setPhone] = useState<string>(profile?.phone_number || '');
  const [house, setHouse] = useState<string>(profile?.house || '');
  const [dormBuilding, setDormBuilding] = useState<string>(profile?.dorm_building || '');
  const [dormRoom, setDormRoom] = useState<string>(profile?.dorm_room || '');
  const [payments, setPayments] = useState<string[]>(profile?.payment_preference?.split(',').filter(Boolean) || []);
  const [zelleHandle, setZelleHandle] = useState<string>(profile?.zelle_handle || '');
  const [venmoHandle, setVenmoHandle] = useState<string>(profile?.venmo_handle || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const togglePayment = (method: string): void => {
    setPayments((prev) => prev.includes(method) ? prev.filter((p) => p !== method) : [...prev, method]);
  };

  const handleSave = async (): Promise<void> => {
    if (!fullName.trim()) { setError('Name is required'); return; }
    setLoading(true);
    setError('');

    const nameParts = fullName.trim().split(' ');
    const { error: updateError } = await updateProfile({
      full_name: fullName.trim(),
      first_name: nameParts[0],
      last_name: nameParts.slice(1).join(' ') || null,
      phone_number: phone.trim() || null,
      house: house || null,
      dorm_building: dormBuilding.trim() || null,
      dorm_room: dormRoom.trim() || null,
      payment_preference: payments.length > 0 ? payments.join(',') : null,
      zelle_handle: zelleHandle.trim() || null,
      venmo_handle: venmoHandle.trim() || null,
    });

    if (updateError) {
      setError(updateError);
      setLoading(false);
      return;
    }

    await fetchProfile();
    router.push('/profile');
  };

  return (
    <PageContainer className="max-w-lg">
      <h1 className="mb-2xl font-heading text-h1 text-text-primary">Edit Profile</h1>

      {error && (
        <div className="mb-lg rounded-md bg-danger-soft px-lg py-md text-sm text-danger">{error}</div>
      )}

      <div className="space-y-lg">
        <div>
          <label className="mb-sm block text-sm text-text-secondary">Full name</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary focus:border-accent focus:outline-none" />
        </div>

        <div>
          <label className="mb-sm block text-sm text-text-secondary">Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary focus:border-accent focus:outline-none" />
        </div>

        <div>
          <label className="mb-sm block text-sm text-text-secondary">House</label>
          <select value={house} onChange={(e) => setHouse(e.target.value)}
            className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary focus:border-accent focus:outline-none">
            <option value="">Select house</option>
            {HOUSE_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-md">
          <div>
            <label className="mb-sm block text-sm text-text-secondary">Dorm building</label>
            <input type="text" value={dormBuilding} onChange={(e) => setDormBuilding(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="mb-sm block text-sm text-text-secondary">Dorm room</label>
            <input type="text" value={dormRoom} onChange={(e) => setDormRoom(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary focus:border-accent focus:outline-none" />
          </div>
        </div>

        <div>
          <label className="mb-sm block text-sm text-text-secondary">Payment preferences</label>
          <div className="flex gap-sm">
            {['Cash', 'Zelle', 'Venmo'].map((m) => (
              <button key={m} type="button" onClick={() => togglePayment(m)}
                className={`rounded-pill border px-lg py-sm text-sm ${payments.includes(m) ? 'border-accent bg-accent text-white' : 'border-border bg-card text-text-primary hover:bg-accent-soft'}`}>
                {m}
              </button>
            ))}
          </div>
          {payments.includes('Zelle') && (
            <input type="text" value={zelleHandle} onChange={(e) => setZelleHandle(e.target.value)} placeholder="Zelle phone or email"
              className="mt-sm w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
          )}
          {payments.includes('Venmo') && (
            <input type="text" value={venmoHandle} onChange={(e) => setVenmoHandle(e.target.value)} placeholder="@username"
              className="mt-sm w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
          )}
        </div>

        <div className="flex gap-md pt-lg">
          <Button variant="secondary" onClick={() => router.back()} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={loading} className="flex-1">{loading ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>
    </PageContainer>
  );
}
