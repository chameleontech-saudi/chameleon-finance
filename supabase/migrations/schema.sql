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

-- Seed Partners (if not already existing in auth.users)
-- Standard Supabase structure for email auth users
-- Password hash: 'Chameleon2026!'
DO $$
DECLARE
  alex_id UUID := 'a1e00000-0000-0000-0000-000000000001';
  sarah_id UUID := '5a8a0000-0000-0000-0000-000000000002';
  marcus_id UUID := '3a8c0000-0000-0000-0000-000000000003';
  elena_id UUID := 'e1e80000-0000-0000-0000-000000000004';
  pw_hash TEXT := crypt('Chameleon2026!', gen_salt('bf', 10));
BEGIN
  -- Insert Alex Mercer
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'alex@chameleon.tech') THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user)
    VALUES (alex_id, '00000000-0000-0000-0000-000000000000', 'alex@chameleon.tech', pw_hash, now(), 'authenticated', '{"provider":"email","providers":["email"]}', '{"name":"Alex Mercer","avatar_url":"https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150","role":"Managing Partner"}', now(), now(), false);
  ELSE
    SELECT id INTO alex_id FROM auth.users WHERE email = 'alex@chameleon.tech';
  END IF;

  -- Insert Sarah Chen
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'sarah@chameleon.tech') THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user)
    VALUES (sarah_id, '00000000-0000-0000-0000-000000000000', 'sarah@chameleon.tech', pw_hash, now(), 'authenticated', '{"provider":"email","providers":["email"]}', '{"name":"Sarah Chen","avatar_url":"https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150","role":"Investment Director"}', now(), now(), false);
  ELSE
    SELECT id INTO sarah_id FROM auth.users WHERE email = 'sarah@chameleon.tech';
  END IF;

  -- Insert Marcus Thompson
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'marcus@chameleon.tech') THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user)
    VALUES (marcus_id, '00000000-0000-0000-0000-000000000000', 'marcus@chameleon.tech', pw_hash, now(), 'authenticated', '{"provider":"email","providers":["email"]}', '{"name":"Marcus Thompson","avatar_url":"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150","role":"Financial Officer"}', now(), now(), false);
  ELSE
    SELECT id INTO marcus_id FROM auth.users WHERE email = 'marcus@chameleon.tech';
  END IF;

  -- Insert Elena Rostova
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'elena@chameleon.tech') THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user)
    VALUES (elena_id, '00000000-0000-0000-0000-000000000000', 'elena@chameleon.tech', pw_hash, now(), 'authenticated', '{"provider":"email","providers":["email"]}', '{"name":"Elena Rostova","avatar_url":"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150","role":"Operations Partner"}', now(), now(), false);
  ELSE
    SELECT id INTO elena_id FROM auth.users WHERE email = 'elena@chameleon.tech';
  END IF;

  -- Seed Investments
  INSERT INTO public.investments (title, amount, date, investor_name, equity_percentage, description, created_by)
  VALUES 
    ('Series A Seed Funding', 500000.00, '2026-01-15', 'Vertex Capital', 10.00, 'Initial institutional funding for scaling the engineering team.', alex_id),
    ('Angel Follow-on Round', 125000.00, '2026-03-10', 'Elena Rostova', 2.50, 'Personal follow-on round for operational emergency runway.', elena_id),
    ('Strategic Partnership Invest', 250000.00, '2026-05-20', 'Chameleon Holdings', 5.00, 'Strategic equity injection for expanding Middle East footprint.', sarah_id);

  -- Seed Expenses
  INSERT INTO public.expenses (title, amount, date, category, description, status, created_by, approved_by, approved_at)
  VALUES 
    ('AWS Cloud Hosting & DB Storage', 4250.00, '2026-06-01', 'Software', 'Monthly AWS bill for staging and production servers.', 'Approved', alex_id, marcus_id, now()),
    ('Office Lease & Space Rental', 8500.00, '2026-06-05', 'Office', 'HQ office space rent for Q2.', 'Approved', elena_id, marcus_id, now()),
    ('Q2 Branding & Agency Retainer', 12000.00, '2026-06-12', 'Marketing', 'Agency fee for rebranding website and marketing collaterals.', 'Approved', sarah_id, alex_id, now()),
    ('New Employee Hardware (Macbooks)', 7800.00, '2026-06-18', 'Hardware', 'Purchased 3x MacBook Pro for new engineering hires.', 'Approved', marcus_id, alex_id, now()),
    ('Dubai FinTech Summit Travel & Lodging', 3200.00, '2026-07-02', 'Travel', 'Flights and hotels for Sarah and Alex to attend the summit.', 'Pending', sarah_id, NULL, NULL),
    ('Server Optimization Freelancer Fee', 1800.00, '2026-07-05', 'Payroll', 'Contract developer payout for optimization of SQL triggers.', 'Pending', alex_id, NULL, NULL),
    ('External Legal Counsel Retainer', 5000.00, '2026-07-08', 'Legal', 'Contract review and IP compliance filings.', 'Rejected', alex_id, marcus_id, now());
END $$;
