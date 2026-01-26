-- Normalize email verification functions to handle case-insensitive email matching
-- This ensures codes work regardless of email case variations

-- Update create_verification_code to normalize email before storing
CREATE OR REPLACE FUNCTION create_verification_code(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_normalized_email TEXT;
BEGIN
  -- Normalize email to lowercase
  v_normalized_email := LOWER(TRIM(p_email));
  
  -- Generate new code
  v_code := generate_verification_code();

  -- Invalidate any existing codes for this email (case-insensitive)
  UPDATE email_verification_codes
  SET used = true
  WHERE LOWER(TRIM(email)) = v_normalized_email AND used = false;

  -- Insert new code (expires in 10 minutes) with normalized email
  INSERT INTO email_verification_codes (email, code, expires_at)
  VALUES (v_normalized_email, v_code, now() + INTERVAL '10 minutes');

  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update verify_email_code to normalize email before verification
CREATE OR REPLACE FUNCTION verify_email_code(p_email TEXT, p_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_valid BOOLEAN;
  v_normalized_email TEXT;
BEGIN
  -- Normalize email to lowercase
  v_normalized_email := LOWER(TRIM(p_email));
  
  -- Check if code is valid and not expired (case-insensitive email matching)
  SELECT EXISTS (
    SELECT 1 FROM email_verification_codes
    WHERE LOWER(TRIM(email)) = v_normalized_email
      AND code = p_code
      AND used = false
      AND expires_at > now()
  ) INTO v_valid;

  IF v_valid THEN
    -- Mark code as used (case-insensitive email matching)
    UPDATE email_verification_codes
    SET used = true
    WHERE LOWER(TRIM(email)) = v_normalized_email AND code = p_code;
  END IF;

  RETURN v_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also normalize existing codes in the database (optional cleanup)
UPDATE email_verification_codes
SET email = LOWER(TRIM(email))
WHERE email != LOWER(TRIM(email));
