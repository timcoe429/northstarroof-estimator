-- Company-based database restructure migration
-- Wrapped in transaction for atomicity - if anything fails, entire migration rolls back

BEGIN;

-- ============================================================================
-- 1. Create companies table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Seed Northstar Roofing company with fixed UUID for consistent references
INSERT INTO public.companies (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Northstar Roofing')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Add company_id to profiles table
-- ============================================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Migrate existing profiles to Northstar Roofing
UPDATE public.profiles 
SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- Make company_id required
ALTER TABLE public.profiles 
ALTER COLUMN company_id SET NOT NULL;

-- ============================================================================
-- 3. Add company_id to data tables and migrate existing data
-- ============================================================================

-- price_items: Add company_id column
ALTER TABLE public.price_items 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Migrate existing price_items: copy company_id from user's profile
UPDATE public.price_items t 
SET company_id = p.company_id 
FROM public.profiles p 
WHERE t.user_id = p.id 
  AND t.company_id IS NULL;

-- Make company_id required for price_items
ALTER TABLE public.price_items 
ALTER COLUMN company_id SET NOT NULL;

-- Make user_id nullable (no longer used for access control)
ALTER TABLE public.price_items 
ALTER COLUMN user_id DROP NOT NULL;

-- estimates: Add company_id column
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Migrate existing estimates: copy company_id from user's profile
UPDATE public.estimates t 
SET company_id = p.company_id 
FROM public.profiles p 
WHERE t.user_id = p.id 
  AND t.company_id IS NULL;

-- Make company_id required for estimates
ALTER TABLE public.estimates 
ALTER COLUMN company_id SET NOT NULL;

-- Keep user_id required (for audit tracking who created it)
-- But ensure it doesn't cascade delete
-- Check if foreign key exists and modify it
DO $$
BEGIN
  -- Drop existing foreign key if it has cascade delete
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'estimates_user_id_fkey' 
    AND confdeltype = 'c'
  ) THEN
    ALTER TABLE public.estimates 
    DROP CONSTRAINT estimates_user_id_fkey;
  END IF;
  
  -- Recreate without cascade delete
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'estimates_user_id_fkey'
  ) THEN
    ALTER TABLE public.estimates 
    ADD CONSTRAINT estimates_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- customers: Add company_id column
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Migrate existing customers: copy company_id from user's profile
UPDATE public.customers t 
SET company_id = p.company_id 
FROM public.profiles p 
WHERE t.user_id = p.id 
  AND t.company_id IS NULL;

-- Make company_id required for customers
ALTER TABLE public.customers 
ALTER COLUMN company_id SET NOT NULL;

-- Make user_id nullable (no longer used for access control)
ALTER TABLE public.customers 
ALTER COLUMN user_id DROP NOT NULL;

-- ============================================================================
-- 4. Drop ALL existing RLS policies
-- ============================================================================

-- Drop price_items policies
DROP POLICY IF EXISTS "price_items_select" ON public.price_items;
DROP POLICY IF EXISTS "price_items_insert" ON public.price_items;
DROP POLICY IF EXISTS "price_items_update" ON public.price_items;
DROP POLICY IF EXISTS "price_items_delete" ON public.price_items;
DROP POLICY IF EXISTS "Users can view own price items" ON public.price_items;
DROP POLICY IF EXISTS "Users can insert own price items" ON public.price_items;
DROP POLICY IF EXISTS "Users can update own price items" ON public.price_items;
DROP POLICY IF EXISTS "Users can delete own price items" ON public.price_items;

-- Drop estimates policies
DROP POLICY IF EXISTS "estimates_select" ON public.estimates;
DROP POLICY IF EXISTS "estimates_insert" ON public.estimates;
DROP POLICY IF EXISTS "estimates_update" ON public.estimates;
DROP POLICY IF EXISTS "estimates_delete" ON public.estimates;
DROP POLICY IF EXISTS "Users can view own estimates" ON public.estimates;
DROP POLICY IF EXISTS "Users can insert own estimates" ON public.estimates;
DROP POLICY IF EXISTS "Users can update own estimates" ON public.estimates;
DROP POLICY IF EXISTS "Users can delete own estimates" ON public.estimates;

