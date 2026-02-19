'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';

const HARVARD_DOMAINS: readonly string[] = [
  '@college.harvard.edu',
  '@fas.harvard.edu',
  '@harvard.edu',
  '@hbs.edu',
  '@hks.harvard.edu',
  '@law.harvard.edu',
  '@gsd.harvard.edu',
  '@hsph.harvard.edu',
];

const GENDER_OPTIONS: readonly string[] = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const HOUSE_OPTIONS: readonly string[] = [
  'Adams', 'Cabot', 'Currier', 'Dunster', 'Eliot', 'Kirkland',
  'Leverett', 'Lowell', 'Mather', 'Pforzheimer', 'Quincy',
  'Winthrop', 'Dudley', 'Off-campus',
];

const PAYMENT_OPTIONS: readonly string[] = ['Cash', 'Zelle', 'Venmo'];

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function SignupPage(): React.ReactElement {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Step 1 fields
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  // Step 2 fields
  const [harvardEmail, setHarvardEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [gradYear, setGradYear] = useState<string>('');
  const [house, setHouse] = useState<string>('');
  const [dormBuilding, setDormBuilding] = useState<string>('');
  const [dormRoom, setDormRoom] = useState<string>('');
  const [payments, setPayments] = useState<string[]>([]);
  const [zelleHandle, setZelleHandle] = useState<string>('');
  const [venmoHandle, setVenmoHandle] = useState<string>('');

  const currentYear = new Date().getFullYear();
  const yearOptions: number[] = Array.from({ length: 5 }, (_, i) => currentYear + i);

  const validateStep1 = (): boolean => {
    if (!firstName.trim()) { setError('First name is required'); return false; }
    if (!lastName.trim()) { setError('Last name is required'); return false; }
    if (!gender) { setError('Please select your gender'); return false; }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) { setError('Phone must be 10 digits'); return false; }
    setError('');
    return true;
  };

  const validateStep2 = (): boolean => {
    const emailLower = harvardEmail.trim().toLowerCase();
    if (!emailLower) { setError('Harvard email is required'); return false; }
    const validDomain = HARVARD_DOMAINS.some((d) => emailLower.endsWith(d));
    if (!validDomain) { setError('Must be a valid Harvard email address'); return false; }
    if (!password) { setError('Password is required'); return false; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return false; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return false; }
    if (!gradYear) { setError('Graduation year is required'); return false; }
    if (!house) { setError('House is required'); return false; }
    setError('');
    return true;
  };

  const handleStep1Submit = (e: FormEvent): void => {
    e.preventDefault();
    if (validateStep1()) setStep(2);
  };

  const handleStep2Submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!validateStep2()) return;
    setLoading(true);

    try {
      const supabase = createClient();
      const emailNormalized = harvardEmail.trim().toLowerCase();

      // Check if email already exists
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('harvard_email', emailNormalized)
        .maybeSingle();

      if (existingProfile) {
        setError('An account with this Harvard email already exists');
        setLoading(false);
        return;
      }

      // Create auth account with user-chosen password
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: emailNormalized,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (signUpError || !authData.user) {
        setError(signUpError?.message || 'Failed to create account');
        setLoading(false);
        return;
      }

      // Build dorm location string
      const dormParts = [dormBuilding.trim(), dormRoom.trim()].filter(Boolean);
      const dormLocation = dormParts.length > 0 ? dormParts.join(' ') : null;

      // Create user profile
      const { error: profileError } = await supabase.from('user_profiles').insert({
        id: authData.user.id,
        full_name: fullName,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        gender,
        phone_number: phone.replace(/\D/g, ''),
        harvard_email: emailNormalized,
        graduation_year: parseInt(gradYear),
        house,
        dorm_building: dormBuilding.trim() || null,
        dorm_room: dormRoom.trim() || null,
        dorm_location: dormLocation,
        payment_preference: payments.length > 0 ? payments.join(',') : null,
        zelle_handle: zelleHandle.trim() || null,
        venmo_handle: venmoHandle.trim() || null,
        login_preference: 'email_code',
        email_verified: true,
      });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        setError('Account created but profile setup failed. Please try logging in.');
        setLoading(false);
        return;
      }

      // Set session and redirect
      setSession(authData.session);
      router.push('/browse');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const togglePayment = (method: string): void => {
    setPayments((prev) =>
      prev.includes(method) ? prev.filter((p) => p !== method) : [...prev, method]
    );
  };

  return (
    <div>
      {/* Progress dots */}
      <div className="mb-2xl flex justify-center gap-sm">
        <div className={`h-2 w-2 rounded-full ${step === 1 ? 'bg-accent' : 'bg-border'}`} />
        <div className={`h-2 w-2 rounded-full ${step === 2 ? 'bg-accent' : 'bg-border'}`} />
      </div>

      {error && (
        <div className="mb-lg rounded-md bg-danger-soft px-lg py-md text-sm text-danger">
          {error}
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleStep1Submit} className="space-y-lg">
          <h2 className="font-heading text-h3 text-text-primary">Personal info</h2>

          <div className="grid grid-cols-2 gap-md">
            <div>
              <label htmlFor="firstName" className="mb-sm block text-sm text-text-secondary">
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
                autoComplete="given-name"
                className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="mb-sm block text-sm text-text-secondary">
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Your last name"
                autoComplete="family-name"
                className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-sm block text-sm text-text-secondary">Gender</label>
            <div className="flex flex-wrap gap-sm">
              {GENDER_OPTIONS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`rounded-pill border px-lg py-sm text-sm transition-colors ${
                    gender === g
                      ? 'border-accent bg-accent text-white'
                      : 'border-border bg-card text-text-primary hover:bg-accent-soft'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="mb-sm block text-sm text-text-secondary">
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(617) 555-1234"
              autoComplete="tel"
              className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-accent px-2xl py-lg text-md font-medium text-white transition-opacity hover:opacity-90"
          >
            Continue
          </button>

          <p className="text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-accent underline">
              Sign in
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleStep2Submit} className="space-y-lg">
          <div className="flex items-center gap-md">
            <button
              type="button"
              onClick={() => { setStep(1); setError(''); }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-text-primary hover:bg-accent-soft"
            >
              &larr;
            </button>
            <h2 className="font-heading text-h3 text-text-primary">Harvard details</h2>
          </div>

          <div>
            <label htmlFor="harvardEmail" className="mb-sm block text-sm text-text-secondary">
              Harvard email
            </label>
            <input
              id="harvardEmail"
              type="email"
              value={harvardEmail}
              onChange={(e) => setHarvardEmail(e.target.value)}
              placeholder="you@college.harvard.edu"
              autoComplete="email"
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
              placeholder="At least 6 characters"
              autoComplete="new-password"
              className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-sm block text-sm text-text-secondary">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-md">
            <div>
              <label htmlFor="gradYear" className="mb-sm block text-sm text-text-secondary">
                Graduation year
              </label>
              <select
                id="gradYear"
                value={gradYear}
                onChange={(e) => setGradYear(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary focus:border-accent focus:outline-none"
              >
                <option value="">Select year</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="house" className="mb-sm block text-sm text-text-secondary">
                House
              </label>
              <select
                id="house"
                value={house}
                onChange={(e) => setHouse(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary focus:border-accent focus:outline-none"
              >
                <option value="">Select house</option>
                {HOUSE_OPTIONS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-md">
            <div>
              <label htmlFor="dormBuilding" className="mb-sm block text-sm text-text-secondary">
                Dorm building <span className="text-text-muted">(optional)</span>
              </label>
              <input
                id="dormBuilding"
                type="text"
                value={dormBuilding}
                onChange={(e) => setDormBuilding(e.target.value)}
                placeholder="e.g. B-entry"
                className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="dormRoom" className="mb-sm block text-sm text-text-secondary">
                Dorm room <span className="text-text-muted">(optional)</span>
              </label>
              <input
                id="dormRoom"
                type="text"
                value={dormRoom}
                onChange={(e) => setDormRoom(e.target.value)}
                placeholder="e.g. 301"
                className="w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-sm block text-sm text-text-secondary">
              Payment preferences <span className="text-text-muted">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-sm">
              {PAYMENT_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePayment(p)}
                  className={`rounded-pill border px-lg py-sm text-sm transition-colors ${
                    payments.includes(p)
                      ? 'border-accent bg-accent text-white'
                      : 'border-border bg-card text-text-primary hover:bg-accent-soft'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {payments.includes('Zelle') && (
              <input
                type="text"
                value={zelleHandle}
                onChange={(e) => setZelleHandle(e.target.value)}
                placeholder="Zelle phone or email"
                className="mt-sm w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            )}
            {payments.includes('Venmo') && (
              <input
                type="text"
                value={venmoHandle}
                onChange={(e) => setVenmoHandle(e.target.value)}
                placeholder="@username"
                className="mt-sm w-full rounded-md border border-border bg-card px-md py-md text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-2xl py-lg text-md font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
      )}
    </div>
  );
}
