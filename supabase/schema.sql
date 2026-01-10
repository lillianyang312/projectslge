-- ============================================================================
-- Passive Shopping MVP - Database Schema
-- ============================================================================
-- This schema defines the core data model for the marketplace app:
-- - User profiles (extends auth.users)
-- - Items being sold
-- - Wants being searched for
-- - Swipe interactions
-- - Matches between buyer and seller
-- - Offers (price negotiation)
-- - Deals (post-match fulfillment)
-- - Messages (chat in match thread)
--
-- All tables include Row-Level Security (RLS) policies for data privacy.
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- profiles: User profile data (extends auth.users)
-- One profile per authenticated user
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    display_name text,
    avatar_url text,

    CONSTRAINT profile_id_not_empty CHECK (id IS NOT NULL)
);

-- items: Items being sold/offered
-- Owned by a single user (seller)
CREATE TABLE IF NOT EXISTS public.items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    title text NOT NULL,
    category text NOT NULL,
    condition text NOT NULL,
    photos text[] NOT NULL DEFAULT '{}'::text[],
    delivery_pref text NOT NULL,
    asking_price numeric,
    created_at timestamptz DEFAULT now(),

    CONSTRAINT item_title_not_empty CHECK (title != ''),
    CONSTRAINT item_category_not_empty CHECK (category != ''),
    CONSTRAINT item_asking_price_positive CHECK (asking_price IS NULL OR asking_price > 0)
);

-- wants: Items/categories being searched for
-- Owned by a single user (buyer)
CREATE TABLE IF NOT EXISTS public.wants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    query text NOT NULL,
    max_price numeric,
    urgency text NOT NULL DEFAULT 'normal',
    delivery_pref text NOT NULL,
    created_at timestamptz DEFAULT now(),

    CONSTRAINT want_query_not_empty CHECK (query != ''),
    CONSTRAINT want_urgency_valid CHECK (urgency IN ('low', 'normal', 'high')),
    CONSTRAINT want_max_price_positive CHECK (max_price IS NULL OR max_price > 0)
);

-- swipes: User interactions with items/wants (buy or sell mode)
-- Tracks when a user swipes on an item (to buy) or shows interest in a want
CREATE TABLE IF NOT EXISTS public.swipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    swiper_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    mode text NOT NULL CHECK (mode IN ('buy', 'sell')),
    target_id uuid NOT NULL,
    direction text NOT NULL CHECK (direction IN ('left', 'right')),
    created_at timestamptz DEFAULT now(),

    CONSTRAINT swipe_target_not_empty CHECK (target_id IS NOT NULL)
);

-- matches: A potential deal between buyer and seller for an item
-- Represents a buyer-seller connection for an item
CREATE TABLE IF NOT EXISTS public.matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id uuid NOT NULL REFERENCES public.profiles (id),
    seller_id uuid NOT NULL REFERENCES public.profiles (id),
    item_id uuid NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
    want_id uuid REFERENCES public.wants (id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at timestamptz DEFAULT now(),

    CONSTRAINT buyer_seller_different CHECK (buyer_id != seller_id),
    CONSTRAINT match_unique_per_item_pair UNIQUE (buyer_id, seller_id, item_id)
);

-- offers: Price negotiation within a match
-- Multiple offers can exist per match (counter-offers)
CREATE TABLE IF NOT EXISTS public.offers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
    from_user_id uuid NOT NULL REFERENCES public.profiles (id),
    amount numeric NOT NULL,
    status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'accepted', 'countered', 'declined')),
    created_at timestamptz DEFAULT now(),

    CONSTRAINT offer_amount_positive CHECK (amount > 0)
);

-- deals: Post-match fulfillment details (pickup/shipping)
-- Created when a match is accepted; contains fulfillment info
CREATE TABLE IF NOT EXISTS public.deals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL UNIQUE REFERENCES public.matches (id) ON DELETE CASCADE,
    fulfillment text NOT NULL CHECK (fulfillment IN ('pickup', 'shipping')),
    timeline_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- messages: Chat messages in a match thread
