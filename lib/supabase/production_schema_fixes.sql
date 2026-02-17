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

-- 3. Presence Tracking Support
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Sync emails from auth.users to profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;

-- Trigger to keep email in sync for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_email_sync()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles
    SET email = NEW.email
    WHERE user_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_email_on_auth_change ON auth.users;
CREATE TRIGGER tr_sync_email_on_auth_change
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_email_sync();

CREATE OR REPLACE FUNCTION public.handle_user_heartbeat(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET status = 'online',
        last_heartbeat_at = NOW(),
        last_seen_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.mark_inactive_users_offline()
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET status = 'offline'
    WHERE status = 'online'
      AND (NOW() - last_heartbeat_at) > INTERVAL '60 seconds';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Audio Call Signaling Table
CREATE TABLE IF NOT EXISTS public.active_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'ringing', -- ringing, accepted, rejected, ended
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_active_calls_receiver ON public.active_calls(receiver_id, status);

ALTER TABLE public.active_calls ENABLE ROW LEVEL SECURITY;

-- Call Policies
DROP POLICY IF EXISTS "Users can see calls they are involved in" ON public.active_calls;
CREATE POLICY "Users can see calls they are involved in"
ON public.active_calls FOR SELECT
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can initiate calls" ON public.active_calls;
CREATE POLICY "Users can initiate calls"
ON public.active_calls FOR INSERT
WITH CHECK (auth.uid() = caller_id);

DROP POLICY IF EXISTS "Users can update their own calls" ON public.active_calls;
CREATE POLICY "Users can update their own calls"
ON public.active_calls FOR UPDATE
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- 5. Story Cleanup Logic
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

-- 6. Re-apply RLS for tables modified/added
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