-- Drop customers policies
DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_update" ON public.customers;
DROP POLICY IF EXISTS "customers_delete" ON public.customers;
DROP POLICY IF EXISTS "Users can view own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can insert own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can delete own customers" ON public.customers;

-- Drop profiles policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Drop companies policies (if any exist)
DROP POLICY IF EXISTS "companies_select" ON public.companies;

-- Drop vendor_quotes policies
DROP POLICY IF EXISTS "vendor_quotes_select_own_estimate" ON public.vendor_quotes;
DROP POLICY IF EXISTS "vendor_quotes_insert_own_estimate" ON public.vendor_quotes;
DROP POLICY IF EXISTS "vendor_quotes_update_own_estimate" ON public.vendor_quotes;
DROP POLICY IF EXISTS "vendor_quotes_delete_own_estimate" ON public.vendor_quotes;

-- Drop vendor_quote_items policies
DROP POLICY IF EXISTS "vendor_quote_items_select_own_estimate" ON public.vendor_quote_items;
DROP POLICY IF EXISTS "vendor_quote_items_insert_own_estimate" ON public.vendor_quote_items;
DROP POLICY IF EXISTS "vendor_quote_items_update_own_estimate" ON public.vendor_quote_items;
DROP POLICY IF EXISTS "vendor_quote_items_delete_own_estimate" ON public.vendor_quote_items;

-- ============================================================================
-- 5. Create new RLS policies based on company_id
-- ============================================================================

-- price_items policies: Company-based access
CREATE POLICY "price_items_select" ON public.price_items
FOR SELECT TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "price_items_insert" ON public.price_items
FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "price_items_update" ON public.price_items
FOR UPDATE TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "price_items_delete" ON public.price_items
FOR DELETE TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- estimates policies: Company-based access
CREATE POLICY "estimates_select" ON public.estimates
FOR SELECT TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "estimates_insert" ON public.estimates
FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "estimates_update" ON public.estimates
FOR UPDATE TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "estimates_delete" ON public.estimates
FOR DELETE TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- customers policies: Company-based access
CREATE POLICY "customers_select" ON public.customers
FOR SELECT TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "customers_insert" ON public.customers
FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "customers_update" ON public.customers
FOR UPDATE TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "customers_delete" ON public.customers
FOR DELETE TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- profiles policies: Company-based read, own update
CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "profiles_update" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid());

-- companies policies: Users can read their own company
CREATE POLICY "companies_select" ON public.companies
FOR SELECT TO authenticated
USING (
  id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- vendor_quotes policies: Access through estimate's company
CREATE POLICY "vendor_quotes_select" ON public.vendor_quotes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = vendor_quotes.estimate_id
    AND e.company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "vendor_quotes_insert" ON public.vendor_quotes
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = vendor_quotes.estimate_id
    AND e.company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "vendor_quotes_update" ON public.vendor_quotes
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = vendor_quotes.estimate_id
    AND e.company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "vendor_quotes_delete" ON public.vendor_quotes
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = vendor_quotes.estimate_id
    AND e.company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

-- vendor_quote_items policies: Access through vendor_quote → estimate → company
CREATE POLICY "vendor_quote_items_select" ON public.vendor_quote_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_quotes vq
    JOIN public.estimates e ON e.id = vq.estimate_id
    WHERE vq.id = vendor_quote_items.vendor_quote_id
    AND e.company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "vendor_quote_items_insert" ON public.vendor_quote_items
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vendor_quotes vq
    JOIN public.estimates e ON e.id = vq.estimate_id
    WHERE vq.id = vendor_quote_items.vendor_quote_id
    AND e.company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "vendor_quote_items_update" ON public.vendor_quote_items
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_quotes vq
    JOIN public.estimates e ON e.id = vq.estimate_id
    WHERE vq.id = vendor_quote_items.vendor_quote_id
    AND e.company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "vendor_quote_items_delete" ON public.vendor_quote_items
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_quotes vq
    JOIN public.estimates e ON e.id = vq.estimate_id
    WHERE vq.id = vendor_quote_items.vendor_quote_id
    AND e.company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

COMMIT;
