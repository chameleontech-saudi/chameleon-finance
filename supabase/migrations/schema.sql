-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clean up existing tables if they exist
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.investments CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'Partner',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Allow update for owners" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Create trigger function that handles new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'role', 'Partner')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on sign up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create investments table
CREATE TABLE public.investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  investor_name TEXT NOT NULL,
  equity_percentage NUMERIC(5, 2),
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for investments
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON public.investments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON public.investments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Software', 'Marketing', 'Hardware', 'Travel', 'Payroll', 'Office', 'Legal', 'Other')),
  description TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON public.expenses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Allow authenticated update" ON public.expenses
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Seed the single admin account (if not already existing in auth.users).
-- Standard Supabase structure for email auth users.
-- Password: 'Chameleon2026!'
-- No demo partners, investments, or expenses are seeded — the ledger starts empty
-- and is populated with real data through the app.
DO $$
DECLARE
  admin_id UUID := 'ad100000-0000-0000-0000-000000000005';
  pw_hash TEXT := crypt('Chameleon2026!', gen_salt('bf', 10));
BEGIN
  -- Insert Admin User
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@chameleontech.com') THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user)
    VALUES (admin_id, '00000000-0000-0000-0000-000000000000', 'admin@chameleontech.com', pw_hash, now(), 'authenticated', '{"provider":"email","providers":["email"]}', '{"name":"Admin Partner","avatar_url":null,"role":"Managing Partner"}', now(), now(), false);
  ELSE
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@chameleontech.com';
  END IF;

  -- Ensure the admin profile exists (needed if the user already exists in
  -- auth.users but the profiles table was dropped/recreated).
  INSERT INTO public.profiles (id, name, email, avatar_url, role)
  VALUES
    (admin_id, 'Admin Partner', 'admin@chameleontech.com', null, 'Managing Partner')
  ON CONFLICT (id) DO NOTHING;
END $$;
