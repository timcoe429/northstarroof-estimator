-- Add sales tax, final price, and section headers to estimates table

-- Sales tax fields
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS sales_tax_percent numeric DEFAULT 10;

ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS sales_tax_amount numeric DEFAULT 0;

ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS final_price numeric DEFAULT 0;

-- Section headers (stored as JSONB)
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS section_headers jsonb;

-- Ensure sundries_amount exists (may have been added in previous migration)
ALTER TABLE public.estimates 
ADD COLUMN IF NOT EXISTS sundries_amount numeric DEFAULT 0;
