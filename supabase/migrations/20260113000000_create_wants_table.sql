-- Create wants table (items/categories being searched for)
-- Owned by a single user (buyer) - uses auth.users directly instead of profiles
CREATE TABLE IF NOT EXISTS public.wants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    query text NOT NULL,
    max_price numeric,
    urgency text NOT NULL DEFAULT 'normal',
    delivery_pref text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    CONSTRAINT want_query_not_empty CHECK (query != ''),
    CONSTRAINT want_urgency_valid CHECK (urgency IN ('low', 'normal', 'high')),
    CONSTRAINT want_max_price_positive CHECK (max_price IS NULL OR max_price > 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wants_owner_id ON public.wants (owner_id);
CREATE INDEX IF NOT EXISTS idx_wants_created_at ON public.wants (created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.wants ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own wants
CREATE POLICY "Users can view their own wants"
  ON public.wants FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own wants"
  ON public.wants FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own wants"
  ON public.wants FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own wants"
  ON public.wants FOR DELETE
  USING (auth.uid() = owner_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_wants_updated_at BEFORE UPDATE ON public.wants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
