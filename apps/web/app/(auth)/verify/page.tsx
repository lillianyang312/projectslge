'use client';

import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';

type SignupData = {
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  harvardEmail: string;
  gradYear: number;
  house: string;
  dormBuilding?: string;
  dormRoom?: string;
  payments: string[];
  zelleHandle?: string;
  venmoHandle?: string;
};

function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function VerifyPage(): React.ReactElement {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [signupData, setSignupData] = useState<SignupData | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const stored = sessionStorage.getItem('signupData');
    if (!stored) {
      router.push('/signup');
      return;
    }
    setSignupData(JSON.parse(stored) as SignupData);
  }, [router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleChange = (index: number, value: string): void => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent): void => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    if (pasted.length > 0) {
      const focusIndex = Math.min(pasted.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const handleVerify = async (): Promise<void> => {
    if (!signupData) return;
    const codeString = code.join('');
    if (codeString.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const supabase = createClient();

      // Verify the code
      const { data: verifyResult, error: verifyError } = await supabase.functions.invoke(
        'verifyEmailCode',
        { body: { email: signupData.harvardEmail, code: codeString } }
      );

      if (verifyError || !verifyResult?.valid) {
        setError('Invalid or expired code. Please try again.');
        setLoading(false);
        return;
      }

      // Create auth account
      const password = generatePassword();
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: signupData.harvardEmail,
        password,
        options: {
          data: {
            full_name: `${signupData.firstName} ${signupData.lastName}`,
          },
        },
      });

      if (signUpError || !authData.user) {
        setError(signUpError?.message || 'Failed to create account');
        setLoading(false);
        return;
      }

      // Build dorm location string
      const dormParts = [signupData.dormBuilding, signupData.dormRoom].filter(Boolean);
      const dormLocation = dormParts.length > 0 ? dormParts.join(' ') : null;

      // Create user profile
      const { error: profileError } = await supabase.from('user_profiles').insert({
        id: authData.user.id,
        full_name: `${signupData.firstName} ${signupData.lastName}`,
        first_name: signupData.firstName,
        last_name: signupData.lastName,
        gender: signupData.gender,
        phone_number: signupData.phone,
        harvard_email: signupData.harvardEmail,
        graduation_year: signupData.gradYear,
        house: signupData.house,
        dorm_building: signupData.dormBuilding || null,
        dorm_room: signupData.dormRoom || null,
        dorm_location: dormLocation,
        payment_preference: signupData.payments.length > 0 ? signupData.payments.join(',') : null,
        zelle_handle: signupData.zelleHandle || null,
        venmo_handle: signupData.venmoHandle || null,
        login_preference: 'email_code',
        email_verified: true,
      });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        setError('Account created but profile setup failed. Please try logging in.');
        setLoading(false);
        return;
      }

      // Clear signup data and redirect
      sessionStorage.removeItem('signupData');
      setSession(authData.session);
      router.push('/browse');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    if (!signupData || resendCooldown > 0) return;

    try {
      const supabase = createClient();
      await supabase.functions.invoke('sendVerificationEmail', {
        body: { email: signupData.harvardEmail },
      });
      setResendCooldown(60);
    } catch {
      setError('Failed to resend code');
    }
  };

  if (!signupData) return <div />;

  return (
    <div className="space-y-2xl">
      <div className="text-center">
        <h2 className="font-heading text-h3 text-text-primary">Verify your email</h2>
        <p className="mt-sm text-sm text-text-secondary">
          We sent a 6-digit code to{' '}
          <span className="font-medium text-text-primary">{signupData.harvardEmail}</span>
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-danger-soft px-lg py-md text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex justify-center gap-md" onPaste={handlePaste}>
        {code.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="h-14 w-12 rounded-md border border-border bg-card text-center text-xl font-medium text-text-primary focus:border-accent focus:outline-none"
          />
        ))}
      </div>

      <button
        onClick={handleVerify}
        disabled={loading || code.some((d) => !d)}
        className="w-full rounded-md bg-accent px-2xl py-lg text-md font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Verifying...' : 'Verify & create account'}
      </button>

      <p className="text-center text-sm text-text-secondary">
        Didn&apos;t receive a code?{' '}
        <button
          onClick={handleResend}
          disabled={resendCooldown > 0}
          className="font-medium text-accent underline disabled:text-text-muted disabled:no-underline"
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
        </button>
      </p>
    </div>
  );
}
