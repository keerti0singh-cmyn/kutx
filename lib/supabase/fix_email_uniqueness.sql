-- STEP 1: Identify and Handle Duplicates
-- This script keeps the oldest record (based on created_at) and removes others for the same email.

-- Note: If you have a custom 'users' table in the 'public' schema, run this:
-- (If your table is named differently, please adjust the table name)

-- 1. Remove duplicates keeping the oldest record
DELETE FROM public.users
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at ASC) as row_num
        FROM public.users
    ) t
    WHERE t.row_num > 1
);

-- 2. Add the UNIQUE constraint to the email column
ALTER TABLE public.users
ADD CONSTRAINT users_email_key UNIQUE (email);

-- 3. Ensure the email column is NOT NULL
ALTER TABLE public.users
ALTER COLUMN email SET NOT NULL;


-- STEP 2: Handle Supabase Auth (if applicable)
-- Supabase Auth already handles email uniqueness by default.
-- If you are experiencing duplicates in auth.users, it usually means 
-- 'Confirm Email' is disabled and multiple signups happened before confirmation.
-- This script primarily targets your custom public.users table as requested.
