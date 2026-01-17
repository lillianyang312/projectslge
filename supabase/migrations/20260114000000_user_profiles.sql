-- User Profiles table for Harvard-specific user data
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Panel 1 fields
  full_name TEXT NOT NULL,
  gender TEXT, -- 'male', 'female', 'non-binary', 'prefer_not_to_say'
  phone_number TEXT,
  -- Panel 2 fields
  harvard_email TEXT UNIQUE NOT NULL,
  graduation_year INTEGER,
  house TEXT, -- Harvard house name
  dorm_building TEXT,
  dorm_room TEXT,
  -- Login preferences
  login_preference TEXT DEFAULT 'biometric', -- 'biometric', 'email_code'
  -- Verification
  email_verified BOOLEAN DEFAULT false,
  phone_verified BOOLEAN DEFAULT false,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS user_profiles_harvard_email_idx ON user_profiles(harvard_email);
CREATE INDEX IF NOT EXISTS user_profiles_phone_idx ON user_profiles(phone_number);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own profile
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Update trigger for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Email verification codes table
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for code lookups
CREATE INDEX IF NOT EXISTS email_verification_codes_email_idx ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS email_verification_codes_expires_idx ON email_verification_codes(expires_at);

-- RLS for verification codes (service role only for security)
ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Only service role can access verification codes
CREATE POLICY "Service role can manage verification codes"
  ON email_verification_codes FOR ALL
  USING (auth.role() = 'service_role');

-- Function to generate a 6-digit verification code
CREATE OR REPLACE FUNCTION generate_verification_code()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to create a verification code for an email
CREATE OR REPLACE FUNCTION create_verification_code(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Generate new code
  v_code := generate_verification_code();

  -- Invalidate any existing codes for this email
  UPDATE email_verification_codes
  SET used = true
  WHERE email = p_email AND used = false;

  -- Insert new code (expires in 10 minutes)
  INSERT INTO email_verification_codes (email, code, expires_at)
  VALUES (p_email, v_code, now() + INTERVAL '10 minutes');

  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify a code
CREATE OR REPLACE FUNCTION verify_email_code(p_email TEXT, p_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  -- Check if code is valid and not expired
  SELECT EXISTS (
    SELECT 1 FROM email_verification_codes
    WHERE email = p_email
      AND code = p_code
      AND used = false
      AND expires_at > now()
  ) INTO v_valid;

  IF v_valid THEN
    -- Mark code as used
    UPDATE email_verification_codes
    SET used = true
    WHERE email = p_email AND code = p_code;
  END IF;

  RETURN v_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