-- All messages within a match are grouped by match_id (thread_id)
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id uuid NOT NULL REFERENCES public.matches (id) ON DELETE CASCADE,
    sender text NOT NULL CHECK (sender IN ('user', 'agent')),
    sender_user_id uuid REFERENCES public.profiles (id),
    body text NOT NULL,
    created_at timestamptz DEFAULT now(),

    CONSTRAINT message_body_not_empty CHECK (body != ''),
    CONSTRAINT message_user_only_if_sender_user CHECK (
        (sender = 'user' AND sender_user_id IS NOT NULL) OR
        (sender = 'agent' AND sender_user_id IS NULL)
    )
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================
-- Improve query performance for common access patterns

CREATE INDEX IF NOT EXISTS idx_items_owner_id ON public.items (owner_id);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON public.items (created_at);

CREATE INDEX IF NOT EXISTS idx_wants_owner_id ON public.wants (owner_id);
CREATE INDEX IF NOT EXISTS idx_wants_created_at ON public.wants (created_at);

CREATE INDEX IF NOT EXISTS idx_swipes_swiper_id ON public.swipes (swiper_id);
CREATE INDEX IF NOT EXISTS idx_swipes_created_at ON public.swipes (created_at);

CREATE INDEX IF NOT EXISTS idx_matches_buyer_id ON public.matches (buyer_id);
CREATE INDEX IF NOT EXISTS idx_matches_seller_id ON public.matches (seller_id);
CREATE INDEX IF NOT EXISTS idx_matches_item_id ON public.matches (item_id);

CREATE INDEX IF NOT EXISTS idx_offers_match_id ON public.offers (match_id);
CREATE INDEX IF NOT EXISTS idx_offers_from_user_id ON public.offers (from_user_id);

CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON public.messages (thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at);

-- ============================================================================
-- 4. ROW-LEVEL SECURITY (RLS)
-- ============================================================================
-- Ensure users can only access data they own or are participants in

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES RLS
-- ============================================================================
-- Users can read all profiles (for display purposes)
-- Users can only write their own profile

CREATE POLICY "profiles_select_all" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own" ON public.profiles
    FOR DELETE USING (auth.uid() = id);

-- ============================================================================
-- ITEMS RLS
-- ============================================================================
-- Users can read all items (public listing)
-- Users can only insert/update/delete their own items

CREATE POLICY "items_select_all" ON public.items
    FOR SELECT USING (true);

CREATE POLICY "items_insert_own" ON public.items
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "items_update_own" ON public.items
    FOR UPDATE USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "items_delete_own" ON public.items
    FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================================
-- WANTS RLS
-- ============================================================================
-- Users can read all wants (public listing)
-- Users can only insert/update/delete their own wants

CREATE POLICY "wants_select_all" ON public.wants
    FOR SELECT USING (true);

CREATE POLICY "wants_insert_own" ON public.wants
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "wants_update_own" ON public.wants
    FOR UPDATE USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "wants_delete_own" ON public.wants
    FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================================
-- SWIPES RLS
-- ============================================================================
-- Users can only read/insert/update/delete their own swipes

CREATE POLICY "swipes_select_own" ON public.swipes
    FOR SELECT USING (auth.uid() = swiper_id);

CREATE POLICY "swipes_insert_own" ON public.swipes
    FOR INSERT WITH CHECK (auth.uid() = swiper_id);

CREATE POLICY "swipes_delete_own" ON public.swipes
    FOR DELETE USING (auth.uid() = swiper_id);

-- ============================================================================
-- MATCHES RLS
-- ============================================================================
-- Users can only read matches they're involved in (as buyer or seller)
-- Only participants can insert/update/delete

CREATE POLICY "matches_select_own" ON public.matches
    FOR SELECT USING (
        auth.uid() = buyer_id OR auth.uid() = seller_id
    );

CREATE POLICY "matches_insert_own" ON public.matches
    FOR INSERT WITH CHECK (
        auth.uid() = buyer_id OR auth.uid() = seller_id
    );

