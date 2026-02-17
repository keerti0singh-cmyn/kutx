-- ============================================
-- 👤 PRODUCTION SCHEMA REPAIRS (SUPABASE)
-- ============================================

-- 1. Ensure Username Uniqueness on Profiles
-- This handles existing duplicates by keeping the oldest and adding a unique constraint.

DELETE FROM public.profiles
WHERE id NOT IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY LOWER(username) ORDER BY created_at ASC) as row_num
        FROM public.profiles
    ) t
    WHERE t.row_num = 1
);

-- Use a unique partial index for case-insensitive uniqueness if not already present
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_lowercase_username ON public.profiles (LOWER(username));

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_stories_expiry ON public.stories(expires_at);

-- 3. RLS Policy Review & Strengthening
-- Note: Ensure these tables have RLS enabled in the dashboard.

-- Example: Strict Message Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only see messages they sent or received" ON public.messages;
CREATE POLICY "Users can only see messages they sent or received"
ON public.messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can only insert their own messages" ON public.messages;
CREATE POLICY "Users can only insert their own messages"
ON public.messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Example: Profile Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

-- 4. Story Cleanup Logic
-- This function deletes stories that have passed their expires_at time.
-- You can run this manually: SELECT delete_expired_stories();
-- Or schedule it via pg_cron (if available) or an Edge Function.

CREATE OR REPLACE FUNCTION delete_expired_stories()
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.stories
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Auto-cleanup trigger (Optional alternative to CRON)
-- Deletes expired stories whenever a new story is posted.
CREATE OR REPLACE FUNCTION trigger_cleanup_stories()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM delete_expired_stories();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_cleanup_stories ON public.stories;
CREATE TRIGGER tr_cleanup_stories
AFTER INSERT ON public.stories
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_cleanup_stories();