CREATE POLICY "matches_update_own" ON public.matches
    FOR UPDATE USING (
        auth.uid() = buyer_id OR auth.uid() = seller_id
    )
    WITH CHECK (
        auth.uid() = buyer_id OR auth.uid() = seller_id
    );

CREATE POLICY "matches_delete_own" ON public.matches
    FOR DELETE USING (
        auth.uid() = buyer_id OR auth.uid() = seller_id
    );

-- ============================================================================
-- OFFERS RLS
-- ============================================================================
-- Users can only read offers in matches they're involved in
-- Only participants can insert/update/delete

CREATE POLICY "offers_select_own" ON public.offers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE public.matches.id = public.offers.match_id
            AND (public.matches.buyer_id = auth.uid() OR public.matches.seller_id = auth.uid())
        )
    );

CREATE POLICY "offers_insert_own" ON public.offers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE public.matches.id = match_id
            AND (public.matches.buyer_id = auth.uid() OR public.matches.seller_id = auth.uid())
        )
    );

CREATE POLICY "offers_update_own" ON public.offers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE public.matches.id = public.offers.match_id
            AND (public.matches.buyer_id = auth.uid() OR public.matches.seller_id = auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE public.matches.id = public.offers.match_id
            AND (public.matches.buyer_id = auth.uid() OR public.matches.seller_id = auth.uid())
        )
    );

CREATE POLICY "offers_delete_own" ON public.offers
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE public.matches.id = public.offers.match_id
            AND (public.matches.buyer_id = auth.uid() OR public.matches.seller_id = auth.uid())
        )
    );

-- ============================================================================
-- DEALS RLS
-- ============================================================================
-- Users can only read/update deals in matches they're involved in

CREATE POLICY "deals_select_own" ON public.deals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE public.matches.id = public.deals.match_id
            AND (public.matches.buyer_id = auth.uid() OR public.matches.seller_id = auth.uid())
        )
    );

CREATE POLICY "deals_insert_own" ON public.deals
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE public.matches.id = match_id
            AND (public.matches.buyer_id = auth.uid() OR public.matches.seller_id = auth.uid())
        )
    );

CREATE POLICY "deals_update_own" ON public.deals
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE public.matches.id = public.deals.match_id
            AND (public.matches.buyer_id = auth.uid() OR public.matches.seller_id = auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE public.matches.id = public.deals.match_id
            AND (public.matches.buyer_id = auth.uid() OR public.matches.seller_id = auth.uid())
        )
    );

CREATE POLICY "deals_delete_own" ON public.deals
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE public.matches.id = public.deals.match_id
            AND (public.matches.buyer_id = auth.uid() OR public.matches.seller_id = auth.uid())
        )
    );

-- ============================================================================
-- MESSAGES RLS
-- ============================================================================
-- Users can only read messages in matches they're involved in
-- Only participants can insert new messages

CREATE POLICY "messages_select_own" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE public.matches.id = public.messages.thread_id
            AND (public.matches.buyer_id = auth.uid() OR public.matches.seller_id = auth.uid())
        )
    );

CREATE POLICY "messages_insert_own" ON public.messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE public.matches.id = thread_id
            AND (public.matches.buyer_id = auth.uid() OR public.matches.seller_id = auth.uid())
        )
        AND (sender = 'user' AND sender_user_id = auth.uid() OR sender = 'agent')
    );

CREATE POLICY "messages_delete_own" ON public.messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE public.matches.id = public.messages.thread_id
            AND (public.matches.buyer_id = auth.uid() OR public.matches.seller_id = auth.uid())
        )
    );

-- ============================================================================
-- 5. NOTES
-- ============================================================================
-- - All UUIDs use gen_random_uuid() for secure random IDs
-- - Timestamps use timestamptz for proper timezone handling
-- - Foreign keys use ON DELETE CASCADE for automatic cleanup
-- - RLS policies use auth.uid() for the current authenticated user
-- - Indexes are created on common query patterns (owner_id, created_at, etc.)
-- - All constraints enforce data consistency
--
-- To test RLS policies, use a Supabase client with auth context.
-- The smoke test script demonstrates CRUD operations with proper auth.
-- ============================================================================
